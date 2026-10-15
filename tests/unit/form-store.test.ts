import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { useInvoiceFormStore } from '@/stores/use-invoice-form-store';
import { cnpjService } from '@/adapters/cnpj/cnpj-service';
import { sefazScraperService } from '@/adapters/sefaz/sefaz-scraper.service';
import { invoiceRepository } from '@/adapters/storage/dexie-invoice.repository';
import { calculateNFeKeyDv } from '@/domain/validators/key-checksum';

describe('Form Store: useInvoiceFormStore', () => {
  const base43 = '3526101234567800019955001000000042112345678';
  const dv = calculateNFeKeyDv(base43);
  const sampleKey = `${base43}${dv}`;

  beforeEach(() => {
    useInvoiceFormStore.getState().resetForm();
    vi.restoreAllMocks();
  });

  it('deve atualizar campos com setFormField permitindo override manual livre', () => {
    const store = useInvoiceFormStore.getState();

    store.setFormField('issuerName', 'Padaria do Bairro');
    expect(useInvoiceFormStore.getState().fields.issuerName).toBe('Padaria do Bairro');

    store.setFormField('totalAmount', '150,50');
    expect(useInvoiceFormStore.getState().fields.totalAmount).toBe('150,50');
  });

  it('deve auto-decompor a chave ao atualizar o campo accessKey', () => {
    const store = useInvoiceFormStore.getState();

    store.setFormField('accessKey', sampleKey);
    const state = useInvoiceFormStore.getState();

    expect(state.fields.type).toBe('NFE');
    expect(state.fields.issuerCnpj).toBe('12345678000199');
    expect(state.fields.model).toBe('55');
    expect(state.fields.series).toBe('1');
    expect(state.fields.number).toBe('42');
  });

  it('deve processar dados escaneados e disparar resolução de CNPJ', async () => {
    vi.spyOn(cnpjService, 'resolveCnpj').mockResolvedValue({
      cnpj: '12345678000199',
      razaoSocial: 'Comércio de Materiais de Construção Ltda',
      provider: 'BrasilAPI',
    });

    const store = useInvoiceFormStore.getState();
    const qrCodeUrl = `https://www.fazenda.sp.gov.br/qrcode?p=${sampleKey}|2|1|1|HASH`;

    await store.handleScannedData(qrCodeUrl);
    const state = useInvoiceFormStore.getState();

    expect(state.fields.accessKey).toBe(sampleKey);
    expect(state.fields.qrCodeUrl).toBe(qrCodeUrl);
    expect(state.fields.issuerName).toBe('Comércio de Materiais de Construção Ltda');
    expect(state.cnpjProviderUsed).toBe('BrasilAPI');
    expect(state.cnpjError).toBeNull();
    expect(state.isScanningModalOpen).toBe(false);
  });

  it('deve permitir cadastro manual caso a consulta de CNPJ falhe (resiliência)', async () => {
    vi.spyOn(cnpjService, 'resolveCnpj').mockRejectedValue(
      new Error('Falha de conexão com os serviços de CNPJ')
    );

    const store = useInvoiceFormStore.getState();
    await store.handleScannedData(sampleKey);

    const state = useInvoiceFormStore.getState();
    expect(state.cnpjError).toContain('Falha de conexão');

    // Usuário insere Razão Social manualmente
    store.setFormField('issuerName', 'Nome Digitado Manualmente');
    expect(useInvoiceFormStore.getState().fields.issuerName).toBe(
      'Nome Digitado Manualmente'
    );
  });

  it('deve salvar a nota fiscal no repositório IndexedDB e resetar o formulário', async () => {
    vi.spyOn(invoiceRepository, 'create').mockResolvedValue(42);

    const store = useInvoiceFormStore.getState();
    store.setFormField('accessKey', sampleKey);
    store.setFormField('issuerCnpj', '12345678000199');
    store.setFormField('issuerName', 'Igreja Local');
    store.setFormField('totalAmount', '230,00');

    const id = await store.submitInvoice();

    expect(id).toBe(42);
    expect(invoiceRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accessKey: sampleKey,
        issuerCnpj: '12345678000199',
        issuerName: 'Igreja Local',
        totalAmount: 230,
        syncStatus: 'PENDING_SYNC',
        sefazDataStatus: 'PENDING',
      })
    );

    // Formulário deve ter sido resetado
    expect(useInvoiceFormStore.getState().fields.accessKey).toBe('');
    expect(useInvoiceFormStore.getState().lastSavedId).toBe(42);
  });

  it('deve disparar resolução de CNPJ automaticamente ao informar chave de 44 dígitos no accessKey', async () => {
    vi.spyOn(cnpjService, 'resolveCnpj').mockResolvedValue({
      cnpj: '12345678000199',
      razaoSocial: 'Auto Resolvido Por Chave Ltda',
      provider: 'MinhaReceita',
    });

    const store = useInvoiceFormStore.getState();
    store.setFormField('accessKey', sampleKey);

    // Aguarda microtask de resolução
    await vi.waitFor(() => {
      expect(useInvoiceFormStore.getState().fields.issuerName).toBe(
        'Auto Resolvido Por Chave Ltda'
      );
    });

    expect(useInvoiceFormStore.getState().cnpjProviderUsed).toBe('MinhaReceita');
  });

  it('deve aceitar URL de NFC-e colada no campo accessKey e disparar resolução de CNPJ', async () => {
    vi.spyOn(cnpjService, 'resolveCnpj').mockResolvedValue({
      cnpj: '12345678000199',
      razaoSocial: 'Auto Resolvido Por URL Ltda',
      provider: 'BrasilAPI',
    });

    const store = useInvoiceFormStore.getState();
    const nfceUrl = `https://www.fazenda.sp.gov.br/nfce/qrcode?p=${sampleKey}|2|1|1|HASH`;
    store.setFormField('accessKey', nfceUrl);

    expect(useInvoiceFormStore.getState().fields.accessKey).toBe(sampleKey);
    expect(useInvoiceFormStore.getState().fields.qrCodeUrl).toBe(nfceUrl);

    await vi.waitFor(() => {
      expect(useInvoiceFormStore.getState().fields.issuerName).toBe(
        'Auto Resolvido Por URL Ltda'
      );
    });
  });

  it('deve disparar resolução de CNPJ automaticamente ao digitar 14 dígitos no issuerCnpj', async () => {
    vi.spyOn(cnpjService, 'resolveCnpj').mockResolvedValue({
      cnpj: '55166633000166',
      razaoSocial: 'Beto Bolsas Vitoria da Conquista Ltda',
      provider: 'MinhaReceita',
    });

    const store = useInvoiceFormStore.getState();
    store.setFormField('issuerCnpj', '55166633000166');

    await vi.waitFor(() => {
      expect(useInvoiceFormStore.getState().fields.issuerName).toBe(
        'Beto Bolsas Vitoria da Conquista Ltda'
      );
    });
  });

  it('deve disparar scrapeSefaz e preencher itens, valor, protocolo e destinatário', async () => {
    const store = useInvoiceFormStore.getState();
    const qrCodeUrl =
      'http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/NFCEC_consulta_chave_acesso.aspx?p=29260944053985000199650010000661511323710790|2|1|1|HASH';

    vi.spyOn(sefazScraperService, 'scrapeByQrCodeUrl').mockResolvedValue({
      accessKey: '29260944053985000199650010000661511323710790',
      issuerName: 'POSTO IPIRANGA BAHIA',
      issuerCnpj: '44053985000199',
      totalAmount: 300.0,
      protocol: '9988776655',
      recipientCpfCnpj: '17261509000186',
      items: [
        {
          code: '1',
          description: 'GASOLINA COMUM',
          quantity: 50,
          unit: 'L',
          unitPrice: 6,
          totalPrice: 300,
        },
      ],
    });

    store.setFormField('qrCodeUrl', qrCodeUrl);
    await store.scrapeSefaz();

    const state = useInvoiceFormStore.getState();
    expect(state.fields.totalAmount).toBe('300,00');
    expect(state.fields.protocol).toBe('9988776655');
    expect(state.fields.recipientCpfCnpj).toBe('17261509000186');
    expect(state.items).toHaveLength(1);
    expect(state.items[0].description).toBe('GASOLINA COMUM');
    expect(state.items[0].totalPrice).toBe(300);
    expect(state.sefazScraped).toBe(true);
    expect(state.sefazError).toBeNull();
  });

  it('deve processar HTML colado manualmente através de parseRawSefazHtml', () => {
    const store = useInvoiceFormStore.getState();
    store.setFormField('accessKey', '29260944053985000199650010000661511323710790');

    const rawHtml = `
      <div class="txtCenter">
        <div class="txtTopo">PADARIA CENTRAL</div>
        <div class="text">CNPJ: 12.345.678/0001-99</div>
      </div>
      <table id="tabResult">
        <tr id="Item + 1">
          <td>
            <span class="txtTit">PAO FRANCES</span>
            <span class="RCod">(Código: 10)</span>
            <span class="Rqtd"><strong>Qtde.:</strong>1,00</span>
            <span class="RUN"><strong>UN: </strong>KG</span>
            <span class="RvlUnit"><strong>Vl. Unit.:</strong> 15,00</span>
          </td>
          <td><span class="valor">15,00</span></td>
        </tr>
      </table>
      <div id="totalNota"><span class="totalNumb txtMax">15,00</span></div>
      <h4>Consumidor</h4>
      <ul><li>Consumidor não identificado</li></ul>
    `;

    store.parseRawSefazHtml(rawHtml);

    const state = useInvoiceFormStore.getState();
    expect(state.fields.issuerName).toBe('PADARIA CENTRAL');
    expect(state.fields.totalAmount).toBe('15,00');
    expect(state.fields.recipientName).toBe('Consumidor não identificado');
    expect(state.items).toHaveLength(1);
    expect(state.items[0].description).toBe('PAO FRANCES');
  });
});
