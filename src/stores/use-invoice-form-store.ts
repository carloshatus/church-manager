import { create } from 'zustand';
import type { InvoiceType, SefazDataStatus } from '@/domain/entities/invoice';
import type { InvoiceItem } from '@/domain/entities/invoice-item';
import { parseScannedInput } from '@/domain/parsers/nfce-url-parser';
import { parseNFeKey } from '@/domain/parsers/nfe-key-parser';
import { cnpjService } from '@/adapters/cnpj/cnpj-service';
import { sefazScraperService } from '@/adapters/sefaz/sefaz-scraper.service';
import { ImageCompressionService } from '@/services/image-compression.service';
import { invoiceRepository } from '@/adapters/storage/dexie-invoice.repository';
import { useChurchSettingsStore } from './use-church-settings-store';

export interface FormFields {
  accessKey: string;
  qrCodeUrl: string;
  type: InvoiceType;
  emissionDate: string;
  issuerCnpj: string;
  issuerName: string;
  issuerAddress: string;
  model: string;
  series: string;
  number: string;
  totalAmount: string;
  taxAmount: string;
  paymentMethod: string;
  protocol: string;
  recipientCpfCnpj: string;
  recipientName: string;
}

interface InvoiceFormState {
  fields: FormFields;
  items: InvoiceItem[];
  imageBlob: Blob | null;
  imagePreviewUrl: string | null;

  isScanningModalOpen: boolean;
  isCompressingPhoto: boolean;
  isResolvingCnpj: boolean;
  isScrapingSefaz: boolean;
  sefazScraped: boolean;
  cnpjError: string | null;
  sefazError: string | null;
  cnpjProviderUsed: string | null;
  formError: string | null;
  isSubmitting: boolean;
  lastSavedId: number | null;

  setScanningModalOpen: (open: boolean) => void;
  setFormField: (field: keyof FormFields, value: string) => void;
  setItems: (items: InvoiceItem[]) => void;
  handleScannedData: (rawInput: string) => Promise<void>;
  retryResolveCnpj: (overrideCnpj?: string, forceRefresh?: boolean) => Promise<void>;
  scrapeSefaz: (overrideUrl?: string) => Promise<void>;
  parseRawSefazHtml: (html: string) => void;
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
  issuerAddress: '',
  model: '',
  series: '',
  number: '',
  totalAmount: '',
  taxAmount: '',
  paymentMethod: '',
  protocol: '',
  recipientCpfCnpj: '',
  recipientName: '',
};

