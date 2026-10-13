---
name: Access and billing scope
description: Owner-requested financial roles, consultation prices, patient payments, attachments and professional earnings.
---

The owner requests administrator, secretaria and tesouraria access to the full
administrative and financial functions. Doctors must not have the clinic's full
finance menu; they should see only their own earnings and their origin by patient,
with period searches and printing/export.

**Why:** The owner explicitly distinguished clinic financial management from
the professional's own remuneration and requested two administrative staff roles.

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
Do not report online collection as operational before a provider is connected
and its eligible methods, asynchronous confirmation and duplicate prevention
are verified.

Consultation prices should be configurable and associated with one or several
doctors, showing the professional's repasse and the clinic's administrative
share. Administrative staff need individual professional and global reports.
Patients should upload exams/documents into their own file for the attending
doctor to access at consultation.

**Why:** The owner described this as a unified workflow for service providers,
patient-submitted records and administrative financial management.

**How to apply:** Keep attachments private, restrict each patient to their own
records and authorize professional access. Keep historical price and repasse
terms attached to each appointment rather than recalculating past care when a
price catalogue changes. Report gross consultation value and each allocation
separately.
