# Billing & Collections Automation Specification

Status: Product specification / not yet implemented
Date: 2026-09-26
Scope: Crystal OS financial automation, notifications, delivery control, payment evidence and multi-tenant readiness.

## 1. Objective

Automate recurring billing and collections so the administrator manages exceptions instead of manually chasing every client each month.

Core principle: the system should be simple for operators, configurable per company, auditable, resilient to delivery failures, and safe against duplicate sends.

## 2. Pre-billing review

Before any recurring billing cycle is sent, Crystal OS should generate a pre-billing report, preferably 7 days before the configured send date.

The report must show at minimum:
- clients scheduled for billing;
- pools/contracts included;
- billing amount;
- billing period;
- VAT/fiscal flag according to the existing business rules;
- delivery channels configured for each client;
- exceptions, pauses or billing-disabled clients;
- changes compared with the previous billing cycle;
- warnings requiring administrator review.

The administrator may:
- approve all;
- edit a client before issue;
- exclude a client from that cycle;
- switch the cycle to manual or semi-automatic mode;
- change the send date.

## 3. Operating modes

Per company and/or per billing workflow:
- Automatic: issue/send without manual approval when all validations pass.
- Semi-automatic: prepare everything but require final approval before send.
- Manual: administrator triggers issue/send.

## 4. Communication channels

The system must support configurable communication identities in Settings.

Examples:
- WhatsApp customer-service number;
- WhatsApp billing/payments number;
- billing email account;
- support email account;
- other email or messaging accounts added later.

Each tenant/company must configure its own accounts. Credentials must never be stored in plain text. Prefer OAuth where supported; otherwise use encrypted application credentials/secrets.

## 5. Dedicated billing WhatsApp

Recommended operating model:
- one human/customer-service WhatsApp for normal conversations;
- one separate billing/payments WhatsApp connected to Crystal OS.

The billing channel may:
- send invoices/payment notices;
- send individual reminders;
- receive proof of payment;
- request proof automatically when a client says they paid but provides no attachment;
- identify the client and candidate invoice(s);
- attach the proof to the financial record;
- classify the payment as confirmed, probable or requiring validation;
- send a receipt/acknowledgement message when appropriate.

The billing channel should clearly identify itself as an automated or semi-automated Crystal Water billing channel.

## 6. Payment evidence and reconciliation

When proof of payment arrives by WhatsApp or email, the system should extract, where possible:
- client identity;
- payer identity;
- amount;
- date;
- payment reference/description;
- candidate invoice(s);
- attachment/image/document.

Suggested confidence levels:
- Confirmed automatically: high-confidence match under configured rules.
- Probable payment: likely match but administrator review needed.
- Unidentified: attachment stored but manual matching required.

If a client owes multiple invoices, the system may propose allocation across one or more invoices according to amount and oldest-due rules, but must keep a clear audit trail.

Preferred future state: proof of payment is evidence; bank reconciliation is the strongest confirmation when banking integration is available.

## 7. Delivery queue and throttling

Do not send hundreds or thousands of emails/WhatsApp messages at the same instant.

All outbound messages must enter a queue.

Minimum states:
- queued;
- processing;
- sent;
- delivered/accepted when the provider supports confirmation;
- failed;
- cancelled;
- retry scheduled.

The dispatcher must support:
- small batches;
- configurable concurrency;
- channel-specific rate limits;
- adaptive throttling when providers return rate-limit or temporary errors;
- automatic backoff and retry;
- continuation of the queue even if one recipient fails.

The application should expose simple policies such as:
- Automatic;
- Conservative;
- Custom;
while always respecting provider limits.

## 8. Duplicate protection / idempotency

The same billing document must not be sent twice by accident.

Recommended idempotency key dimensions:
- tenant/company;
- client;
- invoice/document;
- document version;
- channel;
- intended operation.

Default rule: invoice + client + channel + same document version cannot be sent twice unless the administrator explicitly chooses a forced resend.

## 9. Retry behavior

Provide actions:
- Retry this send;
- Retry selected failures;
- Retry all failed sends;
- Force resend selected item.

"Retry all failed sends" must never resend successful/delivered items.

Automatic retries should be allowed for transient errors only. Permanent errors should require correction first.

## 10. Troubleshooting

