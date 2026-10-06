# 03 - Parsers de Domínio & Regras Fiscais (Chave 44 Dígitos & URLs NFC-e)

Este documento estabelece as regras de domínio para decodificar chaves de acesso de 44 dígitos de NF-e/NFC-e e extrair chaves de URLs lidas em QR Codes de diferentes portais da SEFAZ.

---

## 1. Anatomia da Chave de Acesso Fiscal (44 Dígitos)

A chave de acesso é padronizada nacionalmente pela Receita Federal e Conselho Nacional de Política Fazendária (CONFAZ). Ela possui exatamente 44 dígitos numéricos:

| Posição | Tamanho | Campo | Descrição | Exemplo |
| :--- | :--- | :--- | :--- | :--- |
| **01 a 02** | 2 | `cUF` | Código IBGE do estado emissor | `35` (São Paulo) |
| **03 a 06** | 4 | `AAMM` | Ano (2 dígitos) e Mês (2 dígitos) de emissão | `2610` (Outubro/2026) |
| **07 a 20** | 14 | `CNPJ` | CNPJ do emitente sem formatação | `12345678000199` |
| **21 a 22** | 2 | `mod` | Modelo do documento fiscal | `55` (NF-e) ou `65` (NFC-e) |
| **23 a 25** | 3 | `serie` | Série do documento fiscal | `001` |
| **26 a 34** | 9 | `nNF` | Número do documento fiscal | `000012345` |
| **35 a 35** | 1 | `tpEmis` | Forma de emissão (1 = Normal, 9 = Contingência offline, etc.) | `1` |
| **36 a 43** | 8 | `cNF` | Código numérico que compõe a chave (aleatório) | `10293847` |
| **44 a 44** | 1 | `cDV` | Dígito Verificador da chave de acesso | `4` |

---

## 2. Validação Matemática da Chave (Módulo 11)

O Dígito Verificador (44º dígito) é calculado com o algoritmo Módulo 11 com pesos de 2 a 9 da direita para a esquerda:

```typescript
// src/domain/validators/key-checksum.ts

export function validateNFeKeyChecksum(rawKey: string): boolean {
  const cleanKey = rawKey.replace(/\D/g, '');
  if (cleanKey.length !== 44) return false;

  const base = cleanKey.substring(0, 43);
  const expectedDv = parseInt(cleanKey.charAt(43), 10);

  let weight = 2;
  let sum = 0;

  for (let i = base.length - 1; i >= 0; i--) {
    sum += parseInt(base.charAt(i), 10) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  const calculatedDv = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;

  return calculatedDv === expectedDv;
}
```

---

## 3. Tabela de UFs do Brasil (IBGE)

```typescript
// src/domain/parsers/ufs.ts

export const UF_MAP: Record<string, { uf: string; name: string }> = {
  '11': { uf: 'RO', name: 'Rondônia' },
  '12': { uf: 'AC', name: 'Acre' },
  '13': { uf: 'AM', name: 'Amazonas' },
  '14': { uf: 'RR', name: 'Roraima' },
  '15': { uf: 'PA', name: 'Pará' },
  '16': { uf: 'AP', name: 'Amapá' },
  '17': { uf: 'TO', name: 'Tocantins' },
  '21': { uf: 'MA', name: 'Maranhão' },
  '22': { uf: 'PI', name: 'Piauí' },
  '23': { uf: 'CE', name: 'Ceará' },
  '24': { uf: 'RN', name: 'Rio Grande do Norte' },
  '25': { uf: 'PB', name: 'Paraíba' },
  '26': { uf: 'PE', name: 'Pernambuco' },
  '27': { uf: 'AL', name: 'Alagoas' },
  '28': { uf: 'SE', name: 'Sergipe' },
  '29': { uf: 'BA', name: 'Bahia' },
  '31': { uf: 'MG', name: 'Minas Gerais' },
  '32': { uf: 'ES', name: 'Espírito Santo' },
  '33': { uf: 'RJ', name: 'Rio de Janeiro' },
  '35': { uf: 'SP', name: 'São Paulo' },
  '41': { uf: 'PR', name: 'Paraná' },
  '42': { uf: 'SC', name: 'Santa Catarina' },
  '43': { uf: 'RS', name: 'Rio Grande do Sul' },
  '50': { uf: 'MS', name: 'Mato Grosso do Sul' },
  '51': { uf: 'MT', name: 'Mato Grosso' },
  '52': { uf: 'GO', name: 'Goiás' },
  '53': { uf: 'DF', name: 'Distrito Federal' },
};
```

