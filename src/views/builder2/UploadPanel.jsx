import StableButton from '../../components/StableButton';
import { Icon } from '../../components/ui';
import { t, tr } from '../../i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { syllabi } from '../../lib/api';
import { PDF_FIELDS, PDF_OUTCOME_FIELDS, mapPdfFields } from '../../lib/pdfImport';
import { scanTemplate } from '../../lib/pdfTemplateScan';

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Minimalist live scan animation shown while the server reads/OCRs the uploaded PDF.
function ScanningStage({ fileName, fileSize }) {
  return (
    <div className="up-scanning" role="status" aria-live="polite">
      <div className="up-doc-scan" aria-hidden="true">
        <span className="up-doc-line w70" />
        <span className="up-doc-line w100" />
        <span className="up-doc-line w85" />
        <span className="up-doc-line w100" />
        <span className="up-doc-line w60" />
        <span className="up-doc-beam" />
      </div>
      <div className="up-scanning-body">
        <div className="up-scanning-head">
          <span className="up-scanning-title">
            <span className="up-scan-pulse" aria-hidden="true" />
            <strong>{t('pdfImport.extracting')}</strong>
          </span>
          {fileName && <small className="up-scanning-file">{[fileName, fileSize].filter(Boolean).join(' · ')}</small>}
        </div>
        <div className="up-scanning-bar" aria-hidden="true"><span /></div>
      </div>
    </div>
  );
}

// Animated template scan: sections are ticked one by one (about 140 ms each), then the summary shows.
function TemplateScan({ scan, runKey }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(scan.items.length); return undefined; }
    setShown(0);
    let n = 0;
    const timer = setInterval(() => { n += 1; setShown(n); if (n >= scan.items.length) clearInterval(timer); }, 140);
    return () => clearInterval(timer);
  }, [runKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = shown >= scan.items.length;
  const pct = Math.round((Math.min(shown, scan.items.length) / scan.items.length) * 100);
  return <div className={'tpl-scan' + (done ? (scan.ok ? ' is-ok' : ' is-bad') : ' is-running')} role="status" aria-live="polite">
    <div className="tpl-scan-head">
      <span className="tpl-scan-title">{t('pdfImport.scanTitle')}</span>
      <span className="tpl-scan-pct">{done ? (scan.ok ? t('pdfImport.scanOk') : t('pdfImport.scanMissing', { count: scan.missing.length })) : pct + '%'}</span>
    </div>
    <div className="tpl-scan-bar"><span style={{ width: pct + '%' }} /></div>
    <ul className="tpl-scan-list">
      {scan.items.map((item, i) => {
        const state = i >= shown ? 'wait' : item.filled ? 'ok' : item.optional ? 'skip' : 'bad';
        return <li key={item.key} className={'tpl-scan-item is-' + state} style={{ animationDelay: (i * 140) + 'ms' }}>
          <span className="tpl-scan-dot" aria-hidden="true">{state === 'ok' ? '✓' : state === 'bad' ? '✕' : state === 'skip' ? '–' : ''}</span>
          <span>{t(`pdfImport.field.${item.key}`)}</span>
          <small>{state === 'wait' ? t('pdfImport.scanChecking') : state === 'ok' ? t('pdfImport.scanFilled') : state === 'skip' ? t('pdfImport.scanOptional') : t('pdfImport.scanEmpty')}</small>
        </li>;
      })}
    </ul>
  </div>;
}

const formatUnresolved = (items) => (items || []).slice(0, 5).map(u => {
  const where = u.clo != null ? `CLO ${u.clo}` : u.week != null ? `Week ${u.week}` : '';
  const bad = [...(u.unknown || []).map(n => `${u.label} ${n}`), ...(u.invalid || [])].filter(Boolean).join(', ');
  return [where, bad].filter(Boolean).join(': ');
}).filter(Boolean).join(' · ');

