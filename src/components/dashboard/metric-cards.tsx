import type { Invoice } from '@/domain/entities/invoice';
import { FileText, DollarSign, Clock, CheckCircle2 } from 'lucide-react';

interface MetricCardsProps {
  invoices: Invoice[];
}

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
  const pendingSyncCount = invoices.filter((inv) => inv.syncStatus === 'PENDING_SYNC').length;
  const syncedCount = invoices.filter((inv) => inv.syncStatus === 'SYNCED').length;

  return {
    totalCount,
    totalAmount,
    averageAmount,
    pendingSyncCount,
    syncedCount,
  };
}

export const MetricCards: React.FC<MetricCardsProps> = ({ invoices }) => {
  const metrics = calculateMetrics(invoices);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. Total de Notas */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 backdrop-blur-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Total de Notas</span>
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <FileText className="w-4 h-4" />
          </div>
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {metrics.totalCount}
          </p>
          <span className="text-[11px] text-slate-500">Documentos no aparelho</span>
        </div>
      </div>

      {/* 2. Valor Total Acumulado */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 backdrop-blur-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Total em Despesas</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-400 truncate">
            R$ {metrics.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-500">
            Média: R$ {metrics.averageAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* 3. Pendentes de Sincronização */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 backdrop-blur-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Pendentes de Envio</span>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-400">
            {metrics.pendingSyncCount}
          </p>
          <span className="text-[11px] text-slate-500">Aguardando sincronização</span>
        </div>
      </div>

      {/* 4. Sincronizadas com Sucesso */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 backdrop-blur-sm flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Sincronizadas</span>
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div>
          <p className="text-2xl sm:text-3xl font-extrabold text-sky-400">
            {metrics.syncedCount}
          </p>
          <span className="text-[11px] text-slate-500">
            {metrics.totalCount > 0
              ? `${Math.round((metrics.syncedCount / metrics.totalCount) * 100)}% sincronizado`
              : 'Nenhum registro'}
          </span>
        </div>
      </div>
    </div>
  );
};
