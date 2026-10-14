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
      .catch(err => { if (live) setError(err.message || 'Could not load the history.'); });
    return () => { live = false; };
  }, [id]);

  if (!syllabus) return null;
  return (
    <>
    <div className="overlay" onClick={onClose}>
      <div className="modal vh-modal" role="dialog" aria-modal="true" aria-label="Version history" tabIndex={-1} ref={dialog} onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><h3>Version History</h3><small>{syllabus.courseCode} • {syllabus.title}</small></div><button className="icon-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {error && <div className="empty">{error}</div>}
          {!error && versions === null && <div className="empty">Loading history…</div>}
          {versions && versions.length === 0 && <div className="empty">No versions recorded yet.</div>}
          {versions && versions.length > 0 && <>
            <small>Every version that was submitted is kept, and none is ever changed. Open one to read it as it was.</small>
            <div className="vh-timeline">
              {versions.map((v, i) => (
                <div className="vh-item" key={v.id}>
                  <div className={`vh-dot ${i === 0 ? 'current' : ''}`} />
                  <div className="vh-content">
                    <div className="vh-head"><strong>Version {v.version}</strong><span className={`status ${v.statusAtSave.replaceAll('_', '-')}`}>{STATUS_LABELS[v.statusAtSave] || v.statusAtSave}</span>{i === 0 && <span className="vh-current">Current</span>}</div>
                    <small>{fmt(v.createdAt)} • {v.author}</small>
                    {v.note && <p>{v.note}</p>}
                    {v.changes && v.changes.text
                      ? <small className="vh-changes">{'Changed since the version before: ' + v.changes.text}</small>
                      : v.changed.length > 0 && <small>Changed: {v.changed.map(c => FIELD_LABELS[c] || c).join(', ')}</small>}
                    {v.decision && <small className={'vh-decision ' + v.decision.action}>{DECISION_LABELS[v.decision.action] + ' by ' + v.decision.by + ' on ' + fmt(v.decision.at) + (v.decision.reason ? ': ' + v.decision.reason : '')}</small>}
                    {v.filePath && <small><a href={`${API_ORIGIN}${v.filePath}`} target="_blank" rel="noreferrer" download>Download file</a></small>}
                    <button type="button" className="btn outline vh-view" onClick={() => setViewing(v.id)}>{'View version ' + v.version}</button>
                  </div>
                </div>
              ))}
            </div>
          </>}
        </div>
        <div className="modal-foot"><button className="btn outline" onClick={onClose}>Close</button></div>
      </div>
    </div>
    {viewing !== null && <SyllabusViewModal syllabusId={id} initialVersionId={viewing} onClose={() => setViewing(null)} avatarUrl={syllabus.ownerAvatarUrl || null} />}
    </>
  );
}
