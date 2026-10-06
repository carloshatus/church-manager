# 02 - Camada de Dados & Armazenamento Local (Dexie.js & Blobs)

Este documento especifica a configuração do banco de dados local IndexedDB com **Dexie.js** e o fluxo de compressão e persistência de imagens binárias (`Blob`).

---

## 1. Schema do Banco de Dados (Dexie.js)

### 1.1 Definição dos Tipos e Enums
O modelo armazena todos os metadados fiscais da NF-e / NFC-e, além de status operacionais e a foto do cupom em formato binário nativo.

```typescript
// src/domain/entities/invoice.ts

export type InvoiceType = 'NFE' | 'NFCE' | 'UNKNOWN';

export type SefazDataStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'MANUAL';

export type SyncStatus = 'PENDING_SYNC' | 'SYNCED';

export interface Invoice {
  id?: number;                  // Auto-increment primary key
  accessKey: string;            // Chave de acesso de 44 dígitos (única)
  qrCodeUrl?: string;           // URL completa lida do QR Code da NFC-e
  type: InvoiceType;            // NFE (55) ou NFCE (65)
  emissionDate?: string;        // ISO 8601 string (ex: "2026-10-06T12:00:00Z") ou YYYY-MM
  issuerCnpj: string;           // CNPJ (14 dígitos limpos)
  issuerName?: string;          // Razão Social enriquecida ou manual
  model?: string;               // '55' (NFe) ou '65' (NFCe)
  series?: string;              // Série (ex: "001")
  number?: string;              // Número da nota (ex: "000123456")
  totalAmount?: number;         // Valor total da nota (em reais)
  imageBlob?: Blob;             // Arquivo binário da foto comprimida (NÃO Base64)
  sefazDataStatus: SefazDataStatus; // 'PENDING' | 'SUCCESS' | 'FAILED' | 'MANUAL'
  syncStatus: SyncStatus;       // 'PENDING_SYNC' | 'SYNCED'
  createdAt: number;            // Timestamp Unix (ms)
  updatedAt: number;            // Timestamp Unix (ms)
}
```

### 1.2 Declaração da Classe `ChurchManagerDB`
A versão do esquema define os índices primários e secundários para consultas rápidas no Dashboard:

```typescript
// src/adapters/storage/db.ts
import Dexie, { type Table } from 'dexie';
import type { Invoice } from '@/domain/entities/invoice';

export class ChurchManagerDB extends Dexie {
  invoices!: Table<Invoice, number>;

  constructor() {
    super('ChurchManagerDB');

    // Definição do Schema versão 1
    // Nota: Apenas propriedades indexadas são listadas nas strings de índice.
    // & = unique index, ++ = auto-increment
    this.version(1).stores({
      invoices: '++id, &accessKey, type, emissionDate, issuerCnpj, syncStatus, sefazDataStatus, createdAt, updatedAt'
    });
  }
}

// Instância singleton do banco
export const db = new ChurchManagerDB();
```

---

## 2. Repositório de Invoices (`IInvoiceRepository`)

Para manter o desacoplamento arquitetural, o acesso ao banco é encapsulado em um repositório:

```typescript
// src/ports/invoice-repository.port.ts
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
```

### Implementação com Dexie:
```typescript
// src/adapters/storage/dexie-invoice.repository.ts
import { db } from './db';
import type { Invoice } from '@/domain/entities/invoice';
import type { IInvoiceRepository } from '@/ports/invoice-repository.port';

export class DexieInvoiceRepository implements IInvoiceRepository {
  async create(invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = Date.now();
    const invoice: Invoice = {
      ...invoiceData,
      createdAt: now,
      updatedAt: now,
    };
    return (await db.invoices.add(invoice)) as number;
  }

  async update(id: number, updates: Partial<Invoice>): Promise<number> {
    const now = Date.now();
    await db.invoices.update(id, {
      ...updates,
      updatedAt: now,
    });
    return id;
  }

  async delete(id: number): Promise<void> {
    await db.invoices.delete(id);
  }

  async findById(id: number): Promise<Invoice | undefined> {
    return await db.invoices.get(id);
  }

  async findByAccessKey(accessKey: string): Promise<Invoice | undefined> {
    return await db.invoices.where('accessKey').equals(accessKey).first();
  }

  async listAll(): Promise<Invoice[]> {
    return await db.invoices.orderBy('createdAt').reverse().toArray();
  }

  async listPendingSync(): Promise<Invoice[]> {
    return await db.invoices.where('syncStatus').equals('PENDING_SYNC').toArray();
  }
}

export const invoiceRepository = new DexieInvoiceRepository();
```

---

## 3. Fluxo de Captura e Compressão de Imagens

### 3.1 Justificativa Técnica: Armazenamento em `Blob` vs. Base64
1. **Consumo de Memória**: O formato Base64 aumenta o tamanho do arquivo em 33% em strings ASCII. Salvar Base64 no IndexedDB causa lentidão no garbage collector do navegador móvel.
2. **IndexedDB Nativo**: O IndexedDB suporta o tipo `Blob` de forma nativa e sem overhead de serialização de texto.
3. **Renderização Otimizada**: Ao exibir a foto, utiliza-se `URL.createObjectURL(blob)`, com liberação imediata de memória via `URL.revokeObjectURL(url)`.

### 3.2 Serviço de Compressão (`image-compression.service.ts`)
Utiliza `browser-image-compression` para reduzir fotos de 5MB–12MB (típicas de câmeras de smartphones modernos) para menos de 800KB sem perda de legibilidade do texto da nota:

```typescript
// src/services/image-compression.service.ts
import imageCompression from 'browser-image-compression';

export interface ImageCompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
}

export class ImageCompressionService {
  private static defaultOptions = {
    maxSizeMB: 0.8,              // Alvo de compressão: no máximo 800KB
    maxWidthOrHeight: 1600,      // Resolução suficiente para OCR e leitura de itens
    useWebWorker: true,          // Não trava a UI durante a compressão
    fileType: 'image/jpeg',      // Padronização em JPEG
    initialQuality: 0.85
  };

  /**
   * Comprime um arquivo de imagem recebido do input de câmera.
   */
  public static async compress(
    file: File | Blob,
    customOptions?: ImageCompressionOptions
  ): Promise<Blob> {
    const options = {
      ...this.defaultOptions,
      ...customOptions,
    };

    try {
      // Se for Blob sem name, converte para File para a biblioteca
      const targetFile = file instanceof File ? file : new File([file], 'receipt.jpg', { type: file.type || 'image/jpeg' });
      const compressedBlob = await imageCompression(targetFile, options);
      return compressedBlob;
    } catch (error) {
      console.error('Falha ao comprimir imagem, usando original:', error);
      return file;
    }
  }

  /**
   * Cria uma URL temporária para visualização na UI e retorna uma função de limpeza.
   */
  public static createPreviewUrl(blob: Blob): { url: string; revoke: () => void } {
    const url = URL.createObjectURL(blob);
    return {
      url,
      revoke: () => URL.revokeObjectURL(url)
    };
  }
}
```

### 3.3 Ciclo de Vida da Imagem no Componente React
```tsx
// Exemplo conceitual do hook de captura de foto:
const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  setIsCompressing(true);
  try {
    const compressedBlob = await ImageCompressionService.compress(file);
    setImageBlob(compressedBlob);
    
    // Libera preview anterior se existir
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(compressedBlob));
  } finally {
    setIsCompressing(false);
  }
};
```
