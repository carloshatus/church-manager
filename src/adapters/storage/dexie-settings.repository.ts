import { db, ChurchManagerDB } from './db';
import type { ChurchSettings } from '@/domain/entities/church-settings';
import type { IChurchSettingsRepository } from '@/ports/church-settings-repository.port';

export const DEFAULT_CHURCH_SETTINGS: ChurchSettings = {
  id: 'default',
  churchName: 'Igreja Local',
  mainCnpj: '',
  authorizedRecipients: [],
  corsProxyUrl: 'https://api.allorigins.win/raw?url=',
  updatedAt: Date.now(),
};

export class DexieSettingsRepository implements IChurchSettingsRepository {
  private database: ChurchManagerDB;

  constructor(database: ChurchManagerDB = db) {
    this.database = database;
  }

  async getSettings(): Promise<ChurchSettings> {
    const existing = await this.database.settings.get('default');
    if (existing) {
      return existing;
    }

    const initialSettings: ChurchSettings = {
      ...DEFAULT_CHURCH_SETTINGS,
      updatedAt: Date.now(),
    };
    await this.database.settings.put(initialSettings);
    return initialSettings;
  }

  async saveSettings(settings: ChurchSettings): Promise<void> {
    const updated: ChurchSettings = {
      ...settings,
      id: 'default',
      updatedAt: Date.now(),
    };
    await this.database.settings.put(updated);
  }
}

export const churchSettingsRepository = new DexieSettingsRepository();