export const useInvoiceFormStore = create<InvoiceFormState>((set, get) => ({
  fields: initialFields,
  items: [],
  imageBlob: null,
  imagePreviewUrl: null,
  isScanningModalOpen: false,
  isCompressingPhoto: false,
  isResolvingCnpj: false,
  isScrapingSefaz: false,
  sefazScraped: false,
  cnpjError: null,
  sefazError: null,
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

  setItems: (items) => {
    set({ items });
  },

  handleScannedData: async (rawInput: string) => {
    set({ formError: null, cnpjError: null, sefazError: null });
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
      void get().retryResolveCnpj(parsedKey.cnpj);

      // 4. Scraping remoto da SEFAZ via proxy desativado temporariamente
    } catch (err: unknown) {
      set({
        formError: (err as Error)?.message || 'Erro ao processar dados',
        isScanningModalOpen: false,
      });
    }
  },

  scrapeSefaz: async (overrideUrl?: string) => {
    // Busca online na SEFAZ desativada temporariamente (proxies instáveis)
    if (!sefazScraperService.isSearchEnabled()) {
      set({
        isScrapingSefaz: false,
        sefazError:
          'A consulta online na SEFAZ via proxy está temporariamente desativada. Cole o HTML do portal ou informe os dados manualmente.',
      });
      return;
    }

    const targetUrl = overrideUrl || get().fields.qrCodeUrl;
    if (!targetUrl) return;

    set({ isScrapingSefaz: true, sefazError: null });
    try {
      const corsProxyUrl = useChurchSettingsStore.getState().settings.corsProxyUrl;
      const result = await sefazScraperService.scrapeByQrCodeUrl(targetUrl, corsProxyUrl);

      set((state) => {
        const nextFields = { ...state.fields };

        if (result.issuerName && !nextFields.issuerName) {
          nextFields.issuerName = result.issuerName;
        }
        if (result.issuerCnpj && !nextFields.issuerCnpj) {
          nextFields.issuerCnpj = result.issuerCnpj;
        }
        if (result.issuerAddress) {
          nextFields.issuerAddress = result.issuerAddress;
        }
        if (typeof result.totalAmount === 'number' && !isNaN(result.totalAmount)) {
          nextFields.totalAmount = result.totalAmount.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
        if (result.emissionDate) {
          nextFields.emissionDate = result.emissionDate;
        }
        if (result.protocol) {
          nextFields.protocol = result.protocol;
        }
        if (result.recipientCpfCnpj) {
          nextFields.recipientCpfCnpj = result.recipientCpfCnpj;
        }
        if (result.recipientName) {
          nextFields.recipientName = result.recipientName;
        }
        if (result.paymentMethod) {
          nextFields.paymentMethod = result.paymentMethod;
        }
        if (typeof result.taxAmount === 'number' && !isNaN(result.taxAmount)) {
          nextFields.taxAmount = result.taxAmount.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }

        return {
          fields: nextFields,
          items: result.items && result.items.length > 0 ? result.items : state.items,
          sefazScraped: true,
          sefazError: null,
        };
      });
    } catch (err: unknown) {
      set({
        sefazError:
          (err as Error)?.message || 'Não foi possível obter dados automáticos da SEFAZ.',
      });
    } finally {
      set({ isScrapingSefaz: false });
    }
  },

  parseRawSefazHtml: (html: string) => {
    set({ sefazError: null });
    try {
      const state = get();
      const result = sefazScraperService.parseRawHtml(
        html,
        undefined,
        state.fields.qrCodeUrl,
        state.fields.accessKey
      );

      set((curr) => {
        const nextFields = { ...curr.fields };

        if (result.issuerName) nextFields.issuerName = result.issuerName;
        if (result.issuerCnpj) nextFields.issuerCnpj = result.issuerCnpj;
        if (result.issuerAddress) nextFields.issuerAddress = result.issuerAddress;
        if (typeof result.totalAmount === 'number' && !isNaN(result.totalAmount)) {
          nextFields.totalAmount = result.totalAmount.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
        if (result.emissionDate) nextFields.emissionDate = result.emissionDate;
        if (result.protocol) nextFields.protocol = result.protocol;
        if (result.recipientCpfCnpj)
          nextFields.recipientCpfCnpj = result.recipientCpfCnpj;
        if (result.recipientName) nextFields.recipientName = result.recipientName;
        if (result.paymentMethod) nextFields.paymentMethod = result.paymentMethod;
        if (typeof result.taxAmount === 'number' && !isNaN(result.taxAmount)) {
          nextFields.taxAmount = result.taxAmount.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }

        return {
          fields: nextFields,
          items: result.items && result.items.length > 0 ? result.items : curr.items,
          sefazScraped: true,
          sefazError: null,
        };
      });
    } catch (err: unknown) {
      set({
        sefazError:
          (err as Error)?.message || 'Erro ao interpretar código HTML da SEFAZ.',
      });
    }
  },

  retryResolveCnpj: async (overrideCnpj?: string, forceRefresh = false) => {
    const rawCnpj = overrideCnpj || get().fields.issuerCnpj;
    const cleanCnpj = rawCnpj.replace(/\D/g, '');
    if (!cleanCnpj || cleanCnpj.length !== 14) return;

    set({ isResolvingCnpj: true, cnpjError: null });
    try {
      const cnpjInfo = await cnpjService.resolveCnpj(cleanCnpj, { forceRefresh });
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
      items: [],
      imageBlob: null,
      imagePreviewUrl: null,
      isScrapingSefaz: false,
      sefazScraped: false,
      cnpjError: null,
      sefazError: null,
      cnpjProviderUsed: null,
      formError: null,
      isSubmitting: false,
      lastSavedId: null,
    });
  },

  submitInvoice: async () => {
    const { fields, items, imageBlob, sefazScraped } = get();
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
        const normalized = fields.totalAmount.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(normalized);
        if (!isNaN(num)) {
          parsedAmount = num;
        }
      }

      let parsedTaxAmount: number | undefined = undefined;
      if (fields.taxAmount) {
        const normalized = fields.taxAmount.replace(/\./g, '').replace(',', '.');
        const num = parseFloat(normalized);
        if (!isNaN(num)) {
          parsedTaxAmount = num;
        }
      }

      const sefazStatus: SefazDataStatus =
        sefazScraped || items.length > 0 ? 'SUCCESS' : 'PENDING';

      const id = await invoiceRepository.create({
        accessKey: cleanKey,
        qrCodeUrl: fields.qrCodeUrl || undefined,
        type: fields.type,
        emissionDate: fields.emissionDate || undefined,
        issuerCnpj: cleanCnpj,
        issuerName: fields.issuerName || undefined,
        issuerAddress: fields.issuerAddress || undefined,
        model: fields.model || undefined,
        series: fields.series || undefined,
        number: fields.number || undefined,
        totalAmount: parsedAmount,
        taxAmount: parsedTaxAmount,
        paymentMethod: fields.paymentMethod || undefined,
        protocol: fields.protocol || undefined,
        recipientCpfCnpj: fields.recipientCpfCnpj
          ? fields.recipientCpfCnpj.replace(/\D/g, '')
          : undefined,
        recipientName: fields.recipientName || undefined,
        items: items.length > 0 ? items : undefined,
        imageBlob: imageBlob || undefined,
        sefazDataStatus: sefazStatus,
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
