import type { ICnpjProvider, CnpjDto } from '@/ports/cnpj-provider.port';

interface CnpjWsResponse {
  cnpj_raiz?: string;
  razao_social: string;
  capital_social?: string;
  responsavel_federativo?: string;
  atualizado_em?: string;
  porte?: {
    id?: string;
    descricao?: string;
  };
  natureza_juridica?: {
    id?: string;
    descricao?: string;
  };
  estabelecimento?: {
    cnpj?: string;
    nome_fantasia?: string | null;
    situacao_cadastral?: string;
    data_situacao_cadastral?: string;
    data_inicio_atividade?: string;
    tipo?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string | null;
    bairro?: string;
    cep?: string;
    ddd1?: string;
    telefone1?: string;
    email?: string | null;
    atividade_principal?: {
      id?: string;
      descricao?: string;
    };
    estado?: {
      id?: number;
      nome?: string;
      sigla?: string;
      ibge_id?: number;
    };
    cidade?: {
      id?: number;
      nome?: string;
      ibge_id?: number;
      siafi_id?: string;
    };
  };
}

export class CnpjWsAdapter implements ICnpjProvider {
  public readonly name = 'CnpjWs';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(
    baseUrl = 'https://publica.cnpj.ws/cnpj',
    timeoutMs = 7000,
    fetchFn?: typeof fetch
  ) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.fetchFn = fetchFn
      ? fetchFn.bind(globalThis)
      : (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
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
        let details = '';
        try {
          const errBody = (await response.json()) as {
            detalhes?: string;
            titulo?: string;
          };
          details = errBody.detalhes || errBody.titulo || '';
        } catch {
          // Ignora falha de parse do corpo do erro
        }
        throw new Error(
          `CNPJ.ws retornou status HTTP ${response.status}${details ? `: ${details}` : ''}`
        );
      }

      const data: CnpjWsResponse = await response.json();

      return {
        cnpj: data.estabelecimento?.cnpj
          ? data.estabelecimento.cnpj.replace(/\D/g, '')
          : cleanCnpj,
        razaoSocial: data.razao_social,
        nomeFantasia: data.estabelecimento?.nome_fantasia || undefined,
        uf: data.estabelecimento?.estado?.sigla || undefined,
        municipio: data.estabelecimento?.cidade?.nome || undefined,
        cnaeFiscalDescricao:
          data.estabelecimento?.atividade_principal?.descricao || undefined,
        status: data.estabelecimento?.situacao_cadastral || undefined,
        provider: 'CnpjWs',
      };
    } catch (error: unknown) {
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Timeout na consulta ao CNPJ.ws (${this.timeoutMs}ms)`, {
          cause: error,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
