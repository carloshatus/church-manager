import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { useInvoiceFormStore } from '@/stores/use-invoice-form-store';
import { cnpjService } from '@/adapters/cnpj/cnpj-service';
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
});
