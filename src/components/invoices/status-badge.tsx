import React from 'react';
import type { SyncStatus, SefazDataStatus, InvoiceType } from '@/domain/entities/invoice';

interface StatusBadgeProps {
  type: 'sync' | 'sefaz' | 'invoiceType' | 'provider';
  value?: string | SyncStatus | SefazDataStatus | InvoiceType;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value }) => {
  if (!value) return null;

  if (type === 'sync') {
    const isSynced = value === 'SYNCED';
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
          isSynced
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isSynced ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
          }`}
        />
        {isSynced ? 'Sincronizado' : 'Pendente de Sincronização'}
      </span>
    );
  }

  if (type === 'invoiceType') {
    const isNFe = value === 'NFE';
    const isNFCe = value === 'NFCE';
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider border ${
          isNFe
            ? 'border-sky-500/30 bg-sky-500/10 text-sky-400'
            : isNFCe
            ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
            : 'border-slate-700 bg-slate-800 text-slate-400'
        }`}
      >
        {isNFe ? 'NF-e (Mod. 55)' : isNFCe ? 'NFC-e (Mod. 65)' : 'Outro'}
      </span>
    );
  }

  if (type === 'provider') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-400 font-medium">
        ✓ {value}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
      {value}
    </span>
  );
};
