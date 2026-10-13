---
name: Operational safety decisions
description: Conflict responses, role-bound draft protection and the limits of application recovery.
---

Application-level optimistic conflicts must produce a non-retryable HTTP conflict,
not PostgreSQL's transaction-serialization failure.

**Why:** Concurrent native API tests returned upstream timeouts when stale writes
raised the serialization SQLSTATE. An explicit HTTP-conflict SQLSTATE returned
the stale-write rejection promptly, preserving the whole batch.

**How to apply:** Keep stale-record conflicts separate from retryable database
deadlocks/serialization. Do not blindly retry stale user intent with a freshly
read record version; require review.

Administrative legacy quarantine must use an administrative-only encryption key,
distinct from clinical and reception draft keys. Preserve unreadable ciphertext;
never autosave an empty form over a failed draft recovery.

**Why:** The clinic needs shared-computer protection without losing unsaved care.
A role downgrade must not unlock another professional's quarantined text through
the former administrator's ordinary draft key.

**How to apply:** Validate the caller's current role when releasing encryption
keys. Separate account and role namespaces; clear memory on logout. Treat old
downloads and previously delivered plaintext as historical copies requiring review.

Application data recovery is not a complete provider/disaster-recovery backup.

**Why:** Importing passwords from application JSON is unsafe. Provider Auth,
SMTP configuration and account-bound encryption keys have their own recovery
requirements; restoring canonical clinical rows alone does not restore login.

**How to apply:** Validate application exports in typed isolated tables and test
non-destructive recovery with synthetic records. Require a separately verified
provider backup and an isolated full recovery rehearsal before claiming disaster
recovery readiness. Never test destructive restoration against real patient data.

Password resets must revoke clinical access for old sessions, including sessions
whose JWTs are refreshed after the reset.

**Why:** A changed Auth password alone is not sufficient evidence that previously
issued signed tokens have stopped accessing data through database APIs.

**How to apply:** Check the original native session creation time against the
reset boundary, not merely the refreshed token's issuance time. Enforce this at
both definer routines and row policies, and at service-backed authenticated
endpoints. Test old tokens as well as successful fresh login.

Reapplying baseline security controls must preserve later hardening atomically.

**Why:** Baseline migrations recreate permission helpers and can silently undo
newer session checks even while all SQL statements succeed.

**How to apply:** Apply dependent hardening in the same transaction as the baseline
installer. Keep regression checks for previously revoked sessions after reruns.
