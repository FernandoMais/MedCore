---
name: Browser verification in this environment
description: Browser package installation does not guarantee downloaded executables; initial cloud hydration is asynchronous.
---

Prefer the environment-managed Chromium for browser automation instead of
assuming that the installed Playwright package includes its default browser.

**Why:** Playwright was installed but its expected downloaded headless-shell
executable was absent. The environment-managed browser successfully ran the
authenticated installation verification without installing another browser.

**How to apply:** Locate/use the managed executable before attempting browser
downloads or package upgrades. Keep credentials in runtime environment variables,
sanitize diagnostics and redact identifying information in retained screenshots.

Wait for actual cloud-readiness state, not a fixed short delay, before asserting
that initial login synchronization succeeded.

**Why:** Initial sequential cloud hydration and the deferred sync timer can
still be running after the dashboard appears. A short delay incorrectly reported
a connection failure even though authentication, binding and writes succeeded.

**How to apply:** Authenticate normally, then wait for the app's completed sync
indicator with a bounded timeout before testing persisted counts and cache isolation.

Form-focus regressions need sequential keyboard input, not only a one-step fill.
Load the real application CSS in isolated component fixtures when checking
layout, modal interception or scrolling.

**Why:** A one-step fill can conceal a field being recreated after each character.
Without CSS, a modal backdrop does not prevent background clicks; this can make
a test reopen an editor before a pending close finishes and falsely report a
typing failure.

**How to apply:** Assert full text, retained focus, stable input identity and
position while typing. Await actual modal dismissal, not disappearance of a
“Salvar” button name that changes to “Salvando…”.