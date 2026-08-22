import { createPrivateKey, sign, X509Certificate } from 'node:crypto';
import type { NormalizedCfdiDocument } from './validation/model';
import { validateCsd, type CsdMaterial } from './csd';

export type CfdiCertificateMaterial = {
  certificatePem: string;
  privateKeyPem?: string;
  privateKeyDerBase64?: string;
  privateKeyPassphrase?: string;
  issuerRfc: string;
};

export type RenderContext = {
  certificateBase64: string;
  certificateNumber: string;
  seal: string;
};

export interface FinalCfdiXmlRenderer {
  render(document: NormalizedCfdiDocument, context: RenderContext): Promise<string>;
}

export interface OriginalStringGenerator {
  generate(xmlWithoutSeal: string): Promise<string>;
}

export interface FinalXmlValidator {
  validate(xml: string, document: NormalizedCfdiDocument): Promise<void>;
}

export interface FinalPacPreflight {
  validate(xml: string): Promise<void>;
}

export type PreparedCfdiXml = {
  unsignedXml: string;
  originalString: string;
  sealBase64: string;
  finalXml: string;
  certificateNumber: string;
  certificateBase64: string;
};

function pemBody(pem: string): string {
  return pem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\s+/g, '');
}

/**
 * SAT CSD serials are commonly exposed by Node as a hexadecimal serial whose
 * bytes contain the decimal NoCertificado. Decode that representation first;
 * fall back to the raw serial when it is already numeric.
 */
export function satCertificateNumber(certificatePem: string): string {
  const cert = new X509Certificate(certificatePem);
  const serial = cert.serialNumber.replace(/:/g, '');
  if (/^\d{20}$/.test(serial)) return serial;
  if (/^[0-9A-F]+$/i.test(serial) && serial.length % 2 === 0) {
    const decoded = Buffer.from(serial, 'hex').toString('ascii').replace(/\0/g, '').trim();
    const match = decoded.match(/\d{20}/);
    if (match) return match[0];
  }
  throw new Error(`No fue posible obtener NoCertificado SAT de 20 dígitos desde el CSD (serial ${serial}).`);
}

export function createCsdPrivateKey(material: CfdiCertificateMaterial) {
  if (material.privateKeyPem) {
    return createPrivateKey({ key: material.privateKeyPem, passphrase: material.privateKeyPassphrase });
  }
  if (material.privateKeyDerBase64) {
    return createPrivateKey({
      key: Buffer.from(material.privateKeyDerBase64, 'base64'),
      format: 'der',
      type: 'pkcs8',
      passphrase: material.privateKeyPassphrase,
    });
  }
  throw new Error('No se configuró la llave privada del CSD.');
}

export function signOriginalString(originalString: string, material: CfdiCertificateMaterial): string {
  const privateKey = createCsdPrivateKey(material);
  return sign('RSA-SHA256', Buffer.from(originalString, 'utf8'), privateKey).toString('base64');
}

/**
 * Flujo único previo a PAC:
 * 1) renderiza el XML exacto con Certificado/NoCertificado y Sello vacío;
 * 2) obtiene cadena original desde ese XML;
 * 3) firma SHA-256/RSA con la llave privada CSD;
 * 4) vuelve a renderizar el XML final con el sello;
 * 5) verifica criptográficamente sello/cadena/certificado;
 * 6) valida XML final y preflight sobre EXACTAMENTE los mismos bytes enviados al PAC.
 */
export class CfdiXmlSigningPipeline {
  constructor(
    private readonly renderer: FinalCfdiXmlRenderer,
    private readonly originalString: OriginalStringGenerator,
    private readonly finalValidator: FinalXmlValidator,
    private readonly pacPreflight: FinalPacPreflight,
  ) {}

  async prepare(document: NormalizedCfdiDocument, material: CfdiCertificateMaterial): Promise<PreparedCfdiXml> {
    const certificateNumber = satCertificateNumber(material.certificatePem);
    const certificateBase64 = pemBody(material.certificatePem);

    const unsignedXml = await this.renderer.render(document, {
      certificateBase64,
      certificateNumber,
      seal: '',
    });
    if (!unsignedXml.includes('Sello=""')) {
      throw new Error('El renderer debe generar exactamente un atributo Sello vacío antes de construir la cadena original.');
    }

    const cadena = await this.originalString.generate(unsignedXml);
    if (!cadena.startsWith('||') || !cadena.endsWith('||')) {
      throw new Error('La cadena original generada no tiene el formato esperado del SAT.');
    }

    const sealBase64 = signOriginalString(cadena, material);
    const finalXml = await this.renderer.render(document, {
      certificateBase64,
      certificateNumber,
      seal: sealBase64,
    });

    const csdFindings = validateCsd(
      {
        certificatePem: material.certificatePem,
        issuerRfc: material.issuerRfc,
        expectedCertificateNumber: certificateNumber,
      } satisfies CsdMaterial,
      { originalString: cadena, signatureBase64: sealBase64 },
    );
    if (csdFindings.length) {
      throw new Error(csdFindings.map((finding) => `${finding.code}: ${finding.message}`).join(' | '));
    }

    await this.finalValidator.validate(finalXml, document);
    await this.pacPreflight.validate(finalXml);

    return {
      unsignedXml,
      originalString: cadena,
      sealBase64,
      finalXml,
      certificateNumber,
      certificateBase64,
    };
  }
}
