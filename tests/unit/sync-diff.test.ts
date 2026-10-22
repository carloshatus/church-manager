import { describe, it, expect } from 'vitest';
import { SyncDiffService } from '@/domain/services/sync-diff.service';
import type { Invoice } from '@/domain/entities/invoice';
import type { InvoiceSummary } from '@/domain/entities/p2p-sync';

describe('SyncDiffService: Regras de Diferença e Pareamento P2P', () => {
  const mockInvoice: Invoice = {
    id: 1,
    accessKey: '12345678901234567890123456789012345678901234',
    type: 'NFCE',
    issuerCnpj: '12345678000195',
    totalAmount: 150.5,
    sefazDataStatus: 'SUCCESS',
    syncStatus: 'PENDING_SYNC',
    createdAt: 1000,
    updatedAt: 2000,
    imageBlob: new Blob(['dummy-image'], { type: 'image/jpeg' }),
  };

  describe('createInvoiceSummary', () => {
    it('deve extrair resumo correto com imagem presente', () => {
      const summary = SyncDiffService.createInvoiceSummary(mockInvoice);
      expect(summary).toEqual({
        accessKey: '12345678901234567890123456789012345678901234',
        updatedAt: 2000,
        hasImage: true,
      });
    });

    it('deve indicar hasImage false quando imageBlob estiver ausente', () => {
      const invoiceWithoutImage: Invoice = {
        ...mockInvoice,
        imageBlob: undefined,
      };
      const summary = SyncDiffService.createInvoiceSummary(invoiceWithoutImage);
      expect(summary.hasImage).toBe(false);
    });
  });

  describe('determineNeededAccessKeys', () => {
    it('deve requisitar todas as chaves remotas se o banco local estiver vazio', () => {
      const localSummaries: InvoiceSummary[] = [];
      const remoteSummaries: InvoiceSummary[] = [
        { accessKey: 'KEY_A', updatedAt: 100, hasImage: false },
        { accessKey: 'KEY_B', updatedAt: 200, hasImage: true },
      ];

      const needed = SyncDiffService.determineNeededAccessKeys(
        localSummaries,
        remoteSummaries
      );
      expect(needed).toEqual(['KEY_A', 'KEY_B']);
    });

    it('não deve requisitar nenhuma chave se a lista remota estiver vazia', () => {
      const localSummaries: InvoiceSummary[] = [
        { accessKey: 'KEY_A', updatedAt: 100, hasImage: false },
      ];
      const remoteSummaries: InvoiceSummary[] = [];

      const needed = SyncDiffService.determineNeededAccessKeys(
        localSummaries,
        remoteSummaries
      );
      expect(needed).toEqual([]);
    });

    it('não deve requisitar notas que possuem o mesmo timestamp em ambos os lados', () => {
      const localSummaries: InvoiceSummary[] = [
        { accessKey: 'KEY_A', updatedAt: 100, hasImage: false },
        { accessKey: 'KEY_B', updatedAt: 200, hasImage: true },
      ];
      const remoteSummaries: InvoiceSummary[] = [
        { accessKey: 'KEY_A', updatedAt: 100, hasImage: false },
        { accessKey: 'KEY_B', updatedAt: 200, hasImage: true },
      ];

      const needed = SyncDiffService.determineNeededAccessKeys(
        localSummaries,
        remoteSummaries
      );
      expect(needed).toEqual([]);
    });

    it('deve requisitar notas ausentes localmente e notas mais recentes no remoto (Last-Write-Wins)', () => {
      const localSummaries: InvoiceSummary[] = [
        { accessKey: 'KEY_A', updatedAt: 100, hasImage: false },
        { accessKey: 'KEY_B', updatedAt: 300, hasImage: true }, // Local é mais recente que remoto (300 > 250)
        { accessKey: 'KEY_C', updatedAt: 400, hasImage: false }, // Remoto é mais recente (500 > 400)
      ];
      const remoteSummaries: InvoiceSummary[] = [
        { accessKey: 'KEY_A', updatedAt: 100, hasImage: false }, // Idêntico
        { accessKey: 'KEY_B', updatedAt: 250, hasImage: true }, // Remoto é mais antigo
        { accessKey: 'KEY_C', updatedAt: 500, hasImage: false }, // Remoto é mais novo
        { accessKey: 'KEY_D', updatedAt: 150, hasImage: true }, // Ausente no local
      ];

      const needed = SyncDiffService.determineNeededAccessKeys(
        localSummaries,
        remoteSummaries
      );
      expect(needed).toEqual(['KEY_C', 'KEY_D']);
    });
  });

  describe('formatPairingPayload & parsePairingPayload', () => {
    it('deve formatar e analisar com sucesso um payload de pareamento válido', () => {
      const peerId = 'peer-church-test-123';
      const formatted = SyncDiffService.formatPairingPayload(peerId);

      expect(typeof formatted).toBe('string');

      const parsed = SyncDiffService.parsePairingPayload(formatted);
      expect(parsed).not.toBeNull();
      expect(parsed?.version).toBe(1);
      expect(parsed?.type).toBe('CHURCH_MANAGER_SYNC');
      expect(parsed?.peerId).toBe(peerId);
      expect(typeof parsed?.timestamp).toBe('number');
    });

    it('deve retornar null para strings inválidas ou JSON corrompido', () => {
      expect(SyncDiffService.parsePairingPayload('')).toBeNull();
      expect(SyncDiffService.parsePairingPayload('invalid json {')).toBeNull();
      expect(SyncDiffService.parsePairingPayload(null as unknown as string)).toBeNull();
    });

    it('deve rejeitar QR Codes de notas fiscais SEFAZ ou payloads de outros sistemas', () => {
      const sefazUrl = 'https://nfe.sefaz.ba.gov.br/qrcode?p=292404...';
      expect(SyncDiffService.parsePairingPayload(sefazUrl)).toBeNull();

      const foreignJson = JSON.stringify({
        type: 'OTHER_APP',
        id: 123,
      });
      expect(SyncDiffService.parsePairingPayload(foreignJson)).toBeNull();

      const missingPeerId = JSON.stringify({
        version: 1,
        type: 'CHURCH_MANAGER_SYNC',
        timestamp: Date.now(),
      });
      expect(SyncDiffService.parsePairingPayload(missingPeerId)).toBeNull();
    });
  });
});
