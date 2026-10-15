// Presentation helpers for the dashboard's time-usage card. Pure, so they are tested without React or a browser.

// "2h 14m", "45m", "<1m", "0m". Units come from Intl, so they follow the language (en: "2h 14m").
export function formatDuration(seconds, locale = 'en') {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total === 0) return unit(0, 'minute', locale);
  if (total < 60) return '<' + unit(1, 'minute', locale);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (!hours) return unit(minutes, 'minute', locale);
  return minutes ? unit(hours, 'hour', locale) + ' ' + unit(minutes, 'minute', locale) : unit(hours, 'hour', locale);
}
function unit(value, name, locale) {
  try { return new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'narrow' }).format(value); }
  catch { return value + (name === 'hour' ? 'h' : 'm'); }
}

// 'YYYY-MM-DD' -> a Date at local midnight of that same calendar day (never shifted by the time zone).
export function dayOf(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export const weekdayLabel = (date, locale = 'en') => dayOf(date).toLocaleDateString(locale, { weekday: 'short' });
export const shortDateLabel = (date, locale = 'en') => dayOf(date).toLocaleDateString(locale, { month: 'short', day: 'numeric' });

// Bars for the chart. The scale is the busiest day, but never less than `floor` seconds, so a few minutes does not look like a full day.
// A day with no time still gets a thin stub, so the row of days reads as a row.
export function barLayout(days, { width = 280, height = 96, gap = 6, floor = 900, stub = 2, today = null } = {}) {
  if (!days.length) return [];
  const peak = Math.max(floor, ...days.map((d) => d.seconds));
  const barWidth = Math.max(1, (width - gap * (days.length - 1)) / days.length);
  return days.map((d, i) => {
    const h = d.seconds > 0 ? Math.max(stub, Math.round((d.seconds / peak) * height)) : stub;
    return { date: d.date, seconds: d.seconds, x: Math.round((i * (barWidth + gap)) * 100) / 100, y: height - h, width: Math.round(barWidth * 100) / 100, height: h, isToday: d.date === today, empty: d.seconds === 0 };
  });
}
