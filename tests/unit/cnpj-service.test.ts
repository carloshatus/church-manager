import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrasilApiAdapter } from '@/adapters/cnpj/brasil-api.adapter';
import { MinhaReceitaAdapter } from '@/adapters/cnpj/minha-receita.adapter';
import { CnpjWsAdapter } from '@/adapters/cnpj/cnpj-ws.adapter';
import { CnpjService } from '@/adapters/cnpj/cnpj-service';
import type { ICnpjProvider, CnpjDto } from '@/ports/cnpj-provider.port';

describe('CNPJ Adapters: BrasilApiAdapter, MinhaReceitaAdapter & CnpjWsAdapter', () => {
  const sampleCnpj = '12345678000199';

  it('CnpjWsAdapter deve normalizar resposta de sucesso', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        cnpj_raiz: '12345678',
        razao_social: 'Livraria e Papelaria Central Ltda',
        estabelecimento: {
          cnpj: '12.345.678/0001-99',
          nome_fantasia: 'Livraria Central',
          situacao_cadastral: 'Ativa',
          estado: { sigla: 'SP' },
          cidade: { nome: 'São Paulo' },
          atividade_principal: { descricao: 'Comércio varejista de livros' },
        },
      }),
    });

    const adapter = new CnpjWsAdapter('https://fake-cnpj-ws', 5000, mockFetch as unknown as typeof fetch);
    const result = await adapter.fetchByCnpj(sampleCnpj);

    expect(result.cnpj).toBe('12345678000199');
    expect(result.razaoSocial).toBe('Livraria e Papelaria Central Ltda');
    expect(result.nomeFantasia).toBe('Livraria Central');
    expect(result.uf).toBe('SP');
    expect(result.municipio).toBe('São Paulo');
    expect(result.cnaeFiscalDescricao).toBe('Comércio varejista de livros');
    expect(result.status).toBe('Ativa');
    expect(result.provider).toBe('CnpjWs');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('CnpjWsAdapter deve lançar erro se o status HTTP não for OK com detalhes', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        status: 404,
        titulo: 'CNPJ não encontrado',
        detalhes: 'O CNPJ informado não consta na base de dados.',
      }),
    });

    const adapter = new CnpjWsAdapter('https://fake-cnpj-ws', 5000, mockFetch as unknown as typeof fetch);
    await expect(adapter.fetchByCnpj(sampleCnpj)).rejects.toThrow(
      'CNPJ.ws retornou status HTTP 404: O CNPJ informado não consta na base de dados.'
    );
  });

  it('BrasilApiAdapter deve normalizar resposta de sucesso', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        cnpj: '12.345.678/0001-99',
        razao_social: 'Livraria e Papelaria Central Ltda',
        nome_fantasia: 'Livraria Central',
        uf: 'SP',
        municipio: 'São Paulo',
        descricao_situacao_cadastral: 'ATIVA',
      }),
    });

    const adapter = new BrasilApiAdapter('https://fake-api', 5000, mockFetch as unknown as typeof fetch);
    const result = await adapter.fetchByCnpj(sampleCnpj);

    expect(result.cnpj).toBe('12345678000199');
    expect(result.razaoSocial).toBe('Livraria e Papelaria Central Ltda');
    expect(result.nomeFantasia).toBe('Livraria Central');
    expect(result.uf).toBe('SP');
    expect(result.provider).toBe('BrasilAPI');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('BrasilApiAdapter deve lançar erro se o status HTTP não for OK', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const adapter = new BrasilApiAdapter('https://fake-api', 5000, mockFetch as unknown as typeof fetch);
    await expect(adapter.fetchByCnpj(sampleCnpj)).rejects.toThrow(
      'BrasilAPI retornou status HTTP 404'
    );
  });

  it('MinhaReceitaAdapter deve normalizar resposta de sucesso', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        cnpj: '12345678000199',
        razao_social: 'Livraria e Papelaria Central - Minha Receita',
        uf: 'SP',
        municipio: 'São Paulo',
      }),
    });

    const adapter = new MinhaReceitaAdapter(
      'https://fake-minha-receita',
      5000,
      mockFetch as unknown as typeof fetch
    );
    const result = await adapter.fetchByCnpj(sampleCnpj);

    expect(result.cnpj).toBe('12345678000199');
    expect(result.razaoSocial).toBe('Livraria e Papelaria Central - Minha Receita');
    expect(result.provider).toBe('MinhaReceita');
  });
});

describe('CnpjService: Orquestrador com Fallback Resiliente & Cache', () => {
  const sampleCnpj = '12345678000199';

  let primaryMock: ICnpjProvider;
  let fallbackMock: ICnpjProvider;

  beforeEach(() => {
    primaryMock = {
      name: 'BrasilAPI',
      fetchByCnpj: vi.fn(),
    };
    fallbackMock = {
      name: 'MinhaReceita',
      fetchByCnpj: vi.fn(),
    };
  });

  it('deve usar o provedor primário quando ele responde com sucesso (sem acionar fallback)', async () => {
    const primaryData: CnpjDto = {
      cnpj: sampleCnpj,
      razaoSocial: 'Empresa Principal Ltda',
      provider: 'BrasilAPI',
    };

    (primaryMock.fetchByCnpj as any).mockResolvedValue(primaryData);

    const service = new CnpjService([primaryMock, fallbackMock]);
    const result = await service.resolveCnpj(sampleCnpj);

    expect(result).toEqual(primaryData);
    expect(primaryMock.fetchByCnpj).toHaveBeenCalledWith(sampleCnpj);
    expect(fallbackMock.fetchByCnpj).not.toHaveBeenCalled();
  });

  it('deve acionar automaticamente o fallback se o provedor primário falhar', async () => {
    const fallbackData: CnpjDto = {
      cnpj: sampleCnpj,
      razaoSocial: 'Empresa Salva Pelo Fallback Ltda',
      provider: 'MinhaReceita',
    };

    // BrasilAPI falha
    (primaryMock.fetchByCnpj as any).mockRejectedValue(new Error('Timeout na BrasilAPI'));
    // Minha Receita responde com sucesso
    (fallbackMock.fetchByCnpj as any).mockResolvedValue(fallbackData);

    const service = new CnpjService([primaryMock, fallbackMock]);
    const result = await service.resolveCnpj(sampleCnpj);

    expect(result).toEqual(fallbackData);
    expect(primaryMock.fetchByCnpj).toHaveBeenCalledTimes(1);
    expect(fallbackMock.fetchByCnpj).toHaveBeenCalledTimes(1);
  });

  it('deve lançar erro explicativo para entrada manual quando todos os provedores falharem', async () => {
    (primaryMock.fetchByCnpj as any).mockRejectedValue(new Error('500 Internal Error'));
    (fallbackMock.fetchByCnpj as any).mockRejectedValue(new Error('Network Offline'));

    const service = new CnpjService([primaryMock, fallbackMock]);

    await expect(service.resolveCnpj(sampleCnpj)).rejects.toThrow(
      'Não foi possível consultar o CNPJ automaticamente'
    );
  });

  it('deve servir consultas repetidas a partir do cache em memória', async () => {
    const data: CnpjDto = {
      cnpj: sampleCnpj,
      razaoSocial: 'Supermercado Cacheado Ltda',
      provider: 'BrasilAPI',
    };

    (primaryMock.fetchByCnpj as any).mockResolvedValue(data);

    const service = new CnpjService([primaryMock, fallbackMock]);

    // Primeira chamada
    const res1 = await service.resolveCnpj(sampleCnpj);
    expect(res1).toEqual(data);
    expect(primaryMock.fetchByCnpj).toHaveBeenCalledTimes(1);

    // Segunda chamada para o mesmo CNPJ
    const res2 = await service.resolveCnpj(sampleCnpj);
    expect(res2).toEqual(data);
    // Não deve ter feito uma nova chamada de rede
    expect(primaryMock.fetchByCnpj).toHaveBeenCalledTimes(1);
    expect(service.getCacheSize()).toBe(1);

    // Limpeza de cache
    service.clearCache();
    expect(service.getCacheSize()).toBe(0);
  });

  it('deve forçar nova consulta de rede quando forceRefresh for verdadeiro', async () => {
    const data1: CnpjDto = {
      cnpj: sampleCnpj,
      razaoSocial: 'Versão Inicial',
      provider: 'BrasilAPI',
    };
    const data2: CnpjDto = {
      cnpj: sampleCnpj,
      razaoSocial: 'Versão Atualizada Oficial',
      provider: 'BrasilAPI',
    };

    (primaryMock.fetchByCnpj as any)
      .mockResolvedValueOnce(data1)
      .mockResolvedValueOnce(data2);

    const service = new CnpjService([primaryMock, fallbackMock]);

    const res1 = await service.resolveCnpj(sampleCnpj);
    expect(res1.razaoSocial).toBe('Versão Inicial');
    expect(primaryMock.fetchByCnpj).toHaveBeenCalledTimes(1);

    // Consulta com forceRefresh: true deve chamar a rede novamente
    const res2 = await service.resolveCnpj(sampleCnpj, { forceRefresh: true });
    expect(res2.razaoSocial).toBe('Versão Atualizada Oficial');
    expect(primaryMock.fetchByCnpj).toHaveBeenCalledTimes(2);
  });

  it('deve invalidar cache para um CNPJ específico via invalidateCache', async () => {
    const data: CnpjDto = {
      cnpj: sampleCnpj,
      razaoSocial: 'Empresa Teste',
      provider: 'BrasilAPI',
    };

    (primaryMock.fetchByCnpj as any).mockResolvedValue(data);

    const service = new CnpjService([primaryMock, fallbackMock]);
    await service.resolveCnpj(sampleCnpj);
    expect(service.getCacheSize()).toBe(1);

    service.invalidateCache(sampleCnpj);
    expect(service.getCacheSize()).toBe(0);
  });

  it('deve validar o formato do CNPJ e rejeitar entradas que não contenham 14 dígitos', async () => {
    const service = new CnpjService([primaryMock, fallbackMock]);

    await expect(service.resolveCnpj('12345')).rejects.toThrow(
      'CNPJ deve conter 14 dígitos numéricos'
    );
    expect(primaryMock.fetchByCnpj).not.toHaveBeenCalled();
  });

  it('deve instanciar por padrão MinhaReceita como 1º (primário) e CnpjWs como 2º (fallback)', () => {
    const defaultService = new CnpjService();
    const providers = defaultService.getProviders();

    expect(providers).toHaveLength(2);
    expect(providers[0].name).toBe('MinhaReceita');
    expect(providers[1].name).toBe('CnpjWs');
  });
});
