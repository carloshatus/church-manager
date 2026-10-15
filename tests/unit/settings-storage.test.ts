import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { ChurchManagerDB } from '@/adapters/storage/db';
import { DexieSettingsRepository } from '@/adapters/storage/dexie-settings.repository';
import type { AuthorizedRecipient } from '@/domain/entities/church-settings';

describe('Storage & Dexie: Repositório de Configurações da Igreja (Settings)', () => {
  let testDb: ChurchManagerDB;
  let repository: DexieSettingsRepository;

  beforeEach(() => {
    testDb = new ChurchManagerDB();
    (testDb as any).name = `test_settings_db_${Date.now()}_${Math.random()}`;
    repository = new DexieSettingsRepository(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('deve retornar configurações padrão iniciais se nenhuma estiver salva', async () => {
    const settings = await repository.getSettings();
    expect(settings).toBeDefined();
    expect(settings.id).toBe('default');
    expect(settings.churchName).toBe('Igreja Local');
    expect(settings.authorizedRecipients).toEqual([]);
    expect(settings.corsProxyUrl).toContain('allorigins.win');
  });

  it('deve salvar e atualizar os dados da igreja e destinatários autorizados', async () => {
    const newRecipient: AuthorizedRecipient = {
      id: 'rec-test-1',
      name: 'Pastor João da Silva',
      cpfCnpj: '12345678901',
      role: 'PASTOR',
    };

    await repository.saveSettings({
      id: 'default',
      churchName: 'Primeira Igreja Batista da Esperança',
      mainCnpj: '17261509000186',
      authorizedRecipients: [newRecipient],
      corsProxyUrl: 'https://my-custom-proxy.workers.dev/?url=',
      updatedAt: Date.now(),
    });

    const retrieved = await repository.getSettings();
    expect(retrieved.churchName).toBe('Primeira Igreja Batista da Esperança');
    expect(retrieved.mainCnpj).toBe('17261509000186');
    expect(retrieved.corsProxyUrl).toBe('https://my-custom-proxy.workers.dev/?url=');
    expect(retrieved.authorizedRecipients).toHaveLength(1);
    expect(retrieved.authorizedRecipients[0].name).toBe('Pastor João da Silva');
    expect(retrieved.authorizedRecipients[0].role).toBe('PASTOR');
  });
});
