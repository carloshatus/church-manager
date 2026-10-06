import type { ICnpjProvider, CnpjDto } from '@/ports/cnpj-provider.port';

interface MinhaReceitaResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  uf?: string;
  municipio?: string;
  cnae_fiscal_descricao?: string;
  descricao_situacao_cadastral?: string;
}

export class MinhaReceitaAdapter implements ICnpjProvider {
  public readonly name = 'MinhaReceita';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(baseUrl = 'https://minhareceita.org', timeoutMs = 7000, fetchFn = fetch) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetchFn;
  }

  async fetchByCnpj(cleanCnpj: string): Promise<CnpjDto> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(`${this.baseUrl}/${cleanCnpj}`, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Minha Receita retornou status HTTP ${response.status}`);
      }

      const data: MinhaReceitaResponse = await response.json();

      return {
        cnpj: data.cnpj.replace(/\D/g, ''),
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia || undefined,
        uf: data.uf,
        municipio: data.municipio,
        cnaeFiscalDescricao: data.cnae_fiscal_descricao,
        status: data.descricao_situacao_cadastral,
        provider: 'MinhaReceita',
      };
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Timeout na consulta à Minha Receita (${this.timeoutMs}ms)`, {
          cause: error,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
