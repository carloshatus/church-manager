import Dexie, { type Table } from 'dexie';
import type { Invoice } from '@/domain/entities/invoice';
import type { ChurchSettings } from '@/domain/entities/church-settings';

/**
 * Banco de dados local IndexedDB do Church Manager utilizando Dexie.js.
 * Modelo de dados 100% offline-first com armazenamento binário de fotos (Blob)
 * e configurações locais da igreja com lista de autorizados para validação fiscal.
 */
export class ChurchManagerDB extends Dexie {
  invoices!: Table<Invoice, number>;
  settings!: Table<ChurchSettings, string>;

  constructor() {
    super('ChurchManagerDB');

    // Versão 1: Tabela de Notas Fiscais
    this.version(1).stores({
      invoices:
        '++id, &accessKey, type, emissionDate, issuerCnpj, syncStatus, sefazDataStatus, createdAt, updatedAt',
    });

    // Versão 2: Adiciona tabela de Configurações e índice de destinatário
    this.version(2).stores({
      invoices:
        '++id, &accessKey, type, emissionDate, issuerCnpj, syncStatus, sefazDataStatus, createdAt, updatedAt, recipientCpfCnpj',
      settings: '&id',
    });
  }
}

// Instância singleton do banco de dados
export const db = new ChurchManagerDB();
