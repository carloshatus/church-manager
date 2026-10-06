import type { Invoice } from '@/domain/entities/invoice';

export interface DashboardMetrics {
  totalCount: number;
  totalAmount: number;
  averageAmount: number;
  pendingSyncCount: number;
  syncedCount: number;
}

export function calculateMetrics(invoices: Invoice[]): DashboardMetrics {
  const totalCount = invoices.length;
  const totalAmount = invoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
  const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;
  const pendingSyncCount = invoices.filter(
    (inv) => inv.syncStatus === 'PENDING_SYNC'
  ).length;
  const syncedCount = invoices.filter((inv) => inv.syncStatus === 'SYNCED').length;

  return {
    totalCount,
    totalAmount,
    averageAmount,
    pendingSyncCount,
    syncedCount,
  };
}
