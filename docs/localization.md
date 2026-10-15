# English and Tagalog localization

Faculty see My Profile and Language in Settings. Administrators also see Institutional Standard and AI & Notifications. The language selector applies immediately and saves to the authenticated account. Failed saves restore the last saved language and show an error. Preferences are isolated per account.

## Architecture

- `src/i18n/store.js` is an external store; App subscribes with React useSyncExternalStore. Language changes re-render existing components without reloading or remounting editors.
- `messages.js` and `extra.js` contain 1,602 matching bilingual keys. `t(key, values)` interpolates parameters and falls back to English. `tr(message)` adapts existing trusted UI labels and server messages at the presentation boundary. Numeric templates constrain parameters, and quoted user text is preserved.
- A shared presentation hook fades the committed interface in over 180 ms when the current account changes language, including rollback. It never waits for animation or remounts components. Opacity-only motion preserves sidebar geometry and focus. Reduced motion disables it (including when enabled mid-animation); account changes, logout and unmount cancel it. Browsers without animation support switch immediately.
- The preference controller handles immediate changes, rollback, duplicate requests, and stale responses after an account switch. App also guards pending UI state across account changes.
- `users.preferred_language` defaults to `en`. `PATCH /api/users/me/preferences` accepts only `preferredLanguage: "en" | "tl"`, uses the session account, and rejects extra fields. Password/Google login, remembered sessions, profile responses and GET /api/auth/me restore the preference. The latter reads current database values so refresh also sees changes from another session.
- GET/PUT `/api/settings` independently enforce requireAdmin. Administrator preferences persist in app_settings. These values do not replace compliance rules or configure external AI and SMTP services.
- Dates remain in Asia/Manila and use en-US or fil-PH. Native validation, accessible labels, loading states, toasts, review decisions, rule findings, notification titles and generated report headings are localized.

## Deployment

Run the additive migration before starting the updated API:

```powershell
cd server
npm run migrate-preferences
```

It adds the language column and administrator settings table if missing. Existing accounts default to English. It is safe to repeat and was applied to the current local database. Fresh installs include both definitions in server/db/schema.sql. Restart the API after deployment; development mode uses Node watch mode.

## Content preservation and remaining translation boundaries

Names, emails, course/program names, course codes, message and comment bodies, reviewer notes, editable academic content, institutional vision and mission, citations, uploaded documents and the official printed syllabus form retain their original content. Enum values, form values, permissions, React keys and stored business data remain canonical. Only surrounding interface labels are translated.

Recognized built-in server messages and current compliance-rule messages and fix headings are translated. Unrecognized future server or third-party errors, historical summaries without structured fields, and arbitrary free-text AI output retain their original language through the English/source fallback. New wording needs dictionary entries. Private content is not sent to an online translation service.

## Verification

`npm test` runs the 414 domain/API/motion tests and 45 localization and rendered-component tests. `npm run test:localization` runs the focused checks. Coverage includes password/Google login, persistence, refresh, account isolation, unauthorized writes, rollback, stale responses, dictionary parity, interpolation, dates, native validation, compliance rules and rendered faculty/admin/Tagalog output.

`npm run audit:i18n` checks direct and nested JSX display strings, literal translation references and dictionary parity. It excludes technical values and official document content. The static audit does not prove coverage of every possible dynamic server response.

The Vite development fixture at `/tests/i18n-preview.html` uses in-memory API substitutes and does not change real accounts. It includes faculty/admin switching, English/Tagalog switching, a 390 px preview and failed-save simulation. Rendered markup and responsive CSS were checked in this session. Browser-backed screenshot/pixel inspection was unavailable, so desktop and narrow visual checks remain manual.

## Sidebar behavior

Navigation keeps the same row height and icon columns in expanded and collapsed states. Labels use the expanded width even during the animation, wrap to two lines, and expose their full text through translated tooltips and accessible names. A separate scroll area uses the sidebar padding so vertical scrollbars cannot narrow the buttons. Expanded width responds to viewport size; reduced-motion mode disables sidebar and navigation width transitions. Collapse accessibility is render-tested for faculty and administrators in both languages.

## Stable translated layouts

Shared action buttons reserve both English and Tagalog labels in overlapping grid cells. The inactive copies use visibility:hidden and aria-hidden, so they affect sizing without appearing or being read. Native button props and refs pass through. Unknown text and non-text children remain unchanged. This keeps widths and wrapped heights consistent at the same viewport; it does not measure or mutate the DOM or store presentation sizes in profiles.

Top-bar action slots and profile text have stable dimensions. Dashboard columns use minmax(0, ...) tracks so translated text cannot widen the bento grid; statistic labels and notes reserve line space, and longer content wraps within cards. Existing fixed dashboard row heights and scrolling remain. Toolbar selects have an explicit width. The layout may still adapt when the viewport changes, and unusually long future labels can expand to remain readable.
