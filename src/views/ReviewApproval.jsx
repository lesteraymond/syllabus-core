import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
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
      <PageHead title={translateUI("ui.review_approval_c4c871")} subtitle={translateUI("ui.open_a_submission_to_read_it_then_approve_it_return_it_for_revisi_2dbe01")} actions={<span className="rv-count" role="status"><strong>{pending.length}</strong><span>{translateUI("ui.pending_b6d850").trim()}</span></span>} />
      {waiting > 0 && (
        <div className="info-banner rv-waiting" role="status">
          <span>{tr(waiting + (waiting === 1 ? ' submission is' : ' submissions are')) + translateUI("ui.waiting_for_the_ai_checker_check_37ebe7") + tr(waiting === 1 ? 'it' : 'them') + translateUI("ui.there_first_then_9f79fd") + tr(waiting === 1 ? 'it appears' : 'they appear') + translateUI("ui.here_for_your_decision_b13f6c")}</span>
          {setPage && <StableButton type="button" className="btn outline" onClick={() => setPage('ai')}>{translateUI("ui.open_the_ai_checker_ea8956")}</StableButton>}
        </div>
      )}
      <ReviewBoard rows={shown} total={pending.length} onOpen={(r) => setViewCode(r.syllabusId)} q={q} setQ={setQ} />
    </>
  );
}
