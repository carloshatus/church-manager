export interface CnpjDto {
  cnpj: string;               // 14 dígitos numéricos limpos
  razaoSocial: string;        // Nome oficial / empresarial
  nomeFantasia?: string;      // Nome comercial / fantasia
  uf?: string;                // Sigla do estado (ex: "SP")
  municipio?: string;         // Nome do município
  cnaeFiscalDescricao?: string;// Atividade econômica principal
  status?: string;            // Situação cadastral (ex: "ATIVA")
  provider: 'BrasilAPI' | 'MinhaReceita' | 'Manual';
}

export interface ICnpjProvider {
  readonly name: string;
  fetchByCnpj(cleanCnpj: string): Promise<CnpjDto>;
}
