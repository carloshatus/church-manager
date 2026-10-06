import { describe, it, expect } from 'vitest';
import {
  calculateNFeKeyDv,
  validateNFeKeyChecksum,
} from '@/domain/validators/key-checksum';
import { parseNFeKey, formatAccessKey } from '@/domain/parsers/nfe-key-parser';
import { parseScannedInput } from '@/domain/parsers/nfce-url-parser';

describe('Domain: Módulo 11 & Dígito Verificador', () => {
  it('deve calcular corretamente o Dígito Verificador de uma base de 43 dígitos', () => {
    // Base de 43 dígitos para NF-e SP
    const base43 = '3526101234567800019955001000000001100000001';
    const dv = calculateNFeKeyDv(base43);
    expect(typeof dv).toBe('number');
    expect(dv).toBeGreaterThanOrEqual(0);
    expect(dv).toBeLessThanOrEqual(9);

    // Chave completa válida
    const fullKey = `${base43}${dv}`;
    expect(validateNFeKeyChecksum(fullKey)).toBe(true);
  });

  it('deve invalidar chave com Dígito Verificador incorreto', () => {
    const base43 = '3526101234567800019955001000000001100000001';
    const correctDv = calculateNFeKeyDv(base43);
    const wrongDv = (correctDv + 1) % 10;
    const invalidKey = `${base43}${wrongDv}`;

    expect(validateNFeKeyChecksum(invalidKey)).toBe(false);
  });

  it('deve retornar falso para chaves com tamanho diferente de 44 dígitos', () => {
    expect(validateNFeKeyChecksum('12345')).toBe(false);
    expect(validateNFeKeyChecksum('3526101234567800019955001000000001100000001')).toBe(
      false
    ); // 43 dígitos
  });
});

describe('Domain: Parser de Chave NF-e / NFC-e (parseNFeKey)', () => {
  it('deve decompor perfeitamente uma chave NF-e (Modelo 55)', () => {
    // 35 (SP) + 2610 (2026/10) + 12345678000199 (CNPJ) + 55 (Mod) + 001 (Série) + 000000042 (Num) + 1 (tpEmis) + 12345678 (cNF)
    const base43 = '3526101234567800019955001000000042112345678';
    const dv = calculateNFeKeyDv(base43);
    const fullKey = `${base43}${dv}`;

    const parsed = parseNFeKey(fullKey);

    expect(parsed.accessKey).toBe(fullKey);
    expect(parsed.type).toBe('NFE');
    expect(parsed.ufCode).toBe('35');
    expect(parsed.ufSigla).toBe('SP');
    expect(parsed.ufName).toBe('São Paulo');
    expect(parsed.year).toBe(2026);
    expect(parsed.month).toBe(10);
    expect(parsed.emissionPeriod).toBe('2026-10');
    expect(parsed.cnpj).toBe('12345678000199');
    expect(parsed.model).toBe('55');
    expect(parsed.series).toBe('1');
    expect(parsed.number).toBe('42');
    expect(parsed.dv).toBe(String(dv));
    expect(parsed.isValidChecksum).toBe(true);
  });

  it('deve identificar corretamente NFC-e (Modelo 65)', () => {
    const base43 = '4326109876543200018865002000000150112345678';
    const dv = calculateNFeKeyDv(base43);
    const fullKey = `${base43}${dv}`;

    const parsed = parseNFeKey(fullKey);

    expect(parsed.type).toBe('NFCE');
    expect(parsed.ufSigla).toBe('RS');
    expect(parsed.model).toBe('65');
    expect(parsed.series).toBe('2');
    expect(parsed.number).toBe('150');
  });

  it('deve formatar a chave de 44 dígitos em grupos de 4 dígitos', () => {
    const key = '35261012345678000199550010000000421123456789';
    const formatted = formatAccessKey(key);
    expect(formatted.split(' ')).toHaveLength(11);
    expect(formatted.startsWith('3526 1012')).toBe(true);
  });

  it('deve lançar exceção ao receber chave incompleta', () => {
    expect(() => parseNFeKey('123456')).toThrow('Chave de acesso inválida');
  });
});

describe('Domain: Parser de Entrada Escaneada (parseScannedInput)', () => {
  const base43 = '4126101234567800019965001000000001100000001';
  const dv = calculateNFeKeyDv(base43);
  const sampleKey = `${base43}${dv}`;

  it('deve extrair chave digitada diretamente ou lida de código de barras', () => {
    const result = parseScannedInput(sampleKey);
    expect(result.isUrl).toBe(false);
    expect(result.accessKey).toBe(sampleKey);
    expect(result.qrCodeUrl).toBeUndefined();
  });

  it('deve suportar chaves digitadas com espaços ou hífens', () => {
    const formatted = formatAccessKey(sampleKey);
    const result = parseScannedInput(formatted);
    expect(result.isUrl).toBe(false);
    expect(result.accessKey).toBe(sampleKey);
  });

  it('deve extrair chave de URL NFC-e padrão nacional v2 (com pipe no parâmetro p)', () => {
    const qrUrl = `https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=${sampleKey}|2|1|1|HASH123456`;
    const result = parseScannedInput(qrUrl);

    expect(result.isUrl).toBe(true);
    expect(result.accessKey).toBe(sampleKey);
    expect(result.qrCodeUrl).toBe(qrUrl);
  });

  it('deve extrair chave de URL com parâmetro chNFe', () => {
    const qrUrl = `https://www.fazenda.pr.gov.br/nfce/qrcode?chNFe=${sampleKey}`;
    const result = parseScannedInput(qrUrl);

    expect(result.isUrl).toBe(true);
    expect(result.accessKey).toBe(sampleKey);
    expect(result.qrCodeUrl).toBe(qrUrl);
  });

  it('deve lançar erro explicativo para URLs que não contenham chaves fiscais', () => {
    expect(() => parseScannedInput('https://google.com')).toThrow(
      'Não foi possível identificar a chave de 44 dígitos'
    );
  });

  it('deve lançar erro para entrada vazia ou inválida', () => {
    expect(() => parseScannedInput('')).toThrow('não pode ser vazia');
    expect(() => parseScannedInput('12345')).toThrow('Entrada não reconhecida');
  });
});
