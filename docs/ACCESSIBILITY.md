# Accessibility

Saathi's primary users are older adults, many with low vision, tremor or limited tech confidence. Target: **WCAG 2.2 AA**.

## Built-in

- **Display controls** on every app page: three text sizes (100 / 112.5 / 125 % — everything is in `rem`) and a high-contrast theme. Saved in a cookie and applied on the server, so there is no flash of the wrong size.
- **Read my day aloud** using the browser's speech synthesis (works offline, nothing is sent anywhere).
- **Big targets**: primary dose buttons are 56 px tall; all controls are at least 44 px.
- **Plain language**: 12-hour times, "For blood pressure", "With food", pill colour swatches and descriptions.
- **Forgiving**: every dose action has Undo; skipping asks for a reason; destructive actions need confirmation.

## Semantics

- Skip link, `header`/`nav`/`main`/`aside` landmarks, one `h1` per page, ordered headings.
- Every input has a `<label>`; hints and errors are linked with `aria-describedby`, invalid fields carry `aria-invalid`.
- Results of actions are announced: errors and warnings (e.g. a high blood-pressure reading) with `role="alert"`, success with `role="status"`.
- After a failed submit, keyboard focus moves to the first invalid field.
- Wide tables (health card, outbox, readings) are focusable, labelled scroll regions.
- Navigation marks the current page with `aria-current="page"`; toggle buttons use `aria-pressed`.
- Charts have text alternatives (progress rings are `role="img"` with a label; the adherence heatmap has a screen-reader table).
- Decorative SVGs are `aria-hidden`; icon-only buttons have accessible names.
- `prefers-reduced-motion` disables animation.
- Colour is never the only signal: statuses also have icons and words ("Taken", "Missed").

## Automated checks

- `tests/unit/components.a11y.test.tsx` — axe-core on core components (jsdom).
- `tests/e2e/app.spec.ts` — axe-core (WCAG 2.0/2.1/2.2 A & AA tags) on every public and signed-in page, desktop and mobile, including large-text + high-contrast mode.
- `eslint-plugin-jsx-a11y` rules via `eslint-config-next`.
