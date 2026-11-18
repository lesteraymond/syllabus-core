import { t as translateUI } from "../i18n/index.js";
import { Avatar, Icon } from '../components/ui';
import { programLabel, subjectLabel, toneStyle } from '../lib/reviewView';

// The card is built from Tailwind utilities (the tw: prefix; see src/tailwind.css and src/tw-theme.css). Colours, radius, shadow and type sizes
// come from the app's design tokens through that theme; the program's own colour arrives as --tone / --tone-soft from toneStyle() below,
// so the data still decides the colour and the classes never change. A few values (the grid areas, the transitions, the hover shadow) have no
// token and are written as arbitrary values.
const CARD = [
  // layout: a 35px chip beside three stacked lines (program, subject, faculty note)
  'tw:group tw:relative tw:grid tw:w-full tw:min-w-0 tw:min-h-[120px] tw:[align-content:start] tw:items-start tw:gap-x-[11px] tw:gap-y-0.5 tw:overflow-hidden',
  "tw:grid-cols-[35px_minmax(0,1fr)] tw:grid-rows-[auto_auto_1fr] tw:[grid-template-areas:'icon_label'_'icon_value'_'icon_note']",
  'tw:py-4 tw:pr-9 tw:pl-4 tw:text-left tw:cursor-pointer tw:text-inherit tw:[font:inherit]',
  // minimal surface: flat, one hairline border, no shadow; the button blue (--btn-primary) shows on hover and focus
  'tw:rounded-card tw:border tw:border-line tw:bg-card tw:[box-shadow:none]',
  // motion: a quiet border-colour change, nothing lifts or moves
  'tw:[transition:border-color_0.2s_ease,background-color_0.2s_ease]',
  'tw:hover:border-[color:var(--btn-primary)] tw:hover:bg-[color:var(--btn-primary-tint)]',
  'tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-brand-2',
  'tw:motion-reduce:[transition:none]',
].join(' ');
const PROGRAM = 'tw:[grid-area:label] tw:block tw:max-w-full tw:rounded-[99px] tw:[background:none] tw:p-0 tw:text-muted tw:text-xs tw:leading-[18px] tw:font-semibold tw:uppercase tw:tracking-[var(--tracking-label)] tw:wrap-anywhere';
const SUBJECT = 'tw:[grid-area:value] tw:mt-0.5 tw:text-md tw:leading-[1.3] tw:font-bold tw:font-display tw:text-[#000] tw:wrap-anywhere';
const AVATAR = 'avatar tw:[grid-area:icon] tw:size-[35px] tw:flex-none tw:rounded-full tw:[border:0] tw:bg-[color:var(--tone-soft)] tw:text-[color:var(--tone)] tw:text-xs tw:[box-shadow:none]';
const FACULTY = 'tw:[grid-area:note] tw:[align-self:end] tw:mt-2 tw:min-w-0 tw:flex-[1_1_0] tw:text-xs tw:leading-[18px] tw:font-semibold tw:text-muted tw:wrap-anywhere';
const ARROW = [
  'tw:absolute tw:top-4 tw:right-4 tw:text-muted tw:opacity-0 tw:[transform:translate(-4px,4px)] tw:[transition:opacity_0.2s_ease,color_0.2s_ease,transform_0.2s_ease]',
  'tw:group-hover:opacity-100 tw:group-hover:text-[color:var(--btn-primary)] tw:group-hover:[transform:none]',
  'tw:group-focus-visible:opacity-100 tw:group-focus-visible:text-[color:var(--btn-primary)] tw:group-focus-visible:[transform:none]',
  'tw:motion-reduce:[transition:none]',
].join(' ');

// The reviewer's board: one card for each syllabus waiting for a decision. A card shows exactly three things, the program, the subject
// and who submitted it, and nothing else; the arrow that appears on hover is only a hint that the card opens. The program decides the
// card's colour (the same colour in the window and the panel), so a card is recognised at a glance. Clicking a card opens the syllabus
// in a window. The grid reflows to the width it has, and long names wrap inside their card instead of pushing into the next one.
// It only displays: Review & Approval owns the data.
//   rows     from toReviewRow(...)        total   how many are waiting before the search
//   onOpen(row)                           q / setQ   the search text
export default function ReviewBoard({ rows, total, onOpen, q, setQ }) {
  return (
    <div className="rb">
      <label className="rb-searchbox">
        <Icon name="magnifyingGlass" size={18} />
        <input type="search" placeholder={translateUI("ui.search_faculty_program_or_subject_92ad4a")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={translateUI("ui.search_the_review_board_b45456")} />
      </label>
      {total === 0 && <div className="empty">{translateUI("ui.all_caught_up_no_pending_syllabi_88b06d")}</div>}
      {total > 0 && rows.length === 0 && <div className="empty">{translateUI("ui.no_syllabus_matches_ade270")}{q}”.</div>}
      {rows.length > 0 && (
        <ul className="rb-grid">
          {rows.map((r) => (
            <li key={r.syllabusId}>
              <button type="button" className={CARD} style={toneStyle(r)} aria-haspopup="dialog" onClick={() => onOpen(r)}>
                <span className={PROGRAM}>{programLabel(r)}</span>
                <strong className={SUBJECT}>{subjectLabel(r)}</strong>
                <span className="tw:contents">
                  <Avatar className={AVATAR} userId={r.raw.userId} src={r.raw.ownerAvatarUrl} name={r.facultyName} />
                  <span className={FACULTY}>{r.facultyName || translateUI("ui.unknown_faculty_753147")}</span>
                </span>
                <Icon name="arrowUpRight" size={18} className={ARROW} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
