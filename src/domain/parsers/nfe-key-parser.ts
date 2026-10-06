import { UF_MAP } from './ufs';
import { validateNFeKeyChecksum } from '../validators/key-checksum';
import type { InvoiceType } from '../entities/invoice';

export interface ParsedKeyData {
  accessKey: string;
  type: InvoiceType;
  ufCode: string;
  ufSigla: string;
  ufName: string;
  year: number;
  month: number;
  emissionPeriod: string; // Formato "YYYY-MM"
  cnpj: string;           // 14 dígitos
  model: string;          // "55" ou "65"
  series: string;         // Número da série
  number: string;         // Número da nota
  emissionType: string;
  randomCode: string;
  dv: string;
  isValidChecksum: boolean;
}

/**
 * Formata a chave de 44 dígitos em blocos legíveis de 4 dígitos separados por espaço.
 */
export function formatAccessKey(key: string): string {
  const clean = key.replace(/\D/g, '');
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

/**
 * Decompõe uma chave de acesso fiscal de 44 dígitos em seus campos padronizados pela SEFAZ.
 */
export function parseNFeKey(rawKey: string): ParsedKeyData {
  const cleanKey = rawKey.replace(/\D/g, '');

  if (cleanKey.length !== 44) {
    throw new Error(`Chave de acesso inválida. Esperado 44 dígitos numéricos, recebido: ${cleanKey.length}`);
  }

  const ufCode = cleanKey.substring(0, 2);
  const aa = cleanKey.substring(2, 4);
  const mm = cleanKey.substring(4, 6);
  const cnpj = cleanKey.substring(6, 20);
  const model = cleanKey.substring(20, 22);
  const series = cleanKey.substring(22, 25);
  const number = cleanKey.substring(25, 34);
  const emissionType = cleanKey.substring(34, 35);
  const randomCode = cleanKey.substring(35, 43);
  const dv = cleanKey.substring(43, 44);

  const fullYear = 2000 + parseInt(aa, 10);
  const monthNum = parseInt(mm, 10);
  const emissionPeriod = `${fullYear}-${mm.padStart(2, '0')}`;

  const ufInfo = UF_MAP[ufCode] || { uf: 'UNKNOWN', name: 'Desconhecida' };

  let type: InvoiceType = 'UNKNOWN';
  if (model === '55') type = 'NFE';
  if (model === '65') type = 'NFCE';

  const isValidChecksum = validateNFeKeyChecksum(cleanKey);

  return {
    accessKey: cleanKey,
    type,
    ufCode,
    ufSigla: ufInfo.uf,
    ufName: ufInfo.name,
    year: fullYear,
    month: monthNum,
    emissionPeriod,
    cnpj,
    model,
    series: String(parseInt(series, 10) || 0),
    number: String(parseInt(number, 10) || 0),
    emissionType,
    randomCode,
    dv,
    isValidChecksum
  };
}
