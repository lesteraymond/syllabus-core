import Select from './Select';
import { t } from '../i18n';
import { curriculumYearChoices, normalizeCurriculumYear } from '../lib/subjectTerm';

// A subject's curriculum year (e.g. 2022-2023): the curriculum it is taught under, which is not the academic year of the catalog. Used by the Add subject form and the
// subject's edit dialog. A dropdown (lib/subjectTerm.js curriculumYearChoices): recent curriculum years and the ones already in use (`options`).
// `required`: the Add form starts on "Choose…"; otherwise (edit) the first option is "Not set", which clears the value.
export default function CurriculumYearField({ value, onChange, options = [], required = false, disabled = false }) {
  const year = normalizeCurriculumYear(value);
  const choices = curriculumYearChoices({ inUse: options, value: year || '' });
  return <label className="field"><span>{t('curriculumYear.label')}{required ? ' *' : ''}</span>
    <Select value={year || ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-label={t('curriculumYear.label')}>
      <option value="">{required ? t('term.choose') : t('curriculumYear.notSetOption')}</option>
      {choices.map((y) => <option key={y} value={y}>{y}</option>)}
    </Select>
    <span className="ac-hint">{t('curriculumYear.hint')}</span>
  </label>;
}
