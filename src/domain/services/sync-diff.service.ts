import type { Invoice } from '../entities/invoice';
import type { InvoiceSummary, P2PPairingPayload } from '../entities/p2p-sync';

/**
 * Serviço de domínio puro para cálculo de diferenças de sincronização (Diff)
 * e manipulação do payload de pareamento por QR Code.
 */
export class SyncDiffService {
  /**
   * Converte uma fatura de domínio em um resumo leve para o handshake inicial de sincronização.
   */
  static createInvoiceSummary(invoice: Invoice): InvoiceSummary {
    return {
      accessKey: invoice.accessKey,
      updatedAt: invoice.updatedAt,
      hasImage: Boolean(invoice.imageBlob),
    };
  }

  /**
   * Determina quais chaves de acesso remotas devem ser requisitadas pelo peer local
   * com base na estratégia Last-Write-Wins (LWW) e notas ausentes.
   *
   * @param localSummaries Lista de resumos das notas locais
   * @param remoteSummaries Lista de resumos das notas do peer remoto
   * @returns Lista de chaves de acesso (accessKey) que precisam ser enviadas pelo peer remoto
   */
  static determineNeededAccessKeys(
    localSummaries: InvoiceSummary[],
    remoteSummaries: InvoiceSummary[]
  ): string[] {
    const localMap = new Map<string, InvoiceSummary>();
    for (const summary of localSummaries) {
      localMap.set(summary.accessKey, summary);
    }

    const neededKeys: string[] = [];

    for (const remote of remoteSummaries) {
      const local = localMap.get(remote.accessKey);

      if (!local) {
        // Nota não existe localmente -> Deve ser requisitada
        neededKeys.push(remote.accessKey);
      } else if (remote.updatedAt > local.updatedAt) {
        // Nota remota foi atualizada mais recentemente (Last-Write-Wins)
        neededKeys.push(remote.accessKey);
      }
    }

    return neededKeys;
  }

  /**
   * Formata a carga de dados para geração do QR Code de pareamento.
   */
  static formatPairingPayload(peerId: string): string {
    const payload: P2PPairingPayload = {
      version: 1,
      type: 'CHURCH_MANAGER_SYNC',
      peerId,
      timestamp: Date.now(),
    };
    return JSON.stringify(payload);
  }

  /**
   * Valida e decodifica a carga de dados do QR Code escaneado.
   * Retorna o payload tipado se for um QR Code válido do Church Manager, ou null caso contrário.
   */
  static parsePairingPayload(payloadStr: string): P2PPairingPayload | null {
    if (!payloadStr || typeof payloadStr !== 'string') {
      return null;
    }

    try {
      const data = JSON.parse(payloadStr) as Partial<P2PPairingPayload>;

      if (
        data &&
        data.version === 1 &&
        data.type === 'CHURCH_MANAGER_SYNC' &&
        typeof data.peerId === 'string' &&
        data.peerId.trim().length > 0 &&
        typeof data.timestamp === 'number'
      ) {
        return {
          version: 1,
          type: 'CHURCH_MANAGER_SYNC',
          peerId: data.peerId.trim(),
          timestamp: data.timestamp,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
