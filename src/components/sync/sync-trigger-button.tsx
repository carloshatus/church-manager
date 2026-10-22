import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/adapters/storage/db';
import { useP2PSyncStore } from '@/stores/use-p2p-sync-store';
import { Radio } from 'lucide-react';

interface SyncTriggerButtonProps {
  className?: string;
  variant?: 'header' | 'compact' | 'prominent';
}

export const SyncTriggerButton: React.FC<SyncTriggerButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const openSyncDialog = useP2PSyncStore((state) => state.openSyncDialog);

  // Consulta reativa ao número de notas pendentes de sincronização
  const pendingCount = useLiveQuery(
    () => db.invoices.where('syncStatus').equals('PENDING_SYNC').count(),
    [],
    0
  );

  const hasPending = pendingCount > 0;

  if (variant === 'prominent') {
    return (
      <button
        type="button"
        onClick={() => openSyncDialog()}
        className={`inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white transition shadow-sm active:scale-95 ${className}`}
        title="Sincronizar notas fiscais via rede local (P2P)"
      >
        <Radio className="w-4 h-4 text-primary animate-pulse" />
        <span>Sincronizar P2P</span>
        {hasPending && (
          <span className="ml-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold">
            {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openSyncDialog()}
      className={`relative flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-sm ${className}`}
      title="Sincronizar dispositivos na rede local (WebRTC)"
    >
      <Radio className="w-3.5 h-3.5 text-primary" />
      <span className="hidden sm:inline">Sincronizar</span>
      {hasPending && (
        <span className="flex items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-slate-950">
          {pendingCount}
        </span>
      )}
    </button>
  );
};
