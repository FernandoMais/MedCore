---
name: Financial tenant isolation
description: How Supabase financial RLS identifies the clinic for an authenticated session.
---

The financial RLS policies must derive the tenant from the authenticated Supabase user binding, not from a clinicId supplied by the browser. The internal user is bound to the Auth identity only through the guarded bind function; client-side clinic filters are defense in depth.

**Why:** A caller can alter any request payload, so accepting a client-provided tenant would allow cross-clinic reads or writes even when the UI filters correctly.

**How to apply:** Keep the Supabase schema migration applied before enabling cloud financial sync, pass the authorized clinic to storage for local scoping, and treat RLS errors as offline/local fallback rather than weakening the policy.