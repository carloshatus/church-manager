# 05 - Gerenciamento de Estado & Hierarquia de Componentes UI

Este documento especifica a arquitetura de estado com **Zustand**, a integração com a câmera/scanner via `html5-qrcode` e a hierarquia dos componentes visuais (shadcn/ui e Tailwind CSS).

---

## 1. Gerenciamento de Estado (Zustand Stores)

### 1.1 Store de Conectividade (`useNetworkStore`)
Monitora os eventos de rede do navegador para sinalizar visualmente o modo offline e gerenciar retentativas:

```typescript
// src/stores/use-network-store.ts
import { create } from 'zustand';

interface NetworkState {
  isOnline: boolean;
  initNetworkListeners: () => () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  initNetworkListeners: () => {
    const handleOnline = () => set({ isOnline: true });
    const handleOffline = () => set({ isOnline: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}));
```

### 1.2 Store de Cadastro de Nota Fiscal (`useInvoiceFormStore`)
Controla o ciclo de vida do formulário de registro, desde a leitura do scanner até a compressão da imagem e enriquecimento do CNPJ:

```typescript
// src/stores/use-invoice-form-store.ts
import { create } from 'zustand';
import type { InvoiceType, SefazDataStatus, SyncStatus } from '@/domain/entities/invoice';
import { parseScannedInput } from '@/domain/parsers/nfce-url-parser';
import { parseNFeKey } from '@/domain/parsers/nfe-key-parser';
import { cnpjService } from '@/adapters/cnpj/cnpj-service';
import { ImageCompressionService } from '@/services/image-compression.service';
import { invoiceRepository } from '@/adapters/storage/dexie-invoice.repository';

export interface FormFields {
  accessKey: string;
  qrCodeUrl: string;
  type: InvoiceType;
  emissionDate: string;
  issuerCnpj: string;
  issuerName: string;
  model: string;
  series: string;
  number: string;
  totalAmount: string;
}

interface InvoiceFormState {
  // Dados do formulário
  fields: FormFields;
  imageBlob: Blob | null;
  imagePreviewUrl: string | null;

  // Estados de carregamento e erro
  isScanning: boolean;
  isCompressingPhoto: boolean;
  isResolvingCnpj: boolean;
  cnpjError: string | null;
  cnpjProviderUsed: string | null;
  formError: string | null;
  isSubmitting: boolean;

  // Ações
  setFormField: (field: keyof FormFields, value: string) => void;
  handleScannedData: (rawInput: string) => Promise<void>;
  retryResolveCnpj: () => Promise<void>;
  handlePhotoSelected: (file: File) => Promise<void>;
  removePhoto: () => void;
  resetForm: () => void;
  submitInvoice: () => Promise<number>;
}

const initialFields: FormFields = {
  accessKey: '',
  qrCodeUrl: '',
  type: 'UNKNOWN',
  emissionDate: '',
  issuerCnpj: '',
  issuerName: '',
  model: '',
  series: '',
  number: '',
  totalAmount: ''
};

export const useInvoiceFormStore = create<InvoiceFormState>((set, get) => ({
  fields: initialFields,
  imageBlob: null,
  imagePreviewUrl: null,
  isScanning: false,
  isCompressingPhoto: false,
  isResolvingCnpj: false,
  cnpjError: null,
  cnpjProviderUsed: null,
  formError: null,
  isSubmitting: false,

  setFormField: (field, value) => {
    set((state) => ({
      fields: { ...state.fields, [field]: value }
    }));
  },

  handleScannedData: async (rawInput: string) => {
    set({ formError: null, cnpjError: null });
    try {
      // 1. Extrai a chave de 44 dígitos (seja de URL ou digitação)
      const scanned = parseScannedInput(rawInput);
      // 2. Decompõe a chave
      const parsedKey = parseNFeKey(scanned.accessKey);

      set((state) => ({
        fields: {
          ...state.fields,
          accessKey: parsedKey.accessKey,
          qrCodeUrl: scanned.qrCodeUrl || '',
          type: parsedKey.type,
          emissionDate: parsedKey.emissionPeriod,
          issuerCnpj: parsedKey.cnpj,
          model: parsedKey.model,
          series: parsedKey.series,
          number: parsedKey.number,
        }
      }));

      // 3. Dispara busca assíncrona do CNPJ
      await get().retryResolveCnpj();
    } catch (err: any) {
      set({ formError: err.message });
    }
  },

  retryResolveCnpj: async () => {
    const { issuerCnpj } = get().fields;
    if (!issuerCnpj || issuerCnpj.length !== 14) return;

    set({ isResolvingCnpj: true, cnpjError: null });
    try {
      const cnpjInfo = await cnpjService.resolveCnpj(issuerCnpj);
      set((state) => ({
        fields: {
          ...state.fields,
          issuerName: cnpjInfo.razaoSocial
        },
        cnpjProviderUsed: cnpjInfo.provider,
        cnpjError: null
      }));
    } catch (err: any) {
      set({
        cnpjError: err.message,
        cnpjProviderUsed: null
      });
    } finally {
      set({ isResolvingCnpj: false });
    }
  },

  handlePhotoSelected: async (file: File) => {
    set({ isCompressingPhoto: true });
    try {
      const compressedBlob = await ImageCompressionService.compress(file);
      
      const currentUrl = get().imagePreviewUrl;
      if (currentUrl) URL.revokeObjectURL(currentUrl);

      const preview = URL.createObjectURL(compressedBlob);
      set({
        imageBlob: compressedBlob,
        imagePreviewUrl: preview
      });
    } catch (err: any) {
      console.error('Falha na compressão da foto', err);
    } finally {
      set({ isCompressingPhoto: false });
    }
  },

  removePhoto: () => {
    const currentUrl = get().imagePreviewUrl;
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    set({ imageBlob: null, imagePreviewUrl: null });
  },

  resetForm: () => {
    const currentUrl = get().imagePreviewUrl;
    if (currentUrl) URL.revokeObjectURL(currentUrl);
    set({
      fields: initialFields,
      imageBlob: null,
      imagePreviewUrl: null,
      cnpjError: null,
      cnpjProviderUsed: null,
      formError: null
    });
  },

  submitInvoice: async () => {
    const { fields, imageBlob } = get();
    set({ isSubmitting: true });

    try {
      const cleanKey = fields.accessKey.replace(/\D/g, '');
      if (cleanKey.length !== 44) {
        throw new Error('A chave de acesso deve ter exatamente 44 dígitos.');
      }

      const id = await invoiceRepository.create({
        accessKey: cleanKey,
        qrCodeUrl: fields.qrCodeUrl || undefined,
        type: fields.type,
        emissionDate: fields.emissionDate || undefined,
        issuerCnpj: fields.issuerCnpj.replace(/\D/g, ''),
        issuerName: fields.issuerName || undefined,
        model: fields.model || undefined,
        series: fields.series || undefined,
        number: fields.number || undefined,
        totalAmount: fields.totalAmount ? parseFloat(fields.totalAmount.replace(',', '.')) : undefined,
        imageBlob: imageBlob || undefined,
        sefazDataStatus: 'PENDING',
        syncStatus: 'PENDING_SYNC',
      });

      get().resetForm();
      return id;
    } finally {
      set({ isSubmitting: false });
    }
  }
}));
```

