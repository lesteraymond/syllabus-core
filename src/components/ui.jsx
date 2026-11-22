import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useState, useEffect, useSyncExternalStore } from 'react';
import { resolveAvatar, subscribeAvatars } from '../lib/avatarStore';
import { API_ORIGIN } from '../lib/api';
import {
  Archive,
  ArrowUpRight,
  BarChart,
  Bell,
  BookClosed,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  ClockDashed,
  ClockRewind,
  CloudUpload,
  CornerUpLeft,
  CrossCircle,
  Download,
  Envelope,
  Eye,
  EyeOff,
  FileText,
  FloppyDisk,
  Globe,
  GridMasonry,
  GridSquare,
  Key,
  ListUnordered,
  Logout,
  MagnifyingGlass,
  Message,
  Notebook,
  Notification,
  PaperAirplane,
  PencilEdit,
  RefreshClockwise,
  SettingsGear,
  ShieldCheck,
  SignIn,
  Sparkles,
  StopCircle,
  Trash,
  User,
  Users,
  UserScreen,
  Warning,
} from 'geist-icons';

export function Card({ title, action, children, hideScrollbar = false }) {
  return <div className="card"><div className="card-head"><h3>{title}</h3>{action && <span>{tr(action)}</span>}</div><div className={hideScrollbar ? 'card-body scrollbar-hidden' : 'card-body'} {...(hideScrollbar ? { tabIndex: 0, role: 'region', 'aria-label': title } : {})}>{children}</div></div>;
}

export function Legend({ color, text, value }) {
  return <div className="legend-row"><span className="legend-label"><i style={{ background: color }} />{text}</span><strong>{value}</strong></div>;
}

// `value` is a percentage, or null when there is nothing to measure yet (shown as a dash with an empty bar). `note` is a small line under the bar.
export function Progress({ label, value, note }) {
  const known = Number.isFinite(value);
  return <div className="progress-row"><div><span>{label}</span><b>{known ? `${value}%` : '—'}</b></div><div className="bar"><i style={{ width: `${known ? value : 0}%` }} /></div>{note && <small className="progress-note">{note}</small>}</div>;
}

// `value` is 0-100, or null when no syllabus has a score for this area yet.
// low: the lowest of the areas shown (the AI Quality Snapshot marks where the score was lost)
export function QualityMini({ label, value, low = false, tone, title }) {
  const known = Number.isFinite(value);
  return <div className={'quality-mini' + (low ? ' low' : '') + (tone ? ' tone-' + tone : '')} title={title}><div className="quality-ring" style={{ '--p': `${known ? value * 3.6 : 0}deg` }}><span>{known ? value : '—'}</span></div><span>{label}</span></div>;
}

export function Deadline({ day, mon, title, note }) {
  return <div className="deadline"><div><b>{day}</b><span>{tr(mon)}</span></div><p><strong>{title}</strong><small>{note}</small></p></div>;
}

export function Donut({ value, centerTop, centerBottom }) {
  return <div className="donut" style={{ '--p': `${value * 3.6}deg` }}><div><strong>{centerTop}</strong><small>{tr(centerBottom)}</small></div></div>;
}

export function Field({ label, full, children }) {
  return <label className={full ? 'field full' : 'field'}><span>{label}</span>{children}</label>;
}

export function PageHead({ title, subtitle, actions }) {
  return <div className="page-head"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="page-actions">{actions}</div></div>;
}

export function Recommendation({ level, title, text }) {
  return <div className="recommend"><span className={`priority ${level.toLowerCase()}`}>{level}</span><div><strong>{tr(title)}</strong><p>{tr(text)}</p></div></div>;
}

// `action`: an optional control at the right of the title (the Chart / Table switch).
export function ChartCard({ title, subtitle, action, children }) {
  return <div className="chart-card"><div className="chart-card-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{action}</div>{children}</div>;
}

