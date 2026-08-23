import { createClientAsync, type Client } from 'soap';
import type { PacAdapter, PacEnvironment, PacRejection, PacStampRequest, PacStampResult } from './pac-adapter';
import { decimalText } from './fiscal-decimal';

const SUCCESS = 'Comprobante timbrado satisfactoriamente';
const MAX_XML_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;

export type FinkokCredentials = { username: string; password: string };
export type FinkokCancellationMaterial = { certificatePemBase64: string; privateKeyDes3PemBase64: string; storePending?: boolean };
export type FinkokAdapterOptions = {
  environment: PacEnvironment;
  credentials: FinkokCredentials;
  cancellation?: FinkokCancellationMaterial;
  timeoutMs?: number;
  clientFactory?: (wsdl: string) => Promise<Client>;
};
export type FinkokPendingStatus = { status?: string; uuid?: string; uuidStatus?: 'S'|'F'|string; nextAttempt?: string; attempts?: string; error?: string; date?: string; xml?: string };

const WSDL = {
  SANDBOX: {
    stamp: 'https://demo-facturacion.finkok.com/servicios/soap/stamp.wsdl',
    cancel: 'https://demo-facturacion.finkok.com/servicios/soap/cancel.wsdl',
  },
  PRODUCTION: {
    stamp: 'https://facturacion.finkok.com/servicios/soap/stamp.wsdl',
    cancel: 'https://facturacion.finkok.com/servicios/soap/cancel.wsdl',
  },
} as const;

function firstObject(value: unknown): Record<string, any> {
  if (Array.isArray(value)) return firstObject(value[0]);
  if (value && typeof value === 'object') return value as Record<string, any>;
  return {};
}
function unwrapResult(response: unknown, preferredKeys: string[]): Record<string, any> {
  let current = firstObject(response);
  for (const key of preferredKeys) if (current[key] != null) current = firstObject(current[key]);
  return current;
}
function incidencesFrom(result: Record<string, any>): PacRejection[] {
  const wrapper = result.Incidencias ?? result.incidencias;
  if (!wrapper) return [];
  const raw = wrapper.Incidencia ?? wrapper.incidencia ?? wrapper;
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter(Boolean).map((item: any) => ({
    providerCode: String(item.CodigoError ?? item.codigoError ?? item.IdIncidencia ?? 'FINKOK-INCIDENCE'),
    satCode: String(item.CodigoError ?? item.codigoError ?? '').startsWith('CFDI') ? String(item.CodigoError ?? item.codigoError) : undefined,
    message: String(item.MensajeIncidencia ?? item.mensajeIncidencia ?? item.ExtraInfo ?? 'Incidencia Finkok sin descripción.'),
    retryable: false,
  }));
}
function stampFailure(result: Record<string, any>): PacRejection {
  const incidents = incidencesFrom(result);
  if (incidents.length) return incidents[0];
  return { providerCode: String(result.CodEstatus ?? result.codEstatus ?? 'FINKOK-STAMP-UNKNOWN'), message: String(result.CodEstatus ?? result.codEstatus ?? 'Finkok no devolvió un estado reconocible de timbrado.'), retryable: false };
}
function normalizeXml(value: unknown): string {
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return String(value ?? '');
}
async function defaultClientFactory(wsdl: string): Promise<Client> {
  return createClientAsync(wsdl, { disableCache: false });
}

export class FinkokPacAdapter implements PacAdapter {
  readonly provider = 'FINKOK';
  readonly environment: PacEnvironment;
  private readonly credentials: FinkokCredentials;
  private readonly cancellation?: FinkokCancellationMaterial;
  private readonly clientFactory: (wsdl: string) => Promise<Client>;
  private readonly timeoutMs: number;
  private readonly clients = new Map<string, Promise<Client>>();

  constructor(options: FinkokAdapterOptions) {
    this.environment = options.environment;
    this.credentials = options.credentials;
    this.cancellation = options.cancellation;
    this.clientFactory = options.clientFactory ?? defaultClientFactory;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private client(wsdl: string): Promise<Client> {
    let current = this.clients.get(wsdl);
    if (!current) {
      current = this.clientFactory(wsdl).catch((error) => { this.clients.delete(wsdl); throw error; });
      this.clients.set(wsdl, current);
    }
    return current;
  }

  private async call(client: Client, method: string, args: unknown): Promise<unknown> {
    const fn = (client as any)[`${method}Async`];
    if (typeof fn !== 'function') throw new Error(`FINKOK_METHOD_NOT_AVAILABLE:${method}`);
    return fn.call(client, args, { timeout: this.timeoutMs });
  }

  async healthcheck(): Promise<{ ok: boolean; detail?: string }> {
    try {
      await Promise.all([this.client(WSDL[this.environment].stamp), this.client(WSDL[this.environment].cancel)]);
      return { ok: true };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'No fue posible cargar los WSDL de Finkok.' };
    }
  }

  async preflight(xml: string): Promise<PacRejection[]> {
    const errors: PacRejection[] = [];
    const size = Buffer.byteLength(xml, 'utf8');
    if (size >= MAX_XML_BYTES) errors.push({ providerCode:'FINKOK-XML-SIZE', message:'Finkok limita cada XML a menos de 1 MB.', retryable:false });
    if (!xml.trimStart().startsWith('<?xml') && !xml.trimStart().startsWith('<cfdi:Comprobante')) errors.push({ providerCode:'301', message:'El XML no tiene una estructura inicial reconocible.', retryable:false });
    if (!/\bSello="[^"]+"/.test(xml) || !/\bCertificado="[^"]+"/.test(xml) || !/\bNoCertificado="\d{20}"/.test(xml)) errors.push({ providerCode:'CFDI40102', message:'El XML debe llegar a Finkok con Sello, Certificado y NoCertificado completos.', retryable:false });
    return errors;
  }

