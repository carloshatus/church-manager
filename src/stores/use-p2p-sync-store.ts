import { create } from 'zustand';
import { db, ChurchManagerDB } from '@/adapters/storage/db';
import { p2pSyncAdapter } from '@/adapters/p2p/peerjs-sync.adapter';
import type { IP2PSyncAdapter } from '@/ports/p2p-sync-adapter.port';
import type { Invoice } from '@/domain/entities/invoice';
import type {
  P2PConnectionStatus,
  P2PSyncMode,
  SyncProgress,
} from '@/domain/entities/p2p-sync';
import { SyncDiffService } from '@/domain/services/sync-diff.service';

export interface P2PSyncState {
  isOpen: boolean;
  mode: P2PSyncMode;
  status: P2PConnectionStatus;
  peerId: string | null;
  qrPayload: string | null;
  progress: SyncProgress;
  errorMessage: string | null;
  syncedCount: number;
  isScannerActive: boolean;

  openSyncDialog: (initialMode?: P2PSyncMode) => void;
  closeSyncDialog: () => void;
  setMode: (mode: P2PSyncMode) => void;
  startHostSession: () => Promise<void>;
  connectAndSendFromPayload: (qrPayloadStr: string) => Promise<void>;
  setIsScannerActive: (active: boolean) => void;
  reset: () => void;
}

const initialProgress: SyncProgress = {
  phase: 'IDLE',
  current: 0,
  total: 0,
  message: '',
};

export const createP2PSyncStore = (
  adapter: IP2PSyncAdapter = p2pSyncAdapter,
  database: ChurchManagerDB = db
) =>
  create<P2PSyncState>((set, get) => ({
    isOpen: false,
    mode: 'HOST_RECEIVE',
    status: 'IDLE',
    peerId: null,
    qrPayload: null,
    progress: initialProgress,
    errorMessage: null,
    syncedCount: 0,
    isScannerActive: false,

    openSyncDialog: (initialMode = 'HOST_RECEIVE') => {
      set({
        isOpen: true,
        mode: initialMode,
        status: 'IDLE',
        peerId: null,
        qrPayload: null,
        errorMessage: null,
        syncedCount: 0,
        progress: initialProgress,
        isScannerActive: false,
      });

      if (initialMode === 'HOST_RECEIVE') {
        void get().startHostSession();
      }
    },

    closeSyncDialog: () => {
      adapter.disconnect();
      set({
        isOpen: false,
        status: 'IDLE',
        peerId: null,
        qrPayload: null,
        errorMessage: null,
        syncedCount: 0,
        isScannerActive: false,
        progress: initialProgress,
      });
    },

    setMode: (mode) => {
      adapter.disconnect();
      set({
        mode,
        status: 'IDLE',
        peerId: null,
        qrPayload: null,
        errorMessage: null,
        syncedCount: 0,
        isScannerActive: false,
        progress: initialProgress,
      });

      if (mode === 'HOST_RECEIVE') {
        void get().startHostSession();
      }
    },

    startHostSession: async () => {
      try {
        set({
          status: 'GENERATING_QR',
          errorMessage: null,
          syncedCount: 0,
        });

        const localInvoices = await database.invoices.toArray();

        adapter.onProgress((progress) => {
          set({
            progress,
            status:
              progress.phase === 'DONE'
                ? 'COMPLETED'
                : progress.phase === 'ERROR'
                  ? 'FAILED'
                  : progress.phase === 'SAVING' ||
                      progress.phase === 'RECEIVING_DATA' ||
                      progress.phase === 'DIFFING'
                    ? 'TRANSFERRING'
                    : 'WAITING_PEER',
          });
        });

        const { peerId, qrPayload } = await adapter.startHostSession(
          localInvoices,
          async (receivedInvoices: Invoice[]) => {
            // Gravação atômica no IndexedDB local com Dexie
            await database.transaction('rw', database.invoices, async () => {
              for (const inv of receivedInvoices) {
                const existing = await database.invoices
                  .where('accessKey')
                  .equals(inv.accessKey)
                  .first();

                if (existing?.id) {
                  await database.invoices.update(existing.id, {
                    ...inv,
                    id: existing.id,
                    syncStatus: 'SYNCED',
                  });
                } else {
                  await database.invoices.add({
                    ...inv,
                    syncStatus: 'SYNCED',
                  });
                }
              }
            });

            set({
              syncedCount: receivedInvoices.length,
              status: 'COMPLETED',
            });
          }
        );

        set({
          peerId,
          qrPayload,
          status: 'WAITING_PEER',
        });
      } catch (err) {
        set({
          status: 'FAILED',
          errorMessage:
            err instanceof Error
              ? err.message
              : 'Falha ao iniciar canal P2P de recebimento.',
        });
      }
    },

    connectAndSendFromPayload: async (qrPayloadStr: string) => {
      const parsed = SyncDiffService.parsePairingPayload(qrPayloadStr);
      if (!parsed) {
        set({
          status: 'FAILED',
          errorMessage:
            'QR Code inválido. Aponte a câmera para o QR Code de Sincronização do Church Manager na tela do receptor.',
          isScannerActive: false,
        });
        return;
      }

      set({
        isScannerActive: false,
        status: 'CONNECTING',
        errorMessage: null,
        syncedCount: 0,
      });

      try {
        const localInvoices = await database.invoices.toArray();

        adapter.onProgress((progress) => {
          set({
            progress,
            status:
              progress.phase === 'DONE'
                ? 'COMPLETED'
                : progress.phase === 'ERROR'
                  ? 'FAILED'
                  : progress.phase === 'SENDING_DATA' || progress.phase === 'DIFFING'
                    ? 'TRANSFERRING'
                    : 'CONNECTING',
          });
        });

        const result = await adapter.connectAndSend(parsed.peerId, localInvoices);

        // Atualiza status local para SYNCED nas notas pendentes enviadas
        if (result.sentCount > 0) {
          await database.transaction('rw', database.invoices, async () => {
            const pending = await database.invoices
              .where('syncStatus')
              .equals('PENDING_SYNC')
              .toArray();

            for (const inv of pending) {
              if (inv.id) {
                await database.invoices.update(inv.id, {
                  syncStatus: 'SYNCED',
                  updatedAt: Date.now(),
                });
              }
            }
          });
        }

        set({
          syncedCount: result.sentCount,
          status: 'COMPLETED',
        });
      } catch (err) {
        set({
          status: 'FAILED',
          errorMessage:
            err instanceof Error
              ? err.message
              : 'Falha durante o envio de notas ao receptor.',
        });
      }
    },

    setIsScannerActive: (active: boolean) => {
      set({ isScannerActive: active });
    },

    reset: () => {
      adapter.disconnect();
      set({
        status: 'IDLE',
        peerId: null,
        qrPayload: null,
        progress: initialProgress,
        errorMessage: null,
        syncedCount: 0,
        isScannerActive: false,
      });
    },
  }));

export const useP2PSyncStore = createP2PSyncStore();
