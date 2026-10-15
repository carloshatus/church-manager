import { create } from 'zustand';
import type {
  ChurchSettings,
  AuthorizedRecipient,
} from '@/domain/entities/church-settings';
import {
  churchSettingsRepository,
  DEFAULT_CHURCH_SETTINGS,
} from '@/adapters/storage/dexie-settings.repository';

interface ChurchSettingsState {
  settings: ChurchSettings;
  isLoading: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<ChurchSettings>) => Promise<void>;
  addAuthorizedRecipient: (recipient: Omit<AuthorizedRecipient, 'id'>) => Promise<void>;
  removeAuthorizedRecipient: (id: string) => Promise<void>;
}

export const useChurchSettingsStore = create<ChurchSettingsState>((set, get) => ({
  settings: DEFAULT_CHURCH_SETTINGS,
  isLoading: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const loaded = await churchSettingsRepository.getSettings();
      set({ settings: loaded });
    } catch (err: unknown) {
      set({
        error: (err as Error)?.message || 'Erro ao carregar configurações da igreja',
      });
    } finally {
      set({ isLoading: false });
    }
  },

  updateSettings: async (updates: Partial<ChurchSettings>) => {
    set({ isLoading: true, error: null });
    try {
      const current = get().settings;
      const merged: ChurchSettings = {
        ...current,
        ...updates,
        updatedAt: Date.now(),
      };
      await churchSettingsRepository.saveSettings(merged);
      set({ settings: merged });
    } catch (err: unknown) {
      set({
        error: (err as Error)?.message || 'Erro ao salvar configurações da igreja',
      });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  addAuthorizedRecipient: async (recipientData) => {
    const current = get().settings;
    const newRecipient: AuthorizedRecipient = {
      ...recipientData,
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cpfCnpj: recipientData.cpfCnpj.replace(/\D/g, ''),
    };

    const updatedRecipients = [...current.authorizedRecipients, newRecipient];
    await get().updateSettings({ authorizedRecipients: updatedRecipients });
  },

  removeAuthorizedRecipient: async (id: string) => {
    const current = get().settings;
    const updatedRecipients = current.authorizedRecipients.filter((r) => r.id !== id);
    await get().updateSettings({ authorizedRecipients: updatedRecipients });
  },
}));