---

## 4. Parser da Chave de Acesso (`nfe-key-parser.ts`)

Converte uma chave bruta ou sanitizada de 44 dígitos em um objeto estruturado:

```typescript
// src/domain/parsers/nfe-key-parser.ts
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
  emissionPeriod: string; // "YYYY-MM"
  cnpj: string;
  model: string;          // "55" ou "65"
  series: string;
  number: string;
  emissionType: string;
  randomCode: string;
  dv: string;
  isValidChecksum: boolean;
}

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
    series: String(parseInt(series, 10)), // remove zeros à esquerda para exibição limpa
    number: String(parseInt(number, 10)),
    emissionType,
    randomCode,
    dv,
    isValidChecksum
  };
}
```

---

## 5. Parser de URLs de QR Code da NFC-e (`nfce-url-parser.ts`)

No Brasil, os QR Codes de NFC-e seguem o Padrão Técnico Nacional, onde a URL carrega a chave ou diretamente ou codificada dentro de um parâmetro `p=`:
- **Padrão 2.0 (Mais comum)**: `https://.../qrcode?p=35261012345678000199650010000000011000000014|2|1|1|...`
- **Padrão com `chNFe`**: `https://.../consulta?chNFe=35261012345678000199650010000000011000000014`
- **Padrão Path ou Query direta**: `https://.../35261012345678000199650010000000011000000014`

```typescript
// src/domain/parsers/nfce-url-parser.ts

export interface ScannedInputResult {
  isUrl: boolean;
  qrCodeUrl?: string;
  accessKey: string;
}

export function parseScannedInput(input: string): ScannedInputResult {
  const trimmed = input.trim();

  // Verifica se é URL (inicia com http:// ou https://)
  const isUrl = /^https?:\/\//i.test(trimmed);

  if (!isUrl) {
    const cleanKey = trimmed.replace(/\D/g, '');
    if (cleanKey.length === 44) {
      return {
        isUrl: false,
        accessKey: cleanKey
      };
    }
    throw new Error('Entrada não é uma URL válida nem uma chave de 44 dígitos.');
  }

  // Tratamento de URL
  const qrCodeUrl = trimmed;

  try {
    const url = new URL(trimmed);
    const searchParams = url.searchParams;

    // 1. Tenta parâmetro 'p' (padrão nacional v2)
    const pParam = searchParams.get('p');
    if (pParam) {
      // Se houver pipe (|), a chave é o primeiro item
      const keyCandidate = pParam.split('|')[0].replace(/\D/g, '');
      if (keyCandidate.length === 44) {
        return { isUrl: true, qrCodeUrl, accessKey: keyCandidate };
      }
    }

    // 2. Tenta parâmetro 'chNFe' ou variações de case
    for (const [key, value] of searchParams.entries()) {
      if (/chnfe/i.test(key)) {
        const cleanVal = value.replace(/\D/g, '');
        if (cleanVal.length === 44) {
          return { isUrl: true, qrCodeUrl, accessKey: cleanVal };
        }
      }
    }

    // 3. Regex global em toda a URL para encontrar sequência de 44 dígitos consecutivos
    const keyMatch = trimmed.match(/\b(\d{44})\b/);
    if (keyMatch) {
      return { isUrl: true, qrCodeUrl, accessKey: keyMatch[1] };
    }

    // 4. Se não encontrar 44 dígitos isolados, busca em blocos de dígitos na query
    const any44Digits = trimmed.replace(/\D/g, '').match(/\d{44}/);
    if (any44Digits) {
      return { isUrl: true, qrCodeUrl, accessKey: any44Digits[0] };
    }

    throw new Error('Não foi possível extrair uma chave de acesso de 44 dígitos desta URL de NFC-e.');
  } catch (err: any) {
    throw new Error(`Erro ao interpretar QR Code: ${err.message}`);
  }
}
```
