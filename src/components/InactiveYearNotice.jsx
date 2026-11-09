import { t as translateUI } from '../i18n/index.js';
import { useYearScope } from './AcademicYearScope';

// A new AI check is available only for a syllabus of the active academic year (institutional policy; the server enforces it in lib/activeYearGate.js and
// answers 409 inactive_academic_year). This tells the person before they try. Viewing the syllabus and its saved reports stays available.
export function useInactiveYear(syllabusYear) {
  const scope = useYearScope();
  const active = scope && scope.current ? scope.current.label : null;
  return syllabusYear && active && syllabusYear !== active ? { year: syllabusYear, active } : null;
}

export default function InactiveYearNotice({ inactive }) {
  if (!inactive) return null;
  return (
    <div className="info-banner warning" role="note" data-testid="inactive-year-notice">
      <strong>{translateUI('hybrid.inactiveYearTitle')}</strong> {translateUI('hybrid.inactiveYearBody', { year: inactive.year })}
    </div>
  );
}
