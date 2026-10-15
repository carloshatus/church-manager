import { describe, it, expect } from 'vitest';
import {
  sefazBaParser,
  parseBrNumber,
  parseBrDate,
} from '@/adapters/sefaz/parsers/sefaz-ba.parser';
import { sefazParserRegistry } from '@/adapters/sefaz/parsers/sefaz-parser-registry';

// Fixture real do HTML da SEFAZ Bahia (BA)
const mockBahiaDanfeHtml = `
<!DOCTYPE html>
<html>
<head><title>SEFAZ BA - NFC-e</title></head>
<body>
  <div class="conteudo">
    <!-- Emitente -->
    <div class="txtCenter">
      <div id="u20" class="txtTopo">NOLASCO &amp; SOUSA LTDA</div>
      <div class="text">CNPJ: 44.053.985/0001-99</div>
      <div class="text">AVENIDA BELA VISTA, S/N, , BATE PE, VITORIA DA CONQUISTA, BA</div>
    </div>

    <!-- Tabela de Itens -->
    <table border="0" align="center" cellpadding="0" cellspacing="0" id="tabResult">
      <tr id="Item + 1">
        <td valign="top">
          <span class="txtTit">OLEO DIESEL B S500 COMUM</span>
          <span class="RCod">(Código: 6)</span>
          <br>
          <span class="Rqtd"><strong>Qtde.:</strong>49,444</span>
          <span class="RUN"><strong>UN: </strong>LITRO</span>
          <span class="RvlUnit"><strong>Vl. Unit.:</strong> 8,09</span>
        </td>
        <td align="right" valign="top" class="txtTit noWrap">
          Vl. Total<br><span class="valor">400,00</span>
        </td>
      </tr>
    </table>

    <!-- Totais e Pagamento -->
    <div id="totalNota" class="txtRight">
      <div id="linhaTotal">
        <label>Qtd. total de itens:</label>
        <span class="totalNumb">1</span>
      </div>
      <div id="linhaTotal" class="linhaShade">
        <label>Valor a pagar R$:</label>
        <span class="totalNumb txtMax">400,00</span>
      </div>
      <div id="linhaTotal">
        <label class="tx">1 - Dinheiro</label>
        <span class="totalNumb">400,00</span>
      </div>
      <div id="linhaTotal" class="spcTop">
        <label class="txtObs">Informação dos Tributos Totais Incidentes (Lei Federal 12.741 / 2012)</label>
        <span class="totalNumb txtObs">108,00</span>
      </div>
    </div>

    <!-- Informações Gerais & Protocolo -->
    <div data-role="collapsible">
      <h4>Informações gerais da Nota</h4>
      <ul data-role="listview">
        <li>
          <strong>Número: </strong>66151
          <strong> Série: </strong>1
          <strong> Emissão: </strong>27/09/2026 07:37:06-03:00
          <br><br><strong>Protocolo de Autorização: </strong>229261255104844
        </li>
      </ul>
    </div>

    <!-- Destinatário / Consumidor -->
    <div data-role="collapsible">
      <h4>Consumidor</h4>
      <ul data-role="listview">
        <li><strong>CNPJ: </strong>17.261.509/0007-86</li>
        <li><strong>Razão Social: </strong>Consumidor</li>
      </ul>
    </div>
  </div>
</body>
</html>
`;

