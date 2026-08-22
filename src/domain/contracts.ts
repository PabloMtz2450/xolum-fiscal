export type FiscalStatus = 'DRAFT'|'READY'|'STAMPED'|'CANCEL_REQUESTED'|'CANCELLED'|'BLOCKED';
export type MatchMode = 'MANUAL'|'ASSISTED'|'AUTOMATIC';

export interface PacConnector {
  stamp(xml: string): Promise<{ uuid: string; stampedXml: string; provider: string }>;
  cancel(input: { uuid: string; reason: '01'|'02'|'03'|'04'; replacementUuid?: string }): Promise<{ requestId: string; status: string }>;
  getStatus(uuid: string): Promise<{ satStatus: string; cancellable?: string; cancellationStatus?: string }>;
}

export interface TmsConnector {
  getDelivery(deliveryId: string): Promise<{
    delivered: boolean;
    deliveredAt?: string;
    podAvailable: boolean;
    evidence: Array<'PHOTO'|'SIGNATURE'|'STAMP'|'DOCUMENT'|'BARCODE'|'GPS'|'TEMPERATURE'>;
    podUrl?: string;
  }>;
}

export interface BankMovement {
  id: string;
  amount: number;
  bookedAt: string;
  reference?: string;
  senderName?: string;
  senderRfc?: string;
}

export interface Receivable {
  id: string;
  customerId: string;
  uuid: string;
  balance: number;
  referenceCandidates: string[];
}

export interface ReconciliationSuggestion {
  movementId: string;
  receivableId?: string;
  confidence: number;
  mode: MatchMode;
  reasons: string[];
}
