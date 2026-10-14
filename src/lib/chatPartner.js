// Who a conversation is with, for the chat header and the message list. Plain logic, tested on its own.
//
// The best answer is the server's (GET /api/messages/partners): the other person's real name, picture and role, with the syllabus's program
// and subject. It comes from the user's own record, so it is right before anyone has written and it follows a change of name or picture.
// Without it (the request failed, or no administrator exists) the other side's latest message still carries a name and picture, and an
// administrator can always fall back to the syllabus owner.

export const initialsOf = (name) => String(name || '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

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
