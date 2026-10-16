import { useCallback, useEffect, useState } from 'react';
import { t, getLocale } from '../i18n';
import { deadlines as deadlinesApi } from '../lib/api';
import { usePeriodicRefresh } from '../lib/usePolling';
import { phDateTime } from '../lib/phTime';
import { chipTone, dueParts, sortForAdmin, sortForFaculty, submittedCount } from '../lib/deadlineView';

// The body of the dashboard's "Upcoming Deadlines" card, with the real deadlines (they used to be fixed sample entries).
//   faculty        their own subjects: the due date, and their status for each (upcoming, due today, failed to submit, submitted, submitted late)
//   administrator  every active deadline: how many assigned faculty have submitted, and how many failed
// The most urgent come first. It asks for nothing from the dashboard; clicking a row goes to the page where the deadline is handled.
const MAX_ROWS = 12;

export default function UpcomingDeadlines({ role, onOpen }) {
  const faculty = role === 'faculty';
  const [state, setState] = useState({ status: 'loading' });
  const load = useCallback(async () => {
    try {
      const answer = await (faculty ? deadlinesApi.mine() : deadlinesApi.list());
      setState(answer.enabled === false ? { status: 'off' } : { status: 'ready', list: answer.deadlines || [] });
    } catch {
      setState((previous) => (previous.status === 'ready' ? previous : { status: 'error' }));
    }
  }, [faculty]);
  useEffect(() => { load(); }, [load]);
  usePeriodicRefresh(true, load, 60000);

  if (state.status === 'loading') return <p className="usage-note" role="status">{t('deadline.loading')}</p>;
  if (state.status === 'off') return <p className="usage-note">{t('deadline.cardOff')}</p>;
  if (state.status === 'error') return <p className="usage-note" role="alert">{t('deadline.loadError')}</p>;
  if (!state.list.length) return <p className="usage-note">{t(faculty ? 'deadline.cardEmptyFaculty' : 'deadline.cardEmptyAdmin')}</p>;

  return <DeadlineRows list={state.list} faculty={faculty} onOpen={onOpen} />;
}

// The rows themselves, most urgent first. Separate from the loading so it can be shown, and tested, with a list in hand.
export function DeadlineRows({ list, faculty, onOpen }) {
  const locale = getLocale();
  const rows = (faculty ? sortForFaculty(list) : sortForAdmin(list)).slice(0, MAX_ROWS);
  return <>{rows.map((d) => {
    const { day, month } = dueParts(d.dueAt, locale);
    const failed = !faculty && d.summary.failed > 0;
    return <button key={d.id} type="button" className={'deadline dl-row' + (failed || d.status === 'failed' ? ' is-failed' : '')} onClick={() => onOpen(d)}>
      <div><b>{day}</b><span>{month}</span></div>
      <p>
        <strong>{d.course.code}{' · '}{d.course.title}</strong>
        <small>
          {faculty
            ? <><span className={'status dl-' + d.status}>{t('deadline.status.' + d.status)}</span>{' '}{t('deadline.dueOn', { date: phDateTime(d.dueAt) })}</>
            : <>{chipTone(d) === 'none' ? t('deadline.chipNobody') : chipTone(d) === 'done' ? <span className="status dl-submitted">{t('deadline.chipSettled')}</span> : t('deadline.chipProgress', { done: submittedCount(d.summary), total: d.summary.total })}
              {failed && <>{' '}<span className="status dl-failed">{t('deadline.failedCount', { count: d.summary.failed })}</span></>}</>}
        </small>
      </p>
    </button>;
  })}</>;
}