  async stamp(request: PacStampRequest): Promise<PacStampResult> {
    const local = await this.preflight(request.xml);
    if (local.length) return { ok:false, provider:this.provider, rejection:local[0] };
    try {
      const client = await this.client(WSDL[this.environment].stamp);
      const response = await this.call(client, 'stamp', {
        xml: Buffer.from(request.xml, 'utf8').toString('base64'),
        username: this.credentials.username,
        password: this.credentials.password,
      });
      const result = unwrapResult(response, ['stampResult']);
      const codEstatus = String(result.CodEstatus ?? result.codEstatus ?? '');
      if (codEstatus !== SUCCESS) return { ok:false, provider:this.provider, rejection:stampFailure(result) };
      const uuid = String(result.UUID ?? result.uuid ?? '');
      const stampedXml = normalizeXml(result.xml ?? result.XML);
      if (!uuid || !stampedXml) return { ok:false, provider:this.provider, rejection:{ providerCode:'FINKOK-INCOMPLETE-STAMP', message:'Finkok reportó timbrado exitoso pero no devolvió UUID/XML completos.', retryable:true } };
      return { ok:true, uuid, stampedXml, provider:this.provider, stampedAt:String(result.Fecha ?? result.fecha ?? new Date().toISOString()) };
    } catch (error) {
      return { ok:false, provider:this.provider, rejection:{ providerCode:'FINKOK-TRANSPORT', message:error instanceof Error?error.message:'Error de transporte SOAP Finkok.', retryable:true } };
    }
  }

  async cancel(input: { uuid:string; reason:'01'|'02'|'03'|'04'; replacementUuid?:string; issuerRfc:string }): Promise<{ requestId:string; status:string; rawCode?:string }> {
    if (!this.cancellation) throw new Error('FINKOK_CANCELLATION_MATERIAL_NOT_CONFIGURED');
    if (input.reason === '01' && !input.replacementUuid) throw new Error('FINKOK_REASON_01_REQUIRES_REPLACEMENT_UUID');
    const client = await this.client(WSDL[this.environment].cancel);
    const uuidXml = `<UUID UUID="${input.uuid}" FolioSustitucion="${input.replacementUuid ?? ''}" Motivo="${input.reason}"/>`;
    const response = await this.call(client, 'cancel', {
      UUIDS:{ $xml:uuidXml }, username:this.credentials.username, password:this.credentials.password,
      taxpayer_id:input.issuerRfc, cer:this.cancellation.certificatePemBase64,
      key:this.cancellation.privateKeyDes3PemBase64, store_pending:this.cancellation.storePending ?? false,
    });
    const result = unwrapResult(response, ['cancelResult']);
    const folios = result.Folios?.Folio ?? result.folios?.folio ?? result.Folios ?? [];
    const first = firstObject(folios);
    const rawCode = String(first.EstatusUUID ?? first.estatusUUID ?? result.CodEstatus ?? result.codEstatus ?? '');
    const status = String(first.EstatusCancelacion ?? first.estatusCancelacion ?? result.CodEstatus ?? result.codEstatus ?? 'SOLICITUD_ENVIADA');
    return { requestId:`${String(result.RfcEmisor ?? input.issuerRfc)}:${input.uuid}`, status, rawCode };
  }

  async status(input: { uuid:string; issuerRfc:string; receiverRfc?:string; total?:string|number }): Promise<{ satStatus:string; cancellable?:string; cancellationStatus?:string }> {
    if (!input.receiverRfc || input.total == null) throw new Error('FINKOK_STATUS_REQUIRES_RECEIVER_RFC_AND_TOTAL');
    const client = await this.client(WSDL[this.environment].cancel);
    const response = await this.call(client, 'get_sat_status', {
      username:this.credentials.username, password:this.credentials.password,
      taxpayer_id:input.issuerRfc, rtaxpayer_id:input.receiverRfc,
      uuid:input.uuid, total:decimalText(input.total, 6),
    });
    const result = unwrapResult(response, ['get_sat_statusResult']);
    return {
      satStatus:String(result.sat_status ?? result.SatStatus ?? result.Estado ?? result.estado ?? result.CodEstatus ?? 'DESCONOCIDO'),
      cancellable:result.cancellable ?? result.Cancelable ?? result.EsCancelable,
      cancellationStatus:result.cancellation_status ?? result.EstatusCancelacion ?? result.estatusCancelacion,
    };
  }

  async queryPending(uuid: string): Promise<FinkokPendingStatus> {
    const client = await this.client(WSDL[this.environment].stamp);
    const response = await this.call(client, 'query_pending', { username:this.credentials.username, password:this.credentials.password, uuid });
    const result = unwrapResult(response, ['query_pendingResult']);
    return { status:result.status, xml:normalizeXml(result.xml), uuid:result.uuid, uuidStatus:result.uuid_status, nextAttempt:result.next_attempt, attempts:result.attempts, error:result.error, date:result.date };
  }
}

export const FINKOK_WSDL = WSDL;
