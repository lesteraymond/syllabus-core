import { useEffect, useRef, useState } from 'react';
import CatalogModalPortal from './CatalogModalPortal';
import StableButton from './StableButton';
import Select from './Select';
import DatePicker from './DatePicker';
import { Icon } from './ui';
import { useModalLayer } from './useModalLayer';
import { useActionExit } from '../lib/catalogMotion';
import { deadlines as deadlinesApi } from '../lib/api';
import { t, tr } from '../i18n';
import { phDate, phDateTime } from '../lib/phTime';
import { CURRENT_SCHOOL_YEAR } from '../lib/schoolYear';
import { SEMESTERS, SEMESTER_KEYS, chipTone, currentDeadline, reminderToast, fromDayValue, fromInputValue, schoolYearOptions, splitTerm, submittedCount, termOf, toDayValue, toInputValue } from '../lib/deadlineView';

// The administrator's side of subject deadlines, in the Subjects table. A chip in each row shows the subject's deadline and how many of its
// assigned faculty have submitted; clicking it opens a dialog to set or change the deadline and to see each faculty member's status.
// The rules and the numbers come from the server (server/lib/deadlines.js); this only shows them and sends the form.

const termDisplay = (term) => {
  const parts = splitTerm(term);
  return parts ? parts.schoolYear + ' · ' + (SEMESTER_KEYS[parts.semester] ? t(SEMESTER_KEYS[parts.semester]) : parts.semester) : term;
};

// The row's chip. The row itself opens the subject on click or Enter, so the chip keeps its own clicks and keys to itself.
export function DeadlineChip({ subject, deadline, onOpen }) {
  const own = { onClick: (e) => { e.stopPropagation(); onOpen(); }, onKeyDown: (e) => e.stopPropagation() };
  if (!deadline) {
    return <button type="button" className="dl-chip tone-set" aria-label={t('deadline.chipSet', { code: subject.code })} {...own}>
      <Icon name="calendarBlank" size={16} weight="regular" /><span>{t('deadline.set')}</span>
    </button>;
  }
  const tone = chipTone(deadline);
  const summary = tone === 'none' ? t('deadline.chipNobody') : tone === 'done' ? t('deadline.chipSettled') : t('deadline.chipProgress', { done: submittedCount(deadline.summary), total: deadline.summary.total });
  return <button type="button" className={'dl-chip tone-' + tone} aria-label={t('deadline.chipLabel', { code: subject.code, summary: phDate(deadline.dueAt) + ', ' + summary })} {...own}>
    <Icon name="calendarBlank" size={16} weight="regular" />
    <span className="dl-chip-main"><b>{phDate(deadline.dueAt)}</b><small>{summary}</small></span>
  </button>;
}

const years = () => schoolYearOptions(CURRENT_SCHOOL_YEAR.startYear);
const blankForm = () => ({ schoolYear: years()[1], semester: SEMESTERS[0], dueAt: '', opensAt: toDayValue(new Date().toISOString()), instructions: '' });
function formOf(deadline) {
  if (!deadline) return blankForm();
  const parts = splitTerm(deadline.term) || { schoolYear: years()[1], semester: SEMESTERS[0] };
  return { schoolYear: parts.schoolYear, semester: parts.semester, dueAt: toInputValue(deadline.dueAt), opensAt: toDayValue(deadline.opensAt), instructions: deadline.instructions || '' };
}

