import { X509Certificate, createPublicKey, verify } from 'node:crypto';
import type { ValidationFinding } from './prestamp-validation';

export type CsdMaterial = {
  certificatePem: string;
  issuerRfc: string;
  expectedCertificateNumber?: string;
};

export type SignedCfdiMaterial = {
  originalString: string;
  signatureBase64: string;
};

function finding(code: string, message: string, field?: string): ValidationFinding {
  return { layer: 'SIGNATURE', severity: 'ERROR', code, field, message, satReference: 'Anexo 20 / Certificado, NoCertificado, Sello y cadena original' };
}

/**
 * Valida localmente la vigencia y consistencia criptográfica del CSD.
 * La correspondencia exacta del RFC con el certificado debe complementarse
 * con el parser de atributos SAT del certificado usado en producción.
 */
export function validateCsd(material: CsdMaterial, signed?: SignedCfdiMaterial, now = new Date()): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  let cert: X509Certificate;
  try {
    cert = new X509Certificate(material.certificatePem);
  } catch {
    return [finding('XOL-CSD-001', 'El certificado CSD no puede interpretarse.', 'certificate')];
  }

  const from = new Date(cert.validFrom);
  const to = new Date(cert.validTo);
  if (now < from || now > to) findings.push(finding('XOL-CSD-002', 'El CSD está fuera de su periodo de vigencia.', 'certificate'));

  if (material.expectedCertificateNumber && !cert.serialNumber.toUpperCase().includes(material.expectedCertificateNumber.toUpperCase())) {
    findings.push(finding('XOL-CSD-003', 'El número del certificado no coincide con el configurado para el CFDI.', 'certificateNumber'));
  }

  if (!material.issuerRfc.trim()) findings.push(finding('XOL-CSD-004', 'No se proporcionó el RFC del emisor para validar el CSD.', 'issuer.rfc'));

  if (signed) {
    try {
      const publicKey = createPublicKey(cert.publicKey);
      const ok = verify('RSA-SHA256', Buffer.from(signed.originalString, 'utf8'), publicKey, Buffer.from(signed.signatureBase64, 'base64'));
      if (!ok) findings.push(finding('XOL-CSD-005', 'El sello no corresponde a la cadena original y al CSD proporcionado.', 'signature'));
    } catch {
      findings.push(finding('XOL-CSD-006', 'No fue posible verificar criptográficamente el sello.', 'signature'));
    }
  } else {
    findings.push(finding('XOL-CSD-007', 'Falta la cadena original o el sello final para la validación criptográfica previa al PAC.', 'signature'));
  }

  return findings;
}
