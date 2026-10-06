import React, { useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { useNetworkStore } from '@/stores/use-network-store';
import { QrCode, Camera, Database, Cpu, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const initNetworkListeners = useNetworkStore((state) => state.initNetworkListeners);
  const isOnline = useNetworkStore((state) => state.isOnline);

  useEffect(() => {
    const cleanup = initNetworkListeners();
    return cleanup;
  }, [initNetworkListeners]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      <Header />

      <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 max-w-5xl">
        {/* Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 sm:p-10 shadow-2xl backdrop-blur-xl mb-8">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary border border-primary/20 mb-4">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Etapa 1 Concluída: Fundação & Infraestrutura PWA
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
              Módulo de Gestão de Notas & Cupons Fiscais
            </h1>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-6">
              Aplicação Offline-First para registro de NF-e e NFC-e por QR Code, código de barras e fotos de comprovantes com compressão nativa e fallback automático de CNPJ.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                Nova Nota Fiscal
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition"
              >
                Ver Dashboard
              </button>
            </div>
          </div>
        </section>

        {/* Feature Cards Status (Etapa 1 Verification) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">Scanner QR & Barcode</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              html5-qrcode pronto para detecção de NFC-e e chaves de 44 dígitos com câmera traseira.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Camera className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">Foto & Compressão</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Compressão em Web Worker para &lt; 800 KB e armazenamento em Blob binário no IndexedDB.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">Fallback de CNPJ</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Resolução em cascata BrasilAPI + Minha Receita com cache e suporte a edição manual.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">Dexie.js Offline</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              IndexedDB local operando offline ({isOnline ? 'Online' : 'Desconectado'}).
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        Church Manager • PWA Offline-First • {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default App;
