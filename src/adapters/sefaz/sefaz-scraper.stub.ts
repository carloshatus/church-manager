import type { ISefazScraper, SefazScrapeResult } from '@/ports/sefaz-scraper.port';

/**
 * Implementação inicial Stub para a interface ISefazScraper.
 * Prepara o desacoplamento arquitetural para a futura fase de web scraping direto da SEFAZ.
 */
export class SefazScraperStub implements ISefazScraper {
  async scrapeByQrCodeUrl(qrCodeUrl: string): Promise<SefazScrapeResult> {
    console.info(`[SefazScraperStub] Web scraping agendado para a URL: ${qrCodeUrl}`);
    return {
      accessKey: '',
      items: [],
    };
  }

  async scrapeByAccessKey(accessKey: string, uf: string): Promise<SefazScrapeResult> {
    console.info(
      `[SefazScraperStub] Web scraping agendado para a chave: ${accessKey} (UF: ${uf})`
    );
    return {
      accessKey,
      items: [],
    };
  }
}

export const sefazScraper = new SefazScraperStub();
