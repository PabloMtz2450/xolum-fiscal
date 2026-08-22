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

export function certificateNumberFromX509(cert: X509Certificate): string | null {
  const serial = cert.serialNumber.replace(/:/g, '');
  if (/^\d{20}$/.test(serial)) return serial;
  if (/^[0-9A-F]+$/i.test(serial) && serial.length % 2 === 0) {
    const decoded = Buffer.from(serial, 'hex').toString('ascii').replace(/\0/g, '').trim();
    const match = decoded.match(/\d{20}/);
    if (match) return match[0];
  }
  return null;
}

export function certificateIssuerRfc(cert: X509Certificate): string | null {
  const subject = cert.subject.toUpperCase();
  const candidates = subject.match(/[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}/g) ?? [];
  return candidates[0] ?? null;
}

/** Valida vigencia, NoCertificado, RFC emisor y sello contra la cadena original. */
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

  const certificateNumber = certificateNumberFromX509(cert);
  if (!certificateNumber) findings.push(finding('XOL-CSD-003', 'No fue posible obtener el NoCertificado SAT de 20 dígitos.', 'certificateNumber'));
  else if (material.expectedCertificateNumber && certificateNumber !== material.expectedCertificateNumber) {
    findings.push(finding('XOL-CSD-004', 'El NoCertificado del CSD no coincide con el configurado para el CFDI.', 'certificateNumber'));
  }

  const expectedRfc = material.issuerRfc.trim().toUpperCase();
  if (!expectedRfc) findings.push(finding('XOL-CSD-005', 'No se proporcionó el RFC del emisor para validar el CSD.', 'issuer.rfc'));
  else {
    const certRfc = certificateIssuerRfc(cert);
    if (!certRfc) findings.push(finding('XOL-CSD-006', 'No fue posible localizar el RFC dentro del sujeto del CSD.', 'certificate'));
    else if (certRfc !== expectedRfc) findings.push(finding('XOL-CSD-007', `El CSD pertenece al RFC ${certRfc} y el CFDI usa ${expectedRfc}.`, 'issuer.rfc'));
  }

  if (signed) {
    try {
      const publicKey = createPublicKey(cert.publicKey);
      const ok = verify('RSA-SHA256', Buffer.from(signed.originalString, 'utf8'), publicKey, Buffer.from(signed.signatureBase64, 'base64'));
      if (!ok) findings.push(finding('XOL-CSD-008', 'El sello no corresponde a la cadena original y al CSD proporcionado.', 'signature'));
    } catch {
      findings.push(finding('XOL-CSD-009', 'No fue posible verificar criptográficamente el sello.', 'signature'));
    }
  } else {
    findings.push(finding('XOL-CSD-010', 'Falta la cadena original o el sello final para la validación criptográfica previa al PAC.', 'signature'));
  }

  return findings;
}
