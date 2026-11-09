// Who is who in the review chain. One place, so a route asks a question ("may this person check a syllabus?") instead of comparing a role
// to a string. Keep in sync with src/lib/roles.js on the client (src/lib/roles.test.js checks that the two agree).
//
//   faculty        writes a syllabus and submits it
//   admin          the dean: checks and reviews (stage 'dean'), and manages users, the catalog, deadlines and settings
//   asst_vpaa      Asst. Vice President for Academic Affairs: checks and reviews (stage 'asst_vpaa')
//   lic_director   LIC Director: checks and reviews, with a view on references and citations (stage 'lic_director')
//   vpaa           Vice President for Academic Affairs: reviews the chain's result and is the only one who approves or rejects
// A syllabus reaches the VPAA once the three stages are cleared on its newest version (lib/reviewStages.js).
const STAGES = ['dean', 'asst_vpaa', 'lic_director'];
const STAGE_OF = { admin: 'dean', asst_vpaa: 'asst_vpaa', lic_director: 'lic_director' };
const REVIEW_ROLES = ['admin', 'asst_vpaa', 'lic_director', 'vpaa'];
const STAFF_ROLES = ['faculty', ...REVIEW_ROLES];
// Who writes syllabi (the Syllabus Builder, My Syllabi, drafts, saving and submitting): faculty and the administrator. The Asst. VPAA, the LIC Director and
// the VPAA only review what others wrote.
const AUTHOR_ROLES = ['faculty', 'admin'];

const roleOf = (user) => (user && user.role) || '';
// May look at submitted syllabi, comment on them and run the AI check (never at a draft: that is the author's).
const isReviewer = (user) => REVIEW_ROLES.includes(roleOf(user));
// May clear one of the three stages.
const stageOf = (user) => STAGE_OF[roleOf(user)] || null;
// The only role that approves or rejects.
const isApprover = (user) => roleOf(user) === 'vpaa';
// May write a syllabus of their own.
const canAuthor = (user) => AUTHOR_ROLES.includes(roleOf(user));

module.exports = { STAGES, STAGE_OF, REVIEW_ROLES, STAFF_ROLES, AUTHOR_ROLES, isReviewer, stageOf, isApprover, canAuthor };
