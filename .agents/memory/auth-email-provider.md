---
name: Auth email provider constraints
description: Supabase mail transport, delivery validation, template constraints and trusted published redirects.
---

Do not combine URL-setting fixes with email-template customization when the
Supabase project uses the free default email provider without custom SMTP.

**Why:** The Management API rejected the entire configuration update with
"Email template modification is not available for free tier projects using the
default email provider." Changing the Site URL and allowed redirects alone
worked. Native recovery links were verified on the published app with an
isolated staff account, including saving a password and signing in.

**How to apply:** Keep native staff recovery links until a mail transport that
permits template customization is configured. Do not extend this to patient
recovery: its separate verification flow requires the intended token-hash
template and private identity binding.

Treat the published URL obtained from deployment metadata as authoritative for
Auth links; development and published origins are not interchangeable.

**Why:** Development-only redirects caused production recovery requests to fall
back to Supabase's default localhost Site URL even though the app was published.

**How to apply:** Keep both trusted origins where necessary, preserve staff and
patient callback separation, and do not overwrite the published origin during
later function deployments. Old consumed/expired links require a fresh request,
not a longer expiry or weaker verification.

Do not treat a successfully saved custom SMTP configuration as proof that
invitation emails can be sent.

**Why:** Supabase accepted and persisted SMTP settings and enabled custom
templates, while the mail server separately rejected SMTP authentication. The
Management API validates configuration, not mailbox credentials or the mailbox's
external-application permissions.

**How to apply:** Verify transport authentication before claiming delivery works,
and distinguish server acceptance from inbox delivery. For HostGator Titan, check
external-app access and two-factor compatibility before repeatedly requesting
passwords; do not weaken an administrative mailbox's security just to enable SMTP.

Verify a native Supabase recovery send as well as direct SMTP authentication.
Build an email's complete destination URL in one Go-template expression rather
than interpolating a token after conditional URL fragments.

**Why:** Direct SMTP authentication and signup sends worked while native recovery
returned 500 before reaching SMTP. Go's HTML-template contextual escaping rejected
the token in an ambiguous URL context. This was a rendering failure, not a bad
mailbox password.

**How to apply:** Exercise the templates with Go's actual HTML renderer, including
patient/staff callbacks and missing/default redirects. Inspect sanitized Auth
errors before changing provider credentials. Keep token-hash verification and
separate patient recovery; do not replace them with arbitrary session fragments.

Allow for native Auth template caching after updating a template.

**Why:** The saved configuration and public template endpoint showed the corrected
body while Auth still executed the previous cached body. The upstream Auth source
defaults to a ten-minute template lifetime; accepted sends followed after reload.

**How to apply:** Compare the template/error positions against the current body,
allow a cache reload, and verify a native send before claiming completion.
Configuration persistence alone does not prove the mailer is using the new body.

Check inherited native mail quotas when enabling custom SMTP.

**Why:** The default-provider hourly limit remained in place after custom SMTP was
configured, causing native recovery to return 429.

**How to apply:** Set an appropriate controlled hourly quota, retain per-recipient
cooldowns, and distinguish throttling from rendering/transport failures. Public
recovery must not reveal whether a CPF has an account.
