import { Search, X } from 'lucide-react';
import type { InvoiceType, SyncStatus } from '@/domain/entities/invoice';

export interface FilterState {
  searchTerm: string;
  typeFilter: 'ALL' | InvoiceType;
  syncFilter: 'ALL' | SyncStatus;
}

interface FiltersBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  resultsCount: number;
  totalCount: number;
}

export const FiltersBar: React.FC<FiltersBarProps> = ({
  filters,
  onFilterChange,
  resultsCount,
  totalCount,
}) => {
  const hasActiveFilters =
    filters.searchTerm.trim() !== '' ||
    filters.typeFilter !== 'ALL' ||
    filters.syncFilter !== 'ALL';

  const handleReset = () => {
    onFilterChange({
      searchTerm: '',
      typeFilter: 'ALL',
      syncFilter: 'ALL',
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Campo de Busca por Texto */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) =>
              onFilterChange({ ...filters, searchTerm: e.target.value })
            }
            placeholder="Buscar por Razão Social, CNPJ ou chave de 44 dígitos..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/80 pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-primary focus:outline-none"
          />
          {filters.searchTerm && (
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, searchTerm: '' })}
              className="absolute right-3 top-3 text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtro por Modelo Fiscal */}
        <div className="flex gap-2">
          <select
            value={filters.typeFilter}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                typeFilter: e.target.value as 'ALL' | InvoiceType,
              })
            }
            className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-xs font-medium text-slate-200 focus:border-primary focus:outline-none"
          >
            <option value="ALL">Todos os Modelos</option>
            <option value="NFE">NF-e (Mod. 55)</option>
            <option value="NFCE">NFC-e (Mod. 65)</option>
          </select>

          {/* Filtro por Status de Sincronização */}
          <select
            value={filters.syncFilter}
            onChange={(e) =>
              onFilterChange({
                ...filters,
                syncFilter: e.target.value as 'ALL' | SyncStatus,
              })
            }
            className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-xs font-medium text-slate-200 focus:border-primary focus:outline-none"
          >
            <option value="ALL">Todos os Status</option>
            <option value="PENDING_SYNC">Apenas Pendentes</option>
            <option value="SYNCED">Apenas Sincronizados</option>
          </select>
        </div>
      </div>

      {/* Barra de Status dos Filtros Ativos */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>
          Exibindo <strong className="text-white">{resultsCount}</strong> de{' '}
          <strong className="text-white">{totalCount}</strong> notas
        </span>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
          >
            <X className="w-3.5 h-3.5" />
            Limpar Filtros
          </button>
        )}
      </div>
    </div>
  );
};
