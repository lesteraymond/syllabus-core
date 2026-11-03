// Only newly created instructional rows opt into this authoring order. Existing
// drafts/imports have no marker and are never locked or rewritten on hydration.
import presence from '../../shared/contentPresence.cjs';
export const orderedLesson = row => row?.kind !== 'exam' && row?.authoringOrder === 1;
const filled = presence.hasContent;
export const hasLessonContent = row => filled(row?.contents);
export const hasLessonIlo = row => (row?.ilos || []).some(ilo=>filled(ilo.text));
export function canCreateIlo(row) { return !orderedLesson(row) || hasLessonContent(row); }
export function canEditLessonField(row, field, currentValue = row?.[field]) {
  // Clearing an upstream field never deletes or locks already authored text.
  if(!orderedLesson(row) || filled(currentValue))return true;
  if(field==='ilo')return hasLessonContent(row);
  if(field==='activities')return hasLessonContent(row)&&hasLessonIlo(row);
  if(field==='tasks')return hasLessonContent(row)&&hasLessonIlo(row)&&filled(row.activities);
  return true;
}
