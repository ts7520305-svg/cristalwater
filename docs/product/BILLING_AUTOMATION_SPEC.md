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

## 18. Predictive and decision intelligence

Crystal OS should evolve from a system that records past activity into one that also anticipates operational and financial needs.

The system should progressively support:
- workload forecasting by day/week/zone;
- technician and vehicle capacity forecasting;
- chemical/material consumption forecasting;
- expected revenue and collections forecasting;
- cash-flow visibility based on recurring revenue, overdue amounts and approved works;
- real profitability by client/pool/contract;
- identification of contracts whose real service cost is above the price charged;
- suggested price-review candidates without changing prices automatically;
- maintenance prediction for pumps, filters, chlorinators, probes, heat pumps and other equipment;
- automatic prioritisation of critical incidents versus low-priority anomalies;
- internal SLA tracking from detection to diagnosis and resolution.

All predictive recommendations must remain explainable and reviewable by the administrator.

## 19. AI confidence model

Any AI-generated recommendation or automated decision must expose a confidence level and, where possible, a short explanation of the evidence used.

Suggested levels:
- High confidence;
- Medium confidence;
- Low confidence.

Critical financial, safety, contractual or irreversible actions should require human confirmation unless explicitly configured otherwise under well-tested rules.

## 20. Pool Digital Twin

Each pool should progressively have a digital operational model built from its own historical data rather than relying only on generic rules.

The Digital Twin should aggregate, where available:
- pool volume and geometry;
- equipment inventory and technical characteristics;
- hydraulic layout/tubing notes;
- chemical measurements and trends;
- salt/chlorine/pH/alkalinity/hardness/temperature history;
- water-level observations;
- filtration schedules;
- equipment runtime and maintenance history;
- interventions and repairs;
- photos and visual evidence;
- seasonal behaviour;
- chemical and water consumption;
- recurring anomalies;
- customer-specific operating constraints.

The objective is for Crystal OS to learn the normal baseline of each individual pool and detect deviations from that baseline.

Examples of future Digital Twin insights:
- pH rising abnormally for this specific pool;
- water loss above its normal pattern, suggesting a possible leak;
- chemical demand higher than expected for current temperature/use;
- filter or equipment intervention becoming due based on historical behaviour;
- abnormal runtime or energy pattern;
- expected consumables for upcoming visits.

The Digital Twin must never silently overwrite factual history. Predictions and inferred states must remain distinguishable from measured or technician-entered data.

## 21. Crystal Command Center integration

Predictive, financial and operational intelligence should surface in the Crystal Command Center as exception-focused summaries rather than overwhelming the administrator with raw data.

Example daily summary:
- payments awaiting validation;
- overdue balances requiring attention;
- possible leaks;
- pools with abnormal chemical behaviour;
- route overloads;
- technician/vehicle capacity risks;
- low-stock predictions;
- contracts with negative or weak margin;
- equipment with predicted maintenance needs;
- communication channel failures.

Primary question for the administrator dashboard: "What requires my attention today?"

## 22. Product principle

Crystal OS should automate routine work and surface exceptions.

Target operating model:
- system prepares;
- system validates;
- system sends;
- system retries safe failures;
- system reconciles what it can;
- system predicts emerging needs and anomalies;
- administrator handles only exceptions, approvals and ambiguous cases.

This specification intentionally avoids implementation-specific provider assumptions so that WhatsApp, email and future channels can share the same queue, audit and automation model.

## 23. Pool measurement integrity and truthful client reporting

Decision approved by the user on 2026-09-26.
Status: requirements recorded; implementation and testing remain pending.

Objective: protect service quality and client trust through verification, context and an auditable correction process, never through fabricated or cosmetically normalised readings.

### 23.1 One factual record

- Preserve the original technician-entered or instrument-measured reading, parameter, unit where applicable, pool/visit, timestamp and author/source.
- Never clamp an out-of-range reading to a minimum/maximum, replace it with a normal-looking number, or maintain a false client-facing version.
- Do not offer a "real values / adjusted values" setting. Presentation preferences must not change measured facts.
- A genuine entry correction must retain the original value, corrected value, reason, actor and timestamp. A repeat measurement is a new record, not an overwrite.
- Measured values, corrected entries, estimates and AI predictions must remain distinguishable in the history and in any report where they appear.

