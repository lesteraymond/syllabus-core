import StableButton from './StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useMemo, useRef, useState } from 'react';
import { Avatar, Icon } from './ui';
import ChatThread, { threadOf } from './ChatThread';
import { useModalLayer } from './useModalLayer';
import { DRAFT_CHAT_NOTE, SELF_CHAT_NOTE, canChat, partnerOf } from '../lib/chatPartner';

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
      <div className="modal chat-modal" role="dialog" aria-modal="true" aria-label={translateUI("ui.messages_f1702b")} tabIndex={-1} ref={dialog} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div className="chat-head-info"><Avatar className="chat-av" userId={partner?.id} src={partner?.avatarUrl} name={partner?.name} initials={partner?.initials || '?'} /><div><h3>{partner?.name || translateUI("ui.unknown_bc7819")}{partner?.roleLabel && <span className="chat-role">{tr(partner.roleLabel)}</span>}</h3>{(partner?.program || partner?.subject) && <small>{[partner.program, partner.subject].filter(Boolean).join(' · ')}</small>}</div></div>
          <div className="chat-head-actions"><button className="icon-btn" title={translateUI("ui.delete_conversation_de4346")} aria-label={translateUI("ui.delete_conversation_de4346")} onClick={() => setConfirmDel(true)}><Icon name="bin" size={18} /></button><button className="icon-btn" onClick={onClose}>✕</button></div>
        </div>
        {confirmDel && <div className="chat-del-confirm"><span>{translateUI("ui.delete_all_messages_this_cannot_be_undone_39516a")}</span><StableButton className="btn ghost" onClick={() => setConfirmDel(false)}>{translateUI("ui.cancel_77dfd2")}</StableButton><StableButton className="btn danger" onClick={() => { deleteThread(code); onClose(); }}>{translateUI("ui.delete_f6fdbe")}</StableButton></div>}
        {syl && !canChat(syl, user)
          ? <div className="chat-empty chat-draft" role="status">{tr(syl.status === 'draft' ? DRAFT_CHAT_NOTE : SELF_CHAT_NOTE)}</div>
          : <ChatThread code={code} syl={syl} user={user} messages={messages} sendMsg={sendMsg} markRead={markRead} />}
      </div>
    </div>
  );
}
