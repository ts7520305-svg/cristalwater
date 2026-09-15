# TASK114 — Preventive notification integration

The administration can explicitly enable maintenance notices and request an in-app check at `/api/equipment-maintenance/notifications/config` and `/check`. All three routes require ADMIN; the business layer also validates configuration writes. Existing equipment workflows remain compatible.

When background jobs are enabled, the server reconciles preventive notices and attempts browser push at startup and every five minutes. Configuration defaults to disabled. The manual check creates/reconciles in-app notifications only; it does not send push.

Notices target administration and the technician or team leader assigned to an applicable visit today. Completion, paused plans, cancellation and reassignment invalidate notices during reconciliation. Push rechecks current applicability before delivery. In-app state can lag until the next check; concurrent changes and external delivery cannot be made atomic.

Browser push requires the existing external-notification environment gate, VAPID configuration, an active subscription and device permission. Retries preserve recorded successful destinations; delivery after a crash or across multiple processes is not exactly-once. No real external messages or physical-device delivery were tested in this change.

Validation: unit tests, technician tests, all browser scripts, isolated API tests and the native PostgreSQL CI suite. The integration runner includes the preventive-reminder test and the browser runner includes settings failure/session handling. Existing migration and backup/restore checks remain mandatory. No schema migration is added.
