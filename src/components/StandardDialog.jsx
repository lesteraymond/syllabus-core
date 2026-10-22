import { useEffect, useMemo, useRef, useState } from 'react';
import StableButton from './StableButton';
import { useModalLayer } from './useModalLayer';
import { adminSettings } from '../lib/api';
import { t as translateUI, tr } from '../i18n/index.js';

// The administrator's read-only view of the standard the AI Checker applies (GET /api/settings/standard). Nothing here can be edited: the
// standard is changed by the developers, in the file the checker reads. Rule messages carry {placeholders} that the checker fills in; they
// are shown as "…" here.
const AREA_TEXT = { template: 'standard.area_template', completeness: 'standard.area_completeness', co_po: 'standard.area_co_po', assessment: 'standard.area_assessment', contact_hours: 'standard.area_contact_hours', reference_currency: 'standard.area_reference_currency' };
const CODES = ['T', 'C', 'P', 'A', 'H', 'R', 'J'];
const SEVERITY = { blocking: 'standard.sev_blocking', major: 'standard.sev_major', minor: 'standard.sev_minor' };
// "Excellent 90–100": each band runs from its own minimum to one below the next band up.
const bandRanges = (bands) => [...bands].sort((a, b) => b.min - a.min).map((b, i, all) => b.label + ' ' + b.min + '–' + (i === 0 ? 100 : all[i - 1].min - 1));
const plain = (message) => String(message || '').replace(/\{[^}]+\}/g, '…');

export default function StandardDialog({ onClose }) {
  const dialog = useRef(null);
  useModalLayer(dialog, onClose);
  const [state, setState] = useState({ standard: null, error: '' });
  const [q, setQ] = useState('');
  useEffect(() => {
    let live = true;
    adminSettings.standard().then((r) => { if (live) setState({ standard: r.standard, error: '' }); }, () => { if (live) setState({ standard: null, error: translateUI('standard.failed') }); });
    return () => { live = false; };
  }, []);

  const std = state.standard;
  const rules = useMemo(() => {
    if (!std) return [];
    const ws = q.toLowerCase().split(/\s+/).filter(Boolean);
    return std.rules.filter((r) => ws.every((w) => (r.id + ' ' + r.message + ' ' + r.area + ' ' + r.severity).toLowerCase().includes(w)));
  }, [std, q]);

  return (
    <div className="overlay overlay-confirm" onClick={onClose}>
      <section className="modal std-dialog" role="dialog" aria-modal="true" aria-labelledby="std-title" tabIndex={-1} ref={dialog} onClick={(e) => e.stopPropagation()}>
        <header className="std-head">
          <div>
            <h3 id="std-title">{std ? std.title : translateUI('standard.view')}</h3>
            <p className="muted">{translateUI('standard.title_note')}</p>
          </div>
          <StableButton type="button" className="btn outline" onClick={onClose}>{translateUI('standard.close')}</StableButton>
        </header>
        {!std && !state.error && <p role="status">{translateUI('standard.loading')}</p>}
        {state.error && <p role="alert">{state.error}</p>}
        {std && <div className="std-body">
          <div className="std-facts">
            <div><small>{translateUI('standard.form_label')}</small><strong>{std.form}</strong></div>
            <div><small>{translateUI('standard.pass_mark')}</small><strong>{std.passThreshold}%</strong></div>
            <div><small>{translateUI('standard.score_bands')}</small><strong>{bandRanges(std.bands).join(' · ')}</strong></div>
          </div>

          <h4>{translateUI('standard.how_title')}</h4>
          <ol className="std-how">{[1, 2, 3, 4].map((n) => <li key={n}>{translateUI('standard.how_' + n)}</li>)}</ol>

          <h4>{translateUI('standard.areas_title')}</h4>
          <div className="table-wrap"><table>
            <thead><tr><th>{translateUI('standard.col_area')}</th><th className="num">{translateUI('standard.col_area_weight')}</th></tr></thead>
            <tbody>{std.areas.map((a) => <tr key={a.key}><td><strong>{tr(a.name)}</strong><small className="muted std-note">{AREA_TEXT[a.key] ? translateUI(AREA_TEXT[a.key]) : ''}</small></td><td className="num">{a.weight}</td></tr>)}</tbody>
            <tfoot><tr><th>{translateUI('standard.total_weight')}</th><th className="num">{std.areas.reduce((n, a) => n + a.weight, 0)}</th></tr></tfoot>
          </table></div>

          <h4>{translateUI('standard.rules_title')} <span className="muted">({rules.length})</span></h4>
          <ul className="std-legend">{['blocking', 'major', 'minor'].map((k) => <li key={k}><span className={'chip std-sev ' + k}>{translateUI(SEVERITY[k])}</span> {translateUI('standard.legend_' + k).split(': ')[1]}</li>)}</ul>
          <input className="std-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={translateUI('standard.search_rules')} aria-label={translateUI('standard.search_rules')} />
          <div className="table-wrap"><table className="std-rules">
            <thead><tr><th>{translateUI('standard.col_code')}</th><th>{translateUI('standard.col_rule')}</th><th>{translateUI('standard.col_explain')}</th><th>{translateUI('standard.col_severity')}</th><th className="num">{translateUI('standard.col_weight')}</th></tr></thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id}</td>
                  <td>{tr(plain(r.message))}</td>
                  <td>{r.fix ? tr(r.fix) : ''}{r.note && <small className="muted std-note">{r.note}</small>}</td>
                  <td><span className={'chip std-sev ' + r.severity}>{translateUI(SEVERITY[r.severity] || SEVERITY.minor)}</span></td>
                  <td className="num" title={translateUI('standard.rule_weight')}>{r.weight}</td>
                </tr>
              ))}
              {!rules.length && <tr><td colSpan="5" className="muted">{translateUI('standard.no_match')}</td></tr>}
            </tbody>
            <tfoot><tr><th colSpan="4">{translateUI('standard.total_points')}</th><th className="num">{rules.reduce((n, r) => n + r.weight, 0)}</th></tr></tfoot>
          </table></div>

          <h4>{translateUI('standard.codes_title')}</h4>
          <ul className="std-codes">{CODES.map((c) => (
            <li key={c}><span className="chip mono">{c}-</span><span>{translateUI('standard.code_' + c)}</span><small className="muted">{translateUI('standard.code_count', { p0: std.rules.filter((r) => r.id.startsWith(c + '-')).length })}</small></li>
          ))}</ul>

          {std.pending.length > 0 && <>
            <h4>{translateUI('standard.pending_title')}</h4>
            <p className="muted">{translateUI('standard.pending_note')}</p>
            <ul className="std-pending">{std.pending.map((x) => <li key={x}>{tr(x)}</li>)}</ul>
          </>}
        </div>}
      </section>
    </div>
  );
}
