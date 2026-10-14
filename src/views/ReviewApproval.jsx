import { useMemo, useState } from 'react';
import { PageHead } from '../components/ui';
import { filterRows } from '../lib/complianceView';
import { readyForReview, toReviewRow, waitsForCheck } from '../lib/reviewView';
import ReviewBoard from './ReviewBoard';

// Review & Approval is a board of cards, one for each syllabus waiting for a decision: who submitted it, the program and the subject. A
// submission is checked in the AI Checker first, so it appears here only after the administrator has checked it there; the ones still
// waiting for that check are counted below the title, with a way to the AI Checker.
// Opening a card shows the syllabus in a window, with the decision, comments and messages in a panel beside it (see App.jsx, which holds
// the window like the other modals, and ReviewPanel.jsx).
export default function ReviewApproval({ syllabi, setViewCode, setPage }) {
  const pending = useMemo(() => syllabi.filter(readyForReview), [syllabi]);
  const waiting = useMemo(() => syllabi.filter(waitsForCheck).length, [syllabi]);
  const [q, setQ] = useState('');
  const rows = useMemo(() => pending.map(toReviewRow), [pending]);
  const shown = useMemo(() => filterRows(rows, { q }), [rows, q]);
  return (
    <>
      <PageHead title="Review & Approval" subtitle="Open a submission to read it, then approve it, return it for revision, or reject it." actions={<span className="badge gold">{pending.length} Pending</span>} />
      {waiting > 0 && (
        <div className="info-banner rv-waiting" role="status">
          <span>{waiting + (waiting === 1 ? ' submission is' : ' submissions are') + ' waiting for the AI Checker. Check ' + (waiting === 1 ? 'it' : 'them') + ' there first; then ' + (waiting === 1 ? 'it appears' : 'they appear') + ' here for your decision.'}</span>
          {setPage && <button type="button" className="btn outline" onClick={() => setPage('ai')}>Open the AI Checker</button>}
        </div>
      )}
      <ReviewBoard rows={shown} total={pending.length} onOpen={(r) => setViewCode(r.syllabusId)} q={q} setQ={setQ} />
    </>
  );
}
