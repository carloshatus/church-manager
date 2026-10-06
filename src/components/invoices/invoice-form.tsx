import React, { useState } from 'react';
import {
  QrCode,
  RotateCw,
  Save,
  Trash,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Calendar,
  FileText,
  Info,
} from 'lucide-react';
import { useInvoiceFormStore } from '@/stores/use-invoice-form-store';
import { PhotoUploader } from '@/components/photo/photo-uploader';
import { StatusBadge } from './status-badge';
import { formatAccessKey } from '@/domain/parsers/nfe-key-parser';

interface InvoiceFormProps {
  onSuccess?: (id: number) => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ onSuccess }) => {
  const {
    fields,
    setFormField,
    setScanningModalOpen,
    retryResolveCnpj,
    isResolvingCnpj,
    cnpjError,
    cnpjProviderUsed,
    formError,
    isSubmitting,
    submitInvoice,
    resetForm,
  } = useInvoiceFormStore();

  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccessMessage(null);
    try {
      const id = await submitInvoice();
      setSavedSuccessMessage(`Nota Fiscal #${id} salva com sucesso no IndexedDB!`);
      if (onSuccess) {
        onSuccess(id);
      }
      setTimeout(() => {
        setSavedSuccessMessage(null);
      }, 5000);
    } catch {
      // Erro gerenciado pela store em formError
    }
  };

  const cleanKey = fields.accessKey.replace(/\D/g, '');
  const isKeyComplete = cleanKey.length === 44;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mensagem de Sucesso */}
      {savedSuccessMessage && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400 flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{savedSuccessMessage}</span>
        </div>
      )}

      {/* Erro Geral do Formulário */}
      {formError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-red-300 flex items-center gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span className="text-sm">{formError}</span>
        </div>
      )}

      {/* 1. SEÇÃO DA CHAVE DE ACESSO */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Chave de Acesso (44 Dígitos)
          </label>
          <div className="flex items-center gap-2">
            {fields.type !== 'UNKNOWN' && (
              <StatusBadge type="invoiceType" value={fields.type} />
            )}
            <button
              type="button"
              onClick={() => setScanningModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition shadow-sm"
            >
              <QrCode className="w-3.5 h-3.5" />
              Escanear com Câmera
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <input
            type="text"
            value={fields.accessKey}
            onChange={(e) => setFormField('accessKey', e.target.value)}
            placeholder="Digite os 44 dígitos ou escaneie o QR Code / Código de barras"
            maxLength={55}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary tracking-wide"
          />
          {cleanKey.length > 0 && cleanKey.length < 44 && (
            <p className="text-xs text-amber-400">
              {cleanKey.length}/44 dígitos informados.
            </p>
          )}
          {isKeyComplete && (
            <p className="text-xs text-slate-400 font-mono">
              Visual: {formatAccessKey(cleanKey)}
            </p>
          )}
        </div>
      </div>

      {/* 2. SEÇÃO DO EMITENTE & CNPJ COM RESILIÊNCIA E OVERRIDE MANUAL */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Dados do Emitente (Estabelecimento)
          </h3>
          {cnpjProviderUsed && <StatusBadge type="provider" value={cnpjProviderUsed} />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CNPJ */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              CNPJ do Emitente
            </label>
            <input
              type="text"
              value={fields.issuerCnpj}
              onChange={(e) => setFormField('issuerCnpj', e.target.value)}
              placeholder="00000000000000"
              maxLength={18}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          {/* Razão Social (com Override Manual sempre permitido) */}
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-slate-400 flex items-center justify-between mb-1">
              <span>Razão Social / Nome da Empresa</span>
              <span className="text-[11px] text-slate-500">Editável manualmente</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={fields.issuerName}
                onChange={(e) => setFormField('issuerName', e.target.value)}
                placeholder={
                  isResolvingCnpj
                    ? 'Consultando provedores de CNPJ...'
                    : 'Razão Social ou Nome do Estabelecimento'
                }
                disabled={isResolvingCnpj}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none disabled:opacity-60"
              />
              {isResolvingCnpj && (
                <div className="absolute right-3 top-2.5">
                  <RotateCw className="w-4 h-4 text-primary animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Banner de Erro da Consulta de CNPJ com Botão de Retry */}
        {cnpjError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>{cnpjError}</span>
            </div>
            <button
              type="button"
              onClick={retryResolveCnpj}
              disabled={isResolvingCnpj}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition flex-shrink-0"
            >
              <RotateCw
                className={`w-3.5 h-3.5 ${isResolvingCnpj ? 'animate-spin' : ''}`}
              />
              Tentar Novamente (Retry)
            </button>
          </div>
        )}
      </div>

      {/* 3. METADADOS FISCAIS & VALOR TOTAL */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Metadados da Nota Fiscal
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Modelo
            </label>
            <input
              type="text"
              value={fields.model}
              onChange={(e) => setFormField('model', e.target.value)}
              placeholder="55 ou 65"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">Série</label>
            <input
              type="text"
              value={fields.series}
              onChange={(e) => setFormField('series', e.target.value)}
              placeholder="Ex: 1"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Número da Nota
            </label>
            <input
              type="text"
              value={fields.number}
              onChange={(e) => setFormField('number', e.target.value)}
              placeholder="Ex: 1042"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Data / Período
            </label>
            <input
              type="text"
              value={fields.emissionDate}
              onChange={(e) => setFormField('emissionDate', e.target.value)}
              placeholder="AAAA-MM"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Valor Total */}
        <div>
          <label className="text-xs font-medium text-slate-400 block mb-1">
            Valor Total da Nota (R$)
          </label>
          <div className="relative max-w-xs">
            <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm font-semibold">
              R$
            </span>
            <input
              type="text"
              value={fields.totalAmount}
              onChange={(e) => setFormField('totalAmount', e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-10 pr-4 py-2 text-base font-semibold text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 4. COMPROVANTE FÍSICO (FOTO & COMPRESSÃO) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <PhotoUploader />
      </div>

      {/* 5. AÇÕES DE SUBMISSÃO E LIMPEZA */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={resetForm}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
        >
          <Trash className="w-4 h-4 text-slate-400" />
          Limpar Campos
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition active:scale-95 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? 'Salvando no IndexedDB...' : 'Salvar Nota Fiscal'}
        </button>
      </div>
    </form>
  );
};