### 23.2 Suspected measurement or entry error

- An unusual or inconsistent result prompts the technician to repeat the measurement and check the test method/instrument; notify the administrator and create a follow-up task.
- Use "Por confirmar" only while verification is genuinely pending. Being outside a target range does not by itself prove that a measurement is wrong.
- Never classify a pending, missing or out-of-range result as "Bom", "Ótimo" or confirmed normal.
- The client summary may show "Resultado por confirmar; nova medição necessária" instead of presenting a suspect value as validated. The detailed record retains the actual reading and its validation status.
- A pending verification must not hide a possible safety issue, postpone a necessary protective warning or leave an old reassuring status presented as current.

### 23.3 Arrival, intervention and verification

Keep three distinct elements linked to the visit:
1. Measurement on arrival.
2. Treatment/intervention actually performed, with time and responsible technician.
3. A new post-treatment measurement when technically appropriate.

Use "Tratamento realizado; aguarda nova medição" when a treatment has been recorded but its result has not been verified. Applying a product does not itself prove correction.

Use "Parâmetro corrigido e verificado" only when a valid follow-up measurement supports that statement for that parameter. Verification of one parameter must not imply that all pool-use conditions have been checked.

Record when a follow-up measurement is due, who is responsible and whether it has been completed. Do not invent a post-treatment measurement or automatically substitute a predicted result.

### 23.4 Client presentation

Provide two truthful presentation modes:
- Relatório simplificado: work performed, relevant status, pending checks, next action and any applicable safety/use instruction, in clear language.
- Relatório técnico: actual readings with times, validation status, applicable reference range and before/after context where available.

Internal staff notes and operational details may have restricted visibility, but relevant safety information must not be hidden. Both modes must be consistent with the same underlying record.

Distinguish "last measured at" from current status. A previous visit's normal value must never be displayed as a new measurement or as proof of current safety. Do not label a parameter normal merely because no new reading exists.

Examples of permitted wording, used only when supported by the record:
- "Resultado por confirmar; nova medição necessária."
- "Tratamento realizado; aguarda nova medição."
- "Parâmetro corrigido e verificado às [hora]."

### 23.5 Safety notifications take priority

- Necessary protective notifications to the responsible client/operator must not wait for approval of the ordinary visit report, confirmation of a suspected reading, or a billing campaign.
- When a potential bathing risk is identified, communicate the uncertainty and applicable protective instruction clearly; where suspension of pool use is indicated, make that instruction explicit.
- Report detail settings must never suppress a required warning. These safeguards take precedence over generic approval rules in section 19.
- A restriction must not disappear solely because a timer expired, a product was added, the interface refreshed or an AI recommendation predicted recovery. Record the verification and responsible decision supporting release.
- Define and professionally validate safety thresholds and follow-up rules for the applicable pool type, test method and product instructions during implementation. This section does not establish universal numerical limits or treatment dosages.
- Record notification attempts and the actual delivery evidence available. Unknown delivery is not confirmed receipt. Failed critical notifications must escalate to the administrator for another appropriate contact attempt.

### 23.6 Audit and implementation acceptance criteria

Before marking this feature implemented, verify at least:
- An out-of-range value is never silently replaced by a boundary or normal-looking value in the client portal, PDF, message or export.
- A correction retains the original record and an attributable reason; a repeat reading creates a separate measurement.
- A suspect result remains visibly pending and cannot produce a normal/green status.
- Recording a treatment without a new reading produces a pending-verification state, not a successful-correction claim.
- Before/after values display their own timestamps, and a corrected parameter does not imply blanket pool safety.
- Simplified and technical reports remain factually consistent and retain necessary safety instructions.
- Critical protective warnings are not blocked by ordinary report approval, report visibility preferences or billing queue pauses.
- A warning with failed or unknown delivery produces an actionable alert rather than a false delivery confirmation.
- Tenant isolation and role permissions protect access to measurements and the audit history.

This documentation change does not implement these behaviours, activate notifications, change live measurements or deploy anything to the server.