---

## 2. Componente de Câmera & Scanner (`Html5Qrcode`)

Para garantir confiabilidade e evitar vazamentos de memória na câmera de dispositivos móveis, o leitor possui controle estrito de ciclo de vida (`mount` / `unmount`):

```tsx
// src/components/scanner/qr-scanner-modal.tsx
import React, { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Flashlight } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'html5-qrcode-reader-element';

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const scanner = new Html5Qrcode(readerElementId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
      ],
      verbose: false
    });
    scannerRef.current = scanner;

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' }, // Câmera traseira
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (isMounted) {
              onScanSuccess(decodedText);
              handleStop();
              onClose();
            }
          },
          () => {} // Ignora erros por frame não detectado
        );
      } catch (err) {
        console.error('Falha ao iniciar câmera:', err);
      }
    };

    startScanner();

    const handleStop = async () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (e) {
          console.warn('Erro ao parar scanner:', e);
        }
      }
    };

    return () => {
      isMounted = false;
      handleStop();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-between p-4 backdrop-blur-sm">
      <div className="w-full flex items-center justify-between max-w-md pt-2">
        <div className="flex items-center gap-2 text-white font-medium">
          <Camera className="w-5 h-5 text-primary" />
          <span>Aponte para o QR Code ou Código</span>
        </div>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/80">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="relative w-full max-w-sm aspect-square overflow-hidden rounded-2xl border-2 border-primary/50 shadow-2xl">
        <div id={readerElementId} className="w-full h-full" />
        {/* Linha animada de laser */}
        <div className="scanner-laser-line absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444]" />
      </div>

      <p className="text-slate-400 text-sm text-center max-w-xs pb-6">
        Centralize o QR Code do cupom fiscal ou o código de barras da NF-e no quadrado acima.
      </p>
    </div>
  );
};
```

