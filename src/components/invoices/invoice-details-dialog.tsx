import React, { useEffect, useMemo, useState } from 'react';
import type { Invoice } from '@/domain/entities/invoice';
import { StatusBadge } from './status-badge';
import { RecipientStatusBadge } from './recipient-status-badge';
import { InvoiceItemsTable } from './invoice-items-table';
import { formatAccessKey } from '@/domain/parsers/nfe-key-parser';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Building2,
  FileText,
  RefreshCw,
  Camera,
  Pencil,
  UserCheck,
  CreditCard,
  FileCheck,
  Globe,
} from 'lucide-react';
import { invoiceRepository } from '@/adapters/storage/dexie-invoice.repository';
import { sefazScraperService } from '@/adapters/sefaz/sefaz-scraper.service';
import { useChurchSettingsStore } from '@/stores/use-church-settings-store';

interface InvoiceDetailsDialogProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onInvoiceUpdated?: () => void;
  onEditInvoice?: (invoice: Invoice) => void;
}

export const InvoiceDetailsDialog: React.FC<InvoiceDetailsDialogProps> = ({
  invoice: initialInvoice,
  isOpen,
  onClose,
  onInvoiceUpdated,
  onEditInvoice,
}) => {
  const [overrides, setOverrides] = useState<Partial<Invoice>>({});
  const [copiedKey, setCopiedKey] = useState(false);
  const [isUpdatingSync, setIsUpdatingSync] = useState(false);
  const [isScrapingSefaz, setIsScrapingSefaz] = useState(false);
  const [sefazScrapeError, setSefazScrapeError] = useState<string | null>(null);

  const invoice = initialInvoice ? { ...initialInvoice, ...overrides } : null;

  const imageBlob = invoice?.imageBlob;
  const photoUrl = useMemo(() => {
    if (!imageBlob) return null;
    return URL.createObjectURL(imageBlob);
  }, [imageBlob]);

  useEffect(() => {
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [photoUrl]);

  if (!isOpen || !invoice) return null;

  const handleCopyKey = async () => {
    await navigator.clipboard.writeText(invoice.accessKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleToggleSyncStatus = async () => {
    if (!invoice.id) return;
    setIsUpdatingSync(true);
    try {
      const nextStatus =
        invoice.syncStatus === 'PENDING_SYNC' ? 'SYNCED' : 'PENDING_SYNC';
      await invoiceRepository.update(invoice.id, { syncStatus: nextStatus });
      setOverrides((prev) => ({ ...prev, syncStatus: nextStatus }));
      onInvoiceUpdated?.();
    } finally {
      setIsUpdatingSync(false);
    }
  };

  const handleRetroactiveSefazScrape = async () => {
    if (!invoice.id || !invoice.qrCodeUrl) return;
    setIsScrapingSefaz(true);
    setSefazScrapeError(null);

    try {
      const corsProxy = useChurchSettingsStore.getState().settings.corsProxyUrl;
      const scraped = await sefazScraperService.scrapeByQrCodeUrl(
        invoice.qrCodeUrl,
        corsProxy
      );

      const updates: Partial<Invoice> = {
        totalAmount: scraped.totalAmount ?? invoice.totalAmount,
        emissionDate: scraped.emissionDate ?? invoice.emissionDate,
        issuerName: scraped.issuerName ?? invoice.issuerName,
        issuerAddress: scraped.issuerAddress ?? invoice.issuerAddress,
        protocol: scraped.protocol ?? invoice.protocol,
        recipientCpfCnpj: scraped.recipientCpfCnpj ?? invoice.recipientCpfCnpj,
        recipientName: scraped.recipientName ?? invoice.recipientName,
        paymentMethod: scraped.paymentMethod ?? invoice.paymentMethod,
        taxAmount: scraped.taxAmount ?? invoice.taxAmount,
        items: scraped.items.length > 0 ? scraped.items : invoice.items,
        sefazDataStatus: 'SUCCESS',
      };

      await invoiceRepository.update(invoice.id, updates);
      setOverrides((prev) => ({ ...prev, ...updates }));
      onInvoiceUpdated?.();
    } catch (err: unknown) {
      setSefazScrapeError((err as Error)?.message || 'Erro ao consultar a SEFAZ.');
    } finally {
      setIsScrapingSefaz(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-950 p-5 sm:p-6 shadow-2xl space-y-6">
        {/* Header do Modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <StatusBadge type="invoiceType" value={invoice.type} />
              <StatusBadge type="sync" value={invoice.syncStatus} />
              <StatusBadge type="sefaz" value={invoice.sefazDataStatus} />
            </div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
              <span>{invoice.issuerName || 'Razão Social não informada'}</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">CNPJ: {invoice.issuerCnpj}</p>
            {invoice.issuerAddress && (
              <p className="text-[11px] text-slate-500 mt-0.5">{invoice.issuerAddress}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-900 border border-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chave de Acesso */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-primary" />
              Chave de Acesso (44 Dígitos)
            </span>
            <button
              type="button"
              onClick={handleCopyKey}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              {copiedKey ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </>
              )}
            </button>
          </div>
          <p className="text-xs font-mono text-slate-200 bg-slate-950 p-3 rounded-xl border border-slate-800/80 break-all select-all">
            {formatAccessKey(invoice.accessKey)}
          </p>
        </div>

        {/* Destinatário / Consumidor & Auditoria */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-primary" />
              Destinatário / Consumidor
            </span>
            {invoice.recipientCpfCnpj && (
              <span className="text-xs font-mono text-slate-400">
                Doc: {invoice.recipientCpfCnpj}
              </span>
            )}
          </div>

          {invoice.recipientName && (
            <p className="text-xs font-medium text-white">{invoice.recipientName}</p>
          )}

          <RecipientStatusBadge
            recipientCpfCnpj={invoice.recipientCpfCnpj}
            showDetails={true}
          />
        </div>

        {/* Tabela de Itens (se houver) */}
        {invoice.items && invoice.items.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
            <InvoiceItemsTable items={invoice.items} />
          </div>
        )}

        {/* Grid de Metadados Fiscais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
            <span className="text-slate-500 block mb-0.5">Modelo</span>
            <span className="font-semibold text-white">{invoice.model || 'N/A'}</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
            <span className="text-slate-500 block mb-0.5">Série</span>
            <span className="font-semibold text-white">{invoice.series || 'N/A'}</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
            <span className="text-slate-500 block mb-0.5">Número</span>
            <span className="font-semibold text-white">{invoice.number || 'N/A'}</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
            <span className="text-slate-500 block mb-0.5">Emissão</span>
            <span className="font-semibold text-white">
              {invoice.emissionDate || 'N/A'}
            </span>
          </div>
        </div>

        {/* Protocolo, Pagamento e Tributos */}
        {(invoice.protocol ||
          invoice.paymentMethod ||
          invoice.taxAmount !== undefined) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {invoice.protocol && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
                <span className="text-slate-500 flex items-center gap-1 mb-0.5">
                  <FileCheck className="w-3.5 h-3.5 text-primary" />
                  Protocolo SEFAZ
                </span>
                <span className="font-mono font-semibold text-slate-200">
                  {invoice.protocol}
                </span>
              </div>
            )}

            {invoice.paymentMethod && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
                <span className="text-slate-500 flex items-center gap-1 mb-0.5">
                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                  Pagamento
                </span>
                <span className="font-semibold text-slate-200">
                  {invoice.paymentMethod}
                </span>
              </div>
            )}

            {invoice.taxAmount !== undefined && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
                <span className="text-slate-500 block mb-0.5">Tributos Totais</span>
                <span className="font-semibold text-slate-200">
                  R${' '}
                  {invoice.taxAmount.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Valor Total */}
        {invoice.totalAmount !== undefined && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Valor Total Registrado
            </span>
            <span className="text-xl font-extrabold text-emerald-400">
              R${' '}
              {invoice.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* URL do QR Code da SEFAZ & Botão Retroativo de Scraping */}
        {invoice.qrCodeUrl && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 block">
                URL do QR Code da SEFAZ
              </span>

              {sefazScraperService.isSearchEnabled() && (
                <button
                  type="button"
                  onClick={handleRetroactiveSefazScrape}
                  disabled={isScrapingSefaz}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition disabled:opacity-50"
                >
                  {isScrapingSefaz ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Consultando SEFAZ...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5" />
                      <span>Atualizar dados da SEFAZ</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {sefazScrapeError && (
              <p className="text-xs text-amber-400">{sefazScrapeError}</p>
            )}

            <p className="text-xs text-slate-400 break-all font-mono">
              {invoice.qrCodeUrl}
            </p>

            <a
              href={invoice.qrCodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium pt-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir Consulta no Portal da SEFAZ
            </a>
          </div>
        )}

        {/* Foto do Comprovante Físico */}
        {photoUrl && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-primary" />
              Foto do Comprovante Físico (IndexedDB Blob)
            </span>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center p-2 max-h-72">
              <img
                src={photoUrl}
                alt="Comprovante"
                className="max-h-64 w-auto rounded-xl object-contain"
              />
            </div>
          </div>
        )}

        {/* Rodapé com Ação de Alternar Status de Sincronização */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80 pt-4 text-xs text-slate-500">
          <span>
            Cadastrado em: {new Date(invoice.createdAt).toLocaleString('pt-BR')}
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onEditInvoice && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditInvoice(invoice);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar Nota
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleSyncStatus}
              disabled={isUpdatingSync}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isUpdatingSync ? 'animate-spin' : ''}`}
              />
              {invoice.syncStatus === 'PENDING_SYNC'
                ? 'Marcar como Sincronizado'
                : 'Marcar como Pendente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
