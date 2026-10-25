import { Fragment } from 'react';
import { GROUPS, PLAN_HEADINGS, renderMarkup } from '../../lib/syllabusModel';
import { CURRENT_SCHOOL_YEAR, COLLEGE_NAME, INSTITUTION_NAME, INSTITUTION_ADDRESS } from '../../lib/schoolYear';

const html = (t) => ({ __html: renderMarkup(t) });

// The finished form, read-only, laid out like the institutional form. All free text is escaped before the
// light markup (bullets, bold) is applied. There is no revision date and no modifications checklist:
// the system adds the revision date when the syllabus is approved. Reusable by the admin review.
// A percent as the form prints it: nothing typed stays empty (never 0%).
const pctText = (v) => (String(v == null ? '' : v).trim() === '' || Number.isNaN(Number(v)) ? '' : Number(v) + '%');

export default function FormPaper({ d, model, preparedBy }) {
  const selected = model.outcomesReady(d);
  const I = selected ? model.institutionFor(d) : { vision: '', mission: { lead: '', items: [] } };
  const egas = selected ? model.egaList(d) : []; // this program's own EGAs
  const pos = selected ? model.poList(d) : [];
  const f = model.formulas(d);
  const cloTags = (c) => { const e = c.egas.join('&'); const po = c.pos.join(', '); return (e ? '[EGA ' + e + '] ' : '') + (po ? '[PO ' + po + ']' : ''); };
  const iloTags = (il) => il.tags.map((t) => { const i = model.tagInfo(d, t); return i.kind === 'clo' ? '[CLO' + i.no + ']' : '[' + i.label.replace(' ', '') + ']'; }).join(' ');
  return (
    <div className="paper">
      <div className="paper-head">
        <img className="paper-logo" src="/lcup-logo.png" alt="LCUP logo" />
        <div className="c"><b style={{ fontSize: 14 }}>{INSTITUTION_NAME}</b><br />{INSTITUTION_ADDRESS}</div>
        <img className="paper-logo paper-logo-wide" src="/testmark-logo.png" alt="Testmark logo" />
      </div>
      <div className="c" style={{ marginTop: 8 }}><b>{'SCHOOL YEAR ' + CURRENT_SCHOOL_YEAR.label}</b><br /><b>{COLLEGE_NAME.toUpperCase()}</b></div>
      <div className="kv2"><b>I.</b><b>COURSE CODE</b><span>:</span><span>{d.meta.code}</span></div>
      <div className="kv2"><b>II.</b><b>COURSE TITLE</b><span>:</span><b>{d.meta.title}</b></div>
      <div className="kv2"><b>III.</b><b>COURSE DESCRIPTION</b><span>:</span><span /></div>
      {d.description.filter((x) => x.t.trim()).map((x) => <p key={x.id} className="typed-text" style={{ margin: '4px 0 4px 34px', textAlign: 'justify' }}>{x.t}</p>)}
      <div className="kv2"><b>IV.</b><b>PRE-REQUISITE</b><span>:</span><span>{d.meta.prereq}</span></div>
      <div className="kv2"><b>V.</b><b>CREDIT UNITS</b><span>:</span><span>{d.meta.lecture + ' units lecture / ' + d.meta.lab + ' unit laboratory'}</span></div>
      <div className="kv2"><b>VI.</b><b>COURSE LEARNING OUTCOMES:</b><span /><span /></div>
      <table><tbody>
        <tr><th style={{ width: '40%' }}>Vision</th><th>Mission</th></tr>
        <tr><td>{I.vision}</td><td>{I.mission.lead}<ul>{I.mission.items.map((t, k) => <li key={k}><i>{t}</i></li>)}</ul></td></tr>
      </tbody></table>
      <table><tbody>
        <tr><th style={{ width: '22%' }}>EXPECTED GRADUATE ATTRIBUTES</th><th style={{ width: '36%' }}>PROGRAM OUTCOMES</th><th>COURSE LEARNING OUTCOMES</th></tr>
        <tr>
          <td>{egas.map((e) => <p key={e.no} style={{ margin: '0 0 6px' }}><b>{'EGA ' + e.no}</b>{': ' + e.name}</p>)}</td>
          <td>{pos.length ? pos.map((o) => <p key={o.no} style={{ margin: '0 0 4px' }}><b>{'PO ' + o.no + '.'}</b>{' ' + o.text + ' '}<b>{o.egas.map((g) => '[EGA ' + g + ']').join(' ')}</b></p>) : <span className="m">No program outcomes loaded.</span>}</td>
          <td>{d.clos.map((c, i) => <p key={c.id} style={{ margin: '0 0 8px' }}><b>{'CLO ' + (i + 1) + ' – ' + c.level + (c.title ? ' (' + c.title + ')' : '')}</b><br />{c.statement + ' '}<b>{cloTags(c)}</b></p>)}</td>
        </tr>
      </tbody></table>
      <div className="kv2"><b>VII.</b><b>LEARNING PLAN:</b><span /><span /></div>
      <table>
        <colgroup><col style={{ width: '12%' }} /><col style={{ width: '22%' }} /><col style={{ width: '15%' }} /><col style={{ width: '18%' }} /><col style={{ width: '17%' }} /><col /></colgroup>
        <tbody>
          <tr><th>SCHEDULE</th>{Object.values(PLAN_HEADINGS).map((h) => <th key={h}>{h.toUpperCase()}</th>)}</tr>
          {d.plan.map((r) => (
            <tr key={r.id}>
              <td>{'Week ' + r.week}</td>
              <td>{r.kind === 'exam' ? <div className="typed-text">{r.ilos[0] ? r.ilos[0].text : ''}</div> : r.ilos.map((il, j) => <div key={il.id} className="typed-text" style={{ marginBottom: 4 }}><b>{'ILO' + (j + 1) + ': '}</b>{il.text + ' '}<b>{iloTags(il)}</b></div>)}</td>
              <td dangerouslySetInnerHTML={html(r.contents)} />
              <td dangerouslySetInnerHTML={html(r.activities)} />
              <td dangerouslySetInnerHTML={html(r.tasks)} />
              <td dangerouslySetInnerHTML={html(r.values)} />
            </tr>
          ))}
        </tbody>
      </table>
      <div className="kv2"><b>VIII.</b><b>COURSE REQUIREMENTS</b><span>:</span><span /></div>
      <ol style={{ margin: '2px 0 2px 34px', paddingLeft: 18 }}>{d.reqs.filter((r) => r.t.trim()).map((r) => <li key={r.id}>{r.t}</li>)}</ol>
      <div className="kv2"><b>IX.</b><b>REFERENCES</b><span>:</span><span /></div>
      {GROUPS.map(([key, title], gi) => {
        const grp = d.refs[key];
        return (
          <div key={key} style={{ marginLeft: 34 }}>
            <b>{String.fromCharCode(65 + gi) + '. ' + title.toUpperCase()}</b>
            {grp.na ? <div className="m">Not applicable.</div> : grp.items.filter((r) => r.t.trim()).map((r) => <div key={r.id} style={{ margin: '2px 0' }}>{r.t}</div>)}
          </div>
        );
      })}
      <div className="kv2" style={{ marginTop: 10 }}><b>X.</b><b>GRADING SYSTEM</b><span>:</span><span /></div>
      <div style={{ marginLeft: 34, display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) minmax(0, 1.4fr)', rowGap: 2 }}>
        {d.grading.rows.map((r, i) => {
          const parts = String(r.parts || '').split(',').map((x) => x.trim()).filter(Boolean);
          return (
            <Fragment key={r.id}>
              <span>{(i + 1) + '.'}</span><span>{r.label}</span><span>{pctText(r.pct)}</span>
              {parts.map((p, k) => <Fragment key={k}><span /><span style={{ paddingLeft: 8 }}>{p}</span><span /></Fragment>)}
            </Fragment>
          );
        })}
        <span>{(d.grading.rows.length + 1) + '.'}</span><span>Term Grade</span><span>{f.term.replace('Term Grade = ', '')}</span>
        <span>{(d.grading.rows.length + 2) + '.'}</span><span>Final Rating</span><span style={{ textDecoration: 'underline' }}>{f.final.replace('Final Rating = ', '')}</span>
        <span><b>{(d.grading.rows.length + 3) + '.'}</b></span><span><b>Passing Grade:</b></span><span><b>{pctText(d.grading.passing)}</b></span>
      </div>
      <table style={{ marginTop: 14 }}><tbody><tr>
        <td>Prepared by:<br /><br /><b>{preparedBy}</b></td>
        <td>Checked and Reviewed by:<br /><br /><b className="m">Added by the system on review</b></td>
        <td>Approved by:<br /><br /><b className="m">Added by the system on approval</b></td>
      </tr></tbody></table>
    </div>
  );
}
