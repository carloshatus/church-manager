import type { IStateSefazParser } from '@/ports/state-sefaz-parser.port';
import type { SefazScrapeResult } from '@/ports/sefaz-scraper.port';
import type { InvoiceItem } from '@/domain/entities/invoice-item';

/**
 * Decodifica entidades HTML básicas como &amp;, &quot;, &#39;, &lt;, &gt;
 */
function decodeHtml(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Converte strings numéricas em formato brasileiro (ex: "400,00" ou "49,444" ou "1.250,50")
 * em números de ponto flutuante válidos.
 */
export function parseBrNumber(val: string | undefined): number | undefined {
  if (!val) return undefined;
  const clean = val.trim();
  if (!clean) return undefined;

  // Se houver vírgula, assume padrão BR (pontos são milhares, vírgula é decimal)
  if (clean.includes(',')) {
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? undefined : num;
  }

  // Se só houver ponto
  const num = parseFloat(clean);
  return isNaN(num) ? undefined : num;
}

/**
 * Converte timestamp brasileiro da SEFAZ (ex: "27/09/2026 07:37:06-03:00")
 * para formato ISO 8601 (ex: "2026-09-27T07:37:06-03:00").
 */
export function parseBrDate(dateStr: string | undefined): string | undefined {
  if (!dateStr) return undefined;
  const match = dateStr
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2}(?:-\d{2}:\d{2})?)/);
  if (!match) return dateStr.trim();
  const [, day, month, year, time] = match;
  return `${year}-${month}-${day}T${time}`;
}

/**
 * Parser especialista para páginas de DANFE / consulta NFC-e da SEFAZ Bahia (BA).
 * Processa a estrutura HTML ASP.NET renderizada em nfe.sefaz.ba.gov.br.
 */
export class SefazBaParser implements IStateSefazParser {
  readonly uf = 'BA';

  canHandle(uf: string, url?: string): boolean {
    if (uf.toUpperCase() === 'BA') return true;
    if (url && /sefaz\.ba\.gov\.br/i.test(url)) return true;
    return false;
  }

