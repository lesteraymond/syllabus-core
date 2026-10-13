import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from './ui';

export default function ChatModal({ code, syllabi, user, messages, sendMsg, markRead, deleteThread, onClose }) {
  const [input, setInput] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const ref = useRef(null);
  const syl = syllabi.find(s => s.id === code || s.courseCode === code);
  const thread = useMemo(() => messages.filter(m => m.syllabusId === code || m.syllabusId === syl?.id).sort((a, b) => new Date(a.time) - new Date(b.time)), [messages, code, syl]);
  const partner = useMemo(() => {
    if (!thread.length) return null;
    const otherMsg = thread.find(m => m.senderId !== user.id);
    if (otherMsg) return { name: otherMsg.sender, initials: otherMsg.sender?.split(' ').map(w => w[0]).join('') || '?', avatarUrl: otherMsg.senderAvatarUrl };
    return { name: syl?.faculty || 'Unknown', initials: syl?.faculty?.split(' ').map(w => w[0]).join('') || '?', avatarUrl: user.role === 'admin' ? syl?.ownerAvatarUrl : null };
  }, [thread, user, syl]);
  useEffect(() => { markRead(code); }, [code, thread.length]);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread]);
  const send = (e) => { e.preventDefault(); if (!input.trim()) return; sendMsg(code, input); setInput(''); };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal chat-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="chat-head-info"><Avatar className="chat-av" src={partner?.avatarUrl} name={partner?.name} initials={partner?.initials || '?'} /><div><h3>{partner?.name || 'Unknown'}</h3><small>Syllabus: {syl?.courseCode} • {syl?.title}</small></div></div>
          <div className="chat-head-actions"><button className="icon-btn" title="Delete conversation" onClick={() => setConfirmDel(true)}>🗑</button><button className="icon-btn" onClick={onClose}>✕</button></div>
        </div>
        {confirmDel && <div className="chat-del-confirm"><span>Delete all messages? This cannot be undone.</span><button className="btn ghost" onClick={() => setConfirmDel(false)}>Cancel</button><button className="btn danger" onClick={() => { deleteThread(code); onClose(); }}>Delete</button></div>}
        <div className="chat-list">
          {thread.length === 0 && <div className="chat-empty">No messages yet. Start a conversation.</div>}
          {thread.map(m => { const isMe = m.senderId === user.id; return <div key={m.id} className={`chat-msg ${isMe ? 'me' : 'them'}`}><div className="chat-bubble">{m.text}</div><div className="chat-meta"><span>{m.time}</span>{isMe && <span className="chat-receipt">{m.isRead ? '✓ Read' : '✓ Sent'}</span>}</div></div>; })}
          <div ref={ref} />
        </div>
        <form className="chat-composer" onSubmit={send}><input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." /><button className="btn primary" type="submit">Send</button></form>
      </div>
    </div>
  );
}