// Chart / Table: every chart on the Analytics page has a table with the same numbers (the same switch as the dashboard's View analytics).
export function ViewSwitch({ view, setView }) {
  return <div className="trend-seg chart-switch" role="tablist" aria-label={translateUI('trend.viewLabel')}>
    {['chart', 'table'].map((key) => <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? 'active' : ''} onClick={() => setView(key)}>{key === 'chart' ? translateUI('trend.chart') : translateUI('trend.table')}</button>)}
  </div>;
}

export function Insight({ n, title, text }) {
  return <div className="insight"><span>{n}</span><div><strong>{title}</strong><p>{text}</p></div></div>;
}

export function Toggle({ on, set, title, text, disabled }) {
  return <button type="button" disabled={disabled} className="toggle-row" onClick={() => set(!on)}><span><strong>{title}</strong><small>{text}</small></span><i className={on ? 'on' : ''}><b /></i></button>;
}

export function Assessment({ name, weight, cos }) {
  return <div className="assessment-item"><span className="drag">⋮⋮</span><div><strong>{name}</strong><small>{translateUI("ui.mapped_outcomes_f695cc")}{cos}</small></div><b>{weight}</b><button>•••</button></div>;
}

export function Policy({ title, text }) {
  return <div className="policy"><h3>{title}</h3><textarea defaultValue={text} /></div>;
}

// One icon set (Vercel Geist Iconography) for the whole UI. Only the icons listed here are bundled.
// Decorative by default (aria-hidden); pass `label` when the icon alone conveys meaning.
const ICONS = { signOut: Logout, arrowUpRight: ArrowUpRight, arrowUUpLeft: CornerUpLeft, xCircle: CrossCircle, chatText: Message, clockBack: ClockRewind, notebook: Notebook, sealCheck: CheckCircle, hourglassMedium: ClockDashed, notePencil: PencilEdit, shieldCheck: ShieldCheck, graduationCap: BookOpen, paperPlaneTilt: PaperAirplane, uploadSimple: CloudUpload, squaresFour: GridSquare, pencilRuler: PencilEdit, sparkle: Sparkles, gridFour: GridMasonry, archive: Archive, chartBar: BarChart, downloadSimple: Download, usersThree: Users, gearSix: SettingsGear, caretRight: ChevronRight, eye: Eye, eyeSlash: EyeOff, envelope: Envelope, bell: Bell, magnifyingGlass: MagnifyingGlass, checkCircle: CheckCircle, warning: Warning, floppyDisk: FloppyDisk, calendarBlank: Calendar, bellRinging: Notification, program: BookClosed, subject: ListUnordered, underReview: Clock, approved: CheckCircle, revise: RefreshClockwise, bin: Trash, pencilSquare: PencilEdit, denied: StopCircle, signIn: SignIn, key: Key, identificationCard: UserScreen, userCircle: User, translate: Globe, filePlus: FileText, trash: Trash };
export function Icon({ name, size = 18, weight, label, className, ...rest }) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;
  return <Glyph size={size} className={className} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' })} {...rest} />;
}

// Profile picture: shows the image, or the initials circle when there is no URL or it fails to load.
// `src` is an API path (/api/users/:id/avatar?v=...); the browser sends the session cookie with the <img> request,
// and the server answers 404 when the viewer isn't allowed to see it, which falls back to the initials.
const initialsOf = (name) => (name || '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
// `userId` is optional: without it the user is read from the URL itself. The picture shown is the newest one known for that user (see lib/avatarStore.js).
export function Avatar({ src, name, initials, className = 'avatar', userId }) {
  const [failed, setFailed] = useState(false);
  const current = () => resolveAvatar(userId, src);
  const shown = useSyncExternalStore(subscribeAvatars, current, current);
  useEffect(() => { setFailed(false); }, [shown]);
  const url = shown && shown.startsWith('/') ? `${API_ORIGIN}${shown}` : shown;
  if (url && !failed) return <img className={className} src={url} alt={name} onError={() => setFailed(true)} />;
  return <span className={className}>{initials ?? initialsOf(name)}</span>;
}
