import { db, ChurchManagerDB } from './db';
import type { Invoice } from '@/domain/entities/invoice';
import type { IInvoiceRepository } from '@/ports/invoice-repository.port';

export class DexieInvoiceRepository implements IInvoiceRepository {
  private database: ChurchManagerDB;

  constructor(database: ChurchManagerDB = db) {
    this.database = database;
  }

  async create(
    invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<number> {
    const now = Date.now();
    const invoice: Invoice = {
      ...invoiceData,
      createdAt: now,
      updatedAt: now,
    };
    return (await this.database.invoices.add(invoice)) as number;
  }

  async update(id: number, updates: Partial<Invoice>): Promise<number> {
    const now = Date.now();
    await this.database.invoices.update(id, {
      ...updates,
      updatedAt: now,
    });
    return id;
  }

  async delete(id: number): Promise<void> {
    await this.database.invoices.delete(id);
  }

  async findById(id: number): Promise<Invoice | undefined> {
    return await this.database.invoices.get(id);
  }

  async findByAccessKey(accessKey: string): Promise<Invoice | undefined> {
    return await this.database.invoices.where('accessKey').equals(accessKey).first();
  }

  async listAll(): Promise<Invoice[]> {
    return await this.database.invoices.orderBy('createdAt').reverse().toArray();
  }

  async listPendingSync(): Promise<Invoice[]> {
    return await this.database.invoices
      .where('syncStatus')
      .equals('PENDING_SYNC')
      .toArray();
  }
}

// Instância singleton padrão do repositório
export const invoiceRepository = new DexieInvoiceRepository();
