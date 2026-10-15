import { describe, it, expect } from 'vitest';
import {
  validateRecipient,
  formatRecipientRole,
} from '@/domain/services/recipient-validator.service';
import type { AuthorizedRecipient } from '@/domain/entities/church-settings';

describe('Domain: RecipientValidatorService (Validação Fiscal de Destinatário)', () => {
  const mainCnpj = '17.261.509/0001-86'; // CNPJ Matriz formatado
  const authorizedRecipients: AuthorizedRecipient[] = [
    {
      id: 'rec-1',
      name: 'Pr. Carlos Santos',
      cpfCnpj: '12345678901',
      role: 'PASTOR',
    },
    {
      id: 'rec-2',
      name: 'Maria Oliveira (Tesouraria)',
      cpfCnpj: '98765432100',
      role: 'TREASURER',
    },
    {
      id: 'rec-3',
      name: 'Congregação Bate Pé (Filial)',
      cpfCnpj: '17261509000786',
      role: 'CHURCH_BRANCH',
    },
  ];

  it('deve retornar UNIDENTIFIED quando o destinatário for vazio ou não informado', () => {
    const resultUndefined = validateRecipient(undefined, authorizedRecipients, mainCnpj);
    expect(resultUndefined.status).toBe('UNIDENTIFIED');
    expect(resultUndefined.message).toContain('Consumidor não identificado');

    const resultEmpty = validateRecipient('', authorizedRecipients, mainCnpj);
    expect(resultEmpty.status).toBe('UNIDENTIFIED');

    const resultOnlySpacesOrSymbols = validateRecipient(
      '   ./-  ',
      authorizedRecipients,
      mainCnpj
    );
    expect(resultOnlySpacesOrSymbols.status).toBe('UNIDENTIFIED');
  });

  it('deve retornar AUTHORIZED quando o destinatário for o CNPJ da Igreja Matriz', () => {
    const resultExact = validateRecipient(
      '17.261.509/0001-86',
      authorizedRecipients,
      mainCnpj
    );
    expect(resultExact.status).toBe('AUTHORIZED');
    expect(resultExact.message).toContain('Igreja Matriz');

    const resultUnformatted = validateRecipient(
      '17261509000186',
      authorizedRecipients,
      mainCnpj
    );
    expect(resultUnformatted.status).toBe('AUTHORIZED');
  });

  it('deve retornar AUTHORIZED quando o destinatário estiver na lista de autorizados', () => {
    // Pastor com CPF formatado
    const pastorResult = validateRecipient(
      '123.456.789-01',
      authorizedRecipients,
      mainCnpj
    );
    expect(pastorResult.status).toBe('AUTHORIZED');
    expect(pastorResult.matchedRecipient?.id).toBe('rec-1');
    expect(pastorResult.message).toContain('Pr. Carlos Santos');
    expect(pastorResult.message).toContain('Pastor(a)');

    // Filial com CNPJ
    const branchResult = validateRecipient(
      '17.261.509/0007-86',
      authorizedRecipients,
      mainCnpj
    );
    expect(branchResult.status).toBe('AUTHORIZED');
    expect(branchResult.matchedRecipient?.id).toBe('rec-3');
    expect(branchResult.message).toContain('Congregação Bate Pé (Filial)');
  });

  it('deve retornar UNAUTHORIZED com alerta de auditoria para CPF/CNPJ de terceiro não cadastrado', () => {
    const thirdPartyResult = validateRecipient(
      '111.222.333-44',
      authorizedRecipients,
      mainCnpj
    );
    expect(thirdPartyResult.status).toBe('UNAUTHORIZED');
    expect(thirdPartyResult.matchedRecipient).toBeUndefined();
    expect(thirdPartyResult.message).toContain('não cadastrado na lista de autorizados');
  });

  it('deve formatar corretamente os rótulos de papéis em português', () => {
    expect(formatRecipientRole('CHURCH_HEADQUARTERS')).toBe('Igreja Matriz');
    expect(formatRecipientRole('CHURCH_BRANCH')).toBe('Congregação / Filial');
    expect(formatRecipientRole('PASTOR')).toBe('Pastor(a)');
    expect(formatRecipientRole('TREASURER')).toBe('Tesoureiro(a)');
    expect(formatRecipientRole('BUYER')).toBe('Comprador(a) / Líder');
    expect(formatRecipientRole('OTHER')).toBe('Outro');
  });
});
