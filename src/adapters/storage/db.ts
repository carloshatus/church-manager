import Dexie, { type Table } from 'dexie';
import type { Invoice } from '@/domain/entities/invoice';

/**
 * Banco de dados local IndexedDB do Church Manager utilizando Dexie.js.
 * Modelo de dados 100% offline-first com armazenamento binário de fotos (Blob).
 */
export class ChurchManagerDB extends Dexie {
  invoices!: Table<Invoice, number>;

  constructor() {
    super('ChurchManagerDB');

    // Definição da Versão 1 do Schema
    // & = índice único (chave de acesso não pode ser duplicada)
    // ++ = chave primária numérica auto-incrementada
    this.version(1).stores({
      invoices: '++id, &accessKey, type, emissionDate, issuerCnpj, syncStatus, sefazDataStatus, createdAt, updatedAt'
    });
  }
}

// Instância singleton do banco de dados
export const db = new ChurchManagerDB();
