// Who is who in the review chain, for the screens. Keep in sync with server/lib/roles.js (src/lib/roles.test.js checks that the two agree).
// The server decides what each role may do; this only decides what to SHOW. Every function takes the role string (user.role).
//
//   faculty        writes a syllabus and submits it
//   admin          the dean: checks and reviews (stage 'dean'), and manages users, the catalog, deadlines and settings
//   asst_vpaa      Asst. Vice President for Academic Affairs: checks and reviews (stage 'asst_vpaa')
//   lic_director   LIC Director: checks and reviews, with a view on references and citations (stage 'lic_director')
//   vpaa           Vice President for Academic Affairs: the only one who approves or rejects, once the three stages are cleared
export const ROLE_LABELS = Object.freeze({
  admin: 'Academics Administrator',
  faculty: 'Faculty',
  asst_vpaa: 'Asst. Vice President for Academic Affairs',
  lic_director: 'LIC Director',
  vpaa: 'Vice President for Academic Affairs',
});

export const STAGES = Object.freeze(['dean', 'asst_vpaa', 'lic_director']);
export const STAGE_LABELS = Object.freeze({ dean: 'Dean', asst_vpaa: 'Asst. VPAA', lic_director: 'LIC Director' });
const STAGE_OF = Object.freeze({ admin: 'dean', asst_vpaa: 'asst_vpaa', lic_director: 'lic_director' });
export const REVIEW_ROLES = Object.freeze(['admin', 'asst_vpaa', 'lic_director', 'vpaa']);
export const STAFF_ROLES = Object.freeze(['faculty', ...REVIEW_ROLES]);
// The order roles are listed in (Users & Roles, the Add User form): the VPAA, the Asst. VPAA, the LIC Director, the administrator, faculty; anything else last.
export const ROLE_ORDER = Object.freeze(['vpaa', 'asst_vpaa', 'lic_director', 'admin', 'faculty']);
const roleRank = (role) => { const i = ROLE_ORDER.indexOf(role); return i < 0 ? ROLE_ORDER.length : i; };
// For sorting people: by role in that order, then by last and first name.
export const byRoleOrder = (a, b) => roleRank(a && a.role) - roleRank(b && b.role)
  || String((a && a.lastName) || '').localeCompare(String((b && b.lastName) || '')) || String((a && a.firstName) || '').localeCompare(String((b && b.firstName) || ''));
// Who writes syllabi (Syllabus Builder, My Syllabi): faculty and the administrator. The Asst. VPAA, the LIC Director and the VPAA only review.
export const AUTHOR_ROLES = Object.freeze(['faculty', 'admin']);

// May look at submitted syllabi, comment on them and run the AI check.
export const isReviewer = (role) => REVIEW_ROLES.includes(role);
// The only role that approves or rejects.
export const isApprover = (role) => role === 'vpaa';
// May write a syllabus of their own (the builder and My Syllabi are theirs only).
export const canAuthor = (role) => AUTHOR_ROLES.includes(role);
// The stage a role clears ('dean' | 'asst_vpaa' | 'lic_director'), or null.
export const stageOf = (role) => STAGE_OF[role] || null;
// A navigation item (src/data/initialData.js) is open to everyone (null), to one role (a string) or to several (a list).
export const roleAllows = (gate, role) => !gate || (Array.isArray(gate) ? gate.includes(role) : gate === role);
