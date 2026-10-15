---
name: Access and billing scope
description: Owner-requested financial roles, consultation prices, patient payments, attachments and professional earnings.
---

The owner requests administrator, secretaria and tesouraria access to the full
administrative and financial functions. Doctors must not have the clinic's full
finance menu; they should see only their own earnings and their origin by patient,
with period searches and printing/export.

The owner explicitly requires the doctor's payment/earnings report to include
only consultations that have actually been completed. At that point it may
distinguish paid from pending. Administrative collection tracking can start at
booking.

**Why:** The owner explicitly distinguished clinic financial management from
the professional's own remuneration, requested two administrative staff roles,
and confirmed that an unperformed appointment must not appear as medical earnings.

**How to apply:** Implement backend authorization as well as menu visibility.
Keep the separate administrator-only password-change rule and established
confidential-note boundaries; clarify any requested expansion of sensitive
clinical access instead of assuming that financial authority grants it.

Patients should choose among all participating professionals when booking,
not only their primary doctor. Booking should produce confirmation and payment
options for Pix, boleto or credit card; an insured patient should identify the
plan and the application should check the clinic's accepted network.

**Why:** These are the owner's requested patient-facing booking and billing
behaviors, rather than staff-only financial entry.

**How to apply:** Price and eligibility must come from trusted server data.
Do not equate a selected accepted insurer with verified individual coverage.
For the owner-approved manual-link workflow, present the externally created
checkout URL on screen and by email; authorized staff verify receipts against
the external account and record payouts manually. Neither clicking a link nor
receiving an email proves payment. This workflow does not require a provider
API connection or a PHP webhook, and must not be described as automatic payment
confirmation or automatic bank transfers.

**Why:** The owner chose manually created reusable fixed-value links and manual
repasse instead of the direct payment-provider integration.

**How to apply:** Keep scheduling, receipt confirmation, clinical completion and
repasse as separate states. Do not request provider API keys for this workflow.

The clinic requires client receipts to be centralized in its existing Asaas
account and explicitly declines Stripe and Whop.

**Why:** The owner wants all payments concentrated in the same account, not
another payment-provider account.

**How to apply:** Do not propose or connect Stripe or Whop again unless the owner
changes this requirement. Verify live integration capabilities and state any
implementation limitation explicitly. Do not enable automatic split to other
accounts without separate approval. Never retain bank identifiers or API
credentials in project memory.

The owner indicated `airi.restauraintegral.com.br` (without `www`) as the intended public
hostname for the payment integration.

**Why:** The owner supplied this address when discussing the webhook.

**How to apply:** Treat it as an intended hostname, not evidence of a deployed
application or an active webhook. Verify DNS, HTTPS and the actual server
endpoint before configuration. Payment-webhook failure alerts are intended for
the clinic's administrative mailbox, separate from the webhook URL.

The owner states that consultation prices are predetermined by doctor and
specialty. Prices should be configurable and associated with one or several
doctors, showing the professional's repasse and the clinic's administrative
share. Administrative staff need individual professional and global reports.
Patients should upload exams/documents into their own file for the attending
doctor to access at consultation.

**Why:** The owner described this as a unified workflow for service providers,
patient-submitted records and administrative financial management, with
consultation prices agreed in advance.

**How to apply:** Keep attachments private, restrict each patient to their own
records and authorize professional access. Keep historical price and repasse
terms attached to each appointment rather than recalculating past care when a
price catalogue changes. Report gross consultation value and each allocation
separately.

When a consultation price changes, create a different payment link; do not
change the amount of the link already issued to earlier appointments.

**Why:** A database price snapshot cannot protect past bookings if the same
external reusable link is changed to collect a different amount.

**How to apply:** Preserve both price and checkout URL for historical bookings.
The manual-link calculations use the gross consultation amount; do not silently
deduct gateway fees or change the percentage basis.
