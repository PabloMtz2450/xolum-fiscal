export type CancellationReason = '01'|'02'|'03'|'04';

export type CancellationRequest = {
  uuid: string;
  reason: CancellationReason;
  replacementUuid?: string;
};

export type CancellationValidation = {
  ok: boolean;
  errors: Array<{ code: string; message: string; field: string }>;
};

const uuid = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;

/** Valida la solicitud antes de enviarla al PAC/SAT. */
export function validateCancellationRequest(input: CancellationRequest): CancellationValidation {
  const errors: CancellationValidation['errors'] = [];
  if (!uuid.test(input.uuid)) errors.push({ code: 'XOL-CAN-001', message: 'UUID a cancelar inválido.', field: 'uuid' });
  if (!['01','02','03','04'].includes(input.reason)) errors.push({ code: 'XOL-CAN-002', message: 'Motivo de cancelación inválido.', field: 'reason' });
  if (input.reason === '01') {
    if (!input.replacementUuid) errors.push({ code: 'XOL-CAN-003', message: 'El motivo 01 requiere FolioSustitucion.', field: 'replacementUuid' });
    else if (!uuid.test(input.replacementUuid)) errors.push({ code: 'XOL-CAN-004', message: 'FolioSustitucion no es un UUID válido.', field: 'replacementUuid' });
    else if (input.replacementUuid.toUpperCase() === input.uuid.toUpperCase()) errors.push({ code: 'XOL-CAN-005', message: 'El UUID sustituto no puede ser el mismo que el UUID a cancelar.', field: 'replacementUuid' });
  }
  if (input.reason !== '01' && input.replacementUuid) errors.push({ code: 'XOL-CAN-006', message: 'FolioSustitucion sólo debe enviarse con motivo 01.', field: 'replacementUuid' });
  return { ok: errors.length === 0, errors };
}
