import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { ChurchManagerDB } from '@/adapters/storage/db';
import { createP2PSyncStore } from '@/stores/use-p2p-sync-store';
import type { IP2PSyncAdapter } from '@/ports/p2p-sync-adapter.port';
import type { Invoice } from '@/domain/entities/invoice';
import type { SyncProgress } from '@/domain/entities/p2p-sync';
import { SyncDiffService } from '@/domain/services/sync-diff.service';

describe('useP2PSyncStore: Gerenciamento de Estado e Gravação Local', () => {
  let testDb: ChurchManagerDB;
  let mockAdapter: IP2PSyncAdapter;
  let progressCb: ((p: SyncProgress) => void) | null = null;
  let hostInvoicesCb: ((invoices: Invoice[]) => Promise<void>) | null = null;

  beforeEach(async () => {
    testDb = new ChurchManagerDB();
    await testDb.invoices.clear();

    progressCb = null;
    hostInvoicesCb = null;

    mockAdapter = {
      startHostSession: vi.fn(
        async (_localInvoices, onInvoicesReceived) => {
          hostInvoicesCb = onInvoicesReceived;
          return {
            peerId: 'cm-test-host',
            qrPayload: SyncDiffService.formatPairingPayload('cm-test-host'),
          };
        }
      ),
      connectAndSend: vi.fn(async () => {
        return { sentCount: 1, receivedCount: 0 };
      }),
      onProgress: vi.fn((cb) => {
        progressCb = cb;
      }),
      disconnect: vi.fn(),
    };
  });

  it('deve inicializar com o estado padrão', () => {
    const store = createP2PSyncStore(mockAdapter, testDb);
    const state = store.getState();

    expect(state.isOpen).toBe(false);
    expect(state.mode).toBe('HOST_RECEIVE');
    expect(state.status).toBe('IDLE');
    expect(state.peerId).toBeNull();
    expect(state.qrPayload).toBeNull();
  });

  it('openSyncDialog com HOST_RECEIVE deve iniciar sessão Host e salvar notas no Dexie', async () => {
    const store = createP2PSyncStore(mockAdapter, testDb);

    store.getState().openSyncDialog('HOST_RECEIVE');

    await vi.waitFor(() => {
      expect(store.getState().status).toBe('WAITING_PEER');
      expect(store.getState().peerId).toBe('cm-test-host');
      expect(store.getState().qrPayload).toContain('CHURCH_MANAGER_SYNC');
    });

    // Simula atualização de progresso
    expect(progressCb).not.toBeNull();
    progressCb!({
      phase: 'RECEIVING_DATA',
      current: 1,
      total: 1,
      message: 'Recebendo notas...',
    });
    expect(store.getState().status).toBe('TRANSFERRING');
    expect(store.getState().progress.message).toBe('Recebendo notas...');

    // Simula recepção de notas pelo adaptador
    const remoteInvoice: Invoice = {
      accessKey: '11112222333344445555666677778888999900001234',
      type: 'NFCE',
      issuerCnpj: '12345678000195',
      issuerName: 'Supermercado Central',
      totalAmount: 120.0,
      sefazDataStatus: 'SUCCESS',
      syncStatus: 'PENDING_SYNC',
      createdAt: 1000,
      updatedAt: 1000,
    };

    expect(hostInvoicesCb).not.toBeNull();
    await hostInvoicesCb!([remoteInvoice]);

    // Verifica se gravou no IndexedDB com status SYNCED
    const saved = await testDb.invoices
      .where('accessKey')
      .equals('11112222333344445555666677778888999900001234')
      .first();

    expect(saved).toBeDefined();
    expect(saved?.issuerName).toBe('Supermercado Central');
    expect(saved?.syncStatus).toBe('SYNCED');
    expect(store.getState().syncedCount).toBe(1);
    expect(store.getState().status).toBe('COMPLETED');
  });

  it('connectAndSendFromPayload deve rejeitar QR Codes inválidos', async () => {
    const store = createP2PSyncStore(mockAdapter, testDb);
    store.getState().openSyncDialog('CLIENT_SEND');

    await store.getState().connectAndSendFromPayload('https://sefaz.ba.gov.br/nfce');

    expect(store.getState().status).toBe('FAILED');
    expect(store.getState().errorMessage).toContain('QR Code inválido');
    expect(mockAdapter.connectAndSend).not.toHaveBeenCalled();
  });

  it('connectAndSendFromPayload deve enviar notas e atualizar status local para SYNCED', async () => {
    // Insere nota pendente no banco local
    await testDb.invoices.add({
      accessKey: 'PENDING_LOCAL_KEY',
      type: 'NFCE',
      issuerCnpj: '12345678000195',
      totalAmount: 50.0,
      sefazDataStatus: 'SUCCESS',
      syncStatus: 'PENDING_SYNC',
      createdAt: 1000,
      updatedAt: 1000,
    });

    const store = createP2PSyncStore(mockAdapter, testDb);
    store.getState().openSyncDialog('CLIENT_SEND');

    const qrPayload = SyncDiffService.formatPairingPayload('cm-target-host');
    await store.getState().connectAndSendFromPayload(qrPayload);

    expect(mockAdapter.connectAndSend).toHaveBeenCalledWith(
      'cm-target-host',
      expect.any(Array)
    );

    // Verifica se nota pendente foi atualizada para SYNCED
    const updated = await testDb.invoices
      .where('accessKey')
      .equals('PENDING_LOCAL_KEY')
      .first();

    expect(updated?.syncStatus).toBe('SYNCED');
    expect(store.getState().status).toBe('COMPLETED');
    expect(store.getState().syncedCount).toBe(1);
  });

  it('closeSyncDialog deve desconectar adaptador e restaurar estado', () => {
    const store = createP2PSyncStore(mockAdapter, testDb);
    store.getState().openSyncDialog('HOST_RECEIVE');

    store.getState().closeSyncDialog();

    expect(mockAdapter.disconnect).toHaveBeenCalled();
    expect(store.getState().isOpen).toBe(false);
    expect(store.getState().status).toBe('IDLE');
  });
});
