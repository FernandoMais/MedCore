---
name: Clinical privacy boundaries
description: Why server-side privacy must also cover classification, historical copies and browser retention.
---

Do not broaden clinical read permissions to make a shared browser password work.
Confidentiality decisions must remain attached to personally authenticated access.

**Why:** This product is intended for real outpatient care. Masking a record after
its body reaches the browser does not protect it. Private text duplicated into a
general history, old cache or download remains exposed even after tighter RLS.
Professionals changing specialty must not make their old sensitive records public.

**How to apply:** Treat new confidential writes as privately classified at creation,
not merely by mutable professional metadata or a client-supplied label. Review
historical copies separately; do not erase or rewrite clinical text automatically.
Exports and browser-retention changes must preserve the same access boundaries and
must protect unsaved drafts before removing cached data.
