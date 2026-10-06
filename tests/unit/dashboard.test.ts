import { describe, it, expect } from 'vitest';
import { calculateMetrics } from '@/components/dashboard/metric-cards';
import type { Invoice } from '@/domain/entities/invoice';

describe('Dashboard: Métricas Financeiras & Consolidação', () => {
  it('deve retornar métricas zeradas quando não há notas cadastradas', () => {
    const metrics = calculateMetrics([]);
    expect(metrics.totalCount).toBe(0);
    expect(metrics.totalAmount).toBe(0);
    expect(metrics.averageAmount).toBe(0);
    expect(metrics.pendingSyncCount).toBe(0);
    expect(metrics.syncedCount).toBe(0);
  });

  it('deve calcular corretamente total de despesas, média e pendências de sincronização', () => {
    const mockInvoices: Invoice[] = [
      {
        id: 1,
        accessKey: '35261011111111000199550010000000011000000010',
        issuerCnpj: '11111111000199',
        type: 'NFE',
        totalAmount: 100.0,
        syncStatus: 'PENDING_SYNC',
        sefazDataStatus: 'PENDING',
        createdAt: 1000,
        updatedAt: 1000
      },
      {
        id: 2,
        accessKey: '35261022222222000199650010000000021000000020',
        issuerCnpj: '22222222000199',
        type: 'NFCE',
        totalAmount: 250.0,
        syncStatus: 'SYNCED',
        sefazDataStatus: 'SUCCESS',
        createdAt: 2000,
        updatedAt: 2000
      },
      {
        id: 3,
        accessKey: '35261033333333000199550010000000031000000030',
        issuerCnpj: '33333333000199',
        type: 'NFE',
        totalAmount: 150.0,
        syncStatus: 'PENDING_SYNC',
        sefazDataStatus: 'PENDING',
        createdAt: 3000,
        updatedAt: 3000
      }
    ];

    const metrics = calculateMetrics(mockInvoices);

    expect(metrics.totalCount).toBe(3);
    expect(metrics.totalAmount).toBe(500.0);
    expect(metrics.averageAmount).toBeCloseTo(166.67, 1);
    expect(metrics.pendingSyncCount).toBe(2);
    expect(metrics.syncedCount).toBe(1);
  });
});
