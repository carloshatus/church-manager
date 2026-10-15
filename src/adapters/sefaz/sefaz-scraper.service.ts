import type { ISefazScraper, SefazScrapeResult } from '@/ports/sefaz-scraper.port';
import { sefazParserRegistry } from './parsers/sefaz-parser-registry';
import { getUfFromCode } from '@/domain/parsers/ufs';

export interface SefazScraperOptions {
  corsProxyUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Orquestrador de Web Scraping da SEFAZ para PWA Offline-First.
 * Suporta proxy CORS transparente, resolução dinâmica de parser por estado
 * e fallback gracioso com mensagens descritivas.
 */
export class SefazScraperService implements ISefazScraper {
  private defaultCorsProxyUrl: string;
  private fetchFn: typeof fetch;
  private defaultTimeoutMs: number;

  constructor(options: SefazScraperOptions = {}) {
    // Por padrão, utiliza AllOrigins Raw ou proxy configurado
    this.defaultCorsProxyUrl =
      options.corsProxyUrl ?? 'https://api.allorigins.win/raw?url=';
    this.fetchFn = options.fetchFn
      ? options.fetchFn.bind(globalThis)
      : (...args: Parameters<typeof fetch>) => globalThis.fetch(...args);
    this.defaultTimeoutMs = options.timeoutMs ?? 12000;
  }

  /**
   * Constrói a URL final aplicando o proxy CORS se necessário.
   */
  private buildProxiedUrl(targetUrl: string, customProxy?: string): string {
    const proxy = customProxy ?? this.defaultCorsProxyUrl;
    if (!proxy || proxy.trim() === '') {
      return targetUrl;
    }

    if (proxy.includes('${url}')) {
      return proxy.replace('${url}', encodeURIComponent(targetUrl));
    }

    // Se o proxy terminar com '=', apenas anexa a URL codificada
    if (proxy.endsWith('=')) {
      return `${proxy}${encodeURIComponent(targetUrl)}`;
    }

    // Caso contrário, adiciona barra se necessário
    const separator = proxy.endsWith('/') ? '' : '/';
    return `${proxy}${separator}${encodeURIComponent(targetUrl)}`;
  }

  /**
   * Extrai a UF da chave de 44 dígitos (primeiros 2 dígitos = código IBGE do estado).
   */
  private extractUfFromKey(accessKey: string): string {
    const clean = accessKey.replace(/\D/g, '');
    if (clean.length >= 2) {
      const ufCode = clean.substring(0, 2);
      const uf = getUfFromCode(ufCode);
      if (uf) return uf.uf;
    }
    return '';
  }

  /**
   * Processa diretamente uma string HTML bruta obtida (ex: colada pelo usuário
   * ou retornada de um proxy/webview).
   */
  parseRawHtml(
    html: string,
    ufHint?: string,
    urlHint?: string,
    accessKeyHint?: string
  ): SefazScrapeResult {
    const effectiveUf =
      ufHint || (accessKeyHint ? this.extractUfFromKey(accessKeyHint) : '');
    const parser = sefazParserRegistry.getParser(effectiveUf, urlHint);

    if (!parser) {
      throw new Error(
        `Nenhum parser da SEFAZ disponível para o estado "${effectiveUf || 'desconhecido'}". Verifique se o estado é suportado.`
      );
    }

    return parser.parseDanfeHtml(html, accessKeyHint);
  }

  /**
   * Realiza o scraping da página do DANFE da SEFAZ a partir da URL do QR Code.
   */
  async scrapeByQrCodeUrl(
    qrCodeUrl: string,
    corsProxyUrl?: string
  ): Promise<SefazScrapeResult> {
    const trimmedUrl = qrCodeUrl.trim();
    if (!trimmedUrl) {
      throw new Error('A URL do QR Code da SEFAZ não pode ser vazia.');
    }

    // 1. Localiza o parser correspondente antes de fazer a requisição de rede
    const parser = sefazParserRegistry.getParser('', trimmedUrl);
    if (!parser) {
      throw new Error(
        'A URL informada não pertence a nenhuma SEFAZ estadual com parser homologado.'
      );
    }

    // 2. Constrói a URL através do proxy CORS
    const fetchUrl = this.buildProxiedUrl(trimmedUrl, corsProxyUrl);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.defaultTimeoutMs);

      const response = await this.fetchFn(fetchUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(
          `Servidor da SEFAZ retornou status ${response.status} (${response.statusText}).`
        );
      }

      const html = await response.text();
      if (!html || html.trim().length === 0) {
        throw new Error('A resposta do portal da SEFAZ retornou vazia.');
      }

      return parser.parseDanfeHtml(html);
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError') {
        throw new Error(
          'Tempo limite esgotado ao consultar a SEFAZ. O portal pode estar instável ou offline.',
          { cause: err }
        );
      }
      throw new Error(
        `Falha ao consultar SEFAZ: ${error.message || 'Erro de conexão/CORS'}. Você pode salvar a nota e tentar depois ou colar o HTML.`,
        { cause: err }
      );
    }
  }

  /**
   * Realiza a consulta pela chave de acesso de 44 dígitos e UF.
   */
  async scrapeByAccessKey(
    accessKey: string,
    uf: string,
    corsProxyUrl?: string
  ): Promise<SefazScrapeResult> {
    const cleanKey = accessKey.replace(/\D/g, '');
    if (cleanKey.length !== 44) {
      throw new Error('A chave de acesso deve ter exatamente 44 dígitos.');
    }

    const effectiveUf = uf ? uf.toUpperCase() : this.extractUfFromKey(cleanKey);
    const parser = sefazParserRegistry.getParser(effectiveUf);

    if (!parser) {
      throw new Error(`Nenhum parser da SEFAZ cadastrado para a UF "${effectiveUf}".`);
    }

    // Para a Bahia (BA), a URL de consulta por chave padrão:
    if (effectiveUf === 'BA') {
      const baUrl = `http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/NFCEC_consulta_chave_acesso.aspx?p=${cleanKey}|2|1|1|`;
      return this.scrapeByQrCodeUrl(baUrl, corsProxyUrl);
    }

    throw new Error(
      `Consulta direta por chave para a UF ${effectiveUf} requer a URL completa do QR Code.`
    );
  }
}

export const sefazScraperService = new SefazScraperService();
