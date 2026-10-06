import { QrCode, ArrowLeft, ShieldCheck } from 'lucide-react';
import { InvoiceForm } from '@/components/invoices/invoice-form';
import { QrScannerModal } from '@/components/scanner/qr-scanner-modal';
import { useInvoiceFormStore } from '@/stores/use-invoice-form-store';

interface NewInvoiceViewProps {
  onBackToDashboard?: () => void;
  onInvoiceSaved?: (id: number) => void;
}

export const NewInvoiceView: React.FC<NewInvoiceViewProps> = ({
  onBackToDashboard,
  onInvoiceSaved,
}) => {
  const {
    isScanningModalOpen,
    setScanningModalOpen,
    handleScannedData,
  } = useInvoiceFormStore();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Bar com Navegação e Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="p-2 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Voltar ao Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Cadastrar Nota Fiscal
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Escaneie o QR Code, código de barras ou preencha os dados manualmente
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setScanningModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:opacity-95 transition active:scale-95"
        >
          <QrCode className="w-4 h-4" />
          Abrir Scanner de Câmera
        </button>
      </div>

      {/* Dica de Operação Offline */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4 flex items-start gap-3 text-xs text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <p>
          <strong className="text-slate-200">100% Offline-First:</strong> Esta nota e a foto do cupom são salvas instantaneamente no banco de dados local do seu aparelho. Mesmo sem internet ou com queda na API da Receita Federal, você pode preencher manualmente a Razão Social e salvar.
        </p>
      </div>

      {/* Formulário Principal */}
      <InvoiceForm onSuccess={onInvoiceSaved} />

      {/* Modal de Scanner com html5-qrcode */}
      <QrScannerModal
        isOpen={isScanningModalOpen}
        onClose={() => setScanningModalOpen(false)}
        onScanSuccess={handleScannedData}
      />
    </div>
  );
};