Each failed send must record:
- client;
- channel;
- document/action;
- timestamp;
- provider/internal error code;
- human-readable explanation;
- retry count;
- next retry time if applicable;
- recommended action.

Error categories:
- recipient/client issue: invalid email, invalid number, mailbox full, unsupported destination;
- temporary/provider issue: timeout, provider unavailable, rate limit;
- tenant configuration issue: expired token, invalid SMTP/API configuration, disconnected account;
- internal service issue: worker stopped, queue blocked, unexpected application error.

Recommended remediation should be specific, e.g.:
- verify email;
- verify phone number;
- reconnect account;
- retry later;
- restart only the affected worker/service if safe;
- contact administrator.

Do not reboot the whole application automatically because of one failed delivery.

## 11. Internal notification center

Crystal OS must provide an administrator notification center for billing and delivery exceptions.

Examples:
- 3 clients did not receive an invoice;
- 2 WhatsApp messages failed;
- 1 email bounced;
- 5 payments are awaiting proof;
- 4 payment proofs require validation;
- billing account disconnected;
- retry queue blocked.

Critical issues may also trigger push/email/admin alerts so the administrator does not need to keep the dashboard open.

The goal is exception management: the administrator reviews only what requires human attention.

## 12. Delivery summary

Each billing run should produce a summary such as:
- total scheduled;
- total generated;
- total sent;
- total delivered/accepted;
- total retrying;
- total failed;
- total requiring administrator attention.

Every metric should be drillable to the affected clients/documents.

## 13. Client preferences

Per client, support:
- preferred language;
- preferred billing channel(s);
- preferred notification channel(s);
- email address(es);
- WhatsApp/phone number(s);
- allowed reminder behavior;
- billing contact different from operational contact;
- disabled channel if the client requests it.

## 14. Templates

Use reusable templates per tenant/company and language for:
- invoice sent;
- payment reminder;
- overdue reminder;
- proof requested;
- payment received;
- payment needs review;
- send failure escalation.

Templates should support variables but must avoid silently sending incomplete placeholders.

## 15. Audit trail

All important financial-automation actions must be auditable:
- who changed settings;
- who approved a billing run;
- who edited an amount;
- which automation sent a message;
- provider response;
- retries;
- manual override;
- payment matching decision;
- attachment provenance;
- status changes.

## 16. Multi-tenant / productisation readiness

Because Crystal OS may later be sold to other companies, the automation must be tenant-isolated.

Each tenant must have independent:
- communication accounts;
- templates;
- sender identities;
- billing calendars;
- automation modes;
- rate settings;
- audit logs;
- retry queues;
- customer data;
- payment evidence;
- permissions.

No tenant must ever be able to access another tenant's accounts, messages, clients or payment evidence.

## 17. Recommended additional safeguards

### 17.1 Channel health dashboard
Show whether each configured account is connected and operational before a billing run begins.

Suggested states:
- healthy;
- degraded;
- disconnected;
- credentials expired;
- provider unavailable.

### 17.2 Pre-flight check
Before sending a large billing run, validate:
- channel connected;
- credentials valid;
- queue worker running;
- template available;
- sender configured;
- destination data valid;
- no duplicate job already running.

### 17.3 Dead-letter queue
Messages that exhaust automatic retries should move to a dedicated failure queue rather than disappearing or retrying forever.

### 17.4 Pause / emergency stop
Administrator must be able to pause a billing campaign or outbound queue immediately without losing the queued work.

### 17.5 Dry-run mode
Allow simulation of a billing run without sending anything. Show exactly who would receive what, through which channel, and what exceptions would occur.

### 17.6 Change freeze before issue
Once a billing run is approved, either freeze the included snapshot or flag any subsequent client/price change that would alter the approved result.

### 17.7 Permissions
Separate permissions for:
- view billing;
- edit billing data;
- approve billing run;
- force resend;
- validate payment;
- change communication credentials;
- change automation settings.

## 18. Product principle

Crystal OS should automate routine work and surface exceptions.

Target operating model:
- system prepares;
- system validates;
- system sends;
- system retries safe failures;
- system reconciles what it can;
- administrator handles only exceptions, approvals and ambiguous cases.

This specification intentionally avoids implementation-specific provider assumptions so that WhatsApp, email and future channels can share the same queue, audit and automation model.
