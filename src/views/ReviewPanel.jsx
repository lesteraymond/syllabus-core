import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useState } from 'react';
import { Icon } from '../components/ui';
import ChatThread from '../components/ChatThread';
import CommentsThread from './CommentsThread';
import { DECISIONS, canDecide, checkDecision } from '../lib/reviewView';
import { STATUS_LABELS } from '../lib/syllabusRules';

// Each decision is drawn with the system button that already says what it is: success (go ahead), outline (send back), danger (close).
const ACT_BUTTON = { approve: 'success', revise: 'outline', reject: 'danger' };

// The reviewer's panel beside an open syllabus: decide (approve, return for revision, reject), comment, and message the faculty member.
// Decisions go through the same handleStatus the page always used, and each asks for a second click to confirm. Returning for revision
// and rejecting need a reason (the server insists on it too). When a decision goes through, `onDecided` closes the window.
export default function ReviewPanel({ syllabus, user, messages, handleStatus, sendMsg, markRead, onDecided, onHistory, onOpenChecker }) {
  const [tab, setTab] = useState('decision');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(null); // 'approve' | 'revise' | 'reject' | null
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const unchecked = !!syllabus.awaitingAiCheck; // not checked in the AI Checker yet: the server refuses a decision until it is
  const decidable = canDecide(syllabus.status) && !unchecked;
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
      <div className="rp-tabs" role="tablist" aria-label={translateUI("ui.review_e29a79")}>
        {tabs.map(([key, label, icon]) => (
          <button type="button" key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            <Icon name={icon} size={18} /><span>{tr(label)}</span>
            {key === 'messages' && unread > 0 && <span className="rp-count" aria-label={unread + translateUI("ui.unread_2630a7")}>{unread}</span>}
          </button>
        ))}
      </div>

      {tab === 'decision' && (
        <div className="rp-pane">
          {unchecked && canDecide(syllabus.status) && (
            <div className="info-banner warning rp-check-first" role="status">
              <span>{translateUI("ui.this_submission_has_not_been_checked_in_the_ai_checker_yet_check__0291cf")}</span>
              {onOpenChecker && <StableButton type="button" className="btn outline" onClick={onOpenChecker}>{translateUI("ui.open_the_ai_checker_ea8956")}</StableButton>}
            </div>
          )}
          {!decidable && !unchecked && (
            <p className="rp-status done">
              <Icon name="checkCircle" size={20} />
              <span>{translateUI("ui.this_syllabus_is_b75bb9") + tr(STATUS_LABELS[syllabus.status] || syllabus.status).toLowerCase() + translateUI("ui.there_is_nothing_to_decide_e4fd66")}</span>
            </p>
          )}
          <label className="rp-note"><span>{translateUI("ui.note_to_the_faculty_member_07d0ce")}</span>
            <textarea rows={5} maxLength={2000} value={note} disabled={!decidable || busy} onChange={(e) => { setNote(e.target.value); setProblem(''); setConfirming(null); }} placeholder={translateUI("ui.optional_for_approval_required_to_return_for_revision_or_reject_ce4884")} />
          </label>
          {problem && <div className="info-banner warning" role="alert">{tr(problem)}</div>}
          {confirming && (
            <div className={'rp-confirm ' + confirming} role="alertdialog" aria-label={translateUI("ui.confirm_decision_a3ca00")}>
              <p><Icon name={DECISIONS[confirming].icon} size={22} /><span>{tr(DECISIONS[confirming].confirm)}</span></p>
              <div><button type="button" className="rp-cancel" disabled={busy} onClick={() => setConfirming(null)}>{translateUI("ui.cancel_77dfd2")}</button><button type="button" className="rp-go" autoFocus disabled={busy} onClick={confirm}>{busy ? translateUI("ui.saving_56a228") : translateUI("ui.confirm_04a212")}</button></div>
            </div>
          )}
          {!confirming && (
            <div className="rp-actions">
              {Object.entries(DECISIONS).map(([key, d]) => (
                <button type="button" key={key} className={'btn act act-' + key + ' ' + ACT_BUTTON[key]} disabled={!decidable || busy} onClick={() => ask(key)}>
                  <Icon name={d.icon} size={24} />
                  <span><strong>{tr(d.label)}</strong></span>
                </button>
              ))}
            </div>
          )}
          {onHistory && <button type="button" className="rp-link" onClick={onHistory}><Icon name="clockBack" size={16} />{translateUI("ui.revision_history_b9d26d")}</button>}
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
