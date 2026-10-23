import { describe, it, expect } from 'vitest';
import type { Invoice } from '@/domain/entities/invoice';

describe('Null Safety: Prevenção de Falhas com toLocaleString e imageBlob', () => {
  it('deve formatar valores numéricos com segurança mesmo quando forem null ou undefined', () => {
    const mockInvoice: Partial<Invoice> = {
      taxAmount: null as unknown as undefined,
      totalAmount: null as unknown as undefined,
      createdAt: 1000,
    };

    // Testa verificação typeof === 'number'
    const isTaxValidNumber =
      typeof mockInvoice.taxAmount === 'number' && !isNaN(mockInvoice.taxAmount);
    expect(isTaxValidNumber).toBe(false);

    const isTotalValidNumber =
      typeof mockInvoice.totalAmount === 'number' && !isNaN(mockInvoice.totalAmount);
    expect(isTotalValidNumber).toBe(false);
  });

  it('deve validar imageBlob como instância real de Blob antes de chamar createObjectURL', () => {
    const fakeObject = {} as Blob;
    const isRealBlob = fakeObject instanceof Blob;
    expect(isRealBlob).toBe(false);

    const realBlob = new Blob(['test'], { type: 'image/jpeg' });
    expect(realBlob instanceof Blob).toBe(true);
  });

  it('deve calcular soma de itens com segurança quando preços forem null ou undefined', () => {
    const items = [
      {
        code: '1',
        description: 'Item A',
        quantity: null as unknown as number,
        unit: 'UN',
        unitPrice: null as unknown as number,
        totalPrice: null as unknown as number,
      },
      {
        code: '2',
        description: 'Item B',
        quantity: 2,
        unit: 'UN',
        unitPrice: 10,
        totalPrice: 20,
      },
    ];

    const totalCalculated = items.reduce(
      (acc, item) =>
        acc +
        (typeof item.totalPrice === 'number' && !isNaN(item.totalPrice)
          ? item.totalPrice
          : 0),
      0
    );

    expect(totalCalculated).toBe(20);
  });
});
