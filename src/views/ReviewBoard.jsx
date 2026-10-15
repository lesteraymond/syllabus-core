import { t as translateUI } from "../i18n/index.js";
import { Avatar, Icon } from '../components/ui';
import { programLabel, subjectLabel, toneStyle } from '../lib/reviewView';

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
              <button type="button" className="rb-card" style={toneStyle(r)} aria-haspopup="dialog" onClick={() => onOpen(r)}>
                <span className="rb-pill">{programLabel(r)}</span>
                <strong className="rb-subject">{subjectLabel(r)}</strong>
                <span className="rb-who">
                  <Avatar userId={r.raw.userId} src={r.raw.ownerAvatarUrl} name={r.facultyName} />
                  <span className="rb-name">{r.facultyName || translateUI("ui.unknown_faculty_753147")}</span>
                </span>
                <Icon name="arrowUpRight" size={18} className="rb-go" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
