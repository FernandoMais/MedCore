---
name: Supabase backup handling
description: Confidential database backups require structural inspection without raw SQL excerpts.
---

Inspect migration backups through tooling that emits only structure and aggregate
counts. Do not print raw decompressed samples or restore an unfamiliar dump
directly into the protected destination.

**Why:** Full database backups can contain patient records, Auth password hashes,
legacy plaintext passwords, role credentials and secrets even before the main
table-data sections. Generic archive-preview commands can expose them in chat.

**How to apply:** Check size and compression validity first, then recognize the
decompressed format internally. Keep raw files outside versioned code, process
DDL/COPY metadata without exposing row contents, and review compatibility before
preparing a data-only import. A database backup does not include unsynchronized
browser-local records.