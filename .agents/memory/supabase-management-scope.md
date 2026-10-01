---
name: Supabase administrative access
description: Source and destination management permissions must be verified independently during migration.
---

Treat Supabase Management API access to the source and destination as separate
requirements. Successful destination setup does not establish source export
permission, even when the application already has a working source URL/key.

**Why:** An authorized token successfully installed the empty destination, while
the configured source returned HTTP 403 for project metadata and both SQL
query endpoints. Application access and administrative ownership are different.

**How to apply:** Check source management access before promising remote data
or Auth transfer. If denied, request authorized source access or an export from
its administrator; do not weaken RLS or substitute anonymous access/offline
passwords for an authorized migration. Keep the application connection unchanged
until source and browser-local backups have been reconciled and verified.

Do not attribute source HTTP 403 exclusively to missing ownership. Check the
source project state and available recovery actions in the dashboard too.

**Why:** The source was visible to the user but paused. Denied Management API
requests alone did not establish the cause or prove that the source was empty.

**How to apply:** For a paused source, consult current Supabase recovery guidance
and distinguish resume from backup-download recovery. Do not resume blindly:
existing clients, jobs and webhooks may reconnect. Recovery-document URLs can
retain obsolete time limits in their slugs; use current page contents.