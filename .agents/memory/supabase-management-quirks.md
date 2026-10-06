---
name: Supabase Management API quirks
description: Issued JWT differences and the migrated analytics endpoint can mislead authentication diagnostics.
---

Do not assume a Management API-revealed service-role JWT has the same bytes as
the Edge runtime's service-role JWT, even when both authorize the same project.
New private invitation commitments should depend on server-controlled random
nonces and authoritative identity scope, not the text of an issued API JWT.

**Why:** Both credentials were valid, but an operator-computed legacy commitment
did not match an enrollment that the live Edge runtime successfully validated.
Treating that discrepancy as a corrupt enrollment would have changed a valid
patient identity unnecessarily.

**How to apply:** Preserve legacy verification compatibility. A diagnostic hash
mismatch alone never authorizes rebinding or repairing an invitation. Always
require matching clinic/patient/Auth identity, server-owned nonce metadata, and
absence of a staff binding; never accept caller-supplied ownership.

Use the migrated Supabase unified logs endpoint and inspect the response body
for query errors even when HTTP status is 200.

**Why:** In September 2026, the old analytics logs.all endpoint was removed and
returned 410. The replacement accepts ClickHouse SQL; invalid queries returned
HTTP 200 with an error rather than useful rows. Omitting the explicit time range
restricts the query to the last minute.

**How to apply:** Query analytics/endpoints/logs with both ISO start/end timestamps
and supported projections. Select only necessary error fields; never print raw
authentication logs, request URLs, JWTs, or patient records.