---

## 3. Componente de Foto de Comprovante (`PhotoUploader`)

Permite capturar direto pela câmera traseira ou selecionar da galeria, exibindo o status de compressão e thumbnail:

```tsx
// src/components/photo/photo-uploader.tsx
import React, { useRef } from 'react';
import { Camera, Image as ImageIcon, Loader2, Trash2, Eye } from 'lucide-react';
import { useInvoiceFormStore } from '@/stores/use-invoice-form-store';

export const PhotoUploader: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    imagePreviewUrl,
    isCompressingPhoto,
    handlePhotoSelected,
    removePhoto
  } = useInvoiceFormStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoSelected(file);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-200 flex items-center justify-between">
        <span>Foto do Cupom / Comprovante</span>
        {isCompressingPhoto && (
          <span className="text-xs text-primary flex items-center gap-1.5 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Otimizando imagem...
          </span>
        )}
      </label>

      {/* Input de câmera do celular */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {imagePreviewUrl ? (
        <div className="relative group w-full h-44 rounded-xl overflow-hidden border border-slate-700 bg-slate-900/50 flex items-center justify-center">
          <img
            src={imagePreviewUrl}
            alt="Comprovante da Nota"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition"
              title="Trocar Foto"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={removePhoto}
              className="p-2.5 rounded-lg bg-red-600 text-white hover:bg-red-500 transition"
              title="Excluir Foto"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isCompressingPhoto}
          className="w-full h-36 border-2 border-dashed border-slate-700 hover:border-primary/60 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-primary transition bg-slate-900/30"
        >
          <div className="p-3 rounded-full bg-slate-800/80">
            <Camera className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium">Fotografar Cupom Físico</span>
          <span className="text-xs text-slate-500">Comprime automaticamente para &lt; 800 KB</span>
        </button>
      )}
    </div>
  );
};
```

---

## 4. Hierarquia e Telas

```
App
├── Header (Status Offline/Online, Indicador PWA, Link Dashboard / Nova Nota)
├── Main Content
│   ├── [View: DashboardView]
│   │   ├── MetricCards (Total de Notas, Valor Total, Pendentes de Sincronização)
│   │   ├── FiltersBar (Busca por chave/CNPJ/Razão Social, Filtro por Modelo 55/65)
│   │   └── InvoiceList (Lista de Cards com Badges: PENDING_SYNC, SYNCED, Status SEFAZ)
│   │
│   └── [View: NewInvoiceView]
│       ├── QuickActions (Abrir Câmera Scanner / Digitar Chave)
│       ├── QrScannerModal (html5-qrcode overlay)
│       └── InvoiceForm
│           ├── Chave 44 dígitos (Input editável com formatação em blocos)
│           ├── Status CNPJ & Retry Banner (Botão de 'Tentar Novamente')
│           ├── Razão Social (Input com override manual)
│           ├── CNPJ, Modelo (55/65), Série, Número, Mês/Ano
│           ├── Valor Total (R$)
│           ├── PhotoUploader (Foto, Web Worker compression, preview)
│           └── Botão "Salvar Nota Fiscal" (Gravação atômica no Dexie.js)
```
