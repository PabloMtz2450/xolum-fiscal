import { describe, expect, it } from 'vitest';
import { stampDurably, type StampRepository } from './durable-stamping';
import type { PacAdapter } from './pac-adapter';

const prepared = {
  unsignedXml: '<x/>', originalString: '||x||', sealBase64: 'seal', finalXml: '<signed/>', certificateNumber: '30001000000500003416', certificateBase64: 'cert',
};

function repository() {
  const events: string[] = [];
  const repo: StampRepository = {
    beginAttempt: async () => ({ attemptId:'a1', alreadyStamped:false, inProgress:false }),
    markStamped: async () => { events.push('STAMPED'); },
    markUnknown: async () => { events.push('UNKNOWN'); },
    markRejected: async () => { events.push('REJECTED'); },
  };
  return { repo, events };
}

function pac(result: Awaited<ReturnType<PacAdapter['stamp']>>): PacAdapter {
  return {
    provider:'FINKOK', environment:'SANDBOX',
    healthcheck:async()=>({ok:true}), preflight:async()=>[], stamp:async()=>result,
    cancel:async()=>({requestId:'x',status:'x'}), status:async()=>({satStatus:'Vigente'}),
  };
}

describe('durable stamping', () => {
  it('marca UNKNOWN cuando Finkok reporta fallo de transporte retryable', async () => {
    const { repo, events } = repository();
    const result = await stampDurably({ tenantId:'t1', documentId:'d1', issuerRfc:'AAA010101AAA', prepared, repo, pac:pac({ ok:false, provider:'FINKOK', rejection:{ providerCode:'FINKOK-TRANSPORT', message:'timeout', retryable:true } }) });
    expect(result.status).toBe('UNKNOWN');
    expect(events).toEqual(['UNKNOWN']);
  });

  it('marca REJECTED sólo para rechazo determinista', async () => {
    const { repo, events } = repository();
    const result = await stampDurably({ tenantId:'t1', documentId:'d1', issuerRfc:'AAA010101AAA', prepared, repo, pac:pac({ ok:false, provider:'FINKOK', rejection:{ providerCode:'CFDI40102', message:'Sello inválido', retryable:false } }) });
    expect(result.status).toBe('REJECTED');
    expect(events).toEqual(['REJECTED']);
  });

  it('no llama otra vez al PAC cuando el intento ya está en progreso/UNKNOWN', async () => {
    let calls = 0;
    const repo: StampRepository = {
      beginAttempt: async () => ({ attemptId:'a1', alreadyStamped:false, inProgress:true }),
      markStamped: async()=>{}, markUnknown:async()=>{}, markRejected:async()=>{},
    };
    const adapter = pac({ ok:true, provider:'FINKOK', uuid:'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE', stampedXml:'<xml/>', stampedAt:'2026-08-22T00:00:00Z' });
    adapter.stamp = async (r) => { calls++; return { ok:true, provider:'FINKOK', uuid:'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE', stampedXml:r.xml, stampedAt:'2026-08-22T00:00:00Z' }; };
    const result = await stampDurably({ tenantId:'t1', documentId:'d1', issuerRfc:'AAA010101AAA', prepared, repo, pac:adapter });
    expect(result.status).toBe('IN_PROGRESS');
    expect(calls).toBe(0);
  });
});
