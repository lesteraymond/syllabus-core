import { useMemo, useState } from 'react';
import { PageHead } from '../components/ui';
import { filterRows } from '../lib/complianceView';
import { PENDING, toReviewRow } from '../lib/reviewView';
import ReviewBoard from './ReviewBoard';

// Review & Approval is a board of cards, one for each syllabus waiting for a decision: who submitted it, the program and the subject.
// Opening a card shows the syllabus in a window, with the decision, comments and messages in a panel beside it (see App.jsx, which holds
// the window like the other modals, and ReviewPanel.jsx).
export default function ReviewApproval({ syllabi, setViewCode }) {
  const pending = useMemo(() => syllabi.filter((s) => PENDING.includes(s.status)), [syllabi]);
  const [q, setQ] = useState('');
  const rows = useMemo(() => pending.map(toReviewRow), [pending]);
  const shown = useMemo(() => filterRows(rows, { q }), [rows, q]);
  return (
    <>
      <PageHead title="Review & Approval" subtitle="Open a submission to read it, then approve it, return it for revision, or reject it." actions={<span className="badge gold">{pending.length} Pending</span>} />
      <ReviewBoard rows={shown} total={pending.length} onOpen={(r) => setViewCode(r.syllabusId)} q={q} setQ={setQ} />
    </>
  );
}
