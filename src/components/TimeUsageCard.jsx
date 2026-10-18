import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { t, getLocale } from '../i18n';
import { usage as usageApi } from '../lib/api';
import { usePeriodicRefresh } from '../lib/usePolling';
import { barLayout, formatDuration, shortDateLabel, weekdayLabel } from '../lib/timeUsage';
import StableButton from './StableButton';

const CHART_WIDTH = 280;
const CHART_HEIGHT = 84;

// The body of the dashboard's "Time Usage" card: how long the signed-in person was active in the system. It loads its own numbers
// (GET /api/usage/summary) and asks for nothing from the dashboard, so the card around it and the page's other data are untouched.
export default function TimeUsageCard() {
  const [days, setDays] = useState(7);
  const [state, setState] = useState({ status: 'loading' });
  const request = useRef(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    try {
      const data = await usageApi.summary(days);
      if (current !== request.current) return;
      setState(data.enabled === false ? { status: 'off' } : { status: 'ready', data });
    } catch {
      if (current !== request.current) return;
      setState((previous) => (previous.status === 'ready' ? previous : { status: 'error' }));   // keep showing the last numbers if a refresh fails
    }
  }, [days]);

  useEffect(() => {
    setState({ status: 'loading' });
    load();
    return () => { request.current++; };
  }, [load]);
  usePeriodicRefresh(true, load, 60000);

  const locale = getLocale();
  return (
    <div className="usage-host">
      <div className="usage">
        {state.status === 'loading' && <p className="usage-note" role="status">{t('dashboard.usage.loading')}</p>}
        {state.status === 'off' && <p className="usage-note">{t('dashboard.usage.off')}</p>}
        {state.status === 'error' && <div className="usage-note" role="alert">{t('dashboard.usage.error')} <StableButton type="button" className="btn outline" onClick={load}>{t('dashboard.usage.retry')}</StableButton></div>}
        {state.status === 'ready' && <Ready data={state.data} days={days} onDays={setDays} locale={locale} />}
      </div>
    </div>
  );
}

export function Ready({ data, days, onDays, locale }) {
  const tooltipId = useId();
  const bars = barLayout(data.days, { width: CHART_WIDTH, height: CHART_HEIGHT, gap: days === 30 ? 2 : 8, today: data.today });
  const summary = data.days.map((d) => `${weekdayLabel(d.date, locale)} ${shortDateLabel(d.date, locale)} ${formatDuration(d.seconds, locale)}`).join(', ');
  const ends = [data.days[0], data.days[Math.floor(data.days.length / 2)], data.days[data.days.length - 1]];
  return <>
    <div className="usage-top">
      <div className="usage-hero">
        <strong>{formatDuration(data.todaySeconds, locale)}</strong>
        <span>{t('dashboard.usage.today')}</span>
      </div>
      <div className="usage-range" role="group" aria-label={t('dashboard.usage.range')}>
        {[7, 30].map((n) => <button key={n} type="button" aria-pressed={days === n} className={days === n ? 'on' : undefined} onClick={() => onDays(n)}>{t('dashboard.usage.range' + n)}</button>)}
      </div>
    </div>
    {!data.hasData && <p className="usage-note">{t('dashboard.usage.empty')}</p>}
    <div className="usage-chart-wrap">
    <svg className="usage-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={t('dashboard.usage.chartLabel', { summary })}>
      {bars.map((b) => <rect key={b.date} x={b.x} y={b.y} width={b.width} height={b.height} rx="2" className={'usage-bar' + (b.isToday ? ' today' : '') + (b.empty ? ' empty' : '')}>
        <title>{`${weekdayLabel(b.date, locale)} ${shortDateLabel(b.date, locale)}: ${formatDuration(b.seconds, locale)}`}</title>
      </rect>)}
    </svg>
    <div className="usage-chart-controls" role="group" aria-label={t('dashboard.usage.selectDay')}>
      {bars.map(b => <button key={b.date} type="button" className="usage-day" style={{ left: `${b.x / CHART_WIDTH * 100}%`, width: `${b.width / CHART_WIDTH * 100}%` }} aria-label={`${weekdayLabel(b.date, locale)} ${shortDateLabel(b.date, locale)}: ${formatDuration(b.seconds, locale)}`} aria-describedby={`${tooltipId}-${b.date}`}>
        <span id={`${tooltipId}-${b.date}`} role="tooltip" className="usage-tooltip" data-align={b.x < CHART_WIDTH * 0.2 ? 'start' : b.x + b.width > CHART_WIDTH * 0.8 ? 'end' : 'center'} style={{ top: `${b.y / CHART_HEIGHT * 100}%` }}>{formatDuration(b.seconds, locale)}</span>
      </button>)}
    </div>
    </div>
    <div className={'usage-axis' + (days === 30 ? ' sparse' : '')} aria-hidden="true">
      {days === 30 ? ends.map((d) => <span key={d.date}>{shortDateLabel(d.date, locale)}</span>) : data.days.map((d) => <span key={d.date}>{weekdayLabel(d.date, locale)}</span>)}
    </div>
    <dl className="usage-stats">
      <div><dt>{t('dashboard.usage.avgSession')}</dt><dd>{formatDuration(data.avgSessionSeconds, locale)}</dd></div>
      <div><dt>{t('dashboard.usage.activeDays')}</dt><dd>{t('dashboard.usage.activeDaysValue', { active: data.activeDays, total: data.days.length })}</dd></div>
      <div><dt>{t('dashboard.usage.busiest')}</dt><dd>{data.busiest ? weekdayLabel(data.busiest.date, locale) + ' · ' + formatDuration(data.busiest.seconds, locale) : '—'}</dd></div>
    </dl>
    <p className="usage-foot">{t('dashboard.usage.note')}</p>
  </>;
}
