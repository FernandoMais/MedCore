---
name: Clean installation instead of migration
description: The owner's authorization to start empty supersedes the earlier preserve-and-import migration goal.
---

Start the new installation without importing old database backups or browser
records. Preserve the existing application improvements, old source project,
backup files and previous browser storage; do not silently recover/import them.

**Why:** On 2026-10-01, after confirming additional local records, the owner
explicitly changed the goal from preserving/importing those records to starting
the new application from zero. The absence of old records is intentional.

**How to apply:** Treat old migration reconciliation as historical unless the
owner requests it again. Use isolated storage and authenticated, operator-bound
staff access for the clean installation, not seeded demo credentials or records.