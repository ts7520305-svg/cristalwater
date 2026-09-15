# TASK117 — Return visit retry integrity

A return-visit scheduling retry previously returned success for an existing request identifier even when date, technician or instructions differed. It also rejected an identical saved request once the original date was in the past, before looking up the saved result.

The business layer now compares date, technician, instructions and scheduling administrator against stored return-plan metadata. Changed requests receive HTTP 409. Exact retries return the existing visit, including its current cancelled/completed state, even after the scheduled day has passed. New requests still require a date from today onward and retain existing pool/day duplicate prevention. Missing historical visits produce a conflict rather than success with a null visit.

No migration or route/response-shape change. Existing metadata supports historical requests. Instructions must be text. Date storage/timezone conventions are unchanged in this task.

API tests exercise simultaneous retries, changed dates/technicians/instructions, a historical saved date, rejection of a new past-date request, single receipt generation, cancelled replays and replacement scheduling. Historical-date fixtures are restored before the remaining mobile return-planning and completion flows. Unit, technician, syntax, browser, native PostgreSQL integration and restore gates apply. Physical-device/server trials remain deferred.
