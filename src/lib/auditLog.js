// Pure helpers for the Admin Audit Log view: categorising log actions, filtering rows, and building a CSV export.
import { describeActivity } from './activityView.js';
import { phDate, phTime } from './phTime.js';

const SECURITY_ACTIONS = new Set(['login', 'logout', 'login_failed', 'password_change', 'terms_accept']);
const ACCOUNT_ACTIONS = new Set(['user_create', 'user_credentials', 'user_disable', 'user_enable', 'user_delete', 'user_assignments', 'name_change', 'photo_change', 'language_change']);

export function categoryOfAction(action) {
  if (SECURITY_ACTIONS.has(action)) return 'security';
  if (ACCOUNT_ACTIONS.has(action)) return 'account';
  return 'syllabus';
}

export function shapeAuditRow(log, index = 0, viewerId = null) {
  const item = describeActivity(log, index, viewerId);
  return {
    ...item,
    action: (log && log.action) || '',
    actor: String((log && log.user) || '').trim() || 'Deleted account',
    category: categoryOfAction(log && log.action),
    date: phDate(item.when),
    rawNotes: String((log && log.notes) || '').trim(),
  };
}

export function filterAuditRows(rows, { category = 'all', query = '' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return (rows || []).filter((r) => {
    if (category && category !== 'all' && r.category !== category) return false;
    if (!q) return true;
    const hay = [r.actor, r.verb, r.subject, r.detail, r.note, r.action, r.date, r.time].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function csvCell(value) {
  let s = String(value == null ? '' : value).replace(/\r?\n/g, ' ');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralize spreadsheet formula injection
  return /[",]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function buildAuditCsv(rows) {
  const header = ['Date', 'Time', 'Actor', 'Category', 'Action', 'Target', 'Details'];
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows || []) {
    const details = [r.detail, r.note].filter(Boolean).join(' - ');
    lines.push([
      r.date || '',
      r.time || phTime(r.when) || '',
      r.actor || '',
      r.category || '',
      r.verb || r.action || '',
      r.subject || '',
      details,
    ].map(csvCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}
