---
name: Automated backup requirements
description: Clinic-approved scheduling, retention and destination requirements for automated application backups.
---

The clinic approved daily backups at 02:00 in America/Sao_Paulo, with 60-day
retention and failure alerts to the mailbox explicitly designated by the owner,
which may differ from the administrative SMTP sender. The destination is
an owner-designated private Google Drive folder. Store only encrypted backups.
Do not record account addresses or protection phrases in project memory.

**Why:** The owner confirmed the proposed schedule, explicitly increased retention
to 60 days, and selected a private folder rather than a public sharing link.

**How to apply:** Obtain Google authorization and confirm the specific destination
folder before configuring uploads. These are requirements, not proof that a
scheduled job is active. Verify upload, retention safety, alerts and restoration
before reporting the automation as operational.

The owner authorized changing the destination Google account and creating a
dedicated private folder. Do not assume the originally named account remains
the required destination.

**Why:** The owner chose a different account to simplify backup management.

**How to apply:** Verify the currently authorized account and the chosen folder's
permissions before uploading clinical data; disclose the destination account
without storing account addresses in project memory.

Keep the alert recipient independent from the authenticated SMTP sender.

**Why:** The owner redirected alerts to the backup-management mailbox instead
of the original administrative mailbox, then confirmed receipt of a direct
SMTP test through the clinic's existing mail provider. A Gmail recipient does
not require replacing that sending provider.

**How to apply:** Use the configured alert recipient for notifications, but
authenticate with the sender's credentials. Changing the recipient does not
change the sending provider or prove SMTP delivery. Preserve the distinction
between the confirmed alert transport and unverified scheduled execution or
native Auth recovery links; retest delivery after mail configuration changes.
