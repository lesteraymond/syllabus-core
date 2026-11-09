import { t } from '../i18n/index.js';

// The server's refusals carry a count, so they cannot be translated by their English text.
const KEYS = { syllabus: 'hybrid.approvedProtectedSyllabus', subject: 'hybrid.approvedProtectedSubject', account: 'hybrid.approvedProtectedAccount', program: 'programs.blockedByApproved' };

export const approvedRefusalText = (data) => (data?.code === 'approved_records_protected' && KEYS[data.scope] ? t(KEYS[data.scope], { count: data.count, code: data.programCode }) : null);
