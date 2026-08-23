import type { BankMovement, MatchMode, Receivable, ReconciliationSuggestion } from './contracts';
import { D } from './fiscal/fiscal-decimal';

type Candidate = ReconciliationSuggestion & {
  amountMatches: boolean;
  referenceMatches: boolean;
};

export function suggestReconciliation(movement: BankMovement, receivables: Receivable[]): ReconciliationSuggestion[] {
  const candidates: Candidate[] = receivables.map((receivable): Candidate => {
    let confidence = 0;
    const reasons: string[] = [];

    const amountMatches = D(receivable.balance).minus(D(movement.amount)).abs().lt('0.01');
    if (amountMatches) { confidence += 45; reasons.push('importe exacto'); }

    const normalizedReference = movement.reference?.trim().toUpperCase();
    const referenceMatches = Boolean(
      normalizedReference && receivable.referenceCandidates.some((candidate) =>
        normalizedReference.includes(candidate.trim().toUpperCase()),
      ),
    );
    if (referenceMatches) { confidence += 45; reasons.push('referencia identificada'); }

    // RFC disponible ayuda al analista, pero NO demuestra que corresponda a este receivable.
    if (movement.senderRfc && movement.senderRfc.length >= 12) {
      confidence += 5;
      reasons.push('RFC disponible para revisión');
    }

    const mode: MatchMode = confidence >= 55 ? 'ASSISTED' : 'MANUAL';
    return {
      movementId: movement.id,
      receivableId: receivable.id,
      confidence,
      mode,
      reasons,
      amountMatches,
      referenceMatches,
    };
  }).sort((a,b) => b.confidence - a.confidence);

  // Sólo un candidato inequívoco por importe + referencia puede automatizarse.
  const eligible = candidates.filter((candidate) =>
    candidate.amountMatches && candidate.referenceMatches && candidate.confidence >= 90,
  );
  if (eligible.length === 1) eligible[0].mode = 'AUTOMATIC';

  return candidates.map(({ amountMatches: _amountMatches, referenceMatches: _referenceMatches, ...result }) => result);
}
