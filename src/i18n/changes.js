import { tr } from './index.js';
// The API supplies structured changes; labels and counts are UI, not the syllabus text.
export function localizeChanges(changes) {
  if (!changes?.sections) return changes?.text || '';
  return changes.sections.map(section => {
    const count = section.rows || section.words;
    const unit = section.rows ? (count === 1 ? 'week' : 'weeks') : (count === 1 ? 'word' : 'words');
    return tr(section.label) + (count ? ' (' + tr(count + ' ' + unit) + ')' : '');
  }).join(', ');
}
