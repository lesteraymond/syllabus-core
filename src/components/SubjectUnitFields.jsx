import { t } from '../i18n';
import { unitsBlank, unitsValid } from '../lib/subjectTerm';

// A subject's credit units (lecture and laboratory), set by the administrator. Used by the Add subject form and the subject's edit dialog. `value` holds `lecture` and `lab`
// as text (src/lib/subjectTerm.js). `required`: the Add form; in the edit dialog both may stay empty (a subject made before units existed).
export default function SubjectUnitFields({ value, onChange, required = false, disabled = false }) {
  const wrong = !unitsBlank(value) && !unitsValid(value);
  const field = (key, label) => <label className="field"><span>{t(label)}{required ? ' *' : ''}</span>
    <input className="mono" inputMode="decimal" value={value[key]} maxLength={4} disabled={disabled} aria-invalid={wrong || undefined} aria-label={t(label)} onChange={(e) => onChange({ ...value, [key]: e.target.value })} />
    <span className="ac-hint">{t(wrong ? 'units.invalid' : 'units.hint')}</span>
  </label>;
  return <>{field('lecture', 'units.lecture')}{field('lab', 'units.lab')}</>;
}
