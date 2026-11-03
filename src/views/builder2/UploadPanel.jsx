import StableButton from '../../components/StableButton';
import { t, tr } from '../../i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { syllabi } from '../../lib/api';
import { PDF_FIELDS, PDF_OUTCOME_FIELDS, mapPdfFields } from '../../lib/pdfImport';

const MAX_BYTES = 10 * 1024 * 1024;
const PLAN_COLUMNS = ['week', 'ilo', 'contents', 'activities', 'tasks', 'values'];
// Preview only; confirmation saves through useDraft, never file submission.
export default function UploadPanel({ draft, hasCourse, busy, disabled, disabledReason, onChooseCourse, onExtract, onApply }) {
  const [file, setFile] = useState(null);
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
  const pick = f => {
    if (busy || working || disabled || !f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { setError('pdfImport.invalid'); return; }
    if (f.size > MAX_BYTES) { setError('pdfImport.tooLarge'); return; }
    setFile(f); setPreview(null); setFields(null); setPlanRows(null); setReviewed(false); setError(''); setApplyError('');
    setPrerequisiteChoice(null);
  };
  const perform = async (action, nextPhase) => {
    if (lock.current) return;
    lock.current = true; setPhase(nextPhase); setError(''); setApplyError('');
    try { await action(); }
    catch (e) { (nextPhase === 'apply' ? setApplyError : setError)(e.message || 'pdfImport.failed'); }
    finally { lock.current = false; setPhase(null); }
  };
  const extract = () => {
    // Let the click explain missing prerequisites instead of silently disabling
    // the action. The API remains authoritative for availability and access.
    if (!file) { setError('pdfImport.chooseFile'); return; }
    if (!hasCourse) { setError('pdfImport.chooseSubject'); return; }
    if (enabled === false) { setError('pdfImport.disabled'); return; }
    return perform(async () => {
      const value = await onExtract(file);
      if (!value?.fields || !Array.isArray(value.pages)) throw new Error('pdfImport.failed');
      setPreview(value); setFields(value.fields); setPlanRows(value.layout?.planRows?.length ? value.layout.planRows : null); setReviewed(false);
      setPrerequisiteChoice(null);
    }, 'scan');
  };
  const apply = () => {
    if (!reviewed) { setApplyError('pdfImport.reviewRequired'); return; }
    if (mapped?.error) { setApplyError(mapped.error); return; }
    if (mapped?.mismatch) {
      setApplyError(t('pdfImport.identityMismatch', { code: fields.code?.trim(), selected: draft.meta.code }));
      return;
    }
    if (mapped?.prerequisiteConflict && !mapped.prerequisiteConflict.decision) { setApplyError('pdfImport.prereqReviewRequired'); return; }
    if (mapped?.unresolvedMappings?.length) { setApplyError('pdfImport.unresolvedMappings'); return; }
    return perform(() => onApply(fields, { planRows, prerequisiteChoice }), 'apply');
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
    {!hasCourse && <div className="info-banner warning">{t('pdfImport.chooseSubject')}{' '}<button type="button" className="link-btn" onClick={onChooseCourse}>{t('pdfImport.choose')}</button></div>}
    {disabled && <div className="info-banner warning" role="status">{disabledReason ? tr(disabledReason) : t('pdfImport.readOnly')}</div>}
    {enabled === null && !configError && <p role="status">{t('pdfImport.availabilityLoading')}</p>}
    {configError && <div className="info-banner warning" role="alert">{t('pdfImport.availabilityFailed')}{' '}<StableButton type="button" className="btn outline" disabled={blocked} onClick={() => setConfigAttempt(n => n + 1)}>{t('pdfImport.retry')}</StableButton></div>}
    {enabled === false && <div className="info-banner warning">{t('pdfImport.disabled')}</div>}
    <fieldset disabled={blocked} className="up-fields">
      <label className="field"><span>{t('pdfImport.file')}</span><input type="file" accept=".pdf,application/pdf" onChange={e => { pick(e.target.files[0]); e.target.value = ''; }} /></label>
      {file && <p>{file.name}</p>}
      {url && <details className="up-preview"><summary>{t('pdfImport.pdfPreview')}</summary><iframe title={t('pdfImport.pdfPreview')} src={url} /></details>}
      {error && <div className="info-banner warning" role="alert">{error.startsWith('pdfImport.') ? t(error) : tr(error)}</div>}
      {phase === 'apply' && <div className="info-banner" role="status">{t('pdfImport.checking')}</div>}
      <StableButton type="button" className="btn primary" disabled={blocked} onClick={extract}>{phase === 'scan' ? t('pdfImport.extracting') : t('pdfImport.extract')}</StableButton>
      {preview && fields && <div className="pdf-import-review">
        <h3>{t('pdfImport.reviewTitle')}</h3>
        <p>{t('pdfImport.reviewNote')}</p>
        <p>{t('pdfImport.pages', { count: preview.pages.length, ocr: preview.pages.filter(p => p.method === 'ocr').length })}</p>
        {preview.pages.some(p => p.method === 'ocr') && <div className="info-banner warning">{t('pdfImport.ocrReview')}</div>}
        {mapped?.error && <div className="info-banner warning" role="alert">{t(mapped.error)}</div>}
        {mapped?.warnings.length > 0 && <div className="info-banner warning"><ul>{mapped.warnings.map((warning, i) => <li key={i}>{t(warning.key, warning.values)}</li>)}</ul></div>}
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
        <div className="up-actions"><StableButton type="button" className="btn primary" disabled={blocked} onClick={apply}>{phase === 'apply' ? t('pdfImport.checking') : t('pdfImport.apply')}</StableButton></div>
      </div>}
    </fieldset>
  </section>;
}
