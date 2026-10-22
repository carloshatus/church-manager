import { Peer, type DataConnection } from 'peerjs';
import type { Invoice } from '@/domain/entities/invoice';
import type {
  InvoiceSummary,
  P2PMessage,
  SyncProgress,
} from '@/domain/entities/p2p-sync';
import { SyncDiffService } from '@/domain/services/sync-diff.service';
import type { IP2PSyncAdapter } from '@/ports/p2p-sync-adapter.port';
import {
  splitBlobIntoChunks,
  ChunkCollector,
} from './chunk-transfer.utils';

export class PeerJSSyncAdapter implements IP2PSyncAdapter {
  private peer: Peer | null = null;
  private activeConnection: DataConnection | null = null;
  private progressCallback: ((progress: SyncProgress) => void) | null = null;

  onProgress(callback: (progress: SyncProgress) => void): void {
    this.progressCallback = callback;
  }

  private notifyProgress(progress: SyncProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  /**
   * Inicia o modo Host (Receptor) aguardando conexão do aparelho emissor.
   */
  async startHostSession(
    localInvoices: Invoice[],
    onInvoicesReceived: (invoices: Invoice[]) => Promise<void>
  ): Promise<{ peerId: string; qrPayload: string }> {
    this.disconnect();

    this.notifyProgress({
      phase: 'HANDSHAKE',
      current: 0,
      total: 0,
      message: 'Iniciando sessão P2P e gerando QR Code...',
    });

    return new Promise((resolve, reject) => {
      // Gera ID curto e amigável para a sala
      const prefix = 'cm-';
      const randomSuffix = Math.random().toString(36).substring(2, 9);
      const generatedId = `${prefix}${randomSuffix}`;

      const peer = new Peer(generatedId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer = peer;

      peer.on('open', (id) => {
        const qrPayload = SyncDiffService.formatPairingPayload(id);
        this.notifyProgress({
          phase: 'HANDSHAKE',
          current: 0,
          total: 0,
          message: 'Aguardando leitura do QR Code pelo celular...',
        });
        resolve({ peerId: id, qrPayload });
      });

      peer.on('error', (err) => {
        this.notifyProgress({
          phase: 'ERROR',
          current: 0,
          total: 0,
          message: `Falha na sinalização P2P: ${err.message}`,
        });
        reject(err);
      });

      // Escuta conexão de entrada do cliente
      peer.on('connection', (conn) => {
        this.setupHostConnection(conn, localInvoices, onInvoicesReceived);
      });
    });
  }

  /**
   * Configura o canal de dados no Host quando o cliente conecta.
   */
  private setupHostConnection(
    conn: DataConnection,
    localInvoices: Invoice[],
    onInvoicesReceived: (invoices: Invoice[]) => Promise<void>
  ): void {
    this.activeConnection = conn;

    this.notifyProgress({
      phase: 'HANDSHAKE',
      current: 0,
      total: 0,
      message: 'Dispositivo conectado! Negociando dados...',
    });

    const localSummaries = localInvoices.map(SyncDiffService.createInvoiceSummary);

    // Estruturas de agregação durante a transmissão
    interface PendingInvoice {
      data?: Omit<Invoice, 'id' | 'imageBlob'>;
      hasImageBlob: boolean;
      collector?: ChunkCollector;
    }

    const pendingInvoices = new Map<string, PendingInvoice>();
    let totalExpectedInvoices = 0;
    let completedInvoicesCount = 0;

    conn.on('data', (raw: unknown) => {
      const msg = raw as P2PMessage;

      if (msg.type === 'HELLO') {
        this.notifyProgress({
          phase: 'DIFFING',
          current: 0,
          total: msg.invoicesSummary.length,
          message: `Comparando ${msg.invoicesSummary.length} notas recebidas...`,
        });

        // Identifica quais notas precisam ser solicitadas
        const neededAccessKeys = SyncDiffService.determineNeededAccessKeys(
          localSummaries,
          msg.invoicesSummary
        );

        totalExpectedInvoices = neededAccessKeys.length;

        if (neededAccessKeys.length === 0) {
          this.notifyProgress({
            phase: 'DONE',
            current: 0,
            total: 0,
            message: 'Todas as notas já estão sincronizadas e atualizadas!',
          });
          conn.send({
            type: 'REQUEST_INVOICES',
            neededAccessKeys: [],
          });
          return;
        }

        this.notifyProgress({
          phase: 'RECEIVING_DATA',
          current: 0,
          total: totalExpectedInvoices,
          message: `Solicitando transferência de ${totalExpectedInvoices} notas fiscais...`,
        });

        conn.send({
          type: 'REQUEST_INVOICES',
          neededAccessKeys,
        });
      } else if (msg.type === 'INVOICE_DATA') {
        const { invoice, hasImageBlob } = msg;
        const entry: PendingInvoice = {
          data: invoice,
          hasImageBlob,
        };
        pendingInvoices.set(invoice.accessKey, entry);

        if (!hasImageBlob) {
          completedInvoicesCount++;
          this.notifyProgress({
            phase: 'RECEIVING_DATA',
            current: completedInvoicesCount,
            total: totalExpectedInvoices,
            message: `Recebida nota ${completedInvoicesCount} de ${totalExpectedInvoices}...`,
          });
          conn.send({
            type: 'SYNC_ACK',
            accessKey: invoice.accessKey,
            success: true,
          });
        }
      } else if (msg.type === 'INVOICE_IMAGE_CHUNK') {
        const { accessKey, chunkIndex, totalChunks, data, mimeType } = msg;
        let entry = pendingInvoices.get(accessKey);
        if (!entry) {
          entry = { hasImageBlob: true };
          pendingInvoices.set(accessKey, entry);
        }

        if (!entry.collector) {
          entry.collector = new ChunkCollector(totalChunks, mimeType);
        }

        entry.collector.addChunk(chunkIndex, data);

        if (entry.collector.isComplete() && entry.data) {
          completedInvoicesCount++;
          this.notifyProgress({
            phase: 'RECEIVING_DATA',
            current: completedInvoicesCount,
            total: totalExpectedInvoices,
            message: `Recebida nota e imagem ${completedInvoicesCount} de ${totalExpectedInvoices}...`,
          });
          conn.send({
            type: 'SYNC_ACK',
            accessKey,
            success: true,
          });
        }
      } else if (msg.type === 'SYNC_COMPLETE') {
        void (async () => {
          this.notifyProgress({
            phase: 'SAVING',
            current: completedInvoicesCount,
            total: totalExpectedInvoices,
            message: 'Gravando notas no banco de dados local...',
          });

          const assembledInvoices: Invoice[] = [];

          for (const [, entry] of pendingInvoices.entries()) {
            if (entry.data) {
              let imageBlob: Blob | undefined = undefined;
              if (entry.hasImageBlob && entry.collector?.isComplete()) {
                imageBlob = entry.collector.assembleBlob();
              }

              assembledInvoices.push({
                ...entry.data,
                imageBlob,
                syncStatus: 'SYNCED',
              });
            }
          }

          if (assembledInvoices.length > 0) {
            await onInvoicesReceived(assembledInvoices);
          }

          this.notifyProgress({
            phase: 'DONE',
            current: assembledInvoices.length,
            total: assembledInvoices.length,
            message: `Sincronização concluída com sucesso! (${assembledInvoices.length} notas transferidas)`,
          });

          conn.send({
            type: 'SYNC_COMPLETE',
            totalSynced: assembledInvoices.length,
          });
        })();
      }
    });

    conn.on('close', () => {
      // Conexão encerrada normalmente
    });

    conn.on('error', (err) => {
      this.notifyProgress({
        phase: 'ERROR',
        current: 0,
        total: 0,
        message: `Erro na transferência P2P: ${err.message}`,
      });
    });
  }

  /**
   * Conecta ao Host através do peerId e transmite as notas fiscais locais solicitadas.
   */
  async connectAndSend(
    peerId: string,
    localInvoices: Invoice[],
    _onInvoicesReceived?: (invoices: Invoice[]) => Promise<void>
  ): Promise<{ sentCount: number; receivedCount: number }> {
    this.disconnect();

    this.notifyProgress({
      phase: 'CONNECTING',
      current: 0,
      total: localInvoices.length,
      message: 'Conectando ao receptor via WebRTC...',
    });

    return new Promise((resolve, reject) => {
      const peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });

      this.peer = peer;

      peer.on('error', (err) => {
        this.notifyProgress({
          phase: 'ERROR',
          current: 0,
          total: 0,
          message: `Erro ao conectar: ${err.message}`,
        });
        reject(err);
      });

      peer.on('open', () => {
        const conn = peer.connect(peerId, { reliable: true });
        this.activeConnection = conn;

        conn.on('open', () => {
          this.notifyProgress({
            phase: 'HANDSHAKE',
            current: 0,
            total: localInvoices.length,
            message: 'Conectado! Enviando catálogo de notas...',
          });

          const summaries: InvoiceSummary[] = localInvoices.map(
            SyncDiffService.createInvoiceSummary
          );

          conn.send({
            type: 'HELLO',
            deviceName:
              typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile')
                ? 'Smartphone'
                : 'Dispositivo',
            invoicesSummary: summaries,
          });
        });

        conn.on('data', (raw: unknown) => {
          const msg = raw as P2PMessage;

          if (msg.type === 'REQUEST_INVOICES') {
            void (async () => {
              const { neededAccessKeys } = msg;

              if (neededAccessKeys.length === 0) {
                this.notifyProgress({
                  phase: 'DONE',
                  current: 0,
                  total: 0,
                  message: 'Todas as notas já estão sincronizadas com o receptor!',
                });
                resolve({ sentCount: 0, receivedCount: 0 });
                return;
              }

              this.notifyProgress({
                phase: 'SENDING_DATA',
                current: 0,
                total: neededAccessKeys.length,
                message: `Enviando ${neededAccessKeys.length} notas fiscais...`,
              });

              const keyMap = new Map<string, Invoice>();
              for (const inv of localInvoices) {
                keyMap.set(inv.accessKey, inv);
              }

              let sent = 0;

              for (const key of neededAccessKeys) {
                const invoice = keyMap.get(key);
                if (!invoice) continue;

                const { id: _, imageBlob, ...invoiceFields } = invoice;

                conn.send({
                  type: 'INVOICE_DATA',
                  invoice: invoiceFields,
                  hasImageBlob: Boolean(imageBlob),
                });

                if (imageBlob) {
                  const { chunks, mimeType } = await splitBlobIntoChunks(
                    imageBlob,
                    32 * 1024
                  );
                  for (let i = 0; i < chunks.length; i++) {
                    conn.send({
                      type: 'INVOICE_IMAGE_CHUNK',
                      accessKey: key,
                      chunkIndex: i,
                      totalChunks: chunks.length,
                      data: chunks[i],
                      mimeType,
                    });
                  }
                }

                sent++;
                this.notifyProgress({
                  phase: 'SENDING_DATA',
                  current: sent,
                  total: neededAccessKeys.length,
                  message: `Enviada nota ${sent} de ${neededAccessKeys.length}...`,
                });
              }

              conn.send({
                type: 'SYNC_COMPLETE',
                totalSynced: sent,
              });
            })();
          } else if (msg.type === 'SYNC_COMPLETE') {
            this.notifyProgress({
              phase: 'DONE',
              current: msg.totalSynced,
              total: msg.totalSynced,
              message: `Sincronização concluída com sucesso! (${msg.totalSynced} notas enviadas)`,
            });
            resolve({ sentCount: msg.totalSynced, receivedCount: 0 });
          }
        });

        conn.on('error', (err) => {
          this.notifyProgress({
            phase: 'ERROR',
            current: 0,
            total: 0,
            message: `Erro na conexão: ${err.message}`,
          });
          reject(err);
        });
      });
    });
  }

  /**
   * Encerra conexões abertas e destrói o peer liberando portas e memória.
   */
  disconnect(): void {
    if (this.activeConnection) {
      try {
        this.activeConnection.close();
      } catch {
        // Ignora erros de fechamento
      }
      this.activeConnection = null;
    }

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {
        // Ignora erros de destruição
      }
      this.peer = null;
    }
  }
}

export const p2pSyncAdapter = new PeerJSSyncAdapter();
