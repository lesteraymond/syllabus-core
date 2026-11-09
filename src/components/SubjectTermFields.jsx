import Select from './Select';
import { t } from '../i18n';
import { SEMESTER_OPTIONS, YEAR_LEVELS } from '../lib/subjectTerm';

// The fields an administrator sets for a subject: its academic year, semester, year level (1-4) and pre-requisite. Used by the Add subject form and the subject's edit
// dialog, so both look and behave the same. `value` is { academicYear, semester, yearLevel, prerequisite } as strings (src/lib/subjectTerm.js).
// The catalog is per academic year, so the academic year of a subject is not chosen: it is the year of the catalog it belongs to, shown as a fixed line (`fixedYear`).
export default function SubjectTermFields({ value, onChange, fixedYear = '', disabled = false }) {
  const set = (key, v) => onChange({ ...value, [key]: v });
  return <>
    <label className="field"><span>{t('term.academicYear')}</span>
      <input value={fixedYear || value.academicYear || ''} readOnly aria-label={t('term.academicYear')} />
      <span className="ac-hint">{t('term.yearFixedHint')}</span>
    </label>
    <label className="field"><span>{t('term.semester')} *</span>
      <Select value={value.semester} disabled={disabled} onChange={(e) => set('semester', e.target.value)} aria-label={t('term.semester')}>
        <option value="">{t('term.choose')}</option>
        {SEMESTER_OPTIONS.map((s) => <option key={s.value} value={s.value}>{t(s.key)}</option>)}
      </Select>
    </label>
    <label className="field"><span>{t('term.yearLevel')} *</span>
      <Select value={value.yearLevel} disabled={disabled} onChange={(e) => set('yearLevel', e.target.value)} aria-label={t('term.yearLevel')}>
        <option value="">{t('term.choose')}</option>
        {YEAR_LEVELS.map((n) => <option key={n} value={String(n)}>{t('term.yearOption', { n })}</option>)}
      </Select>
    </label>
    <label className="field full"><span>{t('term.prerequisite')} <small className="hint">{t('term.optional')}</small></span>
      <input value={value.prerequisite} maxLength={255} disabled={disabled} onChange={(e) => set('prerequisite', e.target.value)} aria-label={t('term.prerequisite')} />
      <span className="ac-hint">{t('term.prerequisiteHint')}</span>
    </label>
  </>;
}
