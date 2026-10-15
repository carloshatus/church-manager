import type { InvoiceItem } from './invoice-item';

export type InvoiceType = 'NFE' | 'NFCE' | 'UNKNOWN';

export type SefazDataStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'MANUAL';

export type SyncStatus = 'PENDING_SYNC' | 'SYNCED';

export interface Invoice {
  id?: number; // Chave primária auto-incrementada do IndexedDB
  accessKey: string; // Chave de acesso de 44 dígitos (índice único)
  qrCodeUrl?: string; // URL completa capturada no QR Code da NFC-e
  type: InvoiceType; // NFE (modelo 55) ou NFCE (modelo 65)
  emissionDate?: string; // Formato ISO string ou YYYY-MM
  issuerCnpj: string; // CNPJ (14 dígitos numéricos)
  issuerName?: string; // Razão Social (resolvida via API ou digitada manualmente)
  issuerAddress?: string; // Endereço completo do estabelecimento emitente
  model?: string; // '55' (NF-e) ou '65' (NFC-e)
  series?: string; // Série do documento fiscal
  number?: string; // Número da nota / cupom
  totalAmount?: number; // Valor total da nota em Reais (R$)
  taxAmount?: number; // Valor total de tributos incidentes (Lei 12.741/2012)
  paymentMethod?: string; // Forma de pagamento (ex: Dinheiro, Cartão, Pix)
  protocol?: string; // Protocolo de autorização fiscal
  recipientCpfCnpj?: string; // CPF ou CNPJ do consumidor/destinatário
  recipientName?: string; // Nome ou Razão Social do consumidor
  items?: InvoiceItem[]; // Lista detalhada de itens/produtos comprados
  imageBlob?: Blob; // Binário da foto comprimida (estritamente Blob, nunca Base64)
  sefazDataStatus: SefazDataStatus; // 'PENDING' | 'SUCCESS' | 'FAILED' | 'MANUAL'
  syncStatus: SyncStatus; // 'PENDING_SYNC' | 'SYNCED'
  createdAt: number; // Timestamp Unix em milissegundos
  updatedAt: number; // Timestamp Unix em milissegundos
}
