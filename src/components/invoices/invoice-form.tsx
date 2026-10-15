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
  Search,
  Globe,
  Code2,
  UserCheck,
  CreditCard,
  FileCheck,
} from 'lucide-react';
import { useInvoiceFormStore } from '@/stores/use-invoice-form-store';
import { PhotoUploader } from '@/components/photo/photo-uploader';
import { StatusBadge } from './status-badge';
import { RecipientStatusBadge } from './recipient-status-badge';
import { InvoiceItemsTable } from './invoice-items-table';
import { formatAccessKey } from '@/domain/parsers/nfe-key-parser';

interface InvoiceFormProps {
  onSuccess?: (id: number) => void;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({ onSuccess }) => {
  const {
    fields,
    items,
    setFormField,
    setScanningModalOpen,
    retryResolveCnpj,
    isResolvingCnpj,
    cnpjError,
    cnpjProviderUsed,
    isScrapingSefaz,
    sefazScraped,
    sefazError,
    scrapeSefaz,
    parseRawSefazHtml,
    formError,
    isSubmitting,
    submitInvoice,
    resetForm,
  } = useInvoiceFormStore();

  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
  const [pastedHtml, setPastedHtml] = useState('');

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

  const handleApplyPastedHtml = () => {
    if (!pastedHtml.trim()) return;
    parseRawSefazHtml(pastedHtml);
    setIsHtmlModalOpen(false);
    setPastedHtml('');
  };

  const cleanKey = fields.accessKey.replace(/\D/g, '');
  const isKeyComplete = cleanKey.length === 44;
  const canScrape = Boolean(fields.qrCodeUrl || isKeyComplete);

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

      {/* 1. SEÇÃO DA CHAVE DE ACESSO & SEFAZ */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-sm font-semibold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Chave de Acesso (44 Dígitos) ou URL
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {fields.type !== 'UNKNOWN' && (
              <StatusBadge type="invoiceType" value={fields.type} />
            )}
            <button
              type="button"
              onClick={() => setIsHtmlModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title="Colar código HTML da SEFAZ diretamente"
            >
              <Code2 className="w-3.5 h-3.5" />
              Colar HTML
            </button>
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
            placeholder="Digite os 44 dígitos ou cole a URL / escaneie o QR Code"
            maxLength={250}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-mono text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary tracking-wide"
          />
          {cleanKey.length > 0 && cleanKey.length < 44 && (
            <p className="text-xs text-amber-400">
              {cleanKey.length}/44 dígitos informados.
            </p>
          )}

          {/* Barra de Ações Rápidas da Chave (Scraping SEFAZ e Status) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            {isKeyComplete && (
              <p className="text-slate-400 font-mono">
                Visual: {formatAccessKey(cleanKey)}
              </p>
            )}

            <div className="flex items-center gap-2 ml-auto">
              {canScrape && (
                <button
                  type="button"
                  onClick={() => scrapeSefaz()}
                  disabled={isScrapingSefaz}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition disabled:opacity-50"
                  title="Buscar produtos, valores e destinatário diretamente no portal da SEFAZ"
                >
                  {isScrapingSefaz ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Consultando SEFAZ...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>{sefazScraped ? 'Atualizar SEFAZ' : 'Consultar SEFAZ'}</span>
                    </>
                  )}
                </button>
              )}

              {sefazScraped && (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  SEFAZ Capturada
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Banner de Erro do Scraping SEFAZ */}
        {sefazError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>{sefazError}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => scrapeSefaz()}
                disabled={isScrapingSefaz}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition"
              >
                <RotateCw
                  className={`w-3.5 h-3.5 ${isScrapingSefaz ? 'animate-spin' : ''}`}
                />
                Tentar Novamente
              </button>
              <button
                type="button"
                onClick={() => setIsHtmlModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:text-white transition"
              >
                Colar HTML
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal / Área de Colar HTML SEFAZ */}
      {isHtmlModalOpen && (
        <div className="rounded-2xl border border-primary/30 bg-slate-900/80 p-5 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-primary" />
              Colar Código-Fonte HTML da SEFAZ
            </h4>
            <button
              type="button"
              onClick={() => setIsHtmlModalOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Se o proxy CORS estiver indisponível ou você estiver sem conexão externa,
            copie e cole o código HTML da página do DANFE da SEFAZ abaixo para extrair
            todos os dados instantaneamente:
          </p>
          <textarea
            rows={5}
            value={pastedHtml}
            onChange={(e) => setPastedHtml(e.target.value)}
            placeholder="Cole aqui o HTML completo da consulta (ex: <div class='txtCenter'>...)"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-primary focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsHtmlModalOpen(false)}
              className="px-4 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleApplyPastedHtml}
              disabled={!pastedHtml.trim()}
              className="px-4 py-1.5 rounded-xl bg-primary text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Processar HTML
            </button>
          </div>
        </div>
      )}

      {/* 2. SEÇÃO DO EMITENTE & CNPJ */}
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-400">
                CNPJ do Emitente
              </label>
              <button
                type="button"
                onClick={() => retryResolveCnpj(undefined, true)}
                disabled={
                  isResolvingCnpj || fields.issuerCnpj.replace(/\D/g, '').length !== 14
                }
                className="text-[11px] text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 disabled:opacity-40 disabled:hover:text-primary transition"
                title="Consultar dados cadastrais do CNPJ"
              >
                <Search className="w-3 h-3" />
                {isResolvingCnpj ? 'Buscando...' : 'Buscar CNPJ'}
              </button>
            </div>
            <input
              type="text"
              value={fields.issuerCnpj}
              onChange={(e) => setFormField('issuerCnpj', e.target.value)}
              placeholder="00000000000000"
              maxLength={18}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          {/* Razão Social */}
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

        {/* Endereço do Emitente (se obtido) */}
        {fields.issuerAddress && (
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Endereço do Estabelecimento
            </label>
            <input
              type="text"
              value={fields.issuerAddress}
              onChange={(e) => setFormField('issuerAddress', e.target.value)}
              placeholder="Logradouro, Bairro, Cidade, UF"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-1.5 text-xs text-slate-300 focus:border-primary focus:outline-none"
            />
          </div>
        )}

        {/* Banner de Erro da Consulta de CNPJ */}
        {cnpjError && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>{cnpjError}</span>
            </div>
            <button
              type="button"
              onClick={() => retryResolveCnpj(undefined, true)}
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

      {/* 3. SEÇÃO DO DESTINATÁRIO / CONSUMIDOR & AUDITORIA FISCAL */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-primary" />
            Destinatário / Consumidor (Auditoria Fiscal)
          </h3>
          <RecipientStatusBadge
            recipientCpfCnpj={fields.recipientCpfCnpj}
            showDetails={false}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              CPF ou CNPJ do Destinatário
            </label>
            <input
              type="text"
              value={fields.recipientCpfCnpj}
              onChange={(e) => setFormField('recipientCpfCnpj', e.target.value)}
              placeholder="Não informado (Consumidor Final)"
              maxLength={18}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Nome / Razão Social do Destinatário
            </label>
            <input
              type="text"
              value={fields.recipientName}
              onChange={(e) => setFormField('recipientName', e.target.value)}
              placeholder="Consumidor ou Nome do Voluntário/Igreja"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Explicação e Conformidade do Destinatário */}
        <RecipientStatusBadge
          recipientCpfCnpj={fields.recipientCpfCnpj}
          showDetails={true}
        />
      </div>

      {/* 4. ITENS E PRODUTOS COMPRADOS (SEFAZ) */}
      {items.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
          <InvoiceItemsTable items={items} />
        </div>
      )}

      {/* 5. METADADOS FISCAIS & VALOR TOTAL */}
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
              Data de Emissão
            </label>
            <input
              type="text"
              value={fields.emissionDate}
              onChange={(e) => setFormField('emissionDate', e.target.value)}
              placeholder="AAAA-MM-DD"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Campos Fiscais Adicionais (Protocolo, Pagamento, Tributos) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div>
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
              <FileCheck className="w-3.5 h-3.5 text-primary" />
              Protocolo de Autorização
            </label>
            <input
              type="text"
              value={fields.protocol}
              onChange={(e) => setFormField('protocol', e.target.value)}
              placeholder="Ex: 229261255104844"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1">
              <CreditCard className="w-3.5 h-3.5 text-primary" />
              Forma de Pagamento
            </label>
            <input
              type="text"
              value={fields.paymentMethod}
              onChange={(e) => setFormField('paymentMethod', e.target.value)}
              placeholder="Ex: Dinheiro, Cartão, Pix"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Tributos Incidentes (Lei 12.741)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-500 text-xs font-semibold">
                R$
              </span>
              <input
                type="text"
                value={fields.taxAmount}
                onChange={(e) => setFormField('taxAmount', e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Valor Total da Nota */}
        <div className="pt-2">
          <label className="text-xs font-medium text-slate-300 block mb-1">
            Valor Total da Nota Fiscal (R$)
          </label>
          <div className="relative max-w-xs">
            <span className="absolute left-3.5 top-2.5 text-emerald-400 text-sm font-bold">
              R$
            </span>
            <input
              type="text"
              value={fields.totalAmount}
              onChange={(e) => setFormField('totalAmount', e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl border border-emerald-500/40 bg-slate-950 pl-10 pr-4 py-2.5 text-lg font-bold text-emerald-400 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 6. COMPROVANTE FÍSICO (FOTO & COMPRESSÃO) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
        <PhotoUploader />
      </div>

      {/* 7. AÇÕES DE SUBMISSÃO E LIMPEZA */}
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
