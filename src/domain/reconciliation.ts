import type { BankMovement, Receivable, ReconciliationSuggestion } from './contracts';

export function suggestReconciliation(movement: BankMovement, receivables: Receivable[]): ReconciliationSuggestion[] {
  return receivables.map((r) => {
    let confidence = 0;
    const reasons: string[] = [];
    if (Math.abs(r.balance - movement.amount) < 0.01) { confidence += 45; reasons.push('importe exacto'); }
    if (movement.reference && r.referenceCandidates.some(x => movement.reference!.toUpperCase().includes(x.toUpperCase()))) {
      confidence += 45; reasons.push('referencia identificada');
    }
    if (movement.senderRfc && movement.senderRfc.length >= 12) { confidence += 10; reasons.push('RFC disponible'); }
    const mode = confidence >= 95 && reasons.includes('referencia identificada') ? 'AUTOMATIC' : confidence >= 55 ? 'ASSISTED' : 'MANUAL';
    return { movementId: movement.id, receivableId: r.id, confidence, mode, reasons };
  }).sort((a,b) => b.confidence - a.confidence);
}
