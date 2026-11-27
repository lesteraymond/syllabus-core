// Template completeness scan for an uploaded PDF syllabus, run on the extracted sections before they are applied to the form.
// Every section of the university template must be filled; only IV. Pre-requisite may be empty (many courses have none).
// Placeholder text ("TBA", "N/A", "-", "...") counts as empty. Offline and free: no AI is involved.
import { PDF_FIELDS } from './pdfImport.js';

export const OPTIONAL_SECTIONS = ['prereq'];
const PLACEHOLDER = /^(?:t\.?b\.?a\.?|t\.?b\.?d\.?|n\/?a|none|nil|null|to follow|[-–—_.\s]+)$/i;
const PLAN_CELLS = ['contents', 'activities', 'tasks'];

export const isBlank = (value) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return !text || PLACEHOLDER.test(text);
};

// A learning plan read as a table is filled when at least one week has content, activities and tasks.
const planFilled = (fields, planRows) => Array.isArray(planRows) && planRows.length
  ? planRows.some((row) => PLAN_CELLS.every((cell) => !isBlank(row?.[cell])))
  : !isBlank(fields?.plan);

// -> { items: [{ key, optional, filled }], missing: [key], ok }
export function scanTemplate(fields, planRows = null) {
  const items = PDF_FIELDS.map((key) => {
    const optional = OPTIONAL_SECTIONS.includes(key);
    const filled = key === 'plan' ? planFilled(fields, planRows) : !isBlank(fields?.[key]);
    return { key, optional, filled };
  });
  const missing = items.filter((i) => !i.optional && !i.filled).map((i) => i.key);
  return { items, missing, ok: missing.length === 0 };
}
