# Claude handoff: Program deadline UI

Repository: https://github.com/jpdelrosarioo/Syllabus-Repository
Base branch: System-Improvement

Build the UI only for program-based syllabus submission deadlines in the existing Syllabus Management System. Read CHANGELOG.md and inspect the current components before coding. Start from the latest System-Improvement branch and preserve its existing changes. Match the current design and component architecture.

Do not implement backend routes, database migrations, scheduled reminders, real notification delivery, or email yet. Use isolated mock data and local state behind a small replaceable data adapter. Keep mock notifications separate from authenticated account notifications and never write demonstration records to the real database. Clearly describe that this is a UI prototype in the handoff, without adding implementation jargon to normal product flows.

## Feature rules

- An administrator sets one deadline for a program, school year, and semester. This is by program, not by project.
- The deadline applies to all subjects under that program for that academic period. Do not add subject-specific overrides in this first UI.
- Faculty have submission requirements only for subjects assigned to them. A program assignment without an assigned subject creates no requirement.
- Track progress per assigned faculty/subject pair: two faculty assigned the same subject each have their own requirement.
- A deadline tracks submission, not approval. A submitted syllabus awaiting review is submitted, not overdue. Compare submission time with the deadline for Submitted versus Submitted Late. Initial-submission and revision deadlines must not be conflated.
- Late submissions remain allowed. Do not change permission rules, builder navigation, AI checks, approval, messaging, or immutable version history.
- A deadline must be visible before a syllabus draft exists. Do not invent a syllabus ID for it.

## Administrator UI

Integrate management into Program & Subjects. Add Set Deadline to each program using existing buttons. When a deadline exists, show its academic period and due date, with Edit Deadline, View Progress, and Cancel Deadline actions.

The form modal includes the selected program, school year, semester, due date and time explicitly labelled Philippine Time, optional instructions, and a preview of affected subjects and assigned faculty. Provide Cancel and Save Deadline buttons. Explain the program-wide scope before saving. Validate required fields and date/time values inline; use local simulations for saving, success, and failure states. Preserve entered values on failure and prevent duplicate saves. Confirm cancellation before applying it.

The progress view shows subject code, subject name, assigned faculty, status, submission date, and deadline. Summarize submitted, pending, and overdue requirements. List unassigned subjects separately, without counting them as overdue faculty requirements. Handle multiple academic periods explicitly so progress never mixes different school years/semesters.

## Faculty UI

Replace the fixed sample entries in Upcoming Deadlines with the mock deadline data relevant to the faculty member's assignments. Each entry shows program, subject, academic period, due date, and a clear Upcoming, Due Today, Overdue, Submitted, or Submitted Late state. Provide an action to open the matching syllabus or start one for that assigned subject, using existing entry points where supported. Do not silently invent a backend prefill or academic-period association that does not exist; identify such integration gaps in the report.

Preview deadline-created, deadline-updated, deadline-cancelled, and reminder notifications using the existing notification design in an isolated preview. Clicking a preview notification should open the corresponding deadline context. These are simulated notifications, not real deliveries or a scheduler.

## Existing code to inspect and reuse

- src/views/CourseOutcomes.jsx and src/components/ProgramManagement.jsx: program/subject management and program actions.
- src/components/CatalogModalPortal.jsx, src/components/useModalLayer.js, src/lib/catalogMotion.js: existing dialog layering, focus, and motion.
- src/components/ui.jsx and src/components/StableButton.jsx: shared cards, icons, buttons, and bilingual size reservation.
- src/views/DashboardView.jsx: Upcoming Deadlines currently contains hardcoded sample dates.
- src/views/MySyllabi.jsx and src/views/builder2/: existing syllabus entry points and restrictions.
- src/components/Topbar.jsx and src/lib/notificationRoute.js: notification appearance and routing; keep mock data isolated.
- src/i18n/: centralized English/Tagalog dictionaries, interpolation, account preference, and reduced-motion-aware language changes.
- src/lib/phTime.js: Philippine-time formatting.
- src/styles.css: existing tokens, responsive layout, card heights, scoped scrolling, and sidebar behavior.
- docs/localization.md, docs/program-management.md, docs/admin-authoring-and-subject-standards.md: architecture and deployment notes.

## Design and accessibility

Reuse existing colors, typography, spacing, shadows, border radii, inputs, status badges, icons, and modal/button styles. Inspect shared components before adding new ones. Scope feature styles; do not redesign unrelated pages or change global sizing. Avoid new dependencies unless necessary.

Translate all new interface text into English and Tagalog through stable translation keys. Preserve academic content, program/subject names, and user-entered instructions. Support long Tagalog labels and small screens without changing the existing stable button-sizing approach.

Preserve hidden scrollbars and existing scoped native smooth-scroll behavior on the sidebar, Quick Actions, and Upcoming Deadlines. Do not add global scroll interception or custom mouse-wheel handlers. Respect reduced motion.

Maintain keyboard navigation, visible focus, labelled controls, modal focus management, accessible errors and status announcements, and readable contrast. Show appropriate empty, loading, failure, cancelled, and no-assignment states. Preserve current sidebar collapse behavior and dashboard card geometry.

## Delivery

Before coding, briefly explain which existing components you will reuse and the proposed layout. Then implement the UI prototype. Check both roles, both languages, populated/empty data, multiple faculty assignments, deadline changes/cancellation, midnight boundaries in Philippine time, and narrow layouts. Run the relevant existing tests, localization audit, and production build. Inspect the rendered UI if browser tools are available; report honestly if visual verification is unavailable.

Update CHANGELOG.md. Report files changed, tests run, remaining gaps, and the proposed API integration points for future persistence and notifications. Do not claim real deadlines or reminders are operational.