// Each assigned faculty member with their status, and a Remind button for those who have not submitted (the notification and an email).
const PENDING = ['upcoming', 'due_today', 'failed'];
export function DeadlineProgress({ state, onRemind, reminding = false, message = '' }) {
  const pending = state.status === 'ready' ? state.data.people.filter((p) => PENDING.includes(p.status)) : [];
  return <section className="dl-progress" aria-live="polite">
    <div className="dl-progress-head">
      <h4>{t('deadline.progress')}</h4>
      {state.status === 'ready' && <StableButton type="button" className="btn outline" disabled={reminding || !pending.length} onClick={() => onRemind([])}>
        <Icon name="bellRinging" size={16} weight="regular" />{' '}{t('deadline.remindAll')}</StableButton>}
    </div>
    {message && <p className="hint" role="status">{message}</p>}
    {state.status === 'loading' && <p className="hint" role="status">{t('deadline.loading')}</p>}
    {state.status === 'error' && <p className="form-error" role="alert">{t('deadline.loadError')}</p>}
    {state.status === 'ready' && <>
      <dl className="dl-stats">
        {['submitted', 'late', 'waiting', 'failed'].map((key) => <div key={key} className={'is-' + key}><dt>{t('deadline.stat.' + key)}</dt><dd>{state.data.summary[key]}</dd></div>)}
      </dl>
      {state.data.unassigned && <p className="hint">{t('deadline.unassigned')}</p>}
      {state.data.settled && <p className="dl-settled" role="status">{t('deadline.settledNote')}</p>}
      <ul className="dl-people">
        {state.data.people.map((p) => <li key={p.userId}>
          <span className="dl-name">{p.name}</span>
          <span className={'status dl-' + p.status}>{t('deadline.status.' + p.status)}</span>
          {PENDING.includes(p.status)
            ? <button type="button" className="icon-btn dl-remind" disabled={reminding} title={t('deadline.remind')} aria-label={t('deadline.remindLabel', { name: p.name })} onClick={() => onRemind([p.userId])}><Icon name="bellRinging" size={18} weight="regular" /></button>
            : <span />}
          <small>{p.submittedAt ? t('deadline.submittedOn', { date: phDateTime(p.submittedAt) }) : t('deadline.notSubmitted')}{p.lastNoticeAt && PENDING.includes(p.status) ? ' · ' + t('deadline.lastReminded', { date: phDateTime(p.lastNoticeAt) }) : ''}</small>
        </li>)}
      </ul>
    </>}
  </section>;
}

