import { z } from 'zod';

export const CustomerOnboardingSchema = z.object({
  rfc: z.string().min(12).max(13),
  legalName: z.string().min(1),
  postalCode: z.string().regex(/^\d{5}$/),
  taxRegime: z.string().min(3),
  cfdiUse: z.string().min(3),
  email: z.string().email().optional(),
  source: z.enum(['QR_CSF', 'MANUAL']),
});

export type CustomerOnboarding = z.infer<typeof CustomerOnboardingSchema>;

/**
 * The QR flow is intentionally an adapter boundary.
 * The scanner obtains the SAT QR payload/URL and the implementation resolves
 * the fiscal identity fields that are actually needed for CFDI issuance.
 * XOLUM must not require the customer to upload a Constancia de Situación Fiscal.
 */
export interface FiscalQrResolver {
  resolve(payload: string): Promise<Pick<CustomerOnboarding, 'rfc' | 'legalName' | 'postalCode' | 'taxRegime'>>;
}

export function buildManualCustomer(input: CustomerOnboarding) {
  return CustomerOnboardingSchema.parse({ ...input, source: 'MANUAL' });
}
