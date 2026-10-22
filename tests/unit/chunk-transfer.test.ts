import { describe, it, expect } from 'vitest';
import {
  blobToBase64,
  base64ToBlob,
  splitBlobIntoChunks,
  ChunkCollector,
} from '@/adapters/p2p/chunk-transfer.utils';

describe('chunk-transfer.utils: Fatiamento e Montagem de Blobs Binários', () => {
  it('deve realizar round-trip de conversão Blob <-> Base64 mantendo os bytes intactos', async () => {
    const rawContent = 'Church Manager P2P Data - 1234567890';
    const blob = new Blob([rawContent], { type: 'text/plain' });

    const base64 = await blobToBase64(blob);
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(0);

    const reconstructed = base64ToBlob(base64, 'text/plain');
    const text = await reconstructed.text();
    expect(text).toBe(rawContent);
    expect(reconstructed.type).toBe('text/plain');
  });

  it('deve fatiar um Blob em múltiplos chunks e remontá-lo com fidelidade total', async () => {
    // Cria um buffer de 70KB de dados binários
    const sizeInBytes = 70 * 1024;
    const uint8 = new Uint8Array(sizeInBytes);
    for (let i = 0; i < sizeInBytes; i++) {
      uint8[i] = i % 256;
    }
    const originalBlob = new Blob([uint8], { type: 'image/jpeg' });

    // Fatiar com chunks de 16KB
    const { chunks, mimeType } = await splitBlobIntoChunks(originalBlob, 16 * 1024);
    expect(chunks.length).toBeGreaterThan(1);
    expect(mimeType).toBe('image/jpeg');

    // Remontar utilizando o ChunkCollector
    const collector = new ChunkCollector(chunks.length, mimeType);
    expect(collector.isComplete()).toBe(false);

    chunks.forEach((chunk, index) => {
      collector.addChunk(index, chunk);
    });

    expect(collector.isComplete()).toBe(true);

    const assembledBlob = collector.assembleBlob();
    expect(assembledBlob.size).toBe(originalBlob.size);
    expect(assembledBlob.type).toBe('image/jpeg');

    const assembledBuffer = await assembledBlob.arrayBuffer();
    const assembledUint8 = new Uint8Array(assembledBuffer);

    expect(assembledUint8.length).toBe(uint8.length);
    for (let i = 0; i < 100; i++) {
      expect(assembledUint8[i]).toBe(uint8[i]);
    }
  });

  it('deve lidar com chunks recebidos fora de ordem', async () => {
    const text = 'Sincronização descentralizada offline-first para tesouraria';
    const blob = new Blob([text], { type: 'text/plain' });

    const { chunks, mimeType } = await splitBlobIntoChunks(blob, 10);
    expect(chunks.length).toBeGreaterThan(1);

    const collector = new ChunkCollector(chunks.length, mimeType);

    // Inserir na ordem inversa
    for (let i = chunks.length - 1; i >= 0; i--) {
      collector.addChunk(i, chunks[i]);
    }

    expect(collector.isComplete()).toBe(true);
    const assembled = collector.assembleBlob();
    expect(await assembled.text()).toBe(text);
  });

  it('deve lançar erro se tentar remontar antes de todos os chunks estarem presentes', () => {
    const collector = new ChunkCollector(3, 'image/png');
    collector.addChunk(0, 'chunk0');
    collector.addChunk(1, 'chunk1');

    expect(collector.isComplete()).toBe(false);
    expect(() => collector.assembleBlob()).toThrow('Chunks incompletos');
  });
});
