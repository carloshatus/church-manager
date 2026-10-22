import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PeerJSSyncAdapter } from '@/adapters/p2p/peerjs-sync.adapter';
import type { Invoice } from '@/domain/entities/invoice';
import type { P2PMessage, SyncProgress } from '@/domain/entities/p2p-sync';

// Mock do PeerJS
interface MockConnection {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  send: (data: unknown) => void;
  close: () => void;
  _trigger: (event: string, ...args: unknown[]) => void;
}

interface MockPeer {
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  connect: (id: string, options?: unknown) => MockConnection;
  destroy: () => void;
  _trigger: (event: string, ...args: unknown[]) => void;
}

let mockPeerInstance: MockPeer | null = null;
let mockConnectionInstance: MockConnection | null = null;

vi.mock('peerjs', () => {
  return {
    Peer: vi.fn(function (id?: string) {
      const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

      const instance: MockPeer = {
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        }),
        connect: vi.fn(() => {
          const connListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const conn: MockConnection = {
            on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
              if (!connListeners[event]) connListeners[event] = [];
              connListeners[event].push(cb);
            }),
            send: vi.fn(),
            close: vi.fn(),
            _trigger: (ev: string, ...args: unknown[]) => {
              connListeners[ev]?.forEach((fn) => fn(...args));
            },
          };
          mockConnectionInstance = conn;
          return conn;
        }),
        destroy: vi.fn(),
        _trigger: (ev: string, ...args: unknown[]) => {
          listeners[ev]?.forEach((fn) => fn(...args));
        },
      };

      mockPeerInstance = instance;

      queueMicrotask(() => {
        instance._trigger('open', id || 'mock-peer-id-123');
      });

      return instance;
    }),
  };
});

describe('PeerJSSyncAdapter: Adaptador de Sincronização P2P WebRTC', () => {
  let adapter: PeerJSSyncAdapter;

  const mockInvoices: Invoice[] = [
    {
      id: 1,
      accessKey: 'KEY_1',
      type: 'NFCE',
      issuerCnpj: '12345678000195',
      totalAmount: 100,
      sefazDataStatus: 'SUCCESS',
      syncStatus: 'PENDING_SYNC',
      createdAt: 1000,
      updatedAt: 1000,
      imageBlob: new Blob(['test-photo-data'], { type: 'image/jpeg' }),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockPeerInstance = null;
    mockConnectionInstance = null;
    adapter = new PeerJSSyncAdapter();
  });

  it('deve inicializar sessão Host gerando peerId e payload QR Code', async () => {
    const progressList: SyncProgress[] = [];
    adapter.onProgress((p) => progressList.push(p));

    const onInvoicesReceived = vi.fn().mockResolvedValue(undefined);

    const { peerId, qrPayload } = await adapter.startHostSession(
      mockInvoices,
      onInvoicesReceived
    );

    expect(peerId).toMatch(/^cm-/);
    expect(qrPayload).toContain('CHURCH_MANAGER_SYNC');
    expect(mockPeerInstance).not.toBeNull();
    expect(progressList.some((p) => p.phase === 'HANDSHAKE')).toBe(true);
  });

  it('Host deve receber mensagens HELLO, calcular diff e solicitar notas necessárias', async () => {
    const onInvoicesReceived = vi.fn().mockResolvedValue(undefined);
    await adapter.startHostSession([], onInvoicesReceived);

    const connListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const mockHostConn: MockConnection = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (!connListeners[event]) connListeners[event] = [];
        connListeners[event].push(cb);
      }),
      send: vi.fn(),
      close: vi.fn(),
      _trigger: (ev: string, ...args: unknown[]) => {
        connListeners[ev]?.forEach((fn) => fn(...args));
      },
    };

    // Dispara conexão de entrada no peer
    mockPeerInstance?._trigger('connection', mockHostConn);

    // Cliente envia HELLO
    const helloMsg: P2PMessage = {
      type: 'HELLO',
      deviceName: 'Celular Teste',
      invoicesSummary: [{ accessKey: 'KEY_REMOTE_1', updatedAt: 2000, hasImage: false }],
    };
    mockHostConn._trigger('data', helloMsg);

    // Host deve responder com REQUEST_INVOICES para a chave ausente
    expect(mockHostConn.send).toHaveBeenCalledWith({
      type: 'REQUEST_INVOICES',
      neededAccessKeys: ['KEY_REMOTE_1'],
    });

    // Cliente envia INVOICE_DATA
    const invoiceDataMsg: P2PMessage = {
      type: 'INVOICE_DATA',
      invoice: {
        accessKey: 'KEY_REMOTE_1',
        type: 'NFCE',
        issuerCnpj: '99999999000100',
        sefazDataStatus: 'SUCCESS',
        syncStatus: 'PENDING_SYNC',
        createdAt: 2000,
        updatedAt: 2000,
      },
      hasImageBlob: false,
    };
    mockHostConn._trigger('data', invoiceDataMsg);

    // Host deve responder com SYNC_ACK
    expect(mockHostConn.send).toHaveBeenCalledWith({
      type: 'SYNC_ACK',
      accessKey: 'KEY_REMOTE_1',
      success: true,
    });

    // Cliente finaliza com SYNC_COMPLETE
    mockHostConn._trigger('data', { type: 'SYNC_COMPLETE', totalSynced: 1 });

    // Aguarda execução assíncrona da gravação
    await vi.waitFor(() => {
      expect(onInvoicesReceived).toHaveBeenCalled();
    });

    expect(onInvoicesReceived).toHaveBeenCalledWith([
      expect.objectContaining({
        accessKey: 'KEY_REMOTE_1',
        syncStatus: 'SYNCED',
      }),
    ]);
  });

  it('Cliente deve conectar, enviar HELLO e transmitir notas solicitadas pelo Host', async () => {
    const connectPromise = adapter.connectAndSend('target-host-id', mockInvoices);

    await vi.waitFor(() => {
      expect(mockPeerInstance?.connect).toHaveBeenCalledWith('target-host-id', {
        reliable: true,
      });
      expect(mockConnectionInstance).not.toBeNull();
    });

    mockConnectionInstance?._trigger('open');

    expect(mockConnectionInstance?.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'HELLO',
      })
    );

    mockConnectionInstance?._trigger('data', {
      type: 'REQUEST_INVOICES',
      neededAccessKeys: ['KEY_1'],
    });

    await vi.waitFor(() => {
      expect(mockConnectionInstance?.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INVOICE_DATA',
        })
      );
      expect(mockConnectionInstance?.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INVOICE_IMAGE_CHUNK',
        })
      );
      expect(mockConnectionInstance?.send).toHaveBeenCalledWith({
        type: 'SYNC_COMPLETE',
        totalSynced: 1,
      });
    });

    mockConnectionInstance?._trigger('data', {
      type: 'SYNC_COMPLETE',
      totalSynced: 1,
    });

    const result = await connectPromise;
    expect(result.sentCount).toBe(1);
  });

  it('deve desconectar e liberar recursos adequadamente', async () => {
    await adapter.startHostSession([], vi.fn().mockResolvedValue(undefined));
    expect(mockPeerInstance).not.toBeNull();

    adapter.disconnect();
    expect(mockPeerInstance?.destroy).toHaveBeenCalled();
  });
});
