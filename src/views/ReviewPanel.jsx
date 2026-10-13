import { useState } from 'react';
import { Icon } from '../components/ui';
import ChatThread from '../components/ChatThread';
import CommentsThread from './CommentsThread';
import { DECISIONS, canDecide, checkDecision } from '../lib/reviewView';
import { STATUS_LABELS } from '../lib/syllabusRules';

// The reviewer's panel beside an open syllabus: decide (approve, return for revision, reject), comment, and message the faculty member.
// Decisions go through the same handleStatus the page always used, and each asks for a second click to confirm. Returning for revision
// and rejecting need a reason (the server insists on it too). When a decision goes through, `onDecided` closes the window.
export default function ReviewPanel({ syllabus, user, messages, handleStatus, sendMsg, markRead, onDecided, onHistory }) {
  const [tab, setTab] = useState('decision');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(null); // 'approve' | 'revise' | 'reject' | null
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const decidable = canDecide(syllabus.status);
  const unread = messages.filter((m) => m.syllabusId === syllabus.id && m.receiverId === user.id && !m.isRead).length;

  const ask = (key) => {
    const missing = checkDecision(key, note);
    setProblem(missing);
    setConfirming(missing ? null : key);
  };
  const confirm = async () => {
    if (!confirming || busy) return;
    setBusy(true);
    const ok = await handleStatus(syllabus.id, DECISIONS[confirming].status, note.trim());
    setBusy(false);
    if (ok) { if (onDecided) onDecided(); } else setConfirming(null); // handleStatus already told the reviewer what went wrong
  };
  const tabs = [['decision', 'Decision', 'sealCheck'], ['comments', 'Comments', 'notePencil'], ['messages', 'Messages', 'chatText']];

  return (
    <div className="rp">
      <div className="rp-tabs" role="tablist" aria-label="Review">
        {tabs.map(([key, label, icon]) => (
          <button type="button" key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            <Icon name={icon} size={18} /><span>{label}</span>
            {key === 'messages' && unread > 0 && <span className="rp-count" aria-label={unread + ' unread'}>{unread}</span>}
          </button>
        ))}
      </div>

      {tab === 'decision' && (
        <div className="rp-pane">
          <p className={'rp-status ' + (decidable ? 'waiting' : 'done')}>
            <Icon name={decidable ? 'hourglassMedium' : 'checkCircle'} size={20} />
            <span>{decidable ? 'Waiting for your decision' : 'This syllabus is ' + (STATUS_LABELS[syllabus.status] || syllabus.status).toLowerCase() + '. There is nothing to decide.'}</span>
          </p>
          <label className="rp-note"><span>Note to the faculty member</span>
            <textarea rows={5} maxLength={2000} value={note} disabled={!decidable || busy} onChange={(e) => { setNote(e.target.value); setProblem(''); setConfirming(null); }} placeholder="Optional for approval. Required to return for revision or reject." />
          </label>
          {problem && <div className="info-banner warning" role="alert">{problem}</div>}
          {confirming && (
            <div className={'rp-confirm ' + confirming} role="alertdialog" aria-label="Confirm decision">
              <p><Icon name={DECISIONS[confirming].icon} size={22} /><span>{DECISIONS[confirming].confirm}</span></p>
              <div><button type="button" className="rp-cancel" disabled={busy} onClick={() => setConfirming(null)}>Cancel</button><button type="button" className="rp-go" autoFocus disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Confirm'}</button></div>
            </div>
          )}
          {!confirming && (
            <div className="rp-actions">
              {Object.entries(DECISIONS).map(([key, d]) => (
                <button type="button" key={key} className={'act act-' + key} disabled={!decidable || busy} onClick={() => ask(key)}>
                  <Icon name={d.icon} size={24} />
                  <span><strong>{d.label}</strong><small>{d.hint}</small></span>
                </button>
              ))}
            </div>
          )}
          {onHistory && <button type="button" className="rp-link" onClick={onHistory}><Icon name="clockBack" size={16} />Revision history</button>}
        </div>
      )}

      {tab === 'comments' && <div className="rp-pane"><CommentsThread syllabusId={syllabus.id} canWrite={user.role === 'admin'} /></div>}

      {tab === 'messages' && (
        <div className="rp-pane rp-chat">
          <ChatThread code={syllabus.id} syl={syllabus} user={user} messages={messages} sendMsg={sendMsg} markRead={markRead} />
        </div>
      )}
    </div>
  );
}
