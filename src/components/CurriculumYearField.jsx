import Select from './Select';
import { t } from '../i18n';
import { curriculumYearChoices, normalizeCurriculumYear } from '../lib/subjectTerm';

// A subject's curriculum year (e.g. 2022-2023): the curriculum it is taught under, which is not the academic year of the catalog. Used by the Add subject form and the
// subject's edit dialog. A dropdown (lib/subjectTerm.js curriculumYearChoices): recent curriculum years, the ones already in use (`options`) and the program's approved
// curriculum references (`references`: { program, curriculumYear, status }), marked so the administrator sees which ones the AI Checker can compare the subject with.
// `required`: the Add form starts on "Choose…"; otherwise (edit) the first option is "Not set", which clears the value.
export default function CurriculumYearField({ value, onChange, options = [], references = [], program = '', required = false, disabled = false }) {
  const year = normalizeCurriculumYear(value);
  const approved = references.filter((r) => r.status === 'approved' && r.program === program).map((r) => normalizeCurriculumYear(r.curriculumYear)).filter(Boolean);
  const choices = curriculumYearChoices({ inUse: options, approved, value: year || '' });
  let hint = t('curriculumYear.hint');
  if (year && program && references.length && !approved.includes(year)) hint = t('curriculumYear.noReference', { program, year, list: approved.length ? approved.join(', ') : t('curriculumYear.none') });
  else if (year && approved.includes(year)) hint = t('curriculumYear.hasReference', { program, year });
  return <label className="field"><span>{t('curriculumYear.label')}{required ? ' *' : ''}</span>
    <Select value={year || ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={t('curriculumYear.label')}>
      <option value="">{required ? t('term.choose') : t('curriculumYear.notSetOption')}</option>
      {choices.map((c) => <option key={c.value} value={c.value} data-short={c.value}>{c.approved ? t('curriculumYear.approvedOption', { year: c.value }) : c.value}</option>)}
    </Select>
    <span className="ac-hint">{hint}</span>
  </label>;
}
