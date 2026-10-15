import { describe, it, expect, vi } from 'vitest';
import { SefazScraperService } from '@/adapters/sefaz/sefaz-scraper.service';

const sampleBaHtml = `
<div class="txtCenter">
  <div class="txtTopo">SUPERMERCADO TESTE BA</div>
  <div class="text">CNPJ: 11.222.333/0001-44</div>
</div>
<div id="totalNota"><span class="totalNumb txtMax">150,00</span></div>
<h4>Consumidor</h4>
<ul><li>Consumidor não identificado</li></ul>
`;

describe('Adapters: SefazScraperService (Orquestrador de Scraping com Proxy CORS)', () => {
  it('deve realizar scraping com sucesso através do proxy CORS e delegar ao parser da Bahia', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => sampleBaHtml,
    });

    const scraper = new SefazScraperService({
      fetchFn: mockFetch as any,
      corsProxyUrl: 'https://proxy.example.com/?url=',
    });

    const targetUrl =
      'http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/NFCEC_consulta_chave_acesso.aspx?p=29260944053985000199650010000661511323710790|2|1|1|HASH';

    const result = await scraper.scrapeByQrCodeUrl(targetUrl);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe(
      `https://proxy.example.com/?url=${encodeURIComponent(targetUrl)}`
    );

    expect(result.issuerName).toBe('SUPERMERCADO TESTE BA');
    expect(result.issuerCnpj).toBe('11222333000144');
    expect(result.totalAmount).toBe(150.0);
    expect(result.recipientName).toBe('Consumidor não identificado');
  });

  it('deve lançar erro amigável se a requisição falhar ou retornar erro HTTP', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    const scraper = new SefazScraperService({ fetchFn: mockFetch as any });
    const targetUrl =
      'http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/NFCEC_consulta_chave_acesso.aspx?p=...';

    await expect(scraper.scrapeByQrCodeUrl(targetUrl)).rejects.toThrow(
      'Falha ao consultar SEFAZ: Servidor da SEFAZ retornou status 503'
    );
  });

  it('deve lançar erro descritivo quando a URL pertencer a uma UF sem parser homologado', async () => {
    const scraper = new SefazScraperService();
    const unsupportedUrl = 'https://nfe.fazenda.sp.gov.br/consulta';

    await expect(scraper.scrapeByQrCodeUrl(unsupportedUrl)).rejects.toThrow(
      'A URL informada não pertence a nenhuma SEFAZ estadual com parser homologado'
    );
  });

  it('deve processar HTML bruto diretamente através de parseRawHtml', () => {
    const scraper = new SefazScraperService();
    const result = scraper.parseRawHtml(sampleBaHtml, 'BA');

    expect(result.issuerName).toBe('SUPERMERCADO TESTE BA');
    expect(result.totalAmount).toBe(150.0);
  });

  it('deve delegar a globalThis.fetch preservando o contexto global e evitando Illegal invocation', async () => {
    let callCount = 0;
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = function (this: unknown) {
        callCount++;
        expect(this).toBe(globalThis);
        return Promise.resolve({
          ok: true,
          status: 200,
          text: async () => sampleBaHtml,
        } as any);
      } as any;

      const defaultScraper = new SefazScraperService();
      const baUrl =
        'http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/NFCEC_consulta_chave_acesso.aspx?p=29260944053985000199650010000661511323710790|2|1|1|HASH';

      await defaultScraper.scrapeByQrCodeUrl(baUrl);
      expect(callCount).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

