import React, { useState, useEffect, useRef } from 'react';
import type { Invoice, SyncStatus } from '@/domain/entities/invoice';
import { invoiceRepository } from '@/adapters/storage/dexie-invoice.repository';
import { cnpjService } from '@/adapters/cnpj/cnpj-service';
import { ImageCompressionService } from '@/services/image-compression.service';
import { formatAccessKey } from '@/domain/parsers/nfe-key-parser';
import { StatusBadge } from './status-badge';
import { RecipientStatusBadge } from './recipient-status-badge';
import { PhotoPreviewDialog } from '@/components/photo/photo-preview-dialog';
import {
  X,
  Save,
  Search,
  RotateCw,
  Building2,
  Calendar,
  Camera,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Upload,
  UserCheck,
} from 'lucide-react';

interface EditInvoiceFormProps {
  invoice: Invoice;
  onClose: () => void;
  onInvoiceSaved?: (updatedInvoice: Invoice) => void;
}

const EditInvoiceForm: React.FC<EditInvoiceFormProps> = ({
  invoice,
  onClose,
  onInvoiceSaved,
}) => {
  const [issuerCnpj, setIssuerCnpj] = useState(invoice.issuerCnpj || '');
  const [issuerName, setIssuerName] = useState(invoice.issuerName || '');
  const [totalAmount, setTotalAmount] = useState(
    invoice.totalAmount !== undefined
      ? invoice.totalAmount.toString().replace('.', ',')
      : ''
  );
  const [emissionDate, setEmissionDate] = useState(invoice.emissionDate || '');
  const [model, setModel] = useState(invoice.model || '');
  const [series, setSeries] = useState(invoice.series || '');
  const [number, setNumber] = useState(invoice.number || '');
  const [recipientCpfCnpj, setRecipientCpfCnpj] = useState(
    invoice.recipientCpfCnpj || ''
  );
  const [recipientName, setRecipientName] = useState(invoice.recipientName || '');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    invoice.syncStatus || 'PENDING_SYNC'
  );

  // Gestão de foto com Blob nativo e ObjectURL com prevenção de vazamento
  const [currentBlob, setCurrentBlob] = useState<Blob | null>(invoice.imageBlob || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(() => {
    if (invoice.imageBlob) {
      return URL.createObjectURL(invoice.imageBlob);
    }
    return null;
  });
  const [isPhotoPreviewModalOpen, setIsPhotoPreviewModalOpen] = useState(false);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de consulta de CNPJ
  const [isResolvingCnpj, setIsResolvingCnpj] = useState(false);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [cnpjSuccessMessage, setCnpjSuccessMessage] = useState<string | null>(null);
  const [cnpjProvider, setCnpjProvider] = useState<string | null>(null);

  // Estados de salvamento
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Limpeza de ObjectURL ao desmontar ou trocar de foto
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Consulta / Pesquisa novamente a Razão Social pelo CNPJ
  const handleSearchCnpj = async () => {
    const cleanCnpj = issuerCnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      setCnpjError('O CNPJ deve conter exatamente 14 dígitos numéricos.');
      setCnpjSuccessMessage(null);
      return;
    }

    setIsResolvingCnpj(true);
    setCnpjError(null);
    setCnpjSuccessMessage(null);

    try {
      const result = await cnpjService.resolveCnpj(cleanCnpj, { forceRefresh: true });
      setIssuerName(result.razaoSocial);
      setCnpjProvider(result.provider);
      setCnpjSuccessMessage(`Razão Social atualizada via ${result.provider}!`);
    } catch (err: unknown) {
      const msg =
        (err as Error)?.message ||
        'Não foi possível consultar os dados cadastrais do CNPJ automaticamente.';
      setCnpjError(`${msg}. Você pode preencher ou manter a Razão Social manualmente.`);
      setCnpjProvider(null);
    } finally {
      setIsResolvingCnpj(false);
    }
  };

  // Upload e compressão de nova foto (< 800 KB) em Blob
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    try {
      const compressedBlob = await ImageCompressionService.compress(file);

      // Libera a URL antiga antes de associar a nova
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      const newUrl = URL.createObjectURL(compressedBlob);
      setCurrentBlob(compressedBlob);
      setPreviewUrl(newUrl);
    } catch (err) {
      console.error('Erro ao comprimir imagem selecionada:', err);
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCurrentBlob(null);
    setPreviewUrl(null);
  };

  // Salva as alterações no banco de dados local IndexedDB
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice.id) return;

    setSaveError(null);
    setIsSaving(true);

    try {
      const cleanCnpj = issuerCnpj.replace(/\D/g, '');
      if (cleanCnpj.length !== 14) {
        throw new Error('O CNPJ do emitente deve conter 14 dígitos numéricos.');
      }

      let parsedAmount: number | undefined = undefined;
      if (totalAmount.trim()) {
        const normalized = totalAmount.replace(',', '.');
        const num = parseFloat(normalized);
        if (isNaN(num) || num < 0) {
          throw new Error('Informe um valor total numérico válido em Reais (ex: 45,90).');
        }
        parsedAmount = num;
      }

      const updates: Partial<Invoice> = {
        issuerCnpj: cleanCnpj,
        issuerName: issuerName.trim() || undefined,
        totalAmount: parsedAmount,
        emissionDate: emissionDate.trim() || undefined,
        model: model.trim() || undefined,
        series: series.trim() || undefined,
        number: number.trim() || undefined,
        recipientCpfCnpj: recipientCpfCnpj.replace(/\D/g, '') || undefined,
        recipientName: recipientName.trim() || undefined,
        syncStatus,
        imageBlob: currentBlob || undefined,
      };

      await invoiceRepository.update(invoice.id, updates);

      const updatedInvoice: Invoice = {
        ...invoice,
        ...updates,
        updatedAt: Date.now(),
      };

      onInvoiceSaved?.(updatedInvoice);
      onClose();
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || 'Erro ao atualizar nota fiscal';
      setSaveError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950 p-5 sm:p-6 shadow-2xl space-y-6">
        {/* Header do Modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge type="invoiceType" value={invoice.type} />
              <StatusBadge type="sync" value={syncStatus} />
            </div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Editar Nota Fiscal #{invoice.id}
            </h2>
            <p className="text-xs text-slate-400">
              Ajuste os dados manuais ou pesquise novamente a Razão Social pelo CNPJ.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-900 border border-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagens de Erro ou Alerta Geral de Salvamento */}
        {saveError && (
          <div className="rounded-2xl border border-red-500/30 bg-red-950/30 p-3.5 text-xs text-red-300 flex items-center gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Chave de Acesso (Referência Fiscal) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3.5 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              Chave de Acesso (44 Dígitos)
            </span>
            <p className="text-xs font-mono text-slate-300 break-all select-all bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              {formatAccessKey(invoice.accessKey)}
            </p>
          </div>

          {/* CNPJ e Pesquisa de Razão Social */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary" />
                Dados do Emitente
              </h3>
              {cnpjProvider && (
                <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Fonte: {cnpjProvider}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Campo CNPJ */}
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  CNPJ (14 dígitos)
                </label>
                <input
                  type="text"
                  value={issuerCnpj}
                  onChange={(e) => setIssuerCnpj(e.target.value)}
                  maxLength={18}
                  placeholder="00000000000000"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
                />
              </div>

              {/* Botão de Pesquisar Razão Social */}
              <div className="sm:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleSearchCnpj}
                  disabled={
                    isResolvingCnpj || issuerCnpj.replace(/\D/g, '').length !== 14
                  }
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary/20 border border-primary/40 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/30 disabled:opacity-40 transition active:scale-[0.98]"
                >
                  {isResolvingCnpj ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      Consultando Receita / CNPJ.ws...
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      Pesquisar Razão Social Novamente
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Mensagem de Sucesso na Busca do CNPJ */}
            {cnpjSuccessMessage && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-xs text-emerald-400 flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{cnpjSuccessMessage}</span>
              </div>
            )}

            {/* Mensagem de Erro na Busca do CNPJ */}
            {cnpjError && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5 text-xs text-amber-300 flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>{cnpjError}</span>
              </div>
            )}

            {/* Campo Razão Social */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-400">
                  Razão Social / Nome da Empresa
                </label>
                <span className="text-[10px] text-slate-500">Editável livremente</span>
              </div>
              <input
                type="text"
                value={issuerName}
                onChange={(e) => setIssuerName(e.target.value)}
                placeholder="Informe a Razão Social manualmente ou via busca"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Destinatário / Consumidor (Auditoria Fiscal) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-primary" />
                Destinatário / Consumidor
              </h3>
              <RecipientStatusBadge
                recipientCpfCnpj={recipientCpfCnpj}
                showDetails={false}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">CPF ou CNPJ</label>
                <input
                  type="text"
                  value={recipientCpfCnpj}
                  onChange={(e) => setRecipientCpfCnpj(e.target.value)}
                  placeholder="Não informado (Consumidor Final)"
                  maxLength={18}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Nome / Razão Social</label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Consumidor ou Nome do Voluntário"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <RecipientStatusBadge
              recipientCpfCnpj={recipientCpfCnpj}
              showDetails={true}
            />
          </div>

          {/* Metadados Fiscais e Valor Total */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              Metadados Fiscais
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Modelo</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="55 ou 65"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Série</label>
                <input
                  type="text"
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  placeholder="Ex: 1"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Número</label>
                <input
                  type="text"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="Ex: 1042"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Data / Período</label>
                <input
                  type="text"
                  value={emissionDate}
                  onChange={(e) => setEmissionDate(e.target.value)}
                  placeholder="AAAA-MM"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Valor Total da Nota */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">
                Valor Total Registrado (R$)
              </label>
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">
                  R$
                </span>
                <input
                  type="text"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm font-semibold text-emerald-400 focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Status de Sincronização */}
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">
                Status de Sincronização
              </label>
              <select
                value={syncStatus}
                onChange={(e) => setSyncStatus(e.target.value as SyncStatus)}
                className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-primary focus:outline-none"
              >
                <option value="PENDING_SYNC">Pendente de Sincronização</option>
                <option value="SYNCED">Sincronizado</option>
              </select>
            </div>
          </div>

          {/* Foto do Comprovante Físico */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-primary" />
                Foto do Comprovante Físico (IndexedDB Blob)
              </span>
              {isCompressingPhoto && (
                <span className="text-[11px] text-primary flex items-center gap-1 animate-pulse">
                  <RotateCw className="w-3 h-3 animate-spin" />
                  Comprimindo (&lt; 800 KB)...
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoFileChange}
              className="hidden"
            />

            {previewUrl ? (
              <div className="relative group rounded-2xl border border-slate-800 bg-slate-950 p-2 overflow-hidden flex flex-col items-center justify-center gap-3">
                <img
                  src={previewUrl}
                  alt="Comprovante"
                  className="max-h-48 w-auto rounded-xl object-contain"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPhotoPreviewModalOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-medium transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-primary" />
                    Ampliar
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressingPhoto}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-medium transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    Trocar Foto
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-800/80 text-red-300 hover:bg-red-900 text-xs font-medium transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover Foto
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressingPhoto}
                className="w-full border-2 border-dashed border-slate-800 hover:border-primary/60 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-primary transition bg-slate-950/40"
              >
                <Camera className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium text-slate-200">
                  Adicionar Foto do Comprovante Físico
                </span>
                <span className="text-[10px] text-slate-500">
                  Tire uma foto ou selecione do celular (compressão automática &lt; 800
                  KB)
                </span>
              </button>
            )}
          </div>

          {/* Rodapé com Ações */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-xs font-medium text-slate-300 hover:bg-slate-800 transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSaving || isCompressingPhoto}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando Alterações...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de ampliação de foto */}
      <PhotoPreviewDialog
        isOpen={isPhotoPreviewModalOpen}
        onClose={() => setIsPhotoPreviewModalOpen(false)}
        imageUrl={previewUrl}
        title={`Comprovante - Nota #${invoice.id}`}
      />
    </div>
  );
};

export interface EditInvoiceDialogProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onInvoiceSaved?: (updatedInvoice: Invoice) => void;
}

export const EditInvoiceDialog: React.FC<EditInvoiceDialogProps> = ({
  invoice,
  isOpen,
  onClose,
  onInvoiceSaved,
}) => {
  if (!isOpen || !invoice) return null;

  return (
    <EditInvoiceForm
      key={invoice.id}
      invoice={invoice}
      onClose={onClose}
      onInvoiceSaved={onInvoiceSaved}
    />
  );
};
