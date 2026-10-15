export type RecipientRole =
  'CHURCH_HEADQUARTERS' | 'CHURCH_BRANCH' | 'PASTOR' | 'TREASURER' | 'BUYER' | 'OTHER';

export interface AuthorizedRecipient {
  id: string;
  name: string;
  cpfCnpj: string; // 11 dígitos (CPF) ou 14 dígitos (CNPJ)
  role: RecipientRole;
}

export interface ChurchSettings {
  id: string; // 'default'
  churchName: string;
  mainCnpj?: string;
  authorizedRecipients: AuthorizedRecipient[];
  corsProxyUrl?: string; // Proxy CORS opcional customizado (ex: Cloudflare Worker)
  updatedAt: number;
}
