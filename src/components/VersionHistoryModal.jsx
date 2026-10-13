import { useEffect, useState } from 'react';
import { API_ORIGIN, syllabi as syllabiApi } from '../lib/api';
import { STATUS_LABELS } from '../lib/syllabusRules';
import { fmt } from '../lib/utils';

const FIELD_LABELS = { title: 'title', courseCode: 'course code', curriculumId: 'curriculum', file: 'file', content: 'syllabus content' };

export default function VersionHistoryModal({ syllabus, onClose }) {
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState('');
  const id = syllabus?.id;
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
    <div className="overlay" onClick={onClose}>
      <div className="modal vh-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><div><h3>Version History</h3><small>{syllabus.courseCode} • {syllabus.title}</small></div><button className="icon-btn" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          {error && <div className="empty">{error}</div>}
          {!error && versions === null && <div className="empty">Loading history…</div>}
          {versions && versions.length === 0 && <div className="empty">No versions recorded yet.</div>}
          {versions && versions.length > 0 && <>
            <small>Each version records the title, course code, curriculum and attached file. Versions saved from the new builder also keep the form content.</small>
            <div className="vh-timeline">
              {versions.map((v, i) => (
                <div className="vh-item" key={v.id}>
                  <div className={`vh-dot ${i === 0 ? 'current' : ''}`} />
                  <div className="vh-content">
                    <div className="vh-head"><strong>Version {v.version}</strong><span className={`status ${v.statusAtSave.replaceAll('_', '-')}`}>{STATUS_LABELS[v.statusAtSave] || v.statusAtSave}</span>{i === 0 && <span className="vh-current">Current</span>}</div>
                    <small>{fmt(new Date(v.createdAt))} • {v.author}</small>
                    {v.note && <p>{v.note}</p>}
                    {v.changed.length > 0 && <small>Changed: {v.changed.map(c => FIELD_LABELS[c] || c).join(', ')}</small>}
                    {v.filePath && <small><a href={`${API_ORIGIN}${v.filePath}`} target="_blank" rel="noreferrer" download>Download file</a></small>}
                  </div>
                </div>
              ))}
            </div>
          </>}
        </div>
        <div className="modal-foot"><button className="btn outline" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
