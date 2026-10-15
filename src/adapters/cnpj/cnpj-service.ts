import type { ICnpjProvider, CnpjDto } from '@/ports/cnpj-provider.port';
import { MinhaReceitaAdapter } from './minha-receita.adapter';
import { CnpjWsAdapter } from './cnpj-ws.adapter';

export class CnpjService {
  private providers: ICnpjProvider[];
  private cache = new Map<string, CnpjDto>();

  constructor(providers?: ICnpjProvider[]) {
    // Ordem de prioridade padrão: 1º Minha Receita (mais rápido/estável), 2º CNPJ.ws (contingência)
    this.providers = providers || [new MinhaReceitaAdapter(), new CnpjWsAdapter()];
  }

  /**
   * Resolve dados cadastrais do CNPJ consultando os adaptadores em cascata resiliente.
   * Utiliza cache em memória para evitar requisições de rede redundantes.
   * Se options?.forceRefresh for true, ignora o cache e força nova consulta aos provedores.
   */
  async resolveCnpj(
    cnpj: string,
    options?: { forceRefresh?: boolean }
  ): Promise<CnpjDto> {
    const cleanCnpj = cnpj.replace(/\D/g, '');

    if (cleanCnpj.length !== 14) {
      throw new Error(
        `CNPJ deve conter 14 dígitos numéricos. Recebido: ${cleanCnpj.length}`
      );
    }

    // 1. Verifica cache local em memória (a menos que forceRefresh seja solicitado)
    if (options?.forceRefresh) {
      this.cache.delete(cleanCnpj);
    } else if (this.cache.has(cleanCnpj)) {
      return this.cache.get(cleanCnpj)!;
    }

    const errors: string[] = [];

    // 2. Itera pelos provedores com fallback automático
    for (const provider of this.providers) {
      try {
        const result = await provider.fetchByCnpj(cleanCnpj);
        // Armazena no cache em memória
        this.cache.set(cleanCnpj, result);
        return result;
      } catch (err: unknown) {
        const errorMsg = (err as Error)?.message || 'Erro desconhecido';
        console.warn(
          `[CnpjService] Falha no provedor ${provider.name}: ${errorMsg}. Acionando contingência...`
        );
        errors.push(`${provider.name}: ${errorMsg}`);
      }
    }

    // 3. Se todos os provedores falharem (ou offline)
    throw new Error(
      `Não foi possível consultar o CNPJ automaticamente (${errors.join('; ')}). Por favor, informe a Razão Social manualmente.`
    );
  }

  /**
   * Limpa o cache em memória
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Invalida o cache em memória para um CNPJ específico ou todo o cache
   */
  invalidateCache(cnpj?: string): void {
    if (cnpj) {
      this.cache.delete(cnpj.replace(/\D/g, ''));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Retorna a lista de provedores configurados
   */
  getProviders(): ICnpjProvider[] {
    return [...this.providers];
  }

  /**
   * Retorna a quantidade de CNPJs em cache
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

// Instância singleton padrão do serviço
export const cnpjService = new CnpjService();
