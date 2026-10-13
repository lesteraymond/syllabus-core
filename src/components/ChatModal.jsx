import { useMemo, useRef, useState } from 'react';
import { Avatar } from './ui';
import ChatThread, { threadOf } from './ChatThread';
import { useModalLayer } from './useModalLayer';

export default function ChatModal({ code, syllabi, user, messages, sendMsg, markRead, deleteThread, onClose }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const dialog = useRef(null);
  useModalLayer(dialog, onClose);
  const syl = syllabi.find(s => s.id === code || s.courseCode === code);
  const thread = useMemo(() => threadOf(messages, code, syl), [messages, code, syl]);
  const partner = useMemo(() => {
    if (!thread.length) return null;
    const otherMsg = thread.find(m => m.senderId !== user.id);
    if (otherMsg) return { name: otherMsg.sender, initials: otherMsg.sender?.split(' ').map(w => w[0]).join('') || '?', avatarUrl: otherMsg.senderAvatarUrl };
    return { name: syl?.faculty || 'Unknown', initials: syl?.faculty?.split(' ').map(w => w[0]).join('') || '?', avatarUrl: user.role === 'admin' ? syl?.ownerAvatarUrl : null };
  }, [thread, user, syl]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal chat-modal" role="dialog" aria-modal="true" aria-label="Messages" tabIndex={-1} ref={dialog} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="chat-head-info"><Avatar className="chat-av" src={partner?.avatarUrl} name={partner?.name} initials={partner?.initials || '?'} /><div><h3>{partner?.name || 'Unknown'}</h3><small>Syllabus: {syl?.courseCode} • {syl?.title}</small></div></div>
          <div className="chat-head-actions"><button className="icon-btn" title="Delete conversation" onClick={() => setConfirmDel(true)}>🗑</button><button className="icon-btn" onClick={onClose}>✕</button></div>
        </div>
        {confirmDel && <div className="chat-del-confirm"><span>Delete all messages? This cannot be undone.</span><button className="btn ghost" onClick={() => setConfirmDel(false)}>Cancel</button><button className="btn danger" onClick={() => { deleteThread(code); onClose(); }}>Delete</button></div>}
        <ChatThread code={code} syl={syl} user={user} messages={messages} sendMsg={sendMsg} markRead={markRead} />
      </div>
    </div>
  );
}
