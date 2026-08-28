# XOLUM Fiscal → Universal Core

Fiscal consumes an authorized `fiscal.cfdi.requested.v1` contract and remains the sole owner of fiscal validation, XML generation, CSD signing, PAC interaction, UUID and SAT lifecycle.

The Core contract does not bypass the existing nine-layer fail-closed validation. A request whose source is `DELIVERY` must include an eligible delivery/evidence state before it can proceed to fiscal preflight. That eligibility is necessary but never sufficient for stamping.

After an actual successful PAC stamp, Fiscal emits `fiscal.cfdi.stamped.v1` using a stable idempotency key such as `fiscal:<fiscal-document-id>:stamped`. Downstream modules store references/projections only and never rewrite the CFDI.

Service credentials, CSD/FIEL material and PAC secrets are forbidden in events and remain in the designated secret boundary.
