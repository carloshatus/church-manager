import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/adapters/storage/db';
import { invoiceRepository } from '@/adapters/storage/dexie-invoice.repository';
import { InvoiceCard } from '@/components/invoices/invoice-card';
import {
  FileText,
  DollarSign,
  Clock,
  Search,
  PlusCircle,
  FileQuestion
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateToNewInvoice: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigateToNewInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Consulta reativa ao IndexedDB usando useLiveQuery (atualiza automaticamente ao inserir notas)
  const invoices = useLiveQuery(() => db.invoices.orderBy('createdAt').reverse().toArray());

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta nota fiscal do banco local?')) {
      await invoiceRepository.delete(id);
    }
  };

  const allInvoices = invoices || [];

  // Cálculos de métricas
  const totalInvoices = allInvoices.length;
  const totalAmount = allInvoices.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
  const pendingSyncCount = allInvoices.filter((inv) => inv.syncStatus === 'PENDING_SYNC').length;

  // Filtragem por busca
  const filteredInvoices = allInvoices.filter((inv) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const matchName = inv.issuerName?.toLowerCase().includes(term);
    const matchCnpj = inv.issuerCnpj.includes(term);
    const matchKey = inv.accessKey.includes(term);
    return matchName || matchCnpj || matchKey;
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
            Visão consolidada de notas e cupons fiscais armazenados no dispositivo
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

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total de Notas */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Total de Notas</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {totalInvoices}
          </p>
          <span className="text-[11px] text-slate-500">Documentos fiscais no IndexedDB</span>
        </div>

        {/* Valor Total */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Total Acumulado</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
            R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-slate-500">Soma dos valores das notas</span>
        </div>

        {/* Pendentes de Sincronização */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400">Pendentes de Sync</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-400">
            {pendingSyncCount}
          </p>
          <span className="text-[11px] text-slate-500">Aguardando envio remoto</span>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por Razão Social, CNPJ ou chave de acesso..."
          className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
        />
      </div>

      {/* Lista de Notas Fiscais ou Estado Vazio */}
      {filteredInvoices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInvoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id || invoice.accessKey}
              invoice={invoice}
              onDelete={handleDelete}
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
              {searchTerm ? 'Nenhuma nota encontrada para esta busca' : 'Nenhuma nota fiscal cadastrada ainda'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {searchTerm
                ? 'Tente buscar por outro termo, CNPJ ou limpe o campo de busca.'
                : 'Escaneie o QR Code de um cupom NFC-e ou registre uma chave para começar.'}
            </p>
          </div>
          {!searchTerm && (
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
    </div>
  );
};
