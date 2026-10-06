import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { ChurchManagerDB } from '@/adapters/storage/db';
import { DexieInvoiceRepository } from '@/adapters/storage/dexie-invoice.repository';
import { ImageCompressionService } from '@/services/image-compression.service';

describe('Storage & Dexie: Repositório de Notas Fiscais', () => {
  let testDb: ChurchManagerDB;
  let repository: DexieInvoiceRepository;

  beforeEach(() => {
    // Instancia um banco isolado em memória para cada teste
    const dbName = `test_db_${Date.now()}_${Math.random()}`;
    testDb = new ChurchManagerDB();
    // Substitui o nome para isolamento
    (testDb as any).name = dbName;
    repository = new DexieInvoiceRepository(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('deve cadastrar uma nova nota fiscal e recuperar pelo ID', async () => {
    const fakeBlob = new Blob(['simulated-jpeg-binary-data'], { type: 'image/jpeg' });
    const accessKey = '35261012345678000199550010000000421123456789';

    const id = await repository.create({
      accessKey,
      type: 'NFE',
      emissionDate: '2026-10',
      issuerCnpj: '12345678000199',
      issuerName: 'Papelaria Central de São Paulo Ltda',
      model: '55',
      series: '1',
      number: '42',
      totalAmount: 189.5,
      imageBlob: fakeBlob,
      sefazDataStatus: 'PENDING',
      syncStatus: 'PENDING_SYNC'
    });

    expect(id).toBeDefined();
    expect(typeof id).toBe('number');

    const retrieved = await repository.findById(id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.accessKey).toBe(accessKey);
    expect(retrieved?.issuerName).toBe('Papelaria Central de São Paulo Ltda');
    expect(retrieved?.totalAmount).toBe(189.5);
    expect(retrieved?.syncStatus).toBe('PENDING_SYNC');
    expect(retrieved?.sefazDataStatus).toBe('PENDING');

    // Validação estrita: Imagem armazenada como Blob nativo, NÃO Base64!
    expect(retrieved?.imageBlob).toBeInstanceOf(Blob);
    expect(retrieved?.imageBlob?.size).toBeGreaterThan(0);
    expect(retrieved?.imageBlob?.type).toBe('image/jpeg');
  });

  it('deve buscar nota fiscal pela chave de acesso de 44 dígitos', async () => {
    const accessKey = '43261098765432000188650020000001501123456780';

    await repository.create({
      accessKey,
      type: 'NFCE',
      issuerCnpj: '98765432000188',
      issuerName: 'Supermercado do Bairro',
      sefazDataStatus: 'SUCCESS',
      syncStatus: 'PENDING_SYNC'
    });

    const found = await repository.findByAccessKey(accessKey);
    expect(found).toBeDefined();
    expect(found?.type).toBe('NFCE');
    expect(found?.issuerName).toBe('Supermercado do Bairro');
  });

  it('deve impedir o cadastro de chaves de acesso duplicadas (ConstraintError)', async () => {
    const duplicateKey = '35261012345678000199550010000000421123456789';

    await repository.create({
      accessKey: duplicateKey,
      type: 'NFE',
      issuerCnpj: '12345678000199',
      sefazDataStatus: 'PENDING',
      syncStatus: 'PENDING_SYNC'
    });

    // Segunda tentativa com a mesma chave deve falhar pelo índice único &accessKey
    await expect(
      repository.create({
        accessKey: duplicateKey,
        type: 'NFE',
        issuerCnpj: '12345678000199',
        sefazDataStatus: 'PENDING',
        syncStatus: 'PENDING_SYNC'
      })
    ).rejects.toThrow();
  });

  it('deve atualizar campos de uma nota existente', async () => {
    const id = await repository.create({
      accessKey: '11111111111111111111111111111111111111111111',
      type: 'NFE',
      issuerCnpj: '12345678000199',
      issuerName: 'Nome Provisório',
      sefazDataStatus: 'PENDING',
      syncStatus: 'PENDING_SYNC'
    });

    await repository.update(id, {
      issuerName: 'Nome Corrigido Oficial Ltda',
      syncStatus: 'SYNCED',
      totalAmount: 250.75
    });

    const updated = await repository.findById(id);
    expect(updated?.issuerName).toBe('Nome Corrigido Oficial Ltda');
    expect(updated?.syncStatus).toBe('SYNCED');
    expect(updated?.totalAmount).toBe(250.75);
    expect(updated?.updatedAt).toBeGreaterThan(0);
  });

  it('deve listar notas pendentes de sincronização', async () => {
    await repository.create({
      accessKey: '10000000000000000000000000000000000000000001',
      type: 'NFE',
      issuerCnpj: '11111111000101',
      sefazDataStatus: 'PENDING',
      syncStatus: 'PENDING_SYNC'
    });

    await repository.create({
      accessKey: '20000000000000000000000000000000000000000002',
      type: 'NFCE',
      issuerCnpj: '22222222000102',
      sefazDataStatus: 'SUCCESS',
      syncStatus: 'SYNCED'
    });

    const pending = await repository.listPendingSync();
    expect(pending).toHaveLength(1);
    expect(pending[0].accessKey).toBe('10000000000000000000000000000000000000000001');
  });

  it('deve excluir uma nota cadastrada', async () => {
    const id = await repository.create({
      accessKey: '99999999999999999999999999999999999999999999',
      type: 'NFE',
      issuerCnpj: '99999999000199',
      sefazDataStatus: 'PENDING',
      syncStatus: 'PENDING_SYNC'
    });

    expect(await repository.findById(id)).toBeDefined();

    await repository.delete(id);

    expect(await repository.findById(id)).toBeUndefined();
  });
});

describe('ImageCompressionService & ObjectURL Lifecycle', () => {
  it('deve gerar e revogar URLs de preview sem falhas', () => {
    // Mock simples de URL caso rode em ambiente Node puro
    if (typeof globalThis.URL.createObjectURL !== 'function') {
      globalThis.URL.createObjectURL = () => 'blob:http://localhost:5173/fake-uuid';
      globalThis.URL.revokeObjectURL = () => {};
    }

    const blob = new Blob(['sample-image'], { type: 'image/jpeg' });
    const { url, revoke } = ImageCompressionService.createPreviewUrl(blob);

    expect(url).toBeDefined();
    expect(typeof url).toBe('string');
    expect(typeof revoke).toBe('function');

    // Revoga a URL sem gerar erros
    expect(() => revoke()).not.toThrow();
  });
});
