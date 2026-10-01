---
name: Public patient registration scope
description: Registration is for identity/access only; financial actions and email delivery are independent.
---

Public registration must create only patient identity/contact records and portal
credentials. Do not request payment amount, payer identity, book appointments
or generate financial charges as part of registration.

**Why:** The owner explicitly requested this separation on 2026-10-01; payment
capture is not a condition of registering as a patient.

**How to apply:** Keep billing/procedure pricing in their separate workflows.
Future financial changes must not reintroduce payment requirements into signup.

Treat persisted registration separately from confirmation-email delivery.
If the account and private enrollment are already saved but email sending fails,
report saved registration and pending activation honestly; never automatically
confirm email or report successful delivery without an accepted send request.

**Why:** The new project's mail transport was not configured. Reporting a failed
registration after durable creation caused misleading errors and encouraged
duplicate attempts, while bypassing verification would weaken identity checks.

**How to apply:** Preserve mandatory confirmation and the private enrollment
binding. Configure a trusted mail transport to complete activation; retry email
delivery rather than creating another patient or reassigning an existing account.