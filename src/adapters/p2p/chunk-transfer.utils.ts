/**
 * Utilitários para fatiamento e remontagem de Blobs em chunks seguros
 * para transmissão via WebRTC DataChannel.
 */

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export function base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Fatia um Blob em pedaços (chunks) de tamanho seguro para WebRTC.
 * O tamanho padrão de 32KB previne estouro do buffer de transmissão em conexões móveis.
 */
export async function splitBlobIntoChunks(
  blob: Blob,
  chunkSize = 32 * 1024
): Promise<{ chunks: string[]; mimeType: string }> {
  const mimeType = blob.type || 'image/jpeg';
  if (blob.size === 0) {
    return { chunks: [''], mimeType };
  }

  const base64 = await blobToBase64(blob);
  const chunks: string[] = [];

  for (let i = 0; i < base64.length; i += chunkSize) {
    chunks.push(base64.slice(i, i + chunkSize));
  }

  return {
    chunks: chunks.length > 0 ? chunks : [''],
    mimeType,
  };
}

/**
 * Coletor que remonta os chunks recebidos e reconstrói o Blob nativo.
 */
export class ChunkCollector {
  private chunks: Map<number, string> = new Map();
  private readonly totalChunks: number;
  private readonly mimeType: string;

  constructor(totalChunks: number, mimeType = 'image/jpeg') {
    this.totalChunks = Math.max(1, totalChunks);
    this.mimeType = mimeType;
  }

  addChunk(chunkIndex: number, data: string): boolean {
    this.chunks.set(chunkIndex, data);
    return this.isComplete();
  }

  isComplete(): boolean {
    return this.chunks.size >= this.totalChunks;
  }

  assembleBlob(): Blob {
    if (!this.isComplete()) {
      throw new Error(
        `Chunks incompletos: recebidos ${this.chunks.size} de ${this.totalChunks}`
      );
    }

    const parts: string[] = [];
    for (let i = 0; i < this.totalChunks; i++) {
      const chunk = this.chunks.get(i);
      if (chunk === undefined) {
        throw new Error(`Chunk ausente no índice ${i}`);
      }
      parts.push(chunk);
    }

    return base64ToBlob(parts.join(''), this.mimeType);
  }
}
