import { useMemo, useRef, useState } from 'react';
import { Avatar } from './ui';
import ChatThread, { threadOf } from './ChatThread';
import { useModalLayer } from './useModalLayer';
import { DRAFT_CHAT_NOTE, canChat, partnerOf } from '../lib/chatPartner';

export default function ChatModal({ code, syllabi, user, messages, partner: serverPartner, sendMsg, markRead, deleteThread, onClose }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const dialog = useRef(null);
  useModalLayer(dialog, onClose);
  const syl = syllabi.find(s => s.id === code || s.courseCode === code);
  const thread = useMemo(() => threadOf(messages, code, syl), [messages, code, syl]);
  // Who this is with: the server's profile of them (known before anyone has written), else what the messages and the syllabus say.
  const partner = useMemo(() => partnerOf({ partner: serverPartner, messages: thread, user, syl }), [serverPartner, thread, user, syl]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal chat-modal" role="dialog" aria-modal="true" aria-label="Messages" tabIndex={-1} ref={dialog} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="chat-head-info"><Avatar className="chat-av" src={partner?.avatarUrl} name={partner?.name} initials={partner?.initials || '?'} /><div><h3>{partner?.name || 'Unknown'}{partner?.roleLabel && <span className="chat-role">{partner.roleLabel}</span>}</h3>{(partner?.program || partner?.subject) ? <small>{[partner.program, partner.subject].filter(Boolean).join(' · ')}</small> : <small>Syllabus: {syl?.courseCode} • {syl?.title}</small>}</div></div>
          <div className="chat-head-actions"><button className="icon-btn" title="Delete conversation" onClick={() => setConfirmDel(true)}>🗑</button><button className="icon-btn" onClick={onClose}>✕</button></div>
        </div>
        {confirmDel && <div className="chat-del-confirm"><span>Delete all messages? This cannot be undone.</span><button className="btn ghost" onClick={() => setConfirmDel(false)}>Cancel</button><button className="btn danger" onClick={() => { deleteThread(code); onClose(); }}>Delete</button></div>}
        {syl && !canChat(syl)
          ? <div className="chat-empty chat-draft" role="status">{DRAFT_CHAT_NOTE}</div>
          : <ChatThread code={code} syl={syl} user={user} messages={messages} sendMsg={sendMsg} markRead={markRead} />}
      </div>
    </div>
  );
}
