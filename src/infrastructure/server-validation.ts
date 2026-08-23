import { z, type ZodType } from 'zod';
import { authorize, type AuthContext, type Permission } from './security';

export const uuidSchema = z.string().uuid();
export const rfcSchema = z.string().trim().toUpperCase().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/);
export const postalCodeSchema = z.string().regex(/^\d{5}$/);
export const positiveDecimalString = z.string().regex(/^\d+(?:\.\d{1,10})?$/).refine((value) => !/^0(?:\.0+)?$/.test(value));
export const nonNegativeDecimalString = z.string().regex(/^\d+(?:\.\d{1,10})?$/);

/** tenantId nunca forma parte del payload del navegador; se obtiene de sesión. */
export const stampCommandSchema = z.object({ documentId: uuidSchema }).strict();

export const cancelCommandSchema = z.object({
  documentId: uuidSchema,
  uuid: uuidSchema,
  reason: z.enum(['01','02','03','04']),
  replacementUuid: uuidSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.reason === '01' && !value.replacementUuid) {
    context.addIssue({ code:z.ZodIssueCode.custom, path:['replacementUuid'], message:'Motivo 01 requiere UUID sustituto.' });
  }
});

/**
 * Guard común para endpoints mutables. authContext debe originarse en una
 * sesión HttpOnly validada por servidor. El tenant efectivo siempre es
 * auth.tenantId y jamás se acepta desde URL/body/query string.
 */
export function validateServerAction<T extends object>(input: {
  auth: AuthContext;
  permission: Permission;
  requireMfa?: boolean;
  payload: unknown;
  schema: ZodType<T>;
}): T & { tenantId: string } {
  authorize(input.auth, input.permission, input.requireMfa ?? false);
  const parsed = input.schema.parse(input.payload);
  return { ...parsed, tenantId: input.auth.tenantId };
}