export function DeadlineDialog({ subject, deadlines, onClose, onChanged, onReminded }) {
  const dialog = useRef(null);
  const inFlight = useRef(false);
  const motion = useActionExit(dialog);
  const first = currentDeadline(deadlines);
  const [selected, setSelected] = useState(first ? first.id : 'new');
  const chosen = deadlines.find((d) => d.id === selected) || null;
  const [form, setForm] = useState(() => formOf(first));
  const [progress, setProgress] = useState({ status: 'loading' });
  const [reload, setReload] = useState(0);              // bumped after a reminder, so the list shows who was just reminded
  const [reminding, setReminding] = useState(false);
  const [remindMessage, setRemindMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const close = () => { if (!inFlight.current) motion.dismiss(onClose); };
  useModalLayer(dialog, close);

  useEffect(() => {
    if (selected === 'new') return undefined;
    let live = true;
    setProgress((previous) => (previous.status === 'ready' ? previous : { status: 'loading' }));
    deadlinesApi.progress(selected)
      .then((data) => { if (live) setProgress(data.enabled === false ? { status: 'error' } : { status: 'ready', data }); })
      .catch(() => { if (live) setProgress({ status: 'error' }); });
    return () => { live = false; };
  }, [selected, reload]);

  const choose = (value) => {
    setError(''); setConfirmCancel(false); setRemindMessage(''); setProgress({ status: 'loading' });
    const id = value === 'new' ? 'new' : Number(value);
    setSelected(id);
    setForm(formOf(deadlines.find((d) => d.id === id) || null));
  };
  const change = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const run = async (work, kind) => {
    if (inFlight.current || motion.isClosing()) return;
    inFlight.current = true; setBusy(true); setError('');
    try { const answer = await work(); await motion.dismiss(() => onChanged(kind, answer && answer.notices)); }
    catch (e) { setError(tr(e.message)); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const save = (event) => {
    event.preventDefault();
    const dueAt = fromInputValue(form.dueAt);
    if (!dueAt) { setError(t('deadline.invalidDue')); return; }
    const body = { term: termOf(form.schoolYear, form.semester), dueAt, opensAt: fromDayValue(form.opensAt) || undefined, instructions: form.instructions };
    run(() => (selected === 'new' ? deadlinesApi.create(subject.id, body) : deadlinesApi.update(selected, body)).then(checked), 'saved');
  };
  const remind = async (userIds) => {
    if (reminding || inFlight.current) return;
    setReminding(true); setRemindMessage('');
    try {
      const answer = await deadlinesApi.remind(selected, userIds);
      if (answer && answer.enabled === false) throw new Error(t('deadline.notSetUp'));
      const skipped = (answer.skipped || []).length;
      setRemindMessage(answer.sent ? t('deadline.remindDone', { sent: answer.sent, emailed: answer.emailed }) + (skipped ? ' ' + t('deadline.remindSkipped', { count: skipped }) : '')
        : skipped ? t('deadline.remindSkipped', { count: skipped }) : t('deadline.remindNobody'));
      setReload((n) => n + 1);
      if (onReminded) { const toast = reminderToast(answer, progress.status === 'ready' ? progress.data.people.filter((p) => userIds.includes(p.userId)).map((p) => p.name) : []); onReminded(t(toast.key, toast.values)); }
    } catch (e) { setRemindMessage(e && e.message ? tr(e.message) : t('deadline.remindFailed')); }
    finally { setReminding(false); }
  };
  const checked = (answer) => { if (answer && answer.enabled === false) throw new Error(t('deadline.notSetUp')); return answer; };
  const cancel = () => {
    if (!confirmCancel) { setConfirmCancel(true); return; }
    run(() => deadlinesApi.cancel(selected).then(checked), 'cancelled');
  };

  return <CatalogModalPortal><div className="overlay overlay-confirm catalog-overlay bld2 catalog-page" onClick={close}>
    <section className="modal confirm-modal program-dialog dl-dialog catalog-surface" role="dialog" aria-modal="true" aria-labelledby="deadline-dialog-title" aria-describedby="deadline-dialog-description"
      tabIndex={-1} ref={dialog} onClick={(event) => event.stopPropagation()} aria-busy={busy} inert={motion.closing || undefined}>
      <h3 id="deadline-dialog-title">{t('deadline.dialogTitle', { code: subject.code })}</h3>
      <p id="deadline-dialog-description">{t('deadline.dialogNote')}</p>
      <form onSubmit={save}>
        {deadlines.length > 0 && <label className="field dl-term"><span>{t('deadline.term')}</span>
          <Select value={String(selected)} disabled={busy} onChange={(e) => choose(e.target.value)}>
            {deadlines.map((d) => <option key={d.id} value={String(d.id)}>{termDisplay(d.term)}</option>)}
            <option value="new">{t('deadline.newTerm')}</option>
          </Select>
        </label>}
        <div className="program-edit-fields dl-fields">
          <label className="field"><span>{t('deadline.schoolYear')}</span>
            <Select value={form.schoolYear} disabled={busy} onChange={(e) => change('schoolYear', e.target.value)}>
              {[...new Set([...years(), form.schoolYear])].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </label>
          <label className="field"><span>{t('deadline.semester')}</span>
            <Select value={form.semester} disabled={busy} onChange={(e) => change('semester', e.target.value)}>
              {SEMESTERS.map((s) => <option key={s} value={s}>{t(SEMESTER_KEYS[s])}</option>)}
            </Select>
          </label>
        </div>
        <label className="field"><span>{t('deadline.dueAt')}</span>
          <DatePicker type="datetime-local" value={form.dueAt} required disabled={busy} onChange={(e) => change('dueAt', e.target.value)} />
        </label>
        <label className="field"><span>{t('deadline.instructions')}</span>
          <textarea rows={3} maxLength={1000} value={form.instructions} disabled={busy} onChange={(e) => change('instructions', e.target.value)} />
        </label>
        <details className="dl-advanced">
          <summary>{t('deadline.advanced')}</summary>
          <label className="field"><span>{t('deadline.opensAt')}</span>
            <DatePicker type="date" value={form.opensAt} disabled={busy} onChange={(e) => change('opensAt', e.target.value)} />
            <small className="hint">{t('deadline.opensHint')}</small>
          </label>
        </details>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="confirm-actions">
          <StableButton type="button" className="btn outline" disabled={busy || motion.closing} onClick={close}>{t('deadline.close')}</StableButton>
          {chosen && <StableButton type="button" className="btn danger" disabled={busy || motion.closing} onClick={cancel}>{confirmCancel ? t('deadline.cancelConfirm') : t('deadline.cancelDeadline')}</StableButton>}
          <StableButton type="submit" className="btn primary" disabled={busy || motion.closing}>{busy ? t('ui.saving_56a228') : t('deadline.save')}</StableButton>
        </div>
      </form>
      {chosen && <DeadlineProgress state={progress} onRemind={remind} reminding={reminding} message={remindMessage} />}
    </section>
  </div></CatalogModalPortal>;
}
