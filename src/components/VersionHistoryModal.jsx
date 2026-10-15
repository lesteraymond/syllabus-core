import StableButton from './StableButton';
import { localizeChanges } from '../i18n/changes';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useEffect, useRef, useState } from 'react';
import { API_ORIGIN, syllabi as syllabiApi } from '../lib/api';
import { STATUS_LABELS } from '../lib/syllabusRules';
import { fmt } from '../lib/utils';
import { useModalLayer } from './useModalLayer';
import SyllabusViewModal from './SyllabusViewModal';

const DECISION_LABELS = { revision: 'Returned for revision', approve: 'Approved', reject: 'Rejected' };
const FIELD_LABELS = { title: 'title', courseCode: 'course code', curriculumId: 'curriculum', file: 'file', content: 'syllabus content' };

export default function VersionHistoryModal({ syllabus, onClose }) {
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null); // the version being read in its own window
  const id = syllabus?.id;
  const dialog = useRef(null);
  useModalLayer(dialog, onClose, !!syllabus);
  useEffect(() => {
    if (!id) return undefined;
    let live = true;
    setVersions(null);
    setError('');
    syllabiApi.versions(id)
      .then(v => { if (live) setVersions(v); })
      .catch(err => { if (live) setError(err.message || translateUI("ui.could_not_load_the_history_8efe8d")); });
    return () => { live = false; };
  }, [id]);

  if (!syllabus) return null;
  return (
    <>
    <div className="overlay" onClick={onClose}>
      <div className="modal vh-modal" role="dialog" aria-modal="true" aria-label={translateUI("ui.version_history_91f865")} tabIndex={-1} ref={dialog} onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><h3>{translateUI("ui.version_history_6974ab")}</h3><small>{syllabus.courseCode} • {syllabus.title}</small></div><button className="icon-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {error && <div className="empty">{tr(error)}</div>}
          {!error && versions === null && <div className="empty">{translateUI("ui.loading_history_02cb12")}</div>}
          {versions && versions.length === 0 && <div className="empty">{translateUI("ui.no_versions_recorded_yet_a3a752")}</div>}
          {versions && versions.length > 0 && <>
            <small>{translateUI("history.savedRevisions")}</small>
            <div className="vh-timeline">
              {versions.map((v, i) => (
                <div className="vh-item" key={v.id}>
                  <div className={`vh-dot ${i === 0 ? 'current' : ''}`} />
                  <div className="vh-content">
                    <div className="vh-head"><strong>{translateUI("ui.version_03283e")}{v.version}</strong><span className={`status ${v.statusAtSave.replaceAll('_', '-')}`}>{tr(STATUS_LABELS[v.statusAtSave] || v.statusAtSave)}</span>{i === 0 && <span className="vh-current">{translateUI("ui.current_4fc0e2")}</span>}</div>
                    <small>{fmt(v.createdAt)} • {v.author}</small>
                    {v.note && <p>{v.note}</p>}
                    {v.changes && v.changes.text
                      ? <small className="vh-changes">{translateUI("ui.changed_since_the_version_before_01d3f5") + localizeChanges(v.changes)}</small>
                      : v.changed.length > 0 && <small>{translateUI("ui.changed_8d443e")}{v.changed.map(c => tr(FIELD_LABELS[c] || c)).join(', ')}</small>}
                    {v.decision && <small className={'vh-decision ' + v.decision.action}>{tr(DECISION_LABELS[v.decision.action]) + translateUI("ui.by_876074") + v.decision.by + translateUI("ui.on_bac8e7") + fmt(v.decision.at) + (v.decision.reason ? ': ' + v.decision.reason : '')}</small>}
                    {v.filePath && <small><a href={`${API_ORIGIN}${v.filePath}`} target="_blank" rel="noreferrer" download>{translateUI("ui.download_file_774025")}</a></small>}
                    <StableButton type="button" className="btn outline vh-view" onClick={() => setViewing(v.id)}>{translateUI("ui.view_version_1109c5") + v.version}</StableButton>
                  </div>
                </div>
              ))}
            </div>
          </>}
        </div>
        <div className="modal-foot"><StableButton className="btn outline" onClick={onClose}>{translateUI("ui.close_bbfa77")}</StableButton></div>
      </div>
    </div>
    {viewing !== null && <SyllabusViewModal syllabusId={id} initialVersionId={viewing} onClose={() => setViewing(null)} avatarUrl={syllabus.ownerAvatarUrl || null} />}
    </>
  );
}
