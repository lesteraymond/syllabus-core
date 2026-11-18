import { useEffect, useId, useMemo, useState } from 'react';
import { t as translateUI, tr } from '../i18n/index.js';
import { PageHead } from '../components/ui';
import Select from '../components/Select';
import StableButton from '../components/StableButton';
import { syllabi as syllabiApi, isRevisionConflict } from '../lib/api';
import { EDITABLE_STATUSES } from '../lib/syllabusRules';
import GeneratePanel from './builder2/GeneratePanel';

// The "AI Syllabus Generator" page (sidebar tab): pick one of your own syllabi that can still be edited, and generate a first draft of it
// (server/lib/syllabuscheck/pipeline/generate.js). The sections are saved to that syllabus here; "Open in builder" is where the author reviews and edits them.
export default function SyllabusGenerator({ user, syllabi = [], editing, setEditing, setPage }) {
  const uid = useId();
  const mine = useMemo(() => syllabi.filter((s) => s.userId === user.id && !s.archived && EDITABLE_STATUSES.includes(s.status)), [syllabi, user.id]);
  const offered = (id) => !!id && mine.some((s) => s.id === id);
  const [selectedId, setSelectedId] = useState(() => (offered(editing && editing.syllabusId) ? editing.syllabusId : (mine[0] && mine[0].id) || null));
  const [doc, setDoc] = useState({ loading: false, error: '', content: null, editable: false, status: 'draft' });

  useEffect(() => { if (!offered(selectedId)) setSelectedId((mine[0] && mine[0].id) || null); }, [mine, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedId) { setDoc({ loading: false, error: '', content: null, editable: false, status: 'draft' }); return undefined; }
    let live = true;
    setDoc((prev) => ({ ...prev, loading: true, error: '' }));
    syllabiApi.getContent(selectedId)
      .then((res) => { if (live) setDoc({ loading: false, error: '', content: res.content || null, editable: !!res.editable, status: res.status || 'draft' }); })
      .catch((e) => { if (live) setDoc({ loading: false, error: e.message || '', content: null, editable: false, status: 'draft' }); });
    return () => { live = false; };
  }, [selectedId]);

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

  return (
    <>
      <PageHead title={translateUI('generate.title')} subtitle={translateUI('generate.pageSubtitle')} />
      {mine.length === 0 ? (
        <div className="empty">
          <div>{translateUI('generate.noDraft')}</div>
          <StableButton type="button" className="btn primary" onClick={() => { if (setEditing) setEditing(null); if (setPage) setPage('builder'); }}>{translateUI('generate.startSyllabus')}</StableButton>
        </div>
      ) : (
        <>
          <section className="card pick-card pick-compact" aria-label={translateUI('ui.choose_a_syllabus_to_check_b6f6d2')}>
            <div className="pick-field">
              <label htmlFor={uid + '-s'}>{translateUI('ui.subject_8d183d')}</label>
              <Select id={uid + '-s'} value={selectedId ? String(selectedId) : ''} onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">{translateUI('ui.choose_a_subject_554b9c')}</option>
                {mine.map((s) => <option key={s.id} value={String(s.id)}>{(s.courseCode || '—') + (s.title ? ' — ' + s.title : '')}</option>)}
              </Select>
            </div>
            <StableButton type="button" className="btn outline" disabled={!selectedId} onClick={openBuilder}>{translateUI('generate.openBuilder')}</StableButton>
          </section>
          {doc.error && <div className="info-banner warning" role="alert">{tr(doc.error)}</div>}
          <GeneratePanel draft={doc.content} editable={doc.editable} syllabusId={selectedId} onSections={saveGenerated} showCost={user.role === 'admin'} />
        </>
      )}
    </>
  );
}
