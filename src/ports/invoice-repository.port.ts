import type { Invoice } from '@/domain/entities/invoice';

export interface IInvoiceRepository {
  create(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<number>;
  update(id: number, updates: Partial<Invoice>): Promise<number>;
  delete(id: number): Promise<void>;
  findById(id: number): Promise<Invoice | undefined>;
  findByAccessKey(accessKey: string): Promise<Invoice | undefined>;
  listAll(): Promise<Invoice[]>;
  listPendingSync(): Promise<Invoice[]>;
}
