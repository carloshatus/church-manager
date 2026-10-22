import type { Invoice } from './invoice';

export type P2PConnectionStatus =
  | 'IDLE'
  | 'GENERATING_QR'
  | 'WAITING_PEER'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'TRANSFERRING'
  | 'COMPLETED'
  | 'FAILED';

export type P2PSyncMode = 'HOST_RECEIVE' | 'CLIENT_SEND';

export interface InvoiceSummary {
  accessKey: string;
  updatedAt: number;
  hasImage: boolean;
}

export interface P2PPairingPayload {
  version: 1;
  type: 'CHURCH_MANAGER_SYNC';
  peerId: string;
  timestamp: number;
}

export type P2PMessageType =
  | 'HELLO'
  | 'HELLO_ACK'
  | 'REQUEST_INVOICES'
  | 'INVOICE_DATA'
  | 'INVOICE_IMAGE_CHUNK'
  | 'SYNC_ACK'
  | 'SYNC_COMPLETE'
  | 'ERROR';

export interface P2PHelloMessage {
  type: 'HELLO';
  deviceName: string;
  invoicesSummary: InvoiceSummary[];
}

export interface P2PHelloAckMessage {
  type: 'HELLO_ACK';
  deviceName: string;
  invoicesSummary: InvoiceSummary[];
}

export interface P2PRequestInvoicesMessage {
  type: 'REQUEST_INVOICES';
  neededAccessKeys: string[];
}

export interface P2PInvoiceDataMessage {
  type: 'INVOICE_DATA';
  invoice: Omit<Invoice, 'id' | 'imageBlob'>;
  hasImageBlob: boolean;
}

export interface P2PImageChunkMessage {
  type: 'INVOICE_IMAGE_CHUNK';
  accessKey: string;
  chunkIndex: number;
  totalChunks: number;
  data: string; // Base64 chunk
  mimeType?: string;
}

export interface P2PSyncAckMessage {
  type: 'SYNC_ACK';
  accessKey: string;
  success: boolean;
  error?: string;
}

export interface P2PSyncCompleteMessage {
  type: 'SYNC_COMPLETE';
  totalSynced: number;
}

export interface P2PErrorMessage {
  type: 'ERROR';
  message: string;
}

export type P2PMessage =
  | P2PHelloMessage
  | P2PHelloAckMessage
  | P2PRequestInvoicesMessage
  | P2PInvoiceDataMessage
  | P2PImageChunkMessage
  | P2PSyncAckMessage
  | P2PSyncCompleteMessage
  | P2PErrorMessage;

export interface SyncProgress {
  phase:
    | 'IDLE'
    | 'HANDSHAKE'
    | 'DIFFING'
    | 'SENDING_DATA'
    | 'RECEIVING_DATA'
    | 'SAVING'
    | 'DONE'
    | 'ERROR';
  current: number;
  total: number;
  message: string;
}
