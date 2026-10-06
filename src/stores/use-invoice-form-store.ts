import { create } from 'zustand';
import type { InvoiceType } from '@/domain/entities/invoice';
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
  fields: FormFields;
  imageBlob: Blob | null;
  imagePreviewUrl: string | null;

  isScanningModalOpen: boolean;
  isCompressingPhoto: boolean;
  isResolvingCnpj: boolean;
  cnpjError: string | null;
  cnpjProviderUsed: string | null;
  formError: string | null;
  isSubmitting: boolean;
  lastSavedId: number | null;

  setScanningModalOpen: (open: boolean) => void;
  setFormField: (field: keyof FormFields, value: string) => void;
  handleScannedData: (rawInput: string) => Promise<void>;
  retryResolveCnpj: (overrideCnpj?: string) => Promise<void>;
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
  totalAmount: '',
};

export const useInvoiceFormStore = create<InvoiceFormState>((set, get) => ({
  fields: initialFields,
  imageBlob: null,
  imagePreviewUrl: null,
  isScanningModalOpen: false,
  isCompressingPhoto: false,
  isResolvingCnpj: false,
  cnpjError: null,
  cnpjProviderUsed: null,
  formError: null,
  isSubmitting: false,
  lastSavedId: null,

  setScanningModalOpen: (open: boolean) => {
    set({ isScanningModalOpen: open });
  },

  setFormField: (field, value) => {
    let cnpjToFetch: string | null = null;

    set((state) => {
      const updatedFields = { ...state.fields, [field]: value };

      // Se o usuário alterar a chave manualmente ou colar uma URL da SEFAZ
      if (field === 'accessKey') {
        const trimmed = value.trim();

        // 1. Suporte a colar URL de NFC-e (com parâmetros de SEFAZ)
        if (/^https?:\/\//i.test(trimmed)) {
          try {
            const scanned = parseScannedInput(trimmed);
            const parsed = parseNFeKey(scanned.accessKey);
            updatedFields.accessKey = parsed.accessKey;
            updatedFields.qrCodeUrl = scanned.qrCodeUrl || '';
            updatedFields.type = parsed.type;
            updatedFields.emissionDate = parsed.emissionPeriod;
            updatedFields.issuerCnpj = parsed.cnpj;
            updatedFields.model = parsed.model;
            updatedFields.series = parsed.series;
            updatedFields.number = parsed.number;

            if (parsed.cnpj && parsed.cnpj.length === 14) {
              cnpjToFetch = parsed.cnpj;
            }
          } catch {
            // Ignora se for URL incompleta ou inválida
          }
        } else {
          // 2. Chave de 44 dígitos digitada ou colada
          const cleanKey = trimmed.replace(/\D/g, '');
          if (cleanKey.length === 44) {
            try {
              const parsed = parseNFeKey(cleanKey);
              updatedFields.type = parsed.type;
              updatedFields.emissionDate = parsed.emissionPeriod;
              updatedFields.issuerCnpj = parsed.cnpj;
              updatedFields.model = parsed.model;
              updatedFields.series = parsed.series;
              updatedFields.number = parsed.number;

              if (parsed.cnpj && parsed.cnpj.length === 14) {
                cnpjToFetch = parsed.cnpj;
              }
            } catch {
              // Ignora se não conseguir decompor
            }
          }
        }
      }

      // Se o usuário digitar ou colar o CNPJ diretamente (14 dígitos)
      if (field === 'issuerCnpj') {
        const cleanCnpj = value.replace(/\D/g, '');
        if (
          cleanCnpj.length === 14 &&
          cleanCnpj !== state.fields.issuerCnpj.replace(/\D/g, '')
        ) {
          cnpjToFetch = cleanCnpj;
        }
      }

      return { fields: updatedFields };
    });

    if (cnpjToFetch) {
      void get().retryResolveCnpj(cnpjToFetch);
    }
  },

  handleScannedData: async (rawInput: string) => {
    set({ formError: null, cnpjError: null });
    try {
      // 1. Extrai a chave de 44 dígitos (de URL ou texto bruto)
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
        },
        isScanningModalOpen: false,
      }));

      // 3. Dispara a consulta assíncrona ao CNPJ
      await get().retryResolveCnpj(parsedKey.cnpj);
    } catch (err: unknown) {
      set({
        formError: (err as Error)?.message || 'Erro ao processar dados',
        isScanningModalOpen: false,
      });
    }
  },

  retryResolveCnpj: async (overrideCnpj?: string) => {
    const rawCnpj = overrideCnpj || get().fields.issuerCnpj;
    const cleanCnpj = rawCnpj.replace(/\D/g, '');
    if (!cleanCnpj || cleanCnpj.length !== 14) return;

    set({ isResolvingCnpj: true, cnpjError: null });
    try {
      const cnpjInfo = await cnpjService.resolveCnpj(cleanCnpj);
      set((state) => ({
        fields: {
          ...state.fields,
          issuerName: cnpjInfo.razaoSocial,
        },
        cnpjProviderUsed: cnpjInfo.provider,
        cnpjError: null,
      }));
    } catch (err: unknown) {
      set({
        cnpjError: (err as Error)?.message || 'Erro ao consultar CNPJ',
        cnpjProviderUsed: null,
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
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      const { url } = ImageCompressionService.createPreviewUrl(compressedBlob);
      set({
        imageBlob: compressedBlob,
        imagePreviewUrl: url,
      });
    } catch (err: unknown) {
      console.error('Falha na compressão da imagem:', err);
    } finally {
      set({ isCompressingPhoto: false });
    }
  },

  removePhoto: () => {
    const currentUrl = get().imagePreviewUrl;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    set({ imageBlob: null, imagePreviewUrl: null });
  },

  resetForm: () => {
    const currentUrl = get().imagePreviewUrl;
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
    }
    set({
      fields: initialFields,
      imageBlob: null,
      imagePreviewUrl: null,
      cnpjError: null,
      cnpjProviderUsed: null,
      formError: null,
      isSubmitting: false,
      lastSavedId: null,
    });
  },

  submitInvoice: async () => {
    const { fields, imageBlob } = get();
    set({ isSubmitting: true, formError: null });

    try {
      const cleanKey = fields.accessKey.replace(/\D/g, '');
      if (cleanKey.length !== 44) {
        throw new Error('A chave de acesso deve ter exatamente 44 dígitos numéricos.');
      }

      const cleanCnpj = fields.issuerCnpj.replace(/\D/g, '');
      if (cleanCnpj.length !== 14) {
        throw new Error('O CNPJ do emitente deve conter 14 dígitos numéricos.');
      }

      let parsedAmount: number | undefined = undefined;
      if (fields.totalAmount) {
        const normalized = fields.totalAmount.replace(',', '.');
        const num = parseFloat(normalized);
        if (!isNaN(num)) {
          parsedAmount = num;
        }
      }

      const id = await invoiceRepository.create({
        accessKey: cleanKey,
        qrCodeUrl: fields.qrCodeUrl || undefined,
        type: fields.type,
        emissionDate: fields.emissionDate || undefined,
        issuerCnpj: cleanCnpj,
        issuerName: fields.issuerName || undefined,
        model: fields.model || undefined,
        series: fields.series || undefined,
        number: fields.number || undefined,
        totalAmount: parsedAmount,
        imageBlob: imageBlob || undefined,
        sefazDataStatus: 'PENDING',
        syncStatus: 'PENDING_SYNC',
      });

      get().resetForm();
      set({ lastSavedId: id });
      return id;
    } catch (err: unknown) {
      const errorMsg = (err as Error)?.message || 'Erro ao salvar nota fiscal';
      set({ formError: errorMsg });
      throw err;
    } finally {
      set({ isSubmitting: false });
    }
  },
}));
