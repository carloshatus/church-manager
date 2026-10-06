import React from 'react';
import { Wifi, WifiOff, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { useNetworkStore } from '@/stores/use-network-store';

export const Header: React.FC = () => {
  const isOnline = useNetworkStore((state) => state.isOnline);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-blue-400 text-white shadow-lg shadow-primary/20">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">Church Manager</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase border border-primary/20">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-400">Notas & Cupons Fiscais (NF-e / NFC-e)</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          {/* Offline/Online Badge */}
          <div
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              isOnline
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400 animate-pulse'
            }`}
          >
            {isOnline ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Wifi className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5" />
                <span>Modo Offline</span>
              </>
            )}
          </div>

          {/* Offline-First Storage Badge */}
          <div className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>IndexedDB Ativo</span>
          </div>
        </div>
      </div>
    </header>
  );
};