  parseDanfeHtml(html: string, accessKeyHint?: string): SefazScrapeResult {
    let accessKey = accessKeyHint || '';

    // 1. Chave de acesso no HTML caso não informada
    if (!accessKey) {
      const keyMatch =
        html.match(/(?:chave|Chave de Acesso)[^0-9]*([0-9]{44})/i) ||
        html.match(/\b([0-9]{44})\b/);
      if (keyMatch) {
        accessKey = keyMatch[1];
      }
    }

    // 2. Emitente (Razão Social, CNPJ e Endereço)
    let issuerName: string | undefined;
    let issuerCnpj: string | undefined;
    let issuerAddress: string | undefined;

    // Razão Social
    const topoMatch = html.match(
      /<(?:div|span)[^>]*class=["'][^"']*txtTopo[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i
    );
    if (topoMatch) {
      issuerName = decodeHtml(topoMatch[1]);
    }

    // CNPJ do Emitente
    const cnpjMatch = html.match(/CNPJ:\s*([0-9.\-/]{14,18})/i);
    if (cnpjMatch) {
      issuerCnpj = cnpjMatch[1].replace(/\D/g, '');
    }

    // Endereço do Emitente
    // Geralmente uma tag com class="text" que não contém "CNPJ:"
    const textMatches = Array.from(
      html.matchAll(/<div[^>]*class=["'][^"']*text[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi)
    );
    for (const match of textMatches) {
      const content = decodeHtml(match[1]);
      if (!content.includes('CNPJ:') && content.length > 5) {
        issuerAddress = content;
        break;
      }
    }

    // 3. Tabela de Itens (id="tabResult")
    const items: InvoiceItem[] = [];
    const tabResultMatch = html.match(
      /<table[^>]*id=["']tabResult["'][^>]*>([\s\S]*?)<\/table>/i
    );
    const itemsHtml = tabResultMatch ? tabResultMatch[1] : html;

    // Itera por cada linha de item (<tr id="Item + ...">)
    const rowMatches = Array.from(
      itemsHtml.matchAll(/<tr[^>]*id=["']Item[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)
    );

    // Fallback: se não tiver id="Item", busca por qualquer <tr> com class="txtTit"
    const rowsToProcess =
      rowMatches.length > 0
        ? rowMatches.map((m) => m[1])
        : Array.from(
            itemsHtml.matchAll(
              /<tr[^>]*>([\s\S]*?class=["'][^"']*txtTit[^"']*["'][\s\S]*?)<\/tr>/gi
            )
          ).map((m) => m[1]);

    for (const rowHtml of rowsToProcess) {
      // Descrição do Produto
      const descMatch = rowHtml.match(
        /<span[^>]*class=["'][^"']*txtTit[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
      );
      const description = descMatch ? decodeHtml(descMatch[1]) : '';

      // Código do Produto
      const codeMatch = rowHtml.match(
        /<span[^>]*class=["'][^"']*RCod[^"']*["'][^>]*>[\s\S]*?\(C[óo]digo:\s*([^)]+)\)[\s\S]*?<\/span>/i
      );
      const code = codeMatch ? decodeHtml(codeMatch[1]) : '';

      // Quantidade
      const qtdMatch = rowHtml.match(
        /<span[^>]*class=["'][^"']*Rqtd[^"']*["'][^>]*>[\s\S]*?Qtde\.:\s*<\/strong>\s*([0-9.,]+)[\s\S]*?<\/span>/i
      );
      const quantity = qtdMatch ? (parseBrNumber(qtdMatch[1]) ?? 1) : 1;

      // Unidade de Medida
      const unMatch = rowHtml.match(
        /<span[^>]*class=["'][^"']*RUN[^"']*["'][^>]*>[\s\S]*?UN:\s*<\/strong>\s*([^<]+)[\s\S]*?<\/span>/i
      );
      const unit = unMatch ? decodeHtml(unMatch[1]) : 'UN';

      // Valor Unitário
      const vlUnitMatch = rowHtml.match(
        /<span[^>]*class=["'][^"']*RvlUnit[^"']*["'][^>]*>[\s\S]*?Vl\.\s*Unit\.:\s*<\/strong>\s*([0-9.,]+)[\s\S]*?<\/span>/i
      );
      const unitPrice = vlUnitMatch ? (parseBrNumber(vlUnitMatch[1]) ?? 0) : 0;

      // Valor Total do Item
      const valTotalMatch = rowHtml.match(
        /<span[^>]*class=["'][^"']*valor[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
      );
      const totalPrice = valTotalMatch
        ? (parseBrNumber(valTotalMatch[1]) ?? unitPrice * quantity)
        : unitPrice * quantity;

      if (description) {
        items.push({
          code,
          description,
          quantity,
          unit,
          unitPrice,
          totalPrice,
        });
      }
    }

    // 4. Totais e Pagamento (id="totalNota")
    let totalAmount: number | undefined;
    const totalMatch =
      html.match(
        /<label[^>]*>Valor a pagar R\$:<\/label>\s*<span[^>]*class=["'][^"']*totalNumb[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
      ) ||
      html.match(
        /<span[^>]*class=["'][^"']*totalNumb\s+txtMax[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
      );
    if (totalMatch) {
      totalAmount = parseBrNumber(totalMatch[1]);
    }

    // Forma de Pagamento
    let paymentMethod: string | undefined;
    const paymentMatch = html.match(
      /<label[^>]*class=["'][^"']*tx[^"']*["'][^>]*>([\s\S]*?)<\/label>/i
    );
    if (paymentMatch) {
      paymentMethod = decodeHtml(paymentMatch[1]);
    }

    // Tributos Incidentes
    let taxAmount: number | undefined;
    const taxMatch = html.match(
      /<label[^>]*class=["'][^"']*txtObs[^"']*["'][^>]*>[\s\S]*?Tributos[\s\S]*?<\/label>\s*<span[^>]*class=["'][^"']*totalNumb\s+txtObs[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    );
    if (taxMatch) {
      taxAmount = parseBrNumber(taxMatch[1]);
    }

    // 5. Informações Gerais da Nota (Emissão, Protocolo)
    let emissionDate: string | undefined;
    let protocol: string | undefined;

    const emissionMatch = html.match(
      /<strong>\s*Emiss[ãa]o:\s*<\/strong>\s*([0-9/]+\s+[0-9:]+(?:-[0-9:]+)?)/i
    );
    if (emissionMatch) {
      emissionDate = parseBrDate(emissionMatch[1]);
    }

    const protocolMatch = html.match(
      /<strong>\s*Protocolo de Autoriza[çc][ãa]o:\s*<\/strong>\s*([0-9]+)/i
    );
    if (protocolMatch) {
      protocol = protocolMatch[1];
    }

    // 6. Destinatário / Consumidor
    let recipientCpfCnpj: string | undefined;
    let recipientName: string | undefined;

    const consumidorSection = html.match(
      /<h4>\s*Consumidor\s*<\/h4>([\s\S]*?)(?:<\/div>|<div)/i
    );
    const consumidorHtml = consumidorSection ? consumidorSection[1] : html;

    if (/Consumidor n[ãa]o identificado/i.test(consumidorHtml)) {
      recipientCpfCnpj = undefined;
      recipientName = 'Consumidor não identificado';
    } else {
      const recipientDocMatch = consumidorHtml.match(
        /<strong>\s*(?:CNPJ|CPF):\s*<\/strong>\s*([0-9.\-/]+)/i
      );
      if (recipientDocMatch) {
        recipientCpfCnpj = recipientDocMatch[1].replace(/\D/g, '');
      }

      const recipientNameMatch = consumidorHtml.match(
        /<strong>\s*Raz[ãa]o Social:\s*<\/strong>\s*([^<]+)/i
      );
      if (recipientNameMatch) {
        recipientName = decodeHtml(recipientNameMatch[1]);
      }
    }

    return {
      accessKey,
      totalAmount,
      emissionDate,
      protocol,
      issuerName,
      issuerCnpj,
      issuerAddress,
      recipientCpfCnpj,
      recipientName,
      paymentMethod,
      taxAmount,
      items,
      rawHtml: html,
    };
  }
}

export const sefazBaParser = new SefazBaParser();
