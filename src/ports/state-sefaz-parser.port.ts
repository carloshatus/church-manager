import type { SefazScrapeResult } from './sefaz-scraper.port';

/**
 * Contrato abstrato para parsers de DANFE / páginas de consulta da SEFAZ estadual.
 * Permite adicionar suporte modular a qualquer UF brasileira (BA, SP, RJ, MG, etc.)
 * seguindo o padrão Registry / Strategy.
 */
export interface IStateSefazParser {
  readonly uf: string;
  canHandle(uf: string, url?: string): boolean;
  parseDanfeHtml(html: string, accessKeyHint?: string): SefazScrapeResult;
}
