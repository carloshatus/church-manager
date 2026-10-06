import imageCompression from 'browser-image-compression';

export interface ImageCompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  initialQuality?: number;
  fileType?: string;
}

export class ImageCompressionService {
  private static defaultOptions = {
    maxSizeMB: 0.8, // Alvo de compressão: no máximo 800KB
    maxWidthOrHeight: 1600, // Resolução suficiente para OCR e leitura de itens
    useWebWorker: true, // Não trava a UI durante a compressão
    fileType: 'image/jpeg', // Padronização em JPEG
    initialQuality: 0.85,
  };

  /**
   * Comprime um arquivo de imagem recebido do input de câmera em segundo plano.
   * Converte fotos pesadas de celulares (5MB-12MB) para menos de 800KB.
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
      // Se for Blob puro sem nome, converte temporariamente para File para compatibilidade
      const targetFile =
        file instanceof File
          ? file
          : new File([file], 'receipt.jpg', { type: file.type || 'image/jpeg' });

      const compressedBlob = await imageCompression(targetFile, options);
      return compressedBlob;
    } catch (error) {
      console.warn(
        'Compressão falhou ou não suportada no ambiente, usando original:',
        error
      );
      return file;
    }
  }

  /**
   * Cria uma URL temporária com URL.createObjectURL para renderizar a imagem na UI
   * e retorna uma função revoke para liberar a memória imediatamente ao desmontar.
   */
  public static createPreviewUrl(blob: Blob): { url: string; revoke: () => void } {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(blob);
      return {
        url,
        revoke: () => {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // Ignora se já tiver sido revogado
          }
        },
      };
    }

    return {
      url: '',
      revoke: () => {},
    };
  }
}
