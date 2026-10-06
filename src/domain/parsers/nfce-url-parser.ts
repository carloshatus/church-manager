export interface ScannedInputResult {
  isUrl: boolean;
  qrCodeUrl?: string;
  accessKey: string;
}

/**
 * Identifica se a entrada escaneada é uma URL de QR Code ou uma chave digitada/código de barras.
 * Extrai a chave de acesso de 44 dígitos e preserva a URL original para posterior raspagem da SEFAZ.
 */
export function parseScannedInput(input: string): ScannedInputResult {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('A entrada escaneada não pode ser vazia.');
  }

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
    throw new Error(
      `Entrada não reconhecida. Forneça uma URL de QR Code de NFC-e válida ou uma chave de acesso com 44 dígitos (recebido: ${cleanKey.length} dígitos).`
    );
  }

  // Tratamento de URL
  const qrCodeUrl = trimmed;

  try {
    const url = new URL(trimmed);
    const searchParams = url.searchParams;

    // 1. Tenta parâmetro 'p' (padrão nacional NFC-e v2.0 com pipe |)
    const pParam = searchParams.get('p');
    if (pParam) {
      const keyCandidate = pParam.split('|')[0].replace(/\D/g, '');
      if (keyCandidate.length === 44) {
        return { isUrl: true, qrCodeUrl, accessKey: keyCandidate };
      }
    }

    // 2. Tenta parâmetros como 'chNFe', 'chave', 'ch'
    let foundKeyFromParam: string | null = null;
    searchParams.forEach((value, key) => {
      if (foundKeyFromParam) return;
      if (/^(chnfe|chave|ch)$/i.test(key) || /chnfe/i.test(key)) {
        const cleanVal = value.replace(/\D/g, '');
        if (cleanVal.length === 44) {
          foundKeyFromParam = cleanVal;
        }
      }
    });

    if (foundKeyFromParam) {
      return { isUrl: true, qrCodeUrl, accessKey: foundKeyFromParam };
    }

    // 3. Regex para encontrar sequência isolada de 44 dígitos no texto da URL
    const keyMatch = trimmed.match(/\b(\d{44})\b/);
    if (keyMatch) {
      return { isUrl: true, qrCodeUrl, accessKey: keyMatch[1] };
    }

    // 4. Fallback: qualquer sequência de 44 dígitos consecutivos
    const any44Digits = trimmed.replace(/\D/g, '').match(/\d{44}/);
    if (any44Digits) {
      return { isUrl: true, qrCodeUrl, accessKey: any44Digits[0] };
    }

    throw new Error('Não foi possível identificar a chave de 44 dígitos nesta URL de QR Code.');
  } catch (err: any) {
    if (err.message.includes('chave de 44 dígitos')) {
      throw err;
    }
    throw new Error(`Erro ao interpretar URL da SEFAZ: ${err.message}`);
  }
}
