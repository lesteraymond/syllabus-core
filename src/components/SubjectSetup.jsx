import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import OutcomesFields from './OutcomesFields';
import StableButton from './StableButton';
import VisionMissionFields, { draftBody, draftChanged, draftComplete, draftOf } from './VisionMissionFields';
import { outcomes } from '../lib/api';
import { t, tr } from '../i18n';
import { checkEgas, checkPos, egaPayload, egaRows, poPayload, poRows, sameRows } from '../lib/outcomesSetup';

// Inside the Add program form (components/AddProgramForm.jsx): the program's EGAs and Program Outcomes and the school's vision and mission, so an administrator sets up everything a
// syllabus is built from in one place. What is saved is what the faculty builder shows when faculty pick this program and a subject of it (a new subject starts with a copy of it;
// see server/lib/subjectStandards.js standardsFromMasters).
//   new program       the rows start empty and are created WITH the program and the subject, in one step on the server
//   existing program  the rows are the program's saved ones; a change is saved (with the versions loaded, so a stale screen is refused) before the subject is created
//   vision / mission  one school-wide record, saved first when it was changed
// The parent calls ref.prepare() when the administrator clicks Add program: it saves what changed and returns { outcomes?, programChanged } to merge into the request.
const SubjectSetup = forwardRef(function SubjectSetup({ programCode, existing, isNew, year, onStatus, notify, required = false }, ref) {
  const [school, setSchool] = useState(null);       // saved school record { vision, mission, version, egas }
  const [vm, setVm] = useState(null);               // its draft
  const [data, setData] = useState(null);           // the existing program's saved setup { egas, pos, versions, inheritedFrom?, poReference? }
  const [egas, setEgas] = useState([]);
  const [pos, setPos] = useState([]);
  const [error, setError] = useState('');
  const [savingSchool, setSavingSchool] = useState(false);
  const hadExisting = useRef(false);

  useEffect(() => { let live = true; outcomes.institution().then((s) => { if (live) { setSchool(s); setVm(draftOf(s)); } }).catch((e) => { if (live) setError(tr(e.message)); }); return () => { live = false; }; }, []);
  useEffect(() => {
    let live = true;
    setData(null);
    if (existing) {
      hadExisting.current = true;
      outcomes.program(existing.id).then((p) => { if (live) { setData(p); setEgas(egaRows(p.egas)); setPos(poRows(p.pos)); } }).catch((e) => { if (live) setError(tr(e.message)); });
    } else if (hadExisting.current) { hadExisting.current = false; setEgas([]); setPos([]); }   // from a saved program back to a new code: start empty, never with another program's rows
    return () => { live = false; };
  }, [existing && existing.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const inherited = data && data.inheritedFrom ? data.inheritedFrom : null;
  const referenced = !!(data && data.poReference && !data.referencesVersioned);
  const lockedProgram = !!inherited;
  const editEgas = isNew || (!!data && !lockedProgram);
  const editPos = isNew || (!!data && !lockedProgram && !referenced);
  const egaChanged = isNew ? egas.length > 0 : !!data && !sameRows(egas, egaRows(data.egas));
  const poChanged = isNew ? pos.length > 0 : !!data && !sameRows(pos, poRows(data.pos));
  const vmChanged = !!school && !!vm && draftChanged(vm, school);
  const typedEgas = egas.map((r) => ({ no: Number(r.no) })).filter((e) => Number.isInteger(e.no));
  const mapTo = typedEgas.map((e) => e.no);

  let problem = '';
  const text = (p) => (p ? t(p.key, p.params) : '');
  if (editEgas && egaChanged) problem = text(checkEgas(egas));
  if (!problem && editPos && poChanged) problem = text(checkPos(pos, typedEgas));
  if (!problem && isNew && pos.length && !egas.length) problem = t('outcomes.err.noEgas');
  if (!problem && vmChanged && !draftComplete(vm)) problem = t('inst.err.required');
  // `required` (the Add program form): the Vision, the Mission, at least one EGA and at least one Program Outcome must all be filled in before the program can be added
  let missing = '';
  if (required && isNew && !problem) {
    if (!vm || !draftComplete(vm)) missing = t('inst.err.required');
    else if (!egas.length) missing = t('outcomes.err.noEgas');
    else if (!pos.length) missing = t('outcomes.err.noPos');
  }
  useEffect(() => { if (onStatus) onStatus(problem || missing); }, [problem, missing]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    async prepare() {
      if (vmChanged) {
        const saved = await outcomes.saveInstitution({ ...draftBody(vm), egas: school.egas, version: school.version });
        setSchool(saved); setVm(draftOf(saved));
      }
      if (isNew) return egas.length ? { outcomes: { egas: egaPayload(egas), pos: poPayload(pos) }, programChanged: false } : { programChanged: false };
      let programChanged = false;
      if (existing && data && !lockedProgram) {
        let versions = data.versions;
        if (egaChanged) { const fresh = await outcomes.saveProgramEgas(existing.id, egaPayload(egas), versions.egas); versions = fresh.versions; programChanged = true; }
        if (poChanged && editPos) { await outcomes.saveProgram(existing.id, poPayload(pos), versions.pos); programChanged = true; }
      }
      return { programChanged };
    },
  }));

  // The school vision and mission can be saved on their own, without a subject: it is one school-wide record, so nothing else in the form is needed for it.
  const saveSchool = async () => {
    if (savingSchool || !vmChanged || !draftComplete(vm)) return;
    setSavingSchool(true); setError('');
    try {
      const saved = await outcomes.saveInstitution({ ...draftBody(vm), egas: school.egas, version: school.version });
      setSchool(saved); setVm(draftOf(saved));
      if (notify) notify(t('inst.saved'));
    } catch (e) { setError(tr(e.message)); } finally { setSavingSchool(false); }
  };

  const waiting = existing ? !data : false;
  const schoolLocked = !!school && !school.egas.length;   // the vision and mission cannot be saved without the school EGA list: they stay on show, read-only
  return <fieldset className="subject-setup full" aria-label={t('setup.heading')}>
    {error && <p className="form-error" role="alert">{error}</p>}
    {(programCode || isNew) && <>
      {inherited && <p className="info-banner" role="status">{t('outcomes.readonly.inherited', { code: programCode, source: inherited.code })}</p>}
      {referenced && !lockedProgram && <p className="info-banner" role="status">{t('outcomes.readonly.reference')}</p>}
      {waiting ? <p role="status">{t('outcomes.loading')}</p>
        : <OutcomesFields required={required} egas={egas} pos={pos} onEgas={setEgas} onPos={setPos} mapTo={mapTo} editEgas={editEgas} editPos={editPos} poHint={editPos && !mapTo.length ? t('outcomes.addEgasFirst') : ''} egaFooter={null} poFooter={null} />}
    </>}
    {!school && !error && <p role="status">{t('outcomes.loading')}</p>}
    {schoolLocked && <p className="info-banner warning" role="alert">{t('inst.needsEgas')}</p>}
    {vm && <>
      <VisionMissionFields required={required} draft={vm} onChange={setVm} busy={savingSchool || schoolLocked} />
      {!schoolLocked && <div className="outcomes-actions"><StableButton type="button" className="btn outline" disabled={savingSchool || !vmChanged || !draftComplete(vm)} onClick={saveSchool}>{savingSchool ? t('ui.saving_56a228') : t('inst.save')}</StableButton></div>}
    </>}
    {problem && <p className="form-error" role="alert">{problem}</p>}
    {!problem && missing && <p className="hint">{missing}</p>}
  </fieldset>;
});

export default SubjectSetup;
