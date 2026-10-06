# 04 - Portas & Adaptadores (CNPJ Service, Fallback & SEFAZ Scraper)

Este documento detalha o padrão arquitetural **Ports and Adapters** para consulta de CNPJ com resiliência a falhas (fallback sequencial automático) e a interface preparada para o scraper da SEFAZ.

---

## 1. Porta de Consulta de CNPJ (`ICnpjProvider`)

A porta define o contrato que qualquer provedor de consulta cadastral da Receita Federal deve cumprir:

```typescript
// src/ports/cnpj-provider.port.ts

export interface CnpjDto {
  cnpj: string;               // 14 dígitos
  razaoSocial: string;        // Nome empresarial oficial
  nomeFantasia?: string;      // Nome comercial/fantasia
  uf?: string;                // Sigla do estado (ex: "SP")
  municipio?: string;         // Nome do município
  cnaeFiscalDescricao?: string;// Atividade principal
  status?: string;            // 'ATIVA', etc.
  provider: 'BrasilAPI' | 'MinhaReceita' | 'Manual';
}

export interface ICnpjProvider {
  readonly name: string;
  fetchByCnpj(cleanCnpj: string): Promise<CnpjDto>;
}
```

---

## 2. Adaptador 1: BrasilAPI (`BrasilApiAdapter`)

A **BrasilAPI** é o provedor primário (`https://brasilapi.com.br/api/cnpj/v1/{cnpj}`). Possui CDN e respostas rápidas.

```typescript
// src/adapters/cnpj/brasil-api.adapter.ts
import type { ICnpjProvider, CnpjDto } from '@/ports/cnpj-provider.port';

interface BrasilApiResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  uf?: string;
  municipio?: string;
  cnae_fiscal_descricao?: string;
  descricao_situacao_cadastral?: string;
}

export class BrasilApiAdapter implements ICnpjProvider {
  public readonly name = 'BrasilAPI';
  private readonly baseUrl = 'https://brasilapi.com.br/api/cnpj/v1';
  private readonly timeoutMs = 6000;

  async fetchByCnpj(cleanCnpj: string): Promise<CnpjDto> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/${cleanCnpj}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`BrasilAPI retornou status HTTP ${response.status}`);
      }

      const data: BrasilApiResponse = await response.json();

      return {
        cnpj: data.cnpj.replace(/\D/g, ''),
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia || undefined,
        uf: data.uf,
        municipio: data.municipio,
        cnaeFiscalDescricao: data.cnae_fiscal_descricao,
        status: data.descricao_situacao_cadastral,
        provider: 'BrasilAPI'
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Timeout na consulta à BrasilAPI (${this.timeoutMs}ms)`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

---

## 3. Adaptador 2: Minha Receita (`MinhaReceitaAdapter`)

A **Minha Receita** é o provedor secundário de contingência (`https://minhareceita.org/{cnpj}`):

```typescript
// src/adapters/cnpj/minha-receita.adapter.ts
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
  private readonly baseUrl = 'https://minhareceita.org';
  private readonly timeoutMs = 7000;

  async fetchByCnpj(cleanCnpj: string): Promise<CnpjDto> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/${cleanCnpj}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
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
        provider: 'MinhaReceita'
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Timeout na consulta à Minha Receita (${this.timeoutMs}ms)`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

---

## 4. Orquestrador Resiliente (`CnpjService`)

O `CnpjService` encapsula a lógica de fallback e um cache em memória para evitar requisições redundantes durante a sessão do usuário:

```typescript
// src/adapters/cnpj/cnpj-service.ts
import type { ICnpjProvider, CnpjDto } from '@/ports/cnpj-provider.port';
import { BrasilApiAdapter } from './brasil-api.adapter';
import { MinhaReceitaAdapter } from './minha-receita.adapter';

export class CnpjService {
  private providers: ICnpjProvider[];
  private cache = new Map<string, CnpjDto>();

  constructor(providers?: ICnpjProvider[]) {
    // Ordem de prioridade: 1º BrasilAPI, 2º MinhaReceita
    this.providers = providers || [
      new BrasilApiAdapter(),
      new MinhaReceitaAdapter()
    ];
  }

  /**
   * Resolve o CNPJ consultando provedores em cascata.
   */
  async resolveCnpj(cnpj: string): Promise<CnpjDto> {
    const cleanCnpj = cnpj.replace(/\D/g, '');

    if (cleanCnpj.length !== 14) {
      throw new Error(`CNPJ deve conter 14 dígitos. Recebido: ${cleanCnpj.length}`);
    }

    // 1. Verifica cache local em memória
    if (this.cache.has(cleanCnpj)) {
      return this.cache.get(cleanCnpj)!;
    }

    const errors: string[] = [];

    // 2. Itera pelos provedores com fallback automático
    for (const provider of this.providers) {
      try {
        const result = await provider.fetchByCnpj(cleanCnpj);
        // Salva em cache
        this.cache.set(cleanCnpj, result);
        return result;
      } catch (err: any) {
        console.warn(`[CnpjService] Falha no provedor ${provider.name}: ${err.message}. Tentando próximo...`);
        errors.push(`${provider.name}: ${err.message}`);
      }
    }

    // 3. Se todos falharem ou sem conexão
    throw new Error(`Não foi possível consultar o CNPJ em nenhum dos serviços (${errors.join('; ')}). Insira a Razão Social manualmente.`);
  }

  /**
   * Limpa o cache se necessário
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Instância padrão singleton
export const cnpjService = new CnpjService();
```

---

## 5. Porta & Stub do Scraper da SEFAZ (`ISefazScraper`)

Para preparar o terreno para a fase de web scraping direto da SEFAZ, definimos o contrato e o stub desacoplado:

```typescript
// src/ports/sefaz-scraper.port.ts

export interface SefazInvoiceItem {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface SefazScrapeResult {
  accessKey: string;
  totalAmount?: number;
  emissionDate?: string;
  protocol?: string;
  items: SefazInvoiceItem[];
  rawHtml?: string;
}

export interface ISefazScraper {
  scrapeByQrCodeUrl(qrCodeUrl: string): Promise<SefazScrapeResult>;
  scrapeByAccessKey(accessKey: string, uf: string): Promise<SefazScrapeResult>;
}
```

### Implementação Stub (Preparação):
```typescript
// src/adapters/sefaz/sefaz-scraper.stub.ts
import type { ISefazScraper, SefazScrapeResult } from '@/ports/sefaz-scraper.port';

export class SefazScraperStub implements ISefazScraper {
  async scrapeByQrCodeUrl(qrCodeUrl: string): Promise<SefazScrapeResult> {
    console.info(`[SefazScraperStub] Web scraping agendado para URL: ${qrCodeUrl}`);
    // Na fase atual, retorna estrutura vazia para integração futura
    return {
      accessKey: '',
      items: []
    };
  }

  async scrapeByAccessKey(accessKey: string, uf: string): Promise<SefazScrapeResult> {
    console.info(`[SefazScraperStub] Web scraping agendado para chave: ${accessKey} (UF: ${uf})`);
    return {
      accessKey,
      items: []
    };
  }
}

export const sefazScraper = new SefazScraperStub();
```