const MAX_BYTES = 10 * 1024 * 1024;
const PLAN_COLUMNS = ['week', 'ilo', 'contents', 'activities', 'tasks', 'values'];
// Preview only; confirmation saves through useDraft, never file submission.
// resumeJob: a scan started before this panel opened (a page refresh, or a return to the upload tab). It is read again through
// onResume(job, { signal, onStatus }) instead of uploading again, and onResumeFile(job, { name, signal }) brings its PDF back.
export default function UploadPanel({ draft, hasCourse, busy, disabled, disabledReason, onChooseCourse, onExtract, onApply, resumeJob = null, onResume, onResumeFile }) {
  const [file, setFile] = useState(null);
  const [resumedFile, setResumedFile] = useState(null); // { name, size } of a resumed scan until its PDF is back
  const shownFile = file || resumedFile;
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fields, setFields] = useState(null);
  const [planRows, setPlanRows] = useState(null);
  const [reviewed, setReviewed] = useState(false);
  const [prerequisiteChoice, setPrerequisiteChoice] = useState(null);
  const [phase, setPhase] = useState(null);
  const working = phase !== null;
  const [error, setError] = useState('');
  const [applyError, setApplyError] = useState('');
  const applyFeedback = useRef(null);
  const [enabled, setEnabled] = useState(null);
  const [configError, setConfigError] = useState(false);
  const [configAttempt, setConfigAttempt] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    if (applyError) {
      applyFeedback.current?.focus();
      applyFeedback.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
  }, [applyError]);
  const url = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    setEnabled(null); setConfigError(false);
    syllabi.pdfImportConfig({ signal: controller.signal }).then(config => {
      if (live) {
        if (typeof config.enabled !== 'boolean') throw new Error('pdfImport.failed');
        setEnabled(config.enabled);
      }
    }).catch(() => { if (live) setConfigError(true); }).finally(() => clearTimeout(timeout));
    return () => { live = false; clearTimeout(timeout); controller.abort(); };
  }, [configAttempt]);
  const mapped = useMemo(() => {
    if (!fields) return null;
    let counter = 0;
    try { return mapPdfFields(fields, draft, () => `pdf_preview_${++counter}`, { planRows, identityContext: preview?.identityContext, requireIdentity: true, prerequisiteChoice }); }
    catch (e) { return { error: e.message, warnings: [] }; }
  }, [fields, draft, planRows, preview, prerequisiteChoice]);
  const scan = useMemo(() => fields ? scanTemplate(fields, planRows) : null, [fields, planRows]);
  const [scanRun, setScanRun] = useState(0);
  const [pendingScan, setPendingScan] = useState(false);
  const perform = async (action, nextPhase) => {
    if (lock.current) return;
    lock.current = true; setPhase(nextPhase); setError(''); setApplyError('');
    try { await action(); }
    catch (e) { (nextPhase === 'apply' ? setApplyError : setError)(e.message || 'pdfImport.failed'); }
    finally { lock.current = false; setPhase(null); }
  };
  const showPreview = (value) => {
    if (!value?.fields || !Array.isArray(value.pages)) throw new Error('pdfImport.failed');
    setPreview(value); setFields(value.fields); setPlanRows(value.layout?.planRows?.length ? value.layout.planRows : null); setReviewed(false);
    setPrerequisiteChoice(null); setScanRun(n => n + 1);
  };
  const extractFile = (targetFile) => {
    if (!targetFile) { setError('pdfImport.chooseFile'); return; }
    if (enabled === false) { setError('pdfImport.disabled'); return; }
    return perform(async () => showPreview(await onExtract(targetFile)), 'scan');
  };
  // A scan that was running or finished before this panel opened: wait for it (or read its result) and bring its PDF back.
  // Runs once, on opening; leaving the panel stops waiting (the scan itself goes on on the server).
  const resumeFrom = useRef(resumeJob);
  useEffect(() => {
    const job = resumeFrom.current;
    if (!job || !onResume || disabled) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    let asked = false;
    const onStatus = (status) => {
      if (asked || signal.aborted || !status?.file) return;
      asked = true;
      setResumedFile({ name: status.file.name, size: status.file.size });
      if (onResumeFile) onResumeFile(job, { name: status.file.name, signal }).then(f => { if (!signal.aborted && f) setFile(current => current || f); }).catch(() => {});
    };
    lock.current = true; setPhase('scan'); setError(''); setApplyError('');
    Promise.resolve()
      .then(() => onResume(job, { signal, onStatus }))
      .then(value => { if (!signal.aborted) showPreview(value); })
      .catch(e => { if (!signal.aborted) setError(e.message || 'pdfImport.failed'); })
      .finally(() => { if (!signal.aborted) { lock.current = false; setPhase(null); } });
    return () => { controller.abort(); lock.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = f => {
    if (busy || working || disabled || !f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { setError('pdfImport.invalid'); return; }
    if (f.size > MAX_BYTES) { setError('pdfImport.tooLarge'); return; }
    setFile(f); setResumedFile(null); setPreview(null); setFields(null); setPlanRows(null); setReviewed(false); setError(''); setApplyError('');
    setPrerequisiteChoice(null);
    if (enabled === true) {
      setPendingScan(false);
      extractFile(f);
    } else if (enabled === false) {
      setPendingScan(false);
      setError('pdfImport.disabled');
    } else {
      // Availability is still loading (or being retried): start reading automatically as soon as it resolves.
      setPendingScan(true);
    }
  };
  useEffect(() => {
    if (!pendingScan || !file || busy || working || disabled) return;
    if (enabled === true) {
      setPendingScan(false);
      extractFile(file);
    } else if (enabled === false) {
      setPendingScan(false);
      setError('pdfImport.disabled');
    }
  }, [pendingScan, enabled, file, busy, working, disabled]); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = (next) => {
    if (!reviewed) { setApplyError('pdfImport.reviewRequired'); return; }
    if (mapped?.error) { setApplyError(mapped.error); return; }
    if (mapped?.mismatch) {
      setApplyError(t('pdfImport.identityMismatch', { code: fields.code?.trim(), selected: draft.meta.code }));
      return;
    }
    if (mapped?.prerequisiteConflict && !mapped.prerequisiteConflict.decision) { setApplyError('pdfImport.prereqReviewRequired'); return; }
    if (mapped?.unresolvedMappings?.length) {
      const detail = formatUnresolved(mapped.unresolvedMappings);
      setApplyError(detail ? `${t('pdfImport.unresolvedMappings')} (${detail})` : 'pdfImport.unresolvedMappings');
      return;
    }
    // Template completeness: every section filled; only IV. Pre-requisite may be empty (lib/pdfTemplateScan.js).
    if (scan && !scan.ok) { setApplyError(t('pdfImport.scanBlocked', { sections: scan.missing.map(k => t(`pdfImport.field.${k}`)).join(', ') })); return; }
    return perform(() => onApply(fields, { planRows, prerequisiteChoice, next }), 'apply');
  };
  const editField = (key, value) => { setFields(current => ({ ...current, [key]: value })); setReviewed(false); setApplyError(''); };
  const editRow = (index, key, value) => { setPlanRows(current => current.map((row, i) => i === index ? { ...row, [key]: value } : row)); setReviewed(false); setApplyError(''); };
  const columnLabel = key => key === 'week' ? t('pdfImport.week') : t(`plan.heading.${key}`);
  const blocked = busy || working || disabled;
  return <section className="editor-card up-panel" aria-labelledby="up-title" aria-busy={working}>
    <div className="editor-title"><div>
      <span className="eyebrow">{t('pdfImport.eyebrow')}</span>
      <h2 id="up-title">{t('pdfImport.title')}</h2>
      <p>{t('pdfImport.intro')}</p>
    </div></div>
    {disabled && <div className="info-banner warning" role="status">{disabledReason ? tr(disabledReason) : t('pdfImport.readOnly')}</div>}
    {enabled === null && !configError && <p role="status">{t('pdfImport.availabilityLoading')}</p>}
    {configError && <div className="info-banner warning" role="alert">{t('pdfImport.availabilityFailed')}{' '}<StableButton type="button" className="btn outline" disabled={blocked} onClick={() => setConfigAttempt(n => n + 1)}>{t('pdfImport.retry')}</StableButton></div>}
    {enabled === false && <div className="info-banner warning">{t('pdfImport.disabled')}</div>}
    <fieldset disabled={blocked} className="up-fields">
      <label
        className={'up-dropzone' + (dragging ? ' is-dragging' : '') + (shownFile ? ' has-file' : '') + (phase === 'scan' ? ' is-scanning' : '')}
        onDragEnter={e => { e.preventDefault(); if (!blocked) setDragging(true); }}
        onDragOver={e => { e.preventDefault(); if (!blocked && !dragging) setDragging(true); }}
        onDragLeave={e => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={e => { e.preventDefault(); setDragging(false); if (!blocked) pick(e.dataTransfer?.files?.[0]); }}
      >
        <input type="file" accept=".pdf,application/pdf" className="up-file-input" onChange={e => { pick(e.target.files[0]); e.target.value = ''; }} />
        <span className="up-drop-ico" aria-hidden="true">
          <Icon name={shownFile ? 'filePlus' : 'uploadSimple'} size={22} />
        </span>
        <span className="up-drop-copy">
          <strong>{shownFile ? shownFile.name : t('pdfImport.file')}</strong>
          <small>{shownFile ? [formatFileSize(shownFile.size), tr('Click or drop another PDF to replace')].filter(Boolean).join(' · ') : tr('Drop a PDF here or click to browse')}</small>
        </span>
        {shownFile && phase !== 'scan' && <span className="up-replace-pill" aria-hidden="true">{t('pdfImport.replace')}</span>}
      </label>
      {phase === 'scan' && <ScanningStage fileName={shownFile?.name} fileSize={formatFileSize(shownFile?.size)} />}
      {url && <details className="up-preview"><summary>{t('pdfImport.pdfPreview')}</summary><iframe title={t('pdfImport.pdfPreview')} src={url} /></details>}
      {error && <div className="info-banner warning up-error-row" role="alert">
        <span>{error.startsWith('pdfImport.') ? t(error) : tr(error)}</span>
        {file && enabled !== false && !working && <StableButton type="button" className="btn outline up-retry-btn" disabled={blocked} onClick={() => extractFile(file)}>{t('pdfImport.extract')}</StableButton>}
      </div>}
      {phase === 'apply' && <div className="info-banner" role="status">{t('pdfImport.checking')}</div>}
      {preview && fields && <div className="pdf-import-review">
        <h3>{t('pdfImport.reviewTitle')}</h3>
        <p>{t('pdfImport.reviewNote')}</p>
        {scan && <TemplateScan scan={scan} runKey={scanRun} />}
        <p>{t('pdfImport.pages', { count: preview.pages.length, ocr: preview.pages.filter(p => p.method === 'ocr').length })}</p>
        {preview.pages.some(p => p.method === 'ocr') && <div className="info-banner warning">{t('pdfImport.ocrReview')}</div>}
        {preview.pages.some(p => p.method === 'skipped') && <div className="info-banner warning">{t('pdfImport.skippedPages', { pages: preview.pages.filter(p => p.method === 'skipped').map(p => p.page).join(', ') })}</div>}
        {mapped?.error && <div className="info-banner warning" role="alert">{t(mapped.error)}</div>}
        {mapped?.warnings.length > 0 && <div className="info-banner warning pdf-import-warnings" tabIndex={0} role="region" aria-label={t('pdfImport.reviewTitle')}><ul>{mapped.warnings.map((warning, i) => <li key={i}>{t(warning.key, warning.values)}</li>)}</ul></div>}
        <details><summary>{t('pdfImport.sourceText')}</summary><pre className="pdf-import-source">{preview.text}</pre></details>
        {preview.layout?.warnings?.length > 0 && <div className="info-banner warning">{t('pdfImport.layoutWarning')}</div>}
        {!planRows && <p>{t('pdfImport.formatNote')}</p>}
        {PDF_FIELDS.map((key, index) => <div key={key} className="pdf-import-section">
          {key === 'plan' && planRows ? <>
            <h4>{t('pdfImport.field.plan')}</h4>
            <p>{t('pdfImport.tableNote')}</p>
            <div className="pdf-import-table" tabIndex={0} role="region" aria-label={t('pdfImport.field.plan')}>
              <table><thead><tr>{PLAN_COLUMNS.map(column => <th scope="col" key={column}>{columnLabel(column)}</th>)}<th scope="col">{t('pdfImport.actions')}</th></tr></thead>
                <tbody>{planRows.map((row, i) => <tr key={i}>
                  {PLAN_COLUMNS.map(column => <td key={column}>
                    <textarea rows={column === 'week' ? 2 : 5} aria-label={t('pdfImport.cell', { row: i + 1, field: columnLabel(column) })} value={row[column] || ''} onChange={e => editRow(i, column, e.target.value)} />
                    {column === 'week' && row.sourcePages?.length > 0 && <small>{t('pdfImport.sourcePages', { pages: row.sourcePages.join(', ') })}</small>}
                  </td>)}
                  <td><button type="button" className="btn ghost" onClick={() => { setPlanRows(current => current.filter((_, n) => n !== i)); setReviewed(false); setApplyError(''); }}>{t('pdfImport.removeRow')}</button></td>
                </tr>)}</tbody>
              </table>
            </div>
            <button type="button" className="btn outline" onClick={() => { setPlanRows(current => [...current, { week: '', ilo: '', contents: '', activities: '', tasks: '', values: '', sourcePages: [] }]); setReviewed(false); setApplyError(''); }}>{t('pdfImport.addRow')}</button>
          </> : <label className="field">
            <span>{t(`pdfImport.field.${key}`, { number: index + 1 })}</span>
            <textarea rows={['clos', 'plan', 'refs'].includes(key) ? 7 : 3} maxLength={180000} value={fields[key] || ''} onChange={e => editField(key, e.target.value)} />
          </label>}
          {key === 'clos' && PDF_OUTCOME_FIELDS.some(name => fields[name]?.trim()) && <div className="pdf-import-outcomes">
            <h4>{t('pdfImport.sourceOutcomes')}</h4>
            {PDF_OUTCOME_FIELDS.map(name => <label key={name} className="field"><span>{t(`pdfImport.field.${name}`)}</span><textarea rows={name === 'pos' ? 8 : 4} value={fields[name] || ''} onChange={e => editField(name, e.target.value)} /></label>)}
          </div>}
        </div>)}
        {mapped?.counts && <p>{t('pdfImport.mappingCounts', mapped.counts)}</p>}
        {mapped?.prerequisiteConflict && <fieldset className="pdf-import-prerequisite">
          <legend>{t('pdfImport.prereqConflict')}</legend>
          <p>{t('pdfImport.prereqExisting', { value: mapped.prerequisiteConflict.existing })}</p>
          <p>{t('pdfImport.prereqImported', { value: mapped.prerequisiteConflict.imported })}</p>
          {['keep', 'replace'].map(action => <label key={action}>
            <input type="radio" name="pdf-prerequisite" checked={mapped.prerequisiteConflict.decision === action} onChange={() => {
              setPrerequisiteChoice({ action, existing: mapped.prerequisiteConflict.existing, imported: mapped.prerequisiteConflict.imported });
              setReviewed(false); setApplyError('');
            }} />{t(`pdfImport.prereq${action === 'keep' ? 'Keep' : 'Replace'}`)}
          </label>)}
        </fieldset>}
        <label className="pdf-import-confirm"><input type="checkbox" checked={reviewed} onChange={e => { setReviewed(e.target.checked); setApplyError(''); }} />{t('pdfImport.confirm')}</label>
        {!reviewed && <p className="hint">{t('pdfImport.reviewRequired')}</p>}
        {mapped?.mismatch && <p className="hint">{t('pdfImport.identityMismatch', { code: fields.code?.trim(), selected: draft.meta.code })}</p>}
        {applyError && <div className="info-banner warning" role="alert" tabIndex={-1} ref={applyFeedback}>{applyError.startsWith('pdfImport.') ? t(applyError) : tr(applyError)}</div>}
        <div className="up-actions">
          <StableButton type="button" className="btn outline" disabled={blocked} onClick={() => apply('submit')}>{phase === 'apply' ? t('pdfImport.checking') : t('pdfImport.applySubmit')}</StableButton>
          <StableButton type="button" className="btn primary" disabled={blocked} onClick={() => apply('ai')}>{phase === 'apply' ? t('pdfImport.checking') : t('pdfImport.applyAi')}</StableButton>
        </div>
        <p className="hint">{t('pdfImport.pathNote')}</p>
      </div>}
    </fieldset>
  </section>;
}
