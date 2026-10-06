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
  model?: string; // '55' (NF-e) ou '65' (NFC-e)
  series?: string; // Série do documento fiscal
  number?: string; // Número da nota / cupom
  totalAmount?: number; // Valor total da nota em Reais (R$)
  imageBlob?: Blob; // Binário da foto comprimida (estritamente Blob, nunca Base64)
  sefazDataStatus: SefazDataStatus; // 'PENDING' | 'SUCCESS' | 'FAILED' | 'MANUAL'
  syncStatus: SyncStatus; // 'PENDING_SYNC' | 'SYNCED'
  createdAt: number; // Timestamp Unix em milissegundos
  updatedAt: number; // Timestamp Unix em milissegundos
}
