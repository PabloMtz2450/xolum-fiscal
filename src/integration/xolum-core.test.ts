import { describe, expect, it, vi } from 'vitest';
import { buildCfdiStampedEvent, publishCfdiStamped, validateFiscalRequest } from './xolum-core';

const issuer='019c89aa-1111-4111-8111-111111111111';
const receiver='019c89aa-2222-4222-8222-222222222222';
const product='019c89aa-3333-4333-8333-333333333333';

describe('XOLUM Fiscal Core contract',()=>{
  it('fails closed when a delivery lacks evidence',()=>{
    expect(()=>validateFiscalRequest({source_type:'DELIVERY',source_id:'SO-1',issuer_organization_id:issuer,receiver_organization_id:receiver,currency:'MXN',cfdi_type:'I',delivery_id:'D-1',lines:[{line_id:'10',product_id:product,quantity:1,unit_code:'H87'}]})).toThrow('DELIVERY_EVIDENCE_REQUIRED');
  });

  it('accepts an eligible delivery request',()=>{
    const result=validateFiscalRequest({source_type:'DELIVERY',source_id:'SO-1',issuer_organization_id:issuer,receiver_organization_id:receiver,currency:'MXN',cfdi_type:'I',delivery_id:'D-1',evidence_status:'COMPLETE',lines:[{line_id:'10',product_id:product,quantity:1,unit_code:'H87'}]});
    expect(result.evidence_status).toBe('COMPLETE');
  });

  it('publishes only canonical stamped facts',async()=>{
    const event=buildCfdiStampedEvent({tenantId:'019c89aa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',correlationId:'corr-1',payload:{fiscal_document_id:'FD-1',cfdi_type:'I',uuid:'123E4567-E89B-12D3-A456-426614174000',stamped_at:'2026-08-28T12:00:00.000Z',issuer_organization_id:issuer,receiver_organization_id:receiver,source_entity_type:'sales_order',source_entity_id:'SO-1',xml_document_id:'019c89aa-4444-4444-8444-444444444444',pdf_document_id:null}});
    const fetcher=vi.fn(async()=>new Response(JSON.stringify({duplicate:false,event:{id:event.event_id,event_type:event.event_type,correlation_id:event.correlation_id}}),{status:202,headers:{'content-type':'application/json'}}));
    const result=await publishCfdiStamped({coreUrl:'https://api.xolum.test',serviceToken:'tenant.secret',idempotencyKey:'fiscal:FD-1:stamped',event,fetcher:fetcher as typeof fetch});
    expect(result.duplicate).toBe(false);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
