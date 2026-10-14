// Who a conversation is with, for the chat header and the message list. Plain logic, tested on its own.
//
// The best answer is the server's (GET /api/messages/partners): the other person's real name, picture and role, with the syllabus's program
// and subject. It comes from the user's own record, so it is right before anyone has written and it follows a change of name or picture.
// Without it (the request failed, or no administrator exists) the other side's latest message still carries a name and picture, and an
// administrator can always fall back to the syllabus owner.

export const initialsOf = (name) => String(name || '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// A reliable display identity even if the thread is empty or the partner profile request failed.
export function chatPartner(thread, user, syl) {
  const messages = Array.isArray(thread) ? thread : thread?.msgs || thread?.messages || [];
  const selfName = user.name || [user.firstName, user.lastName].filter(Boolean).join(' ');
  const usable = name => typeof name === 'string' && name.trim() && name.trim().toLowerCase() !== 'unknown' && (!selfName || name.trim() !== selfName.trim());
  const result = (name, avatarUrl) => ({ name: name.trim(), initials: initialsOf(name), avatarUrl: avatarUrl || null });
  if (user.role === 'admin') {
    return syl && syl.userId !== user.id && usable(syl.faculty)
      ? result(syl.faculty, syl.ownerAvatarUrl)
      : result('Faculty', null);
  }
  const candidates = messages.map((message, index) => ({ message, index }))
    .filter(({ message }) => message.senderId !== user.id && (!message.senderRole || message.senderRole === 'admin') && usable(message.sender));
  candidates.sort((a, b) => {
    const first = Date.parse(a.message.time), second = Date.parse(b.message.time);
    return Number.isFinite(first) && Number.isFinite(second) ? first - second || a.index - b.index : a.index - b.index;
  });
  const latest = candidates.at(-1)?.message;
  return latest ? result(latest.sender, latest.senderAvatarUrl) : result('Administrator', null);
}

// -> { name, initials, avatarUrl, roleLabel, program, subject } or null when nobody is known.
//   partner  the server's entry for this syllabus (or undefined/null)      messages  the messages of this thread
//   user     the signed-in user                                            syl       the syllabus row from the list (or undefined)
export function partnerOf({ partner, messages = [], user, syl }) {
  if (partner && partner.name) {
    return { name: partner.name, initials: initialsOf(partner.name), avatarUrl: partner.avatarUrl || null, roleLabel: partner.roleLabel || '', program: partner.program || '', subject: partner.subject || '' };
  }
  // Program and subject describe the faculty member, so they are shown only to an administrator (whose partner is the faculty member).
  const showSyl = syl && user.role === 'admin';
  const subject = showSyl ? [syl.courseCode, syl.courseTitle || syl.title].filter(Boolean).join(' — ') : '';
  const program = showSyl ? (syl.programCode ? syl.programCode + (syl.program ? ' · ' + syl.program : '') : syl.program || '') : '';
  const other = messages.find((m) => m.senderId !== user.id);
  if (other) return { name: other.sender, initials: initialsOf(other.sender), avatarUrl: other.senderAvatarUrl || null, roleLabel: '', program, subject };
  if (user.role === 'admin' && syl && syl.faculty) return { name: syl.faculty, initials: initialsOf(syl.faculty), avatarUrl: syl.ownerAvatarUrl || null, roleLabel: 'Faculty', program, subject };
  return null;
}

// The line a thread in the message list is titled with: the subject, not the syllabus number.
export const threadTitle = (syl, code) => (syl ? [syl.courseCode, syl.courseTitle || syl.title].filter(Boolean).join(' • ') : 'Syllabus #' + code);

// A draft has no conversation: an administrator never sees a draft, so there is nobody to message until it is submitted. The server refuses
// the chat for a draft too; this keeps the button away and says why if a chat is opened anyway.
export const canChat = (syl) => !!syl && syl.status !== 'draft';
export const DRAFT_CHAT_NOTE = 'A draft has no conversation. Submit it for review first, then you can message the administrator.';
