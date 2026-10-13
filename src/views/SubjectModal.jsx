import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { courses as coursesApi, outcomes as outcomesApi } from '../lib/api';
import { LEVELS, createModel } from '../lib/syllabusModel';
import { CURRENT_SCHOOL_YEAR } from '../lib/schoolYear';
import { Auto, Ic, OutcomePicker, Tag } from './builder2/parts';

// Everything an administrator manages for one subject, in one modal. Five cards, each saved on its own:
//   1. Vision and mission      school-wide
//   2. Expected graduate attributes (EGAs)   this subject's program, shared by all its subjects
//   3. Program outcomes (POs)  this subject's program, shared by all its subjects
//   4. Course learning outcomes (CLOs)       this subject only; tagged with the program's EGAs and POs
//   5. Subject details         this subject only
// No collisions: a card sends only its own data plus the version it loaded; if someone else saved first the server
// answers "changed by someone else", the card keeps what was typed and offers Reload. EGA/PO numbers never change once
// saved and the server refuses to remove one a CLO still uses. Faculty see all of this read-only in the builder.

// What is still missing before faculty can complete the Learning Outcomes step for this subject (the same checks the server
// makes on submit and lists beside each subject). Computed here from what the modal already loaded.
const blank = (v) => !String(v == null ? '' : v).trim();
function setupGaps({ inst, program, course }) {
  const gaps = [];
  if (blank(inst.vision)) gaps.push('the vision');
  if (blank(inst.mission.lead) || !inst.mission.items.some((t) => !blank(t))) gaps.push('the mission');
  if (!program.egas.length) gaps.push('the ' + program.code + ' graduate attributes (EGAs)');
  if (!program.pos.length) gaps.push('the ' + program.code + ' program outcomes');
  if (!course.clos.length) gaps.push('the learning outcomes of ' + course.code);
  return gaps;
}

let tmp = 0;
const STALE = /changed by someone else/i;

// One independent save: tracks busy, the server's message, and whether the screen is out of date.
function useSave() {
  const [st, setSt] = useState({ busy: false, error: '', stale: false });
  const run = async (fn) => {
    setSt({ busy: true, error: '', stale: false });
    try { await fn(); setSt({ busy: false, error: '', stale: false }); return true; }
    catch (e) { setSt({ busy: false, error: e.message, stale: STALE.test(e.message) }); return false; }
  };
  return [st, run];
}

function Card({ title, scope, note, dirty, st, onSave, onReload, canSave = true, saveLabel = 'Save', children }) {
  return (
    <section className="sm-card">
      <header className="sm-card-h"><h4>{title}</h4><span className="sm-scope">{scope}</span></header>
      {note && <p className="sm-note">{note}</p>}
      <div className="sm-card-b">{children}</div>
      <footer className="sm-card-f">
        <span className="hint" role="status">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        {st.stale
          ? <span className="sm-stale" role="alert">This was changed by someone else. Reload to see the latest. <button type="button" className="asg-link" onClick={onReload}>Reload</button></span>
          : st.error && <span className="ie-err" role="alert">{st.error}</span>}
        <button type="button" className="asg-btn primary sm" disabled={!dirty || st.busy || !canSave} onClick={onSave}>{st.busy ? 'Saving…' : saveLabel}</button>
      </footer>
    </section>
  );
}

