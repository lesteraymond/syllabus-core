import { REVIEW_ROLES } from '../lib/roles.js';

export const BRAND = { blue: '#0b2d8f', navy: '#071d57', gold: '#d89a2b', peach: '#e7bd98' };

export const navItems = [
  ['dashboard', 'squaresFour', 'Dashboard', null],
  ['builder', 'pencilRuler', 'Syllabus Builder', ['faculty', 'admin']],
  ['ai', 'sparkle', 'AI Checker', null],
  ['my-syllabi', 'notebook', 'My Syllabi', ['faculty', 'admin']],
  ['review', 'sealCheck', 'Review & Approval', REVIEW_ROLES],
  ['courses', 'graduationCap', 'Program & Subjects', 'admin'],
  ['repository', 'archive', 'Repository', null],
  ['compliance', 'shieldCheck', 'Compliance', 'admin'],
  ['analytics', 'chartBar', 'Analytics', null],
  ['reports', 'downloadSimple', 'Reports', null],
  ['users', 'usersThree', 'Users & Roles', 'admin'],
  ['settings', 'gearSix', 'Settings', null],
  ['student-dashboard', 'squaresFour', 'Dashboard', 'student'],
  ['student-syllabi', 'archive', 'Syllabi', 'student'],
];
