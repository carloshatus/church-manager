import type { InvoiceItem } from '@/domain/entities/invoice-item';

export type { InvoiceItem as SefazInvoiceItem };

export interface SefazScrapeResult {
  accessKey: string;
  totalAmount?: number;
  emissionDate?: string;
  protocol?: string;
  issuerName?: string;
  issuerCnpj?: string;
  issuerAddress?: string;
  recipientCpfCnpj?: string;
  recipientName?: string;
  paymentMethod?: string;
  taxAmount?: number;
  items: InvoiceItem[];
  rawHtml?: string;
}

export interface ISefazScraper {
  scrapeByQrCodeUrl(qrCodeUrl: string, corsProxyUrl?: string): Promise<SefazScrapeResult>;
  scrapeByAccessKey(
    accessKey: string,
    uf: string,
    corsProxyUrl?: string
  ): Promise<SefazScrapeResult>;
}
