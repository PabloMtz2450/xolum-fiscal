import { describe, expect, it } from 'vitest';
import { FinkokPacAdapter } from './finkok-adapter';

function fakeClient(overrides: Record<string, any> = {}) {
  return {
    stampAsync: async () => [{ stampResult: { CodEstatus: 'Comprobante timbrado satisfactoriamente', UUID: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE', xml: '<cfdi:Comprobante/>', Fecha: '2026-08-22T12:00:00' } }],
    cancelAsync: async () => [{ cancelResult: { Folios: { Folio: [{ EstatusUUID: '201', EstatusCancelacion: 'En proceso' }] } } }],
    get_sat_statusAsync: async () => [{ get_sat_statusResult: { Estado: 'Vigente', EsCancelable: 'Cancelable sin aceptación', EstatusCancelacion: 'En proceso' } }],
    query_pendingAsync: async () => [{ query_pendingResult: { uuid_status: 'F', status: 'OK', uuid: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE' } }],
    ...overrides,
  } as any;
}

const signedXml = '<?xml version="1.0"?><cfdi:Comprobante Sello="abc" Certificado="xyz" NoCertificado="30001000000500003416" />';

describe('FinkokPacAdapter', () => {
  it('interpreta CodEstatus como fuente de éxito de timbrado', async () => {
    const adapter = new FinkokPacAdapter({ environment: 'SANDBOX', credentials: { username: 'u', password: 'p' }, clientFactory: async () => fakeClient() });
    const result = await adapter.stamp({ xml: signedXml, idempotencyKey: '1', issuerRfc: 'EKU9003173C9' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.uuid).toBe('AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE');
  });

  it('normaliza incidencias cuando CodEstatus no indica éxito', async () => {
    const client = fakeClient({ stampAsync: async () => [{ stampResult: { CodEstatus: '', Incidencias: { Incidencia: [{ CodigoError: 'CFDI40102', MensajeIncidencia: 'Sello inválido' }] } } }] });
    const adapter = new FinkokPacAdapter({ environment: 'SANDBOX', credentials: { username: 'u', password: 'p' }, clientFactory: async () => client });
    const result = await adapter.stamp({ xml: signedXml, idempotencyKey: '1', issuerRfc: 'EKU9003173C9' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rejection.providerCode).toBe('CFDI40102');
  });

  it('bloquea XML de 1 MB o más antes del PAC', async () => {
    const adapter = new FinkokPacAdapter({ environment: 'SANDBOX', credentials: { username: 'u', password: 'p' }, clientFactory: async () => fakeClient() });
    const errors = await adapter.preflight(`<cfdi:Comprobante Sello="a" Certificado="b" NoCertificado="30001000000500003416">${'x'.repeat(1024 * 1024)}</cfdi:Comprobante>`);
    expect(errors.some((e) => e.providerCode === 'FINKOK-XML-SIZE')).toBe(true);
  });

  it('motivo 01 exige UUID sustituto', async () => {
    const adapter = new FinkokPacAdapter({ environment: 'SANDBOX', credentials: { username: 'u', password: 'p' }, cancellation: { certificatePemBase64: 'cer', privateKeyDes3PemBase64: 'key' }, clientFactory: async () => fakeClient() });
    await expect(adapter.cancel({ uuid: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE', reason: '01', issuerRfc: 'EKU9003173C9' })).rejects.toThrow('FINKOK_REASON_01_REQUIRES_REPLACEMENT_UUID');
  });

  it('no confunde código 201 con cancelación final', async () => {
    const adapter = new FinkokPacAdapter({ environment: 'SANDBOX', credentials: { username: 'u', password: 'p' }, cancellation: { certificatePemBase64: 'cer', privateKeyDes3PemBase64: 'key' }, clientFactory: async () => fakeClient() });
    const result = await adapter.cancel({ uuid: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE', reason: '02', issuerRfc: 'EKU9003173C9' });
    expect(result.rawCode).toBe('201');
    expect(result.status).toBe('En proceso');
  });

  it('get_sat_status exige RFC receptor y total', async () => {
    const adapter = new FinkokPacAdapter({ environment: 'SANDBOX', credentials: { username: 'u', password: 'p' }, clientFactory: async () => fakeClient() });
    await expect(adapter.status({ uuid: 'x', issuerRfc: 'EKU9003173C9' })).rejects.toThrow('FINKOK_STATUS_REQUIRES_RECEIVER_RFC_AND_TOTAL');
  });

  it('consulta pendientes S/F', async () => {
    const adapter = new FinkokPacAdapter({ environment: 'SANDBOX', credentials: { username: 'u', password: 'p' }, clientFactory: async () => fakeClient() });
    const pending = await adapter.queryPending('AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE');
    expect(pending.uuidStatus).toBe('F');
  });
});
