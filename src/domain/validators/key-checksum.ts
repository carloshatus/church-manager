/**
 * Calcula o Dígito Verificador (Módulo 11) para os primeiros 43 dígitos de uma chave NF-e/NFC-e.
 * Regra técnica da Receita Federal:
 * Pesos de 2 a 9 da direita para a esquerda.
 * Resto 0 ou 1 => DV 0; caso contrário => 11 - resto.
 */
export function calculateNFeKeyDv(base43Digits: string): number {
  const cleanBase = base43Digits.replace(/\D/g, '');
  if (cleanBase.length !== 43) {
    throw new Error(`Base da chave deve ter 43 dígitos. Recebido: ${cleanBase.length}`);
  }

  let weight = 2;
  let sum = 0;

  for (let i = cleanBase.length - 1; i >= 0; i--) {
    const digit = parseInt(cleanBase.charAt(i), 10);
    sum += digit * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  return remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
}

/**
 * Valida se a chave de acesso de 44 dígitos possui Dígito Verificador válido.
 */
export function validateNFeKeyChecksum(rawKey: string): boolean {
  const cleanKey = rawKey.replace(/\D/g, '');
  if (cleanKey.length !== 44) return false;

  const base43 = cleanKey.substring(0, 43);
  const expectedDv = parseInt(cleanKey.charAt(43), 10);

  const calculatedDv = calculateNFeKeyDv(base43);
  return calculatedDv === expectedDv;
}
