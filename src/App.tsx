import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { useNetworkStore } from '@/stores/use-network-store';
import { DashboardView } from '@/views/dashboard-view';
import { NewInvoiceView } from '@/views/new-invoice-view';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new-invoice'>('dashboard');

  const initNetworkListeners = useNetworkStore((state) => state.initNetworkListeners);

  useEffect(() => {
    const cleanup = initNetworkListeners();
    return cleanup;
  }, [initNetworkListeners]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
      {/* Header com Abas de Navegação e Status de Rede */}
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Conteúdo Principal Dinâmico */}
      <main className="flex-1 container mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-8 max-w-5xl">
        {activeTab === 'dashboard' ? (
          <DashboardView onNavigateToNewInvoice={() => setActiveTab('new-invoice')} />
        ) : (
          <NewInvoiceView
            onBackToDashboard={() => setActiveTab('dashboard')}
            onInvoiceSaved={() => {
              // Redireciona para o Dashboard após salvar a nota
              setTimeout(() => {
                setActiveTab('dashboard');
              }, 600);
            }}
          />
        )}
      </main>

      <footer className="hidden sm:block border-t border-slate-900/80 py-6 text-center text-xs text-slate-500">
        Church Manager • Módulo Fiscal PWA Offline-First • {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default App;