// ---- 1. vision and mission (school-wide) ----
function VisionCard({ inst, onSaved, onReload, setDirty, notify }) {
  const [form, setForm] = useState(() => ({ vision: inst.vision, lead: inst.mission.lead, items: inst.mission.items.map((t) => ({ key: ++tmp, t })) }));
  const [dirty, setD] = useState(false);
  const [st, run] = useSave();
  const mark = (v) => { setD(v); setDirty(v); };
  const edit = (fn) => { setForm((c) => { const n = { ...c, items: c.items.map((x) => ({ ...x })) }; fn(n); return n; }); mark(true); };
  const move = (i, d) => edit((n) => { const j = i + d; if (j >= 0 && j < n.items.length) n.items.splice(j, 0, n.items.splice(i, 1)[0]); });
  const valid = form.vision.trim() && form.lead.trim() && form.items.length && form.items.every((x) => x.t.trim());
  const save = () => run(async () => {
    const saved = await outcomesApi.saveInstitution({ vision: form.vision, mission: { lead: form.lead, items: form.items.map((x) => x.t) }, egas: inst.egas, version: inst.version });
    mark(false); onSaved(saved); notify('Vision and mission saved. They apply to every program.');
  });
  return (
    <Card title="Vision and mission" scope="School-wide · all programs" dirty={dirty} st={st} onSave={save} onReload={onReload} canSave={!!valid}>
      <label className="field full"><span>Vision</span><Auto className="in" value={form.vision} label="Vision" placeholder="The institution's vision" onChange={(v) => edit((n) => { n.vision = v; })} /></label>
      <label className="field full" style={{ marginTop: 10 }}><span>Mission, introduction</span><Auto className="in" value={form.lead} label="Mission introduction" placeholder="... programs and services that will enable them to:" onChange={(v) => edit((n) => { n.lead = v; })} /></label>
      <span className="lbl" style={{ marginTop: 10 }}>Mission statements</span>
      {form.items.map((x, i) => (
        <div className="ie-row" key={x.key}>
          <span className="mono ie-no">{i + 1}.</span>
          <Auto className="in" value={x.t} label={'Mission statement ' + (i + 1)} placeholder="Mission statement" onChange={(v) => edit((n) => { n.items[i].t = v; })} />
          <span className="ie-tools">
            <button type="button" className="ib" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><Ic n="up" /></button>
            <button type="button" className="ib" aria-label="Move down" disabled={i === form.items.length - 1} onClick={() => move(i, 1)}><Ic n="down" /></button>
            <button type="button" className="ib del" aria-label="Remove statement" disabled={form.items.length < 2} onClick={() => edit((n) => { n.items.splice(i, 1); })}><Ic n="trash" /></button>
          </span>
        </div>
      ))}
      <button type="button" className="link" disabled={form.items.length >= 20} onClick={() => edit((n) => { n.items.push({ key: ++tmp, t: '' }); })}>+ Add mission statement</button>
    </Card>
  );
}

const sharedNote = (program, course) => {
  const others = program.subjects.filter((c) => c !== course.code);
  return others.length ? `Shared with ${others.length} other ${program.code} subject${others.length === 1 ? '' : 's'}: ${others.slice(0, 6).join(', ')}${others.length > 6 ? '…' : ''}. A change here applies to all of them.` : `Only ${course.code} uses these in ${program.code} for now.`;
};

// ---- 2. EGAs (this program) ----
function EgaCard({ program, course, onSaved, onReload, setDirty, notify }) {
  const [rows, setRows] = useState(() => program.egas.map((e) => ({ key: ++tmp, ...e })));
  const [dirty, setD] = useState(false);
  const [st, run] = useSave();
  const mark = (v) => { setD(v); setDirty(v); };
  const edit = (fn) => { setRows((c) => { const n = c.map((x) => ({ ...x })); fn(n); return n; }); mark(true); };
  const valid = rows.length && rows.every((e) => e.name.trim() && e.short.trim());
  const removed = program.egas.filter((e) => !rows.some((r) => r.no === e.no));
  const save = () => {
    if (removed.length && program.subjects.length > 1 && !window.confirm(`${removed.map((e) => 'EGA ' + e.no).join(', ')} will be removed for all ${program.subjects.length} ${program.code} subjects. Continue?`)) return Promise.resolve();
    return run(async () => {
      const saved = await outcomesApi.saveProgramEgas(program.code, rows.map((e) => ({ no: e.no, name: e.name, short: e.short })), program.versions.egas);
      mark(false); onSaved(saved); notify(`${program.code} EGAs saved.`);
    });
  };
  return (
    <Card title="Expected graduate attributes" scope={program.code + ' · all subjects'} note={sharedNote(program, course)} dirty={dirty} st={st} onSave={save} onReload={onReload} canSave={!!valid}>
      <p className="hint">The number is fixed once saved: program outcomes and CLOs point at it. One that is still tagged cannot be removed.</p>
      {rows.map((e, i) => (
        <div className="ie-ega" key={e.key}>
          <span className="code ref mono">{'EGA ' + e.no}</span>
          <input className="in" value={e.name} maxLength={255} placeholder="Full name" aria-label={'Name of EGA ' + e.no} onChange={(ev) => { const v = ev.target.value; edit((n) => { n[i].name = v; }); }} />
          <input className="in" value={e.short} maxLength={120} placeholder="Short name" aria-label={'Short name of EGA ' + e.no} onChange={(ev) => { const v = ev.target.value; edit((n) => { n[i].short = v; }); }} />
          <button type="button" className="ib del" aria-label={'Remove EGA ' + e.no} disabled={rows.length < 2} onClick={() => edit((n) => { n.splice(i, 1); })}><Ic n="trash" /></button>
        </div>
      ))}
      <button type="button" className="link" disabled={rows.length >= 20} onClick={() => edit((n) => { n.push({ key: ++tmp, no: Math.max(0, ...n.map((r) => r.no), ...program.egas.map((r) => r.no)) + 1, name: '', short: '' }); })}>+ Add EGA</button>
    </Card>
  );
}

