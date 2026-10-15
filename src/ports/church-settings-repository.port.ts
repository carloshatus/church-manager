import type { ChurchSettings } from '@/domain/entities/church-settings';

/**
 * Contrato abstrato para persistência e recuperação de configurações
 * da igreja local e lista de destinatários fiscais autorizados.
 */
export interface IChurchSettingsRepository {
  getSettings(): Promise<ChurchSettings>;
  saveSettings(settings: ChurchSettings): Promise<void>;
}
