import React, { useEffect, useState } from 'react';
import type { Invoice } from '@/domain/entities/invoice';
import { StatusBadge } from './status-badge';
import { formatAccessKey } from '@/domain/parsers/nfe-key-parser';
import { Calendar, Trash2, Eye, Building2 } from 'lucide-react';
import { PhotoPreviewDialog } from '@/components/photo/photo-preview-dialog';

interface InvoiceCardProps {
  invoice: Invoice;
  onDelete?: (id: number) => void;
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({ invoice, onDelete }) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (!invoice.imageBlob) {
      setThumbnailUrl(null);
      return;
    }

    const url = URL.createObjectURL(invoice.imageBlob);
    setThumbnailUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [invoice.imageBlob]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 transition flex flex-col justify-between gap-4">
      {/* Top Header do Card */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge type="invoiceType" value={invoice.type} />
            <StatusBadge type="sync" value={invoice.syncStatus} />
          </div>
          <h3 className="font-semibold text-base text-white flex items-center gap-1.5 pt-1">
            <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="truncate max-w-xs sm:max-w-md">
              {invoice.issuerName || 'Razão Social não informada'}
            </span>
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            CNPJ: {invoice.issuerCnpj}
          </p>
        </div>

        {/* Thumbnail da foto anexada */}
        {thumbnailUrl && (
          <div
            onClick={() => setIsPreviewOpen(true)}
            className="relative h-16 w-16 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex-shrink-0 cursor-pointer group shadow-md"
            title="Clique para ampliar o comprovante"
          >
            <img
              src={thumbnailUrl}
              alt="Comprovante"
              className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Eye className="w-4 h-4 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Chave de Acesso e Detalhes */}
      <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800/80 space-y-1">
        <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider block">
          Chave de Acesso
        </span>
        <p className="text-xs font-mono text-slate-300 break-all select-all">
          {formatAccessKey(invoice.accessKey)}
        </p>
      </div>

      {/* Metadados Fiscais & Rodapé do Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          {invoice.emissionDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              {invoice.emissionDate}
            </span>
          )}
          {invoice.totalAmount !== undefined && (
            <span className="font-semibold text-emerald-400 flex items-center gap-0.5 text-sm">
              R$ {invoice.totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {/* Ação de exclusão */}
        {onDelete && invoice.id && (
          <button
            type="button"
            onClick={() => onDelete(invoice.id!)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition ml-auto"
            title="Excluir Nota"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Modal de ampliação de foto */}
      <PhotoPreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        imageUrl={thumbnailUrl}
        title={`Comprovante - ${invoice.issuerName || invoice.accessKey}`}
      />
    </div>
  );
};
