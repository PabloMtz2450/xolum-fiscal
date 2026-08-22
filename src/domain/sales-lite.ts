import { z } from 'zod';

export const FiscalCustomerSchema = z.object({
  id: z.string(),
  rfc: z.string().min(12).max(13),
  legalName: z.string().min(1),
  postalCode: z.string().regex(/^\d{5}$/),
  taxRegime: z.string().min(3),
  cfdiUse: z.string().min(3),
  source: z.enum(['QR_CSF', 'MANUAL']),
});

export const OrderLineSchema = z.object({
  line: z.number().int().positive(),
  internalSku: z.string().optional(),
  description: z.string().min(1),
  satProductServiceKey: z.string().regex(/^\d{8}$/),
  quantity: z.number().positive(),
  commercialUnit: z.string().min(1),
  satUnitKey: z.string().min(2),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  taxObject: z.enum(['01', '02', '03', '04']),
  vatRate: z.number().nonnegative().optional(),
  purchaseOrder: z.string().optional(),
  purchaseOrderLine: z.string().optional(),
});

export const SalesLiteOrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  currency: z.string().length(3).default('MXN'),
  exchangeRate: z.number().positive().optional(),
  paymentMethod: z.enum(['PUE', 'PPD']),
  paymentForm: z.string().min(2),
  notes: z.string().optional(),
  lines: z.array(OrderLineSchema).min(1),
  status: z.enum(['DRAFT', 'READY_FOR_FISCAL', 'INVOICED', 'CANCELLED']),
});

export type FiscalCustomer = z.infer<typeof FiscalCustomerSchema>;
export type SalesLiteOrder = z.infer<typeof SalesLiteOrderSchema>;

export function lockOrderForFiscal(order: SalesLiteOrder): SalesLiteOrder {
  return SalesLiteOrderSchema.parse({ ...order, status: 'READY_FOR_FISCAL' });
}

export function orderToFiscalDraft(order: SalesLiteOrder) {
  if (order.status !== 'READY_FOR_FISCAL') throw new Error('El pedido debe estar listo para fiscal antes de transformar a CFDI.');
  return {
    sourceOrderId: order.id,
    currency: order.currency,
    exchangeRate: order.exchangeRate,
    paymentMethod: order.paymentMethod,
    paymentForm: order.paymentForm,
    concepts: order.lines.map((line) => ({
      line: line.line,
      description: line.description,
      productServiceKey: line.satProductServiceKey,
      quantity: line.quantity,
      unitKey: line.satUnitKey,
      unitPrice: line.unitPrice,
      discount: line.discount,
      taxObject: line.taxObject,
      vatRate: line.vatRate,
      commercialReferences: {
        purchaseOrder: line.purchaseOrder,
        purchaseOrderLine: line.purchaseOrderLine,
      },
    })),
    locked: true as const,
  };
}
