import { useEffect, useId, useMemo, useState } from 'react';
import { t as translateUI, tr } from '../i18n/index.js';
import { PageHead } from '../components/ui';
import Select from '../components/Select';
import StableButton from '../components/StableButton';
import { courses as coursesApi, syllabi as syllabiApi, isRevisionConflict } from '../lib/api';
import { SECTION_KEYS, saveOnce } from '../lib/draftSave';
import { EDITABLE_STATUSES } from '../lib/syllabusRules';
import { SCHEMA_VERSION, applyCourse, emptyDraft } from '../lib/syllabusModel';
import { newId } from './builder2/useDraft';
import GeneratePanel from './builder2/GeneratePanel';

// The "AI Syllabus Generator" page (sidebar tab): pick one of your own syllabi that can still be edited, OR a subject assigned to you that has no draft yet, and generate a first draft
// (server/lib/syllabuscheck/pipeline/generate.js). For a subject with no draft, the draft is created when you press Generate, the same way the builder creates one when a subject is
// chosen. The generated sections are saved to the syllabus here; "Open in builder" is where the author reviews and edits them.
// Choices are 's:<syllabus id>' (a draft) or 'c:<course id>' (an assigned subject with no draft).
export default function SyllabusGenerator({ user, syllabi = [], editing, setEditing, setPage, onChanged }) {
  const uid = useId();
  const mine = useMemo(() => syllabi.filter((s) => s.userId === user.id && !s.archived && EDITABLE_STATUSES.includes(s.status)), [syllabi, user.id]);
  const [fresh, setFresh] = useState([]); // drafts created on this page that the app's list does not hold yet: [{ id, courseId, courseCode, title }]
  const [subjects, setSubjects] = useState(null); // the subjects assigned to this person (all subjects for an administrator), each with `taken` when a syllabus exists on it
  const drafts = useMemo(() => [...mine.map((s) => ({ id: s.id, courseCode: s.courseCode, title: s.title })), ...fresh.filter((f) => !mine.some((s) => s.id === f.id))], [mine, fresh]);
  const unstarted = useMemo(() => (subjects || []).filter((c) => !c.taken && !fresh.some((f) => f.courseId === c.id)), [subjects, fresh]);
  const hasDraft = (id) => !!id && drafts.some((d) => d.id === id);
  const [choice, setChoice] = useState(() => (editing && hasDraft(editing.syllabusId) ? 's:' + editing.syllabusId : ''));
  const [doc, setDoc] = useState({ loading: false, error: '', content: null, editable: false, status: 'draft' });
  const selectedId = choice.startsWith('s:') ? Number(choice.slice(2)) : null;
  const subject = choice.startsWith('c:') ? unstarted.find((c) => c.id === Number(choice.slice(2))) || null : null;

  // The subjects assigned to this person; read again when the list of syllabi changes (a draft was started somewhere else).
  useEffect(() => {
    let live = true;
    coursesApi.list('', { except: 0 }).then((list) => { if (live) setSubjects(Array.isArray(list) ? list : []); }).catch(() => { if (live) setSubjects([]); });
    return () => { live = false; };
  }, [syllabi.length, fresh.length]);

  // Always one valid choice: a draft, else a subject with no draft, else nothing.
  useEffect(() => {
    if (subjects === null) return;
    const valid = (choice.startsWith('s:') && hasDraft(selectedId)) || (choice.startsWith('c:') && !!subject);
    if (!valid) setChoice(drafts[0] ? 's:' + drafts[0].id : unstarted[0] ? 'c:' + unstarted[0].id : '');
  }, [subjects, drafts, unstarted, choice]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) { setDoc({ loading: false, error: '', content: null, editable: false, status: 'draft' }); return undefined; }
    let live = true;
    setDoc((prev) => ({ ...prev, loading: true, error: '' }));
    syllabiApi.getContent(selectedId)
      .then((res) => { if (live) setDoc({ loading: false, error: '', content: res.content || null, editable: !!res.editable, status: res.status || 'draft' }); })
      .catch((e) => { if (live) setDoc({ loading: false, error: e.message || '', content: null, editable: false, status: 'draft' }); });
    return () => { live = false; };
  }, [selectedId]);

  // What the panel sees for a subject with no draft yet: just enough to show the card (a subject is chosen, nothing written).
  const placeholder = useMemo(() => (subject ? { meta: { courseId: subject.id, code: subject.code, title: subject.title, program: subject.program }, plan: [] } : null), [subject]);

  // Creates the draft of the chosen subject, the way the builder does when a subject is chosen (the subject's outcomes and CLOs are copied in), and moves the page onto it.
  const startDraft = async () => {
    if (!subject) throw new Error(translateUI('generate.notSaved'));
    const course = await coursesApi.get(subject.id);
    const d = applyCourse(emptyDraft(newId), course);
    const idRef = { current: null };
    const result = await saveOnce({ api: syllabiApi, d, idRef, saved: { current: {} }, sections: SECTION_KEYS, schemaVersion: SCHEMA_VERSION });
    if (result !== 'saved' || !idRef.current) throw new Error(translateUI('generate.notSaved'));
    const id = idRef.current;
    setFresh((list) => [...list, { id, courseId: subject.id, courseCode: course.code, title: course.title }]);
    setDoc({ loading: false, error: '', content: d, editable: true, status: 'draft' });
    setChoice('s:' + id);
    if (onChanged) onChanged(); // the app's list of syllabi learns about the new draft
    return id;
  };

  // Saves the generated sections to the syllabus; a save conflict (newer changes in another tab) writes nothing and says so.
  const saveGenerated = async (sections) => {
    try {
      await syllabiApi.saveContent(selectedId, sections, (doc.content && doc.content.schemaVersion) || 3);
    } catch (e) {
      if (isRevisionConflict(e)) throw new Error('Newer changes to this syllabus were saved after you opened it. Nothing was replaced. Reload the page and try again.');
      throw e;
    }
    setDoc((prev) => ({ ...prev, content: { ...prev.content, ...sections } }));
  };
  const openBuilder = () => { if (setEditing) setEditing({ syllabusId: selectedId, status: doc.status }); if (setPage) setPage('builder'); };
  const label = (code, title) => (code || '—') + (title ? ' — ' + title : '');

  return (
    <>
      <PageHead title={translateUI('generate.title')} subtitle={translateUI('generate.pageSubtitle')} />
      {subjects !== null && drafts.length === 0 && unstarted.length === 0 ? (
        <div className="empty">
          <div>{translateUI('generate.noSubjects')}</div>
        </div>
      ) : (
        <>
          <section className="card pick-card pick-compact" aria-label={translateUI('ui.choose_a_syllabus_to_check_b6f6d2')}>
            <div className="pick-field">
              <label htmlFor={uid + '-s'}>{translateUI('ui.subject_8d183d')}</label>
              <Select id={uid + '-s'} value={choice} onChange={(e) => setChoice(e.target.value)}>
                <option value="">{translateUI('ui.choose_a_subject_554b9c')}</option>
                {drafts.map((s) => <option key={'s' + s.id} value={'s:' + s.id}>{label(s.courseCode, s.title)}</option>)}
                {unstarted.map((c) => <option key={'c' + c.id} value={'c:' + c.id}>{label(c.code, c.title) + ' · ' + translateUI('generate.noDraftYet')}</option>)}
              </Select>
            </div>
            <StableButton type="button" className="btn outline" disabled={!selectedId} onClick={openBuilder}>{translateUI('generate.openBuilder')}</StableButton>
          </section>
          {doc.error && <div className="info-banner warning" role="alert">{tr(doc.error)}</div>}
          <GeneratePanel
            draft={selectedId ? doc.content : placeholder}
            editable={selectedId ? doc.editable : !!placeholder}
            syllabusId={selectedId}
            beforeRun={selectedId ? undefined : startDraft}
            onSections={saveGenerated}
            showCost={user.role === 'admin'}
          />
        </>
      )}
    </>
  );
}
