import React from 'react';
import type { InvoiceItem } from '@/domain/entities/invoice-item';
import { ShoppingCart } from 'lucide-react';

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  className?: string;
}

export const InvoiceItemsTable: React.FC<InvoiceItemsTableProps> = ({
  items,
  className = '',
}) => {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-center text-xs text-slate-500">
        Nenhum item detalhado capturado para esta nota.
      </div>
    );
  }

  const totalCalculated = items.reduce((acc, item) => acc + (item.totalPrice || 0), 0);

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
          <ShoppingCart className="w-3.5 h-3.5 text-primary" />
          Itens da Compra ({items.length} {items.length === 1 ? 'item' : 'itens'})
        </span>
        <span className="text-xs font-mono text-slate-400">
          Soma dos itens: R${' '}
          {totalCalculated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-3.5 py-2.5">#</th>
              <th className="px-3.5 py-2.5">Descrição</th>
              <th className="px-3.5 py-2.5 text-center">Qtd.</th>
              <th className="px-3.5 py-2.5 text-center">UN</th>
              <th className="px-3.5 py-2.5 text-right">Vl. Unit.</th>
              <th className="px-3.5 py-2.5 text-right">Vl. Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200 font-mono">
            {items.map((item, index) => (
              <tr
                key={`${item.code}-${index}`}
                className="hover:bg-slate-900/40 transition-colors"
              >
                <td className="px-3.5 py-2 text-slate-500 text-[11px]">{index + 1}</td>
                <td className="px-3.5 py-2 font-sans font-medium text-slate-100">
                  <div>{item.description}</div>
                  {item.code && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      Cód: {item.code}
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-2 text-center text-slate-300">
                  {item.quantity.toLocaleString('pt-BR')}
                </td>
                <td className="px-3.5 py-2 text-center text-slate-400 text-[11px]">
                  {item.unit || 'UN'}
                </td>
                <td className="px-3.5 py-2 text-right text-slate-300">
                  R${' '}
                  {item.unitPrice.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-3.5 py-2 text-right font-semibold text-emerald-400">
                  R${' '}
                  {item.totalPrice.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
