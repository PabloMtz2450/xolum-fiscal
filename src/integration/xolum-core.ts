import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const uuidLike=z.string().min(16).max(64);
const requestLine=z.object({line_id:z.string().min(1).max(128),product_id:uuidLike,quantity:z.number().positive(),unit_code:z.string().min(1).max(32),unit_price:z.number().min(0).nullable().optional(),customer_product_code:z.string().max(160).nullable().optional()}).strict();

export const cfdiRequestedPayloadSchema=z.object({
  source_type:z.enum(['SALES_ORDER','DELIVERY','PURCHASE_ORDER','PAYROLL']),
  source_id:z.string().min(1).max(128),
  issuer_organization_id:uuidLike,
  receiver_organization_id:uuidLike,
  fiscal_profile_id:z.string().max(64).nullable().optional(),
  currency:z.string().regex(/^[A-Z]{3}$/),
  cfdi_type:z.enum(['I','E','T','P','N']).default('I'),
  delivery_id:z.string().max(128).nullable().optional(),
  evidence_status:z.enum(['COMPLETE','EXCEPTION_APPROVED']).nullable().optional(),
  lines:z.array(requestLine).min(1).max(10_000),
}).strict();

export const cfdiStampedPayloadSchema=z.object({
  fiscal_document_id:z.string().min(1).max(128),
  cfdi_type:z.enum(['I','E','T','P','N']),
  uuid:z.string().regex(/^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/),
  stamped_at:z.string().datetime(),
  issuer_organization_id:uuidLike,
  receiver_organization_id:uuidLike,
  source_entity_type:z.string().max(80).nullable().optional(),
  source_entity_id:z.string().max(128).nullable().optional(),
  xml_document_id:uuidLike,
  pdf_document_id:z.string().max(64).nullable().optional(),
}).strict();

export type CfdiRequestedPayload=z.infer<typeof cfdiRequestedPayloadSchema>;
export type CfdiStampedPayload=z.infer<typeof cfdiStampedPayloadSchema>;

export function validateFiscalRequest(input:unknown):CfdiRequestedPayload{
  const payload=cfdiRequestedPayloadSchema.parse(input);
  if(payload.source_type==='DELIVERY' && (!payload.delivery_id || !payload.evidence_status)) throw new Error('DELIVERY_EVIDENCE_REQUIRED');
  return payload;
}

export function buildCfdiStampedEvent(input:{tenantId:string;correlationId:string;payload:CfdiStampedPayload;eventId?:string;occurredAt?:string}){
  const payload=cfdiStampedPayloadSchema.parse(input.payload);
  return {event_id:input.eventId??randomUUID(),event_type:'fiscal.cfdi.stamped.v1',schema_version:'1.0' as const,occurred_at:input.occurredAt??new Date().toISOString(),tenant_id:input.tenantId,entity_type:'fiscal_document',entity_id:payload.fiscal_document_id,correlation_id:input.correlationId,payload};
}

export async function publishCfdiStamped(args:{coreUrl:string;serviceToken:string;idempotencyKey:string;event:ReturnType<typeof buildCfdiStampedEvent>;fetcher?:typeof fetch}){
  if(!args.idempotencyKey) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  const response=await (args.fetcher??fetch)(`${args.coreUrl.replace(/\/$/,'')}/api/v1/events`,{method:'POST',headers:{'content-type':'application/json','x-service-token':args.serviceToken,'idempotency-key':args.idempotencyKey,'x-request-id':args.event.correlation_id},body:JSON.stringify(args.event)});
  if(response.status!==200&&response.status!==202) throw new Error(`XOLUM_CORE_EVENT_REJECTED_${response.status}`);
  return response.json() as Promise<{duplicate:boolean;event:{id:string;event_type:string;correlation_id:string}}>;
}
