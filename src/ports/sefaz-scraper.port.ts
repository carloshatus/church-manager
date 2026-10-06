export interface SefazInvoiceItem {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface SefazScrapeResult {
  accessKey: string;
  totalAmount?: number;
  emissionDate?: string;
  protocol?: string;
  items: SefazInvoiceItem[];
  rawHtml?: string;
}

export interface ISefazScraper {
  scrapeByQrCodeUrl(qrCodeUrl: string): Promise<SefazScrapeResult>;
  scrapeByAccessKey(accessKey: string, uf: string): Promise<SefazScrapeResult>;
}
