import { AUTHOR_ROLES, REVIEW_ROLES } from '../lib/roles.js';

export const BRAND = { blue: '#0b2d8f', navy: '#071d57', gold: '#d89a2b', peach: '#e7bd98' };

export const navItems = [
  ['dashboard', 'squaresFour', 'Dashboard', null],
  ['builder', 'pencilRuler', 'Syllabus Builder', AUTHOR_ROLES], // faculty and the administrator write syllabi; the Asst. VPAA, LIC Director and VPAA review
  ['ai', 'sparkle', 'AI Checker', null],
  ['generator', 'filePlus', 'AI Syllabus Generator', AUTHOR_ROLES], // writes a first draft of the author's own syllabus (server/lib/syllabuscheck/pipeline/generate.js)
  ['my-syllabi', 'notebook', 'My Syllabi', AUTHOR_ROLES],
  ['review', 'sealCheck', 'Review & Approval', REVIEW_ROLES],
  ['courses', 'graduationCap', 'Curriculum', 'admin'],
  ['repository', 'archive', 'Repository', null],
  ['compliance', 'shieldCheck', 'Compliance', 'admin'],
  ['analytics', 'chartBar', 'Analytics', null],
  ['reports', 'downloadSimple', 'Reports', null],
  ['users', 'usersThree', 'Users & Roles', 'admin'],
  ['settings', 'gearSix', 'Settings', null],
  ['student-dashboard', 'squaresFour', 'Dashboard', 'student'], // a student's own pages (views/StudentViews.jsx): read-only
  ['student-syllabi', 'archive', 'Syllabi', 'student'],
];
