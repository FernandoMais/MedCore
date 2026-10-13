---
name: Access invitation delivery
description: The clinic chose email invitations for patients and staff to define their own passwords.
---

Use email invitations for initial patient and staff access, letting the
recipient define their own password. Do not substitute manually delivered
activation links without a new choice from the owner.

**Why:** On 2026-10-05 the owner chose email delivery when offered email
invitations or confidential links handed out by the clinic.

**How to apply:** Preserve patient CPF login and staff email login. Account
creation and activation must have explicit outcomes; a saved clinical or staff
profile alone must never be presented as working authenticated access.

Direct password changes are now an explicitly requested supplementary
administrative option, not a replacement for email invitations.

**Why:** The owner requested a password-change field in user profiles visible
and usable only by administrators.

**How to apply:** Restrict direct changes to an active administrator in the same
clinic, require confirmation of the administrator's current credential, and
keep secrets out of profiles, backups and audit records. Do not implicitly
confirm an email, reactivate a disabled account or change its identity binding.
Keep staff email login and patient CPF login unchanged.
