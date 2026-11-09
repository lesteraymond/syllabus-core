import StableButton from './StableButton';
import { tr } from '../i18n/index.js';
import { t as translateUI } from '../i18n/index.js';
import { useEffect, useId, useState } from 'react';
import Select from './Select';

const STATUS_LABELS = { draft: 'Draft', for_revision: 'For Revision', rejected: 'Rejected' };

// The administrator's own syllabi in the AI Checker: the drafts (and those returned for revision or rejected) they wrote in the builder. Checking one
// sends it to the AI Checker the same way the builder's "Continue to check" does (POST /syllabi/:id/prepare-check: a saved version, status Under
// Review), runs the check and opens the result, where the administrator sends it for review. It only chooses; the page does the work.
//   rows      the administrator's own syllabi that can be checked now (the page filters them)
//   busy      true while a check runs
//   onCheck(row)  "Check my syllabus"          onOpen(row)  "Open in builder"
export default function OwnSyllabusPicker({ rows, busy = false, onCheck, onOpen }) {
  const uid = useId();
  const [id, setId] = useState('');
  const row = rows.find((r) => String(r.id) === id) || null;
  useEffect(() => { if (id && !row) setId(''); }, [id, row]); // checked: it left this list for the one below
  const empty = rows.length === 0;
  return (
    <section className="card pick-card" aria-label={translateUI('ownCheck.title')} data-testid="own-syllabus-picker">
      <div className="pick-head">
        <h3>{translateUI('ownCheck.title')}</h3>
        <p>{translateUI('ownCheck.help')}</p>
      </div>
      <div className="pick-grid">
        <div className="pick-field">
          <label htmlFor={uid + '-own'}>{translateUI('ui.subject_8d183d')}</label>
          <Select id={uid + '-own'} value={row ? id : ''} disabled={empty || busy} onChange={(e) => setId(e.target.value)}>
            <option value="">{empty ? translateUI('ownCheck.none') : translateUI('ui.choose_a_subject_554b9c')}</option>
            {rows.map((r) => <option key={r.id} value={String(r.id)}>{(r.courseCode || '—') + (r.courseTitle || r.title ? ' — ' + (r.courseTitle || r.title) : '')}</option>)}
          </Select>
        </div>
      </div>
      <div className="pick-foot">
        <div className="pick-info" aria-live="polite">{row && <span className={'status ' + row.status}>{tr(STATUS_LABELS[row.status] || row.status)}</span>}</div>
        <div className="pick-actions">
          <StableButton type="button" className="btn outline" disabled={!row || busy} onClick={() => row && onOpen(row)}>{translateUI('ownCheck.open')}</StableButton>
          <StableButton type="button" className="btn primary" disabled={!row || busy || !row.courseCode} title={row && !row.courseCode ? translateUI('ownCheck.chooseSubjectFirst') : undefined} onClick={() => row && onCheck(row)}>{busy ? translateUI('ownCheck.checking') : translateUI('ownCheck.check')}</StableButton>
        </div>
      </div>
    </section>
  );
}