// ---- 3. program outcomes (this program) ----
function PoCard({ program, course, onSaved, onReload, setDirty, notify }) {
  const [rows, setRows] = useState(() => program.pos.map((p) => ({ key: ++tmp, ...p, egas: [...p.egas] })));
  const [dirty, setD] = useState(false);
  const [st, run] = useSave();
  const mark = (v) => { setD(v); setDirty(v); };
  const edit = (fn) => { setRows((c) => { const n = c.map((x) => ({ ...x, egas: [...x.egas] })); fn(n); return n; }); mark(true); };
  const toggleEga = (i, no) => edit((n) => { n[i].egas = n[i].egas.includes(no) ? n[i].egas.filter((v) => v !== no) : [...n[i].egas, no].sort((a, b) => a - b); });
  const valid = rows.every((r) => r.short.trim() && r.text.trim());
  const removed = program.pos.filter((p) => !rows.some((r) => r.no === p.no));
  const save = () => {
    if (removed.length && program.subjects.length > 1 && !window.confirm(`${removed.map((p) => 'PO ' + p.no).join(', ')} will be removed for all ${program.subjects.length} ${program.code} subjects. Continue?`)) return Promise.resolve();
    return run(async () => {
      const saved = await outcomesApi.saveProgram(program.code, rows.map((r) => ({ no: r.no, short: r.short, text: r.text, egas: r.egas })), program.versions.pos);
      mark(false); onSaved(saved); notify(`${program.code} program outcomes saved.`);
    });
  };
  return (
    <Card title="Program outcomes" scope={program.code + ' · all subjects'} note={sharedNote(program, course)} dirty={dirty} st={st} onSave={save} onReload={onReload} canSave={!!valid}>
      <p className="hint">The number is fixed once saved. One that a subject's CLO is tagged with cannot be removed.</p>
      {!rows.length && <div className="info-banner warning">No program outcomes for {program.code} yet. Faculty see an empty list until you add them.</div>}
      {rows.map((r, i) => (
        <div className="ie-po" key={r.key}>
          <span className="code ref mono">{'PO ' + r.no}</span>
          <div>
            <input className="in" value={r.short} maxLength={120} placeholder="Short name" aria-label={'Short name of PO ' + r.no} onChange={(e) => { const v = e.target.value; edit((n) => { n[i].short = v; }); }} />
            <div style={{ marginTop: 8 }}><Auto className="in" value={r.text} label={'Statement of PO ' + r.no} placeholder="Full statement" onChange={(v) => edit((n) => { n[i].text = v; })} /></div>
            <div className="ie-egas" role="group" aria-label={'EGAs supported by PO ' + r.no}>
              <span className="hint">Supports</span>
              {program.egas.map((e) => (
                <label key={e.no} className={'ie-chip' + (r.egas.includes(e.no) ? ' on' : '')} title={e.name}>
                  <input type="checkbox" checked={r.egas.includes(e.no)} onChange={() => toggleEga(i, e.no)} />{'EGA ' + e.no}
                </label>
              ))}
            </div>
          </div>
          <button type="button" className="ib del" aria-label={'Remove PO ' + r.no} onClick={() => edit((n) => { n.splice(i, 1); })}><Ic n="trash" /></button>
        </div>
      ))}
      <button type="button" className="link" disabled={rows.length >= 50} onClick={() => edit((n) => { n.push({ key: ++tmp, no: Math.max(0, ...n.map((r) => r.no), ...program.pos.map((r) => r.no)) + 1, short: '', text: '', egas: [] }); })}>+ Add program outcome</button>
    </Card>
  );
}

