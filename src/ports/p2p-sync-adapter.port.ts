import type { Invoice } from '@/domain/entities/invoice';
import type { SyncProgress } from '@/domain/entities/p2p-sync';

export interface IP2PSyncAdapter {
  /**
   * Inicia uma sessão de acolhimento (Host / Receptor) aguardando conexão P2P.
   * Gera o ID único do peer e o payload do QR Code para exibição na tela.
   */
  startHostSession(
    localInvoices: Invoice[],
    onInvoicesReceived: (invoices: Invoice[]) => Promise<void>
  ): Promise<{ peerId: string; qrPayload: string }>;

  /**
   * Conecta ao Host através do peerId escaneado no QR Code e sincroniza as notas.
   */
  connectAndSend(
    peerId: string,
    localInvoices: Invoice[],
    onInvoicesReceived?: (invoices: Invoice[]) => Promise<void>
  ): Promise<{ sentCount: number; receivedCount: number }>;

  /**
   * Registra ouvinte para atualizações de progresso em tempo real.
   */
  onProgress(callback: (progress: SyncProgress) => void): void;

  /**
   * Encerra a conexão e libera os recursos WebRTC/PeerJS.
   */
  disconnect(): void;
}
