# TASK116 — Chemical shortage retry integrity

The shortage/unfinished-visit endpoint previously returned a successful replay when a request identifier was reused with different product, quantity, unit, next-step or reason. In poor connectivity this could tell the technician that an edited report had been saved when only the earlier report existed.

The business layer now compares the stored canonical report and reporting identity before accepting a replay. An identical retry returns the existing record; a changed request returns HTTP 409. This uses existing metadata and also validates historical reports without a migration. Product fields are compared individually because database JSON property order is not stable.

Chemical quantity input rejects booleans, objects and arrays. Quantity may still be unknown (null, omitted or empty), and decimal commas remain supported. Reasons must be actual supported entries, and the next-step must be text. These changes do not consume or adjust stock, close the visit or create a new return visit.

Validation covers changed payloads, malformed quantities, concurrent identical retries, a single stored reminder, unchanged pool readings and zero stock movements. The existing field browser flow also covers lost receipt responses and retry without duplicate delivery receipts. This task does not modify production integration settings.
