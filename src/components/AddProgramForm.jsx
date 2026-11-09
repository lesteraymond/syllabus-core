import { useRef, useState } from 'react';
import StableButton from './StableButton';
import SubjectSetup from './SubjectSetup';
import { useActionExit, useSurfaceMotion } from '../lib/catalogMotion';
import { outcomes as outcomesApi } from '../lib/api';
import { t, tr } from '../i18n';

// The Add program form of Program & Subjects: the program's code and name, and the Vision, Mission, EGAs and Program Outcomes it starts with. Only the code and the name are
// required: a program may be created empty and set up later with its Outcomes button. The EGAs and POs belong to this program; the Vision and Mission are the school's one
// record (the form shows it and saves it when changed), and every subject added to this program starts with a copy of all four.
const CODE = /^[A-Z0-9-]{2,20}$/;

export default function AddProgramForm({ year, onCreated, onCancel, notify }) {
  const form = useRef(null);
  const setup = useRef(null);                              // the Vision / Mission / EGA / PO part (components/SubjectSetup.jsx)
  const motion = useActionExit(form);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [problem, setProblem] = useState('');              // why the outcomes cannot be saved yet (empty when fine)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useSurfaceMotion(form, JSON.stringify([error, !!code]), true);

  const cleanName = name.trim().replace(/\s+/g, ' ');
  const valid = CODE.test(code.trim()) && cleanName.length >= 2 && !problem;
  const close = () => motion.dismiss(onCancel);
  const submit = async () => {
    if (busy || motion.isClosing() || !valid) return;
    setBusy(true); setError('');
    try {
      const prepared = await setup.current.prepare();   // saves the school Vision and Mission when they were changed
      const made = await outcomesApi.createProgram({ code: code.trim(), name: cleanName, ...(prepared.outcomes ? { outcomes: prepared.outcomes } : {}) });
      await onCreated(made);
      await motion.dismiss(onCancel);
      notify(t(prepared.outcomes ? 'programs.created' : 'programs.createdNeedsOutcomes', { code: made.code }));
    } catch (e) { setError(tr(e.message)); } finally { setBusy(false); }
  };

  return <div ref={form} inert={motion.closing || undefined} className="card ac-form catalog-surface" aria-label={t('programs.addTitle')}>
    <h3>{t('programs.addTitle')}</h3>
    <p className="ac-hint">{t('programs.addNote', { year })}</p>
    <p className="hint">{t('programs.allRequired')}</p>
    <div className="form-grid">
      <label className="field"><span>{t('ui.program_code_18ae83')} *</span>
        <input value={code} maxLength={20} autoComplete="off" placeholder={t('ui.e_g_bsit_a78cbf')} disabled={busy} onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }} />
      </label>
      <label className="field"><span>{t('ui.program_name_699413')} *</span>
        <input value={name} maxLength={255} autoComplete="off" placeholder={t('ui.e_g_bs_information_technology_898182')} disabled={busy} onChange={(e) => { setName(e.target.value); setError(''); }} />
      </label>
      <SubjectSetup ref={setup} required programCode={code.trim()} existing={null} isNew year={year} onStatus={setProblem} notify={notify} />
    </div>
    {error && <div className="info-banner warning" role="alert" style={{ marginTop: 10 }}>{error}</div>}
    <div className="ac-actions">
      <StableButton className="btn outline" disabled={busy || motion.closing} onClick={close}>{t('ui.cancel_77dfd2')}</StableButton>
      <StableButton className="btn primary" disabled={!valid || busy || motion.closing} onClick={submit}>{busy ? t('ui.adding_ffb2e6') : t('programs.add')}</StableButton>
    </div>
  </div>;
}
