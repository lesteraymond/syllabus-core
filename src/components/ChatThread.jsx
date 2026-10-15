import StableButton from './StableButton';
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt } from '../lib/utils';

// The messages about one syllabus, oldest first.
export const threadOf = (messages, code, syl) => messages.filter(m => m.syllabusId === code || m.syllabusId === syl?.id).sort((a, b) => new Date(a.time) - new Date(b.time));

// The message list and the box to send one, for a syllabus. Shared by the chat window and the review panel, so both behave the same:
// opening it marks the messages read, and the list scrolls to the newest. Renders two siblings (the list, then the composer) so the
// parent decides the layout.
export default function ChatThread({ code, syl, user, messages, sendMsg, markRead }) {
  const [input, setInput] = useState('');
  const ref = useRef(null);
  const thread = useMemo(() => threadOf(messages, code, syl), [messages, code, syl]);
  useEffect(() => { markRead(code); }, [code, thread.length]);
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread]);
  const send = (e) => { e.preventDefault(); if (!input.trim()) return; sendMsg(code, input); setInput(''); };
  return (
    <>
      <div className="chat-list">
        {thread.length === 0 && <div className="chat-empty">{translateUI("ui.no_messages_yet_start_a_conversation_d5ea96")}</div>}
        {thread.map(m => { const isMe = m.senderId === user.id; return <div key={m.id} className={`chat-msg ${isMe ? 'me' : 'them'}`}><div className="chat-bubble">{m.text}</div><div className="chat-meta"><span>{fmt(m.time)}</span>{isMe && <span className="chat-receipt">{m.isRead ? translateUI("ui.read_927abf") : translateUI("ui.sent_610540")}</span>}</div></div>; })}
        <div ref={ref} />
      </div>
      <form className="chat-composer" onSubmit={send}><input value={input} onChange={e => setInput(e.target.value)} placeholder={translateUI("ui.type_a_message_09bdff")} /><StableButton className="btn primary" type="submit">{translateUI("ui.send_9bc257")}</StableButton></form>
    </>
  );
}
