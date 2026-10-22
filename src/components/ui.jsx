import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useState, useEffect, useSyncExternalStore } from 'react';
import { resolveAvatar, subscribeAvatars } from '../lib/avatarStore';
import { API_ORIGIN } from '../lib/api';
import { Notebook } from '@phosphor-icons/react/dist/csr/Notebook';
import { ArrowUpRight } from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import { ArrowUUpLeft } from '@phosphor-icons/react/dist/csr/ArrowUUpLeft';
import { XCircle } from '@phosphor-icons/react/dist/csr/XCircle';
import { ChatCircleText } from '@phosphor-icons/react/dist/csr/ChatCircleText';
import { ClockCounterClockwise } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise';
import { SealCheck } from '@phosphor-icons/react/dist/csr/SealCheck';
import { HourglassMedium } from '@phosphor-icons/react/dist/csr/HourglassMedium';
import { NotePencil } from '@phosphor-icons/react/dist/csr/NotePencil';
import { ShieldCheck } from '@phosphor-icons/react/dist/csr/ShieldCheck';
import { GraduationCap } from '@phosphor-icons/react/dist/csr/GraduationCap';
import { PaperPlaneTilt } from '@phosphor-icons/react/dist/csr/PaperPlaneTilt';
import { UploadSimple } from '@phosphor-icons/react/dist/csr/UploadSimple';
import { SquaresFour } from '@phosphor-icons/react/dist/csr/SquaresFour';
import { SignOut } from '@phosphor-icons/react/dist/csr/SignOut';
import { PencilRuler } from '@phosphor-icons/react/dist/csr/PencilRuler';
import { Sparkle } from '@phosphor-icons/react/dist/csr/Sparkle';
import { GridFour } from '@phosphor-icons/react/dist/csr/GridFour';
import { Archive } from '@phosphor-icons/react/dist/csr/Archive';
import { ChartBar } from '@phosphor-icons/react/dist/csr/ChartBar';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { GearSix } from '@phosphor-icons/react/dist/csr/GearSix';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeSlash } from '@phosphor-icons/react/dist/csr/EyeSlash';
import { Envelope } from '@phosphor-icons/react/dist/csr/Envelope';
import { Bell } from '@phosphor-icons/react/dist/csr/Bell';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { Warning } from '@phosphor-icons/react/dist/csr/Warning';
import { FloppyDisk } from '@phosphor-icons/react/dist/csr/FloppyDisk';
import { CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { BellRinging } from '@phosphor-icons/react/dist/csr/BellRinging';
import { ProgramIcon, SubjectIcon, UnderReviewIcon, ApprovedIcon, ReviseIcon, BinIcon, PencilSquareIcon, DeniedIcon } from './customIcons';

export function Card({ title, action, onAction, children, hideScrollbar = false }) {
  return <div className="card"><div className="card-head"><h3>{title}</h3>{action && (onAction ? <button type="button" className="card-action" onClick={onAction}>{tr(action)}</button> : <span>{tr(action)}</span>)}</div><div className={hideScrollbar ? 'card-body scrollbar-hidden' : 'card-body'} {...(hideScrollbar ? { tabIndex: 0, role: 'region', 'aria-label': title } : {})}>{children}</div></div>;
}

export function Legend({ color, text, value, tip }) {
  return <div className="legend-row" data-tip={tip}><span className="legend-label"><i style={{ background: color }} />{text}</span><strong>{value}</strong></div>;
}

export function Progress({ label, value, tip }) {
  return <div className="progress-row" data-tip={tip}><div><span>{label}</span><b>{value}%</b></div><div className="bar"><i style={{ width: `${value}%` }} /></div></div>;
}

export function QualityMini({ label, value, pass = 79 }) {
  return <div className={'quality-mini' + (value >= pass ? ' pass' : '')}><div className="quality-ring" style={{ '--p': `${value * 3.6}deg` }}><span>{value}</span></div><span>{label}</span></div>;
}

export function Deadline({ day, mon, title, note }) {
  return <div className="deadline"><div><b>{day}</b><span>{tr(mon)}</span></div><p><strong>{title}</strong><small>{note}</small></p></div>;
}

export function Donut({ value, centerTop, centerBottom, tip }) {
  return <div className="donut" data-tip={tip} style={{ '--p': `${value * 3.6}deg` }}><div><strong>{centerTop}</strong><small>{tr(centerBottom)}</small></div></div>;
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

export function ChartCard({ title, subtitle, children }) {
  return <div className="chart-card"><div><h3>{title}</h3><p>{subtitle}</p></div>{children}</div>;
}

// With `onClick` the card is a button that takes the reader to the place the insight is about; `go` names that place.
export function Insight({ n, title, text, onClick, go }) {
  const body = <><span>{n}</span><div><strong>{title}</strong><p>{text}</p>{onClick && go && <small className="insight-go">{go} ›</small>}</div></>;
  return onClick ? <button type="button" className="insight insight-link" onClick={onClick}>{body}</button> : <div className="insight">{body}</div>;
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

// One icon set (Phosphor) for the whole UI. Only the icons listed here are bundled.
// Decorative by default (aria-hidden); pass `label` when the icon alone conveys meaning.
const ICONS = { signOut: SignOut, arrowUpRight: ArrowUpRight, arrowUUpLeft: ArrowUUpLeft, xCircle: XCircle, chatText: ChatCircleText, clockBack: ClockCounterClockwise, notebook: Notebook, sealCheck: SealCheck, hourglassMedium: HourglassMedium, notePencil: NotePencil, shieldCheck: ShieldCheck, graduationCap: GraduationCap, paperPlaneTilt: PaperPlaneTilt, uploadSimple: UploadSimple, squaresFour: SquaresFour, pencilRuler: PencilRuler, sparkle: Sparkle, gridFour: GridFour, archive: Archive, chartBar: ChartBar, downloadSimple: DownloadSimple, usersThree: UsersThree, gearSix: GearSix, caretRight: CaretRight, eye: Eye, eyeSlash: EyeSlash, envelope: Envelope, bell: Bell, magnifyingGlass: MagnifyingGlass, checkCircle: CheckCircle, warning: Warning, floppyDisk: FloppyDisk, calendarBlank: CalendarBlank, bellRinging: BellRinging, program: ProgramIcon, subject: SubjectIcon, underReview: UnderReviewIcon, approved: ApprovedIcon, revise: ReviseIcon, bin: BinIcon, pencilSquare: PencilSquareIcon, denied: DeniedIcon };
export function Icon({ name, size = 20, weight = 'duotone', label, className, ...rest }) {
  const Glyph = ICONS[name];
  if (!Glyph) return null;
  return <Glyph size={size} weight={weight} className={className} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' })} {...rest} />;
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