describe('Adapters: SefazBaParser (Parser Especialista da Bahia)', () => {
  it('deve extrair com precisão todos os campos da nota fiscal a partir do HTML real da Bahia', () => {
    const accessKey = '29260944053985000199650010000661511323710790';
    const result = sefazBaParser.parseDanfeHtml(mockBahiaDanfeHtml, accessKey);

    expect(result.accessKey).toBe(accessKey);
    expect(result.issuerName).toBe('NOLASCO & SOUSA LTDA');
    expect(result.issuerCnpj).toBe('44053985000199');
    expect(result.issuerAddress).toBe(
      'AVENIDA BELA VISTA, S/N, , BATE PE, VITORIA DA CONQUISTA, BA'
    );

    // Totais e Pagamento
    expect(result.totalAmount).toBe(400.0);
    expect(result.paymentMethod).toBe('1 - Dinheiro');
    expect(result.taxAmount).toBe(108.0);

    // Informações Gerais
    expect(result.emissionDate).toBe('2026-09-27T07:37:06-03:00');
    expect(result.protocol).toBe('229261255104844');

    // Destinatário
    expect(result.recipientCpfCnpj).toBe('17261509000786');
    expect(result.recipientName).toBe('Consumidor');

    // Itens
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.description).toBe('OLEO DIESEL B S500 COMUM');
    expect(item.code).toBe('6');
    expect(item.quantity).toBe(49.444);
    expect(item.unit).toBe('LITRO');
    expect(item.unitPrice).toBe(8.09);
    expect(item.totalPrice).toBe(400.0);
  });

  it('deve identificar consumidor não identificado corretamente', () => {
    const htmlUnidentified = mockBahiaDanfeHtml.replace(
      /<li><strong>CNPJ: <\/strong>17.261.509\/0007-86<\/li>\s*<li><strong>Razão Social: <\/strong>Consumidor<\/li>/,
      '<li>Consumidor não identificado</li>'
    );

    const result = sefazBaParser.parseDanfeHtml(htmlUnidentified);
    expect(result.recipientCpfCnpj).toBeUndefined();
    expect(result.recipientName).toBe('Consumidor não identificado');
  });

  it('deve extrair múltiplos itens comprados', () => {
    const multiItemHtml = mockBahiaDanfeHtml.replace(
      '</table>',
      `
      <tr id="Item + 2">
        <td valign="top">
          <span class="txtTit">ARLA 32 BOMBONA 20L</span>
          <span class="RCod">(Código: 12)</span>
          <br>
          <span class="Rqtd"><strong>Qtde.:</strong>2,000</span>
          <span class="RUN"><strong>UN: </strong>UN</span>
          <span class="RvlUnit"><strong>Vl. Unit.:</strong> 65,00</span>
        </td>
        <td align="right" valign="top" class="txtTit noWrap">
          Vl. Total<br><span class="valor">130,00</span>
        </td>
      </tr>
      </table>
      `
    );

    const result = sefazBaParser.parseDanfeHtml(multiItemHtml);
    expect(result.items).toHaveLength(2);
    expect(result.items[1].description).toBe('ARLA 32 BOMBONA 20L');
    expect(result.items[1].code).toBe('12');
    expect(result.items[1].quantity).toBe(2);
    expect(result.items[1].unitPrice).toBe(65.0);
    expect(result.items[1].totalPrice).toBe(130.0);
  });

  it('deve converter números brasileiros corretamente em parseBrNumber', () => {
    expect(parseBrNumber('400,00')).toBe(400);
    expect(parseBrNumber('8,09')).toBe(8.09);
    expect(parseBrNumber('49,444')).toBe(49.444);
    expect(parseBrNumber('1.250,50')).toBe(1250.5);
    expect(parseBrNumber('')).toBeUndefined();
    expect(parseBrNumber(undefined)).toBeUndefined();
  });

  it('deve converter datas brasileiras para ISO em parseBrDate', () => {
    expect(parseBrDate('27/09/2026 07:37:06-03:00')).toBe('2026-09-27T07:37:06-03:00');
    expect(parseBrDate('15/10/2026 14:30:00')).toBe('2026-10-15T14:30:00');
    expect(parseBrDate('')).toBeUndefined();
  });
});

describe('Adapters: SefazParserRegistry', () => {
  it('deve resolver o parser da Bahia por UF ("BA")', () => {
    const parser = sefazParserRegistry.getParser('BA');
    expect(parser).toBeDefined();
    expect(parser?.uf).toBe('BA');
  });

  it('deve resolver o parser da Bahia a partir da URL da SEFAZ BA', () => {
    const url =
      'http://nfe.sefaz.ba.gov.br/servicos/nfce/modulos/geral/NFCEC_consulta_chave_acesso.aspx?p=...';
    const parser = sefazParserRegistry.getParser('', url);
    expect(parser).toBeDefined();
    expect(parser?.uf).toBe('BA');
  });

  it('deve retornar undefined para UFs ou URLs não suportadas', () => {
    expect(sefazParserRegistry.getParser('ZZ')).toBeUndefined();
    expect(sefazParserRegistry.getParser('', 'https://google.com')).toBeUndefined();
  });
});
