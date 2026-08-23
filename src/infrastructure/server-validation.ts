import { z, type ZodType } from 'zod';
import { authorize, type AuthContext, type Permission } from './security';

export const uuidSchema = z.string().uuid();
export const rfcSchema = z.string().trim().toUpperCase().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/);
export const postalCodeSchema = z.string().regex(/^\d{5}$/);
export const positiveDecimalString = z.string().regex(/^\d+(?:\.\d{1,10})?$/);
export const nonNegativeDecimalString = z.string().regex(/^\d+(?:\.\d{1,10})?$/);

export const stampCommandSchema = z.object({
  tenantId: uuidSchema,
  documentId: uuidSchema,
}).strict();

export const cancelCommandSchema = z.object({
  tenantId: uuidSchema,
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
 * Guard común para endpoints mutables. Nunca confiar en tenantId/role enviados
 * por el navegador: authContext debe venir de sesión validada en servidor.
 */
export function validateServerAction<T>(input: {
  auth: AuthContext;
  permission: Permission;
  requireMfa?: boolean;
  payload: unknown;
  schema: ZodType<T>;
}): T {
  authorize(input.auth, input.permission, input.requireMfa ?? false);
  const parsed = input.schema.parse(input.payload);
  if (parsed && typeof parsed === 'object' && 'tenantId' in (parsed as Record<string, unknown>)) {
    if ((parsed as Record<string, unknown>).tenantId !== input.auth.tenantId) throw new Error('TENANT_CONTEXT_MISMATCH');
  }
  return parsed;
}
