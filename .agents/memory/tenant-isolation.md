---
name: Financial tenant isolation
description: How Supabase financial RLS identifies the clinic for an authenticated session.
---

The financial RLS policies must derive the tenant from the authenticated Supabase user binding, not from a clinicId supplied by the browser. The internal user is bound to the Auth identity only through the guarded bind function; client-side clinic filters are defense in depth.

**Why:** A caller can alter any request payload, so accepting a client-provided tenant would allow cross-clinic reads or writes even when the UI filters correctly.

**How to apply:** Keep the Supabase schema migration applied before enabling cloud financial sync, pass the authorized clinic to storage for local scoping, and treat RLS errors as offline/local fallback rather than weakening the policy.

Staff and patient clinic resolvers must remain separate authorization domains.

**Why:** Existing financial and user-profile policies interpret a resolved staff clinic as staff access. Extending that resolver to patient identities would grant patients clinic-wide staff privileges even with correct patient-row RLS.

**How to apply:** Use a separate patient-only scope and Auth storage for the portal. Never broaden the staff resolver or auto-bind a staff identity from the local part of an email; staff links require trusted provisioning.