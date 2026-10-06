import React from 'react';
import {
  Wifi,
  WifiOff,
  FileSpreadsheet,
  ShieldCheck,
  LayoutDashboard,
  PlusCircle,
} from 'lucide-react';
import { useNetworkStore } from '@/stores/use-network-store';

interface HeaderProps {
  activeTab?: 'dashboard' | 'new-invoice';
  onTabChange?: (tab: 'dashboard' | 'new-invoice') => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab = 'dashboard',
  onTabChange,
}) => {
  const isOnline = useNetworkStore((state) => state.isOnline);

  return (
    <>
      {/* Top Header - Otimizado e Arejado em todas as resoluções */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur-md">
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6">
          {/* Brand / Logo */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              onClick={() => onTabChange?.('dashboard')}
              className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-blue-400 text-white shadow-lg shadow-primary/20 cursor-pointer flex-shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span
                  onClick={() => onTabChange?.('dashboard')}
                  className="font-bold text-base sm:text-lg tracking-tight text-white cursor-pointer"
                >
                  Church Manager
                </span>
                <span className="rounded-full bg-primary/10 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-primary uppercase border border-primary/20">
                  PWA
                </span>
              </div>
              {/* Subtítulo oculto no celular para evitar que o header fique espremido */}
              <p className="hidden sm:block text-xs text-slate-400">
                Notas & Cupons Fiscais (NF-e / NFC-e)
              </p>
            </div>
          </div>

          {/* Abas de Navegação no Desktop/Tablet (em telas sm:) */}
          {onTabChange && (
            <nav className="hidden sm:flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => onTabChange('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'dashboard'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => onTabChange('new-invoice')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'new-invoice'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Nova Nota</span>
              </button>
            </nav>
          )}

          {/* Indicadores de Conexão e Armazenamento */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Status Online/Offline (Compacto no celular, completo no desktop) */}
            <div
              className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3 py-1 text-xs font-medium border transition-colors ${
                isOnline
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400 animate-pulse'
              }`}
              title={isOnline ? 'Conexão de rede ativa' : 'Operando no modo Offline'}
            >
              <span className="relative flex h-2 w-2">
                {isOnline && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isOnline ? 'bg-emerald-500' : 'bg-amber-400'
                  }`}
                ></span>
              </span>
              {isOnline ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              <span className="text-[11px] font-semibold sm:text-xs">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {/* Offline-First Badge (Desktop) */}
            <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span>IndexedDB</span>
            </div>
          </div>
        </div>
      </header>

      {/* Barra de Navegação Inferior Nativa para Celular (sm:hidden) */}
      {onTabChange && (
        <nav
          aria-label="Navegação móvel"
          className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/80 px-6 py-2 flex items-center justify-around shadow-2xl pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            onClick={() => onTabChange('dashboard')}
            className={`flex flex-col items-center gap-1 py-1 px-5 rounded-xl text-xs transition active:scale-95 ${
              activeTab === 'dashboard'
                ? 'text-primary font-bold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                activeTab === 'dashboard' ? 'bg-primary/10' : ''
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-[11px]">Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => onTabChange('new-invoice')}
            className={`flex flex-col items-center gap-1 py-1 px-5 rounded-xl text-xs transition active:scale-95 ${
              activeTab === 'new-invoice'
                ? 'text-primary font-bold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div
              className={`p-1 rounded-xl transition ${
                activeTab === 'new-invoice'
                  ? 'bg-primary text-white shadow-md shadow-primary/30'
                  : 'text-slate-400'
              }`}
            >
              <PlusCircle className="w-5 h-5" />
            </div>
            <span className="text-[11px]">Nova Nota</span>
          </button>
        </nav>
      )}
    </>
  );
};
