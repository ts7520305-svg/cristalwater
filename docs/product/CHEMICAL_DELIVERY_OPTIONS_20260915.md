# TASK118 — Complete and usable chemical delivery choices

The technician delivery selector previously fetched only the latest 100 transfers before filtering for the missing product. A valid older load could therefore disappear after unrelated transfers. Options now scan transfers with descending-ID keyset batches of 100, preserving vehicle, date, product, unit and linked-shortage restrictions.

Available quantity is capped by the outstanding need as well as unreceived/unreturned load quantity. Fully received needs return no options. Unknown shortage quantities remain limited by the load. These are independent choices, not a reservation across multiple movements: confirmation still revalidates transactionally and can reject stale options.

The lookup is read-only and does not consume stock. More historical movements can increase lookup work; batching bounds each database query but does not impose a silent result cutoff.

New isolated API test creates a valid load followed by 101 unrelated transfers, verifies discovery, receives 7 of 10 required units with exact replay, rejects an excess receipt, receives the remaining 3, confirms an empty selector and unchanged stock-movement count, then checks reassignment rejection. The test is included in the field suite. Existing mobile delivery/lost-response flows are rerun. No schema, external-message or deployment changes.