// ---- 4. CLOs (this subject) ----
function ClosCard({ course, program, model, onSaved, onReload, setDirty, notify }) {
  const [clos, setClos] = useState(() => course.clos.map((c) => ({ ...c, key: c.id })));
  const [dirty, setD] = useState(false);
  const [picker, setPicker] = useState(null);
  const [st, run] = useSave();
  const mark = (v) => { setD(v); setDirty(v); };
  const edit = (fn) => { setClos((cur) => { const n = cur.map((c) => ({ ...c, egas: [...c.egas], pos: [...c.pos] })); fn(n); return n; }); mark(true); };
  const toggle = (arr, n) => (arr.includes(n) ? arr.filter((v) => v !== n) : [...arr, n].sort((a, b) => a - b));
  const pseudo = { meta: { program: program.code }, clos };
  const pc = picker && clos[picker.i];
  const valid = clos.every((c) => c.statement.trim());
  const remove = (i) => {
    if (clos[i].id && !window.confirm('Delete CLO ' + (i + 1) + '? ILOs in saved syllabi that are tagged with it will show the tag as unresolved until faculty fix them.')) return;
    edit((n) => { n.splice(i, 1); });
  };
  const save = () => run(async () => {
    const saved = await coursesApi.saveClos(course.id, clos.map((c) => ({ id: c.id, title: c.title, level: c.level, statement: c.statement, egas: c.egas, pos: c.pos })), course.version);
    mark(false); onSaved(saved); notify('Learning outcomes saved. Faculty see them the next time they open the subject.');
  });
  return (
    <Card title="Course learning outcomes" scope={course.code + ' only'} dirty={dirty} st={st} onSave={save} onReload={onReload} canSave={!!valid} saveLabel="Save outcomes">
      {!clos.length && <div className="info-banner warning">This subject has no learning outcomes yet. Faculty cannot tag their ILOs until you add them.</div>}
      {clos.map((c, i) => (
        <div className="clorow" key={c.key || c.tmp}>
          <div><span className={'code lg k' + (i % 6)}>{'CLO ' + (i + 1)}</span></div>
          <div>
            <div className="cap">
              <select className="sel" value={c.level} aria-label={'Level of CLO ' + (i + 1)} onChange={(e) => { const v = e.target.value; edit((n) => { n[i].level = v; }); }}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                <button type="button" className="ib" aria-label={'Move CLO ' + (i + 1) + ' up'} disabled={i === 0} onClick={() => edit((n) => { n.splice(i - 1, 0, n.splice(i, 1)[0]); })}><Ic n="up" /></button>
                <button type="button" className="ib" aria-label={'Move CLO ' + (i + 1) + ' down'} disabled={i === clos.length - 1} onClick={() => edit((n) => { n.splice(i + 1, 0, n.splice(i, 1)[0]); })}><Ic n="down" /></button>
                <button type="button" className="ib del" aria-label={'Delete CLO ' + (i + 1)} onClick={() => remove(i)}><Ic n="trash" /></button>
              </span>
            </div>
            <input className="in" value={c.title} maxLength={255} placeholder="Descriptor, e.g. Foundational Knowledge" aria-label={'Title of CLO ' + (i + 1)} onChange={(e) => { const v = e.target.value; edit((n) => { n[i].title = v; }); }} />
            <div style={{ marginTop: 8 }}><Auto className="in" value={c.statement} label={'Statement of CLO ' + (i + 1)} placeholder="What students will be able to do" onChange={(v) => edit((n) => { n[i].statement = v; })} /></div>
          </div>
          <div className="col2">
            <span className="lbl">Expected graduate attributes</span>
            <div className="tags">
              {c.egas.map((no) => <Tag key={'e' + no} info={model.tagInfo(pseudo, 'ega:' + no)} onRemove={() => edit((n) => { n[i].egas = n[i].egas.filter((v) => v !== no); })} />)}
              <button type="button" className="tagbtn" onClick={(e) => setPicker({ i, kind: 'ega', rect: e.currentTarget.getBoundingClientRect() })}>+ EGA</button>
            </div>
            <span className="lbl" style={{ marginTop: 12 }}>Program outcomes</span>
            <div className="tags">
              {c.pos.map((no) => <Tag key={'p' + no} info={model.tagInfo(pseudo, 'po:' + no)} onRemove={() => edit((n) => { n[i].pos = n[i].pos.filter((v) => v !== no); })} />)}
              <button type="button" className="tagbtn" onClick={(e) => setPicker({ i, kind: 'po', rect: e.currentTarget.getBoundingClientRect() })}>+ PO</button>
            </div>
            {model.missingEgas(pseudo, c).length > 0 && (
              <div className="taghint" style={{ marginTop: 8 }}>The program outcomes you chose support {model.missingEgas(pseudo, c).map((g) => (
                <button type="button" className="link" key={g} onClick={() => edit((n) => { n[i].egas = toggle(n[i].egas, g); })}>{'+ EGA ' + g + ' ' + model.egaList(pseudo).find((e) => e.no === g).short}</button>
              ))}</div>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="btn outline" disabled={clos.length >= 20} onClick={() => edit((n) => { n.push({ tmp: ++tmp, id: null, title: '', level: 'Enabling', statement: '', egas: [], pos: [] }); })}>+ Add CLO</button>
      {picker && pc && (
        <OutcomePicker model={model} d={pseudo} kinds={[picker.kind]} rect={picker.rect} title="Tag outcomes"
          selected={(picker.kind === 'ega' ? pc.egas : pc.pos).map((no) => picker.kind + ':' + no)}
          onClose={() => setPicker(null)}
          onToggle={(t) => { const no = Number(t.split(':')[1]); edit((n) => { const k = picker.kind === 'ega' ? 'egas' : 'pos'; n[picker.i][k] = toggle(n[picker.i][k], no); }); }} />
      )}
    </Card>
  );
}

// ---- 5. subject details ----
function DetailsCard({ course, onSaved, onDeleted, setDirty, notify }) {
  const [head, setHead] = useState({ code: course.code, title: course.title });
  const [dirty, setD] = useState(false);
  const [st, run] = useSave();
  const mark = (v) => { setD(v); setDirty(v); };
  const change = (k, v) => { setHead((h) => ({ ...h, [k]: v })); mark(true); };
  const save = () => run(async () => { const saved = await coursesApi.update(course.id, head); mark(false); onSaved(saved); notify('Subject saved.'); });
  const remove = async () => {
    if (!window.confirm('Delete ' + course.code + '? Syllabi that use it keep the outcomes they were saved with, but new drafts can no longer pick it.')) return;
    try { await coursesApi.remove(course.id); notify('Subject deleted.'); onDeleted(); } catch (e) { notify('Delete failed: ' + e.message); }
  };
  return (
    <Card title="Subject details" scope={course.code + ' only'} dirty={dirty} st={st} onSave={save} onReload={() => {}} canSave={!!(head.code.trim() && head.title.trim())}>
      <div className="form-grid">
        <label className="field"><span>Subject code</span><input className="mono" value={head.code} maxLength={50} onChange={(e) => change('code', e.target.value)} /></label>
        <label className="field"><span>Subject title</span><input value={head.title} maxLength={255} onChange={(e) => change('title', e.target.value)} /></label>
      </div>
      <button type="button" className="asg-link sm-del" onClick={remove}>Delete this subject</button>
    </Card>
  );
}

export default function SubjectModal({ courseId, onClose, onChanged, notify }) {
  const [data, setData] = useState(null); // { course, program, inst }
  const [error, setError] = useState('');
  const dirty = useRef({});
  const setDirtyFor = (key) => (v) => { dirty.current[key] = v; };

  const load = useCallback(async () => {
    const course = await coursesApi.get(courseId);
    const [program, inst] = await Promise.all([outcomesApi.program(course.program.code), outcomesApi.institution()]);
    return { course, program, inst };
  }, [courseId]);
  useEffect(() => {
    let live = true;
    load().then((d) => { if (live) setData(d); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [load]);

  const guardedClose = useCallback(() => {
    if (Object.values(dirty.current).some(Boolean) && !window.confirm('Close without saving your changes?')) return;
    onClose();
  }, [onClose]);
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape' && !document.querySelector('.bld2-pop')) guardedClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [guardedClose]);

  const model = useMemo(() => (data ? createModel({
    institution: data.inst,
    programs: { [data.program.code]: { name: data.program.name, pos: data.program.pos, egas: data.program.egas } },
    year: CURRENT_SCHOOL_YEAR.startYear,
  }) : null), [data]);

  const patch = (part) => setData((d) => ({ ...d, ...part }));
  const reloadAll = async () => { try { setData(await load()); dirty.current = {}; } catch (e) { notify('Could not reload: ' + e.message); } };
  const course = data && data.course;

  return (
    <div className="overlay" onClick={guardedClose}>
      <div className="modal sm-modal" role="dialog" aria-modal="true" aria-labelledby="sm-title" onClick={(e) => e.stopPropagation()}>
        <header className="asg-head">
          <div>
            <span className="asg-eyebrow">{data ? data.program.code + ' · ' + data.program.name : 'Subject'}</span>
            <h3 id="sm-title">{course ? course.code + ' · ' + course.title : 'Loading…'}</h3>
            <small>Vision, mission, graduate attributes, program outcomes and course learning outcomes. Faculty see them read-only in the syllabus builder.</small>
          </div>
          <button type="button" className="asg-x" onClick={guardedClose} aria-label="Close">✕</button>
        </header>
        <div className="asg-body sm-body">
          {data && setupGaps(data).length > 0 && (
            <div className="info-banner warning" role="status">
              <b>Setup incomplete.</b> Faculty cannot finish the Learning Outcomes step, or submit a syllabus for this subject, until these are added: {setupGaps(data).join(', ')}.
            </div>
          )}
          {error && <div className="info-banner warning">Could not open the subject: {error}</div>}
          {!data && !error && <div className="empty">Loading…</div>}
          {data && (
            <div className="sm-stack">
              <ClosCard key={'c' + course.id + '-' + course.version} course={course} program={data.program} model={model}
                onSaved={(saved) => { patch({ course: saved }); onChanged(); }} onReload={reloadAll} setDirty={setDirtyFor('clos')} notify={notify} />
              <div className="sm-pair">
                <EgaCard key={'e' + data.program.versions.egas} program={data.program} course={course}
                  onSaved={(saved) => patch({ program: saved })} onReload={reloadAll} setDirty={setDirtyFor('egas')} notify={notify} />
                <PoCard key={'p' + data.program.versions.pos} program={data.program} course={course}
                  onSaved={(saved) => patch({ program: saved })} onReload={reloadAll} setDirty={setDirtyFor('pos')} notify={notify} />
              </div>
              <div className="sm-pair">
                <VisionCard key={'v' + data.inst.version} inst={data.inst}
                  onSaved={(saved) => patch({ inst: saved })} onReload={reloadAll} setDirty={setDirtyFor('vision')} notify={notify} />
                <DetailsCard key={'d' + course.id} course={course}
                  onSaved={(saved) => { patch({ course: { ...saved } }); onChanged(); }} onDeleted={() => { onChanged(); onClose(); }} setDirty={setDirtyFor('details')} notify={notify} />
              </div>
            </div>
          )}
        </div>
        <footer className="asg-foot">
          <span className="asg-summary">Each section saves on its own.</span>
          <button type="button" className="asg-btn ghost" onClick={guardedClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}
