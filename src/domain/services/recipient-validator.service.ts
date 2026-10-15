import type {
  AuthorizedRecipient,
  RecipientRole,
} from '@/domain/entities/church-settings';

export type RecipientValidationStatus = 'UNIDENTIFIED' | 'AUTHORIZED' | 'UNAUTHORIZED';

export interface RecipientValidationResult {
  status: RecipientValidationStatus;
  message: string;
  matchedRecipient?: AuthorizedRecipient;
}

export function formatRecipientRole(role: RecipientRole): string {
  switch (role) {
    case 'CHURCH_HEADQUARTERS':
      return 'Igreja Matriz';
    case 'CHURCH_BRANCH':
      return 'Congregação / Filial';
    case 'PASTOR':
      return 'Pastor(a)';
    case 'TREASURER':
      return 'Tesoureiro(a)';
    case 'BUYER':
      return 'Comprador(a) / Líder';
    case 'OTHER':
      return 'Outro';
    default:
      return role;
  }
}

/**
 * Validação pura de conformidade do destinatário fiscal (Consumidor)
 * contra os parâmetros e auditoria interna da Igreja.
 *
 * 1. Não Identificado: Válido (Compras rotineiras de balcão).
 * 2. CNPJ da Igreja Matriz ou Filial: Válido e Autorizado.
 * 3. CPF de Líder/Membro previamente cadastrado: Válido e Autorizado.
 * 4. CPF/CNPJ de terceiro não cadastrado: Inválido / Alerta de Auditoria.
 */
export function validateRecipient(
  recipientCpfCnpj: string | undefined,
  authorizedRecipients: AuthorizedRecipient[],
  churchMainCnpj?: string
): RecipientValidationResult {
  const clean = recipientCpfCnpj ? recipientCpfCnpj.replace(/\D/g, '') : '';

  // 1. Sem identificação no cupom fiscal (Válido para prestação de contas)
  if (!clean) {
    return {
      status: 'UNIDENTIFIED',
      message:
        'Consumidor não identificado no cupom fiscal (Conforme para prestação de contas).',
    };
  }

  // 2. Compara com o CNPJ principal da igreja
  if (churchMainCnpj && clean === churchMainCnpj.replace(/\D/g, '')) {
    return {
      status: 'AUTHORIZED',
      message: 'Emitido no CNPJ oficial da Igreja Matriz.',
    };
  }

  // 3. Compara com a lista de autorizados cadastrados
  const match = authorizedRecipients.find(
    (item) => item.cpfCnpj.replace(/\D/g, '') === clean
  );

  if (match) {
    return {
      status: 'AUTHORIZED',
      message: `Emitido para destinatário autorizado: ${match.name} (${formatRecipientRole(match.role)}).`,
      matchedRecipient: match,
    };
  }

  // 4. Identificado, porém NÃO cadastrado na lista da Igreja (Alerta de Auditoria)
  return {
    status: 'UNAUTHORIZED',
    message: `Atenção: Destinatário com CPF/CNPJ (${recipientCpfCnpj}) não cadastrado na lista de autorizados da igreja.`,
  };
}
