import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/adapters/storage/db';
import { invoiceRepository } from '@/adapters/storage/dexie-invoice.repository';
import type { Invoice } from '@/domain/entities/invoice';
import { InvoiceCard } from '@/components/invoices/invoice-card';
import { MetricCards } from '@/components/dashboard/metric-cards';
import { FiltersBar, type FilterState } from '@/components/dashboard/filters-bar';
import { InvoiceDetailsDialog } from '@/components/invoices/invoice-details-dialog';
import { PlusCircle, FileQuestion } from 'lucide-react';

interface DashboardViewProps {
  onNavigateToNewInvoice: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToNewInvoice,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    typeFilter: 'ALL',
    syncFilter: 'ALL',
  });

  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<Invoice | null>(null);

  // Consulta reativa ao IndexedDB via useLiveQuery
  const invoices = useLiveQuery(() => db.invoices.orderBy('createdAt').reverse().toArray());

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta nota fiscal do banco local?')) {
      await invoiceRepository.delete(id);
    }
  };

  const allInvoices = invoices || [];

  // Lógica de filtragem
  const filteredInvoices = allInvoices.filter((inv) => {
    // 1. Filtro por Modelo
    if (filters.typeFilter !== 'ALL' && inv.type !== filters.typeFilter) {
      return false;
    }

    // 2. Filtro por Sync Status
    if (filters.syncFilter !== 'ALL' && inv.syncStatus !== filters.syncFilter) {
      return false;
    }

    // 3. Filtro por Termo de Busca
    if (filters.searchTerm.trim() !== '') {
      const term = filters.searchTerm.toLowerCase();
      const matchName = inv.issuerName?.toLowerCase().includes(term);
      const matchCnpj = inv.issuerCnpj.includes(term);
      const matchKey = inv.accessKey.includes(term);
      if (!matchName && !matchCnpj && !matchKey) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header do Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Painel Fiscal
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Visão consolidada e controle de notas e cupons fiscais armazenados no aparelho
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToNewInvoice}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          Nova Nota Fiscal
        </button>
      </div>

      {/* Cards de Métricas Financeiras e Sincronização */}
      <MetricCards invoices={allInvoices} />

      {/* Barra de Busca e Filtros Avançados */}
      <FiltersBar
        filters={filters}
        onFilterChange={setFilters}
        resultsCount={filteredInvoices.length}
        totalCount={allInvoices.length}
      />

      {/* Lista de Notas Fiscais ou Estado Vazio */}
      {filteredInvoices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInvoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id || invoice.accessKey}
              invoice={invoice}
              onDelete={handleDelete}
              onViewDetails={(inv) => setSelectedInvoiceForDetails(inv)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-800/80 bg-slate-900/20 p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="p-4 rounded-2xl bg-slate-800/60 text-slate-400">
            <FileQuestion className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">
              {allInvoices.length > 0
                ? 'Nenhuma nota encontrada com os filtros atuais'
                : 'Nenhuma nota fiscal cadastrada ainda'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {allInvoices.length > 0
                ? 'Tente alterar os filtros ou o termo de busca para localizar a nota.'
                : 'Escaneie o QR Code de um cupom NFC-e ou registre uma nota para começar.'}
            </p>
          </div>
          {allInvoices.length === 0 && (
            <button
              type="button"
              onClick={onNavigateToNewInvoice}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition shadow-lg shadow-primary/20"
            >
              <PlusCircle className="w-4 h-4" />
              Cadastrar Primeira Nota Fiscal
            </button>
          )}
        </div>
      )}

      {/* Modal de Detalhes da Nota Fiscal */}
      <InvoiceDetailsDialog
        isOpen={Boolean(selectedInvoiceForDetails)}
        invoice={selectedInvoiceForDetails}
        onClose={() => setSelectedInvoiceForDetails(null)}
      />
    </div>
  );
};
