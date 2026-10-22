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

Reviewing protected pending edits must be read-only. After recovering or
explicitly discarding a pending batch, read the confirmed server state before
allowing normal editing and autosync again.

**Why:** Flushing the old screen before comparison blocks the comparison itself
when pending edits are held. Flushing stale UI data after recovery can also
resubmit changes that contradict the recovered records.

**How to apply:** Preserve the encrypted copy on conflicts or incomplete server
acknowledgments. Do not clear it merely because an HTTP request returned. Keep
new edits suspended during review rather than mixing fresh intent into an older
protected batch.
Present an active review workspace with local versus confirmed values instead
of showing an entire inert form as if it were usable. Recovery controls must
remain outside the edit lock and usable on mobile.

**Why:** Administrators interpreted the protected-pending lock as a frozen system
even though recovery links were present. Removing the write guard would risk
data loss; making the resolution visible and actionable preserves both safety
and usability.

Resolve browser-local pending edits at the original address before a custom
domain cutover.

**Why:** The same Supabase project does not make browser-local encrypted drafts
available across different origins. A domain change can hide access to a local
copy without actually deleting it.

**How to apply:** Recover using the same account, browser and address where the
warning appeared. Do not recommend clearing browser storage or changing domains
as a remedy for protected pending edits.

Administrative legacy quarantine must use an administrative-only encryption key,
distinct from clinical and reception draft keys. Preserve unreadable ciphertext;
never autosave an empty form over a failed draft recovery.

**Why:** The clinic needs shared-computer protection without losing unsaved care.
A role downgrade must not unlock another professional's quarantined text through
the former administrator's ordinary draft key.

**How to apply:** Validate the caller's current role when releasing encryption
keys. Separate account and role namespaces; clear memory on logout. Treat old
downloads and previously delivered plaintext as historical copies requiring review.
Nonclinical financial staff must be able to protect administrative pending
edits without requesting clinical encryption keys. Do not expand server-side
clinical permissions just to make a newly introduced staff profile log in.

**Why:** Permission to manage finances is not permission to decrypt clinical
drafts. Reusing clinical-key initialization for nonclinical roles can block
otherwise valid logins and make pending-edit protection fail.

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
