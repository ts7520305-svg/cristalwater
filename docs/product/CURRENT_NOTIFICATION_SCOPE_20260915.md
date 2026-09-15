# TASK115 — Current preventive notice visibility

Preventive notices could remain visible to an old technician until the next scheduled reconciliation after reassignment. The notification list, unread count, both single-read aliases and read-all now use a shared service that validates preventive notices against their current plan and visit before applying the existing role scope.

This also excludes paused, completed, cancelled or disabled preventive notices without requiring a scheduler run. Validation does not create notifications or mutate read/delivery history. Non-preventive notices retain the existing scope. Database failures return the existing API error rather than falling back to unvalidated notices.

Candidates use keyset batches of 500; no first-page truncation occurs. Validation adds database reads proportional to scoped preventive notices, so unusually large backlogs may increase response time. A change concurrent with the scope check is not made atomic with the subsequent query. Already-rendered content is refreshed when the frontend next requests notifications; this is not remote erasure of offline data.

Tests: API reassignment before reconciliation excludes the old notice from list/count, rejects both read aliases and preserves its unread state on read-all. Existing access tests run alongside this scenario. Unit coverage checks more than 500 notices and failure propagation. No schema changes, external delivery or production deployment.
