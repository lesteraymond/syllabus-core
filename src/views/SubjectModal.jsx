import { useActionExit } from '../lib/catalogMotion';
import StableButton from '../components/StableButton';
import { tr } from "../i18n/index.js";
import { t as translateUI } from "../i18n/index.js";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { courses as coursesApi } from '../lib/api';
import { LEVELS, createModel } from '../lib/syllabusModel';
import { CURRENT_SCHOOL_YEAR } from '../lib/schoolYear';
import { Auto, Ic, OutcomePicker, Tag } from './builder2/parts';


// Everything an administrator manages for one subject, in one modal. Five cards, each saved on its own:
//   1. Vision and mission      school-wide
//   2. Expected graduate attributes (EGAs)   this subject
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
      <header className="sm-card-h"><h4>{title}</h4><span className="sm-scope">{tr(scope)}</span></header>
      {note && <p className="sm-note">{tr(note)}</p>}
      <div className="sm-card-b">{children}</div>
      <footer className="sm-card-f">
        <span className="hint" role="status">{dirty ? translateUI("ui.unsaved_changes_292672") : translateUI("ui.all_changes_saved_9595b7")}</span>
        {st.stale
          ? <span className="sm-stale" role="alert">{translateUI("ui.this_was_changed_by_someone_else_reload_to_see_the_latest_88df1e")}<button type="button" className="asg-link" onClick={onReload}>{translateUI("ui.reload_cce715")}</button></span>
          : st.error && <span className="ie-err" role="alert">{tr(st.error)}</span>}
        <button type="button" className="asg-btn primary sm" disabled={!dirty || st.busy || !canSave} onClick={onSave}>{st.busy ? translateUI("ui.saving_56a228") : tr(saveLabel)}</button>
      </footer>
    </section>
  );
}

// ---- 1. vision and mission (school-wide) ----
function VisionCard({ course, inst, onSaved, onReload, setDirty, notify }) {
  const [form, setForm] = useState(() => ({ vision: inst.vision, lead: inst.mission.lead, items: (inst.mission.items.length ? inst.mission.items : ['']).map(t => ({ key: ++tmp, t })) }));
  const [dirty, setD] = useState(false);
  const [st, run] = useSave();
  const mark = (v) => { setD(v); setDirty(v); };
  const edit = (fn) => { setForm((c) => { const n = { ...c, items: c.items.map((x) => ({ ...x })) }; fn(n); return n; }); mark(true); };
  const move = (i, d) => edit((n) => { const j = i + d; if (j >= 0 && j < n.items.length) n.items.splice(j, 0, n.items.splice(i, 1)[0]); });
  const valid = form.vision.trim() && form.lead.trim() && form.items.length && form.items.every((x) => x.t.trim());
  const save = () => run(async () => {
    const saved = await coursesApi.saveStandards(course.id, 'vision', { vision: form.vision, mission: { lead: form.lead, items: form.items.map(x => x.t) } }, inst.version);
    mark(false); onSaved(saved); notify(translateUI('outcomes.subjectSaved'));
  });
  return (
    <Card title={translateUI("ui.vision_and_mission_4c8752")} scope={tr(course.code + ' only')} dirty={dirty} st={st} onSave={save} onReload={onReload} canSave={!!valid}>
      <label className="field full"><span>{translateUI("ui.vision_40b090")}</span><Auto className="in" value={form.vision} label={translateUI("ui.vision_40b090")} placeholder={translateUI('ui.vision_40b090')} onChange={(v) => edit((n) => { n.vision = v; })} /></label>
      <label className="field full" style={{ marginTop: 10 }}><span>{translateUI("ui.mission_introduction_873ac6")}</span><Auto className="in" value={form.lead} label={translateUI("ui.mission_introduction_8acfc4")} placeholder={translateUI("ui.programs_and_services_that_will_enable_them_to_2162c1")} onChange={(v) => edit((n) => { n.lead = v; })} /></label>
      <span className="lbl" style={{ marginTop: 10 }}>{translateUI("ui.mission_statements_5e2923")}</span>
      {form.items.map((x, i) => (
        <div className="ie-row" key={x.key}>
          <span className="mono ie-no">{i + 1}.</span>
          <Auto className="in" value={x.t} label={translateUI("ui.mission_statement_45b2a8") + (i + 1)} placeholder={translateUI("ui.mission_statement_0ccc0c")} onChange={(v) => edit((n) => { n.items[i].t = v; })} />
          <span className="ie-tools">
            <button type="button" className="ib" aria-label={translateUI("ui.move_up_b4f57c")} disabled={i === 0} onClick={() => move(i, -1)}><Ic n="up" /></button>
            <button type="button" className="ib" aria-label={translateUI("ui.move_down_260ff8")} disabled={i === form.items.length - 1} onClick={() => move(i, 1)}><Ic n="down" /></button>
            <button type="button" className="ib del" aria-label={translateUI("ui.remove_statement_100039")} disabled={form.items.length < 2} onClick={() => edit((n) => { n.items.splice(i, 1); })}><Ic n="trash" /></button>
          </span>
        </div>
      ))}
      <button type="button" className="link" disabled={form.items.length >= 20} onClick={() => edit((n) => { n.items.push({ key: ++tmp, t: '' }); })}>{translateUI("ui.add_mission_statement_0ad1c2")}</button>
    </Card>
  );
}

// ---- 2. EGAs (this subject) ----
function EgaCard({ program, course, onSaved, onReload, setDirty, notify }) {
  const [rows, setRows] = useState(() => program.egas.map((e) => ({ key: ++tmp, ...e })));
  const [dirty, setD] = useState(false);
  const [st, run] = useSave();
  const mark = (v) => { setD(v); setDirty(v); };
  const edit = (fn) => { setRows((c) => { const n = c.map((x) => ({ ...x })); fn(n); return n; }); mark(true); };
  const valid = rows.length && rows.every((e) => e.name.trim() && e.short.trim());
  const save = () => {
    return run(async () => {
      const saved = await coursesApi.saveStandards(course.id, 'egas', rows.map(e => ({ no: e.no, name: e.name, short: e.short })), program.versions.egas);
      mark(false); onSaved(saved); notify(translateUI('outcomes.setupSaved'));
    });
  };
  return (
    <Card title={translateUI("ui.expected_graduate_attributes_86f980")} scope={tr(course.code + ' only')} dirty={dirty} st={st} onSave={save} onReload={onReload} canSave={!!valid}>
      <p className="hint">{translateUI("ui.the_number_is_fixed_once_saved_program_outcomes_and_clos_point_at_b96124")}</p>
      {rows.map((e, i) => (
        <div className="ie-ega" key={e.key}>
          <span className="code ref mono">{translateUI("ui.ega_4f085b") + e.no}</span>
          <input className="in" value={e.name} maxLength={255} placeholder={translateUI("ui.full_name_eeb692")} aria-label={translateUI("ui.name_of_ega_3dfa90") + e.no} onChange={(ev) => { const v = ev.target.value; edit((n) => { n[i].name = v; }); }} />
          <input className="in" value={e.short} maxLength={120} placeholder={translateUI("ui.short_name_feb5a9")} aria-label={translateUI("ui.short_name_of_ega_231166") + e.no} onChange={(ev) => { const v = ev.target.value; edit((n) => { n[i].short = v; }); }} />
          <button type="button" className="ib del" aria-label={translateUI("ui.remove_ega_8c32e7") + e.no} disabled={rows.length < 2} onClick={() => edit((n) => { n.splice(i, 1); })}><Ic n="trash" /></button>
        </div>
      ))}
      <button type="button" className="link" disabled={rows.length >= 20} onClick={() => edit((n) => { n.push({ key: ++tmp, no: Math.max(0, ...n.map((r) => r.no), ...program.egas.map((r) => r.no)) + 1, name: '', short: '' }); })}>{translateUI("ui.add_ega_270a20")}</button>
    </Card>
  );
}

// ---- 3. program outcomes (this subject) ----
function PoCard({ program, course, onSaved, onReload, setDirty, notify }) {
  const [rows, setRows] = useState(() => program.pos.map((p) => ({ key: ++tmp, ...p, egas: [...p.egas] })));
  const [dirty, setD] = useState(false);
  const [st, run] = useSave();
  const mark = (v) => { setD(v); setDirty(v); };
  const edit = (fn) => { setRows((c) => { const n = c.map((x) => ({ ...x, egas: [...x.egas] })); fn(n); return n; }); mark(true); };
  const toggleEga = (i, no) => edit((n) => { n[i].egas = n[i].egas.includes(no) ? n[i].egas.filter((v) => v !== no) : [...n[i].egas, no].sort((a, b) => a - b); });
  const valid = rows.every((r) => r.short.trim() && r.text.trim());
  const save = () => {
    return run(async () => {
      const saved = await coursesApi.saveStandards(course.id, 'pos', rows.map(r => ({ no: r.no, short: r.short, text: r.text, egas: r.egas })), program.versions.pos);
      mark(false); onSaved(saved); notify(translateUI('outcomes.setupSaved'));
    });
  };
  return (
    <Card title={translateUI("ui.program_outcomes_858de9")} scope={tr(course.code + ' only')} dirty={dirty} st={st} onSave={save} onReload={onReload} canSave={!!valid}>
      <p className="hint">{translateUI("ui.the_number_is_fixed_once_saved_one_that_a_subject_s_clo_is_tagged_542d3f")}</p>
      {!rows.length && <div className="info-banner warning">{translateUI("ui.no_program_outcomes_for_3d5a81")}{program.code}{translateUI("ui.yet_faculty_see_an_empty_list_until_you_add_them_6295d9")}</div>}
      {rows.map((r, i) => (
        <div className="ie-po" key={r.key}>
          <span className="code ref mono">{translateUI("ui.po_3756d6") + r.no}</span>
          <div>
            <input className="in" value={r.short} maxLength={120} placeholder={translateUI("ui.short_name_feb5a9")} aria-label={translateUI("ui.short_name_of_po_452bca") + r.no} onChange={(e) => { const v = e.target.value; edit((n) => { n[i].short = v; }); }} />
            <div style={{ marginTop: 8 }}><Auto className="in" value={r.text} label={translateUI("ui.statement_of_po_0182b3") + r.no} placeholder={translateUI("ui.full_statement_0c9d6a")} onChange={(v) => edit((n) => { n[i].text = v; })} /></div>
            <div className="ie-egas" role="group" aria-label={translateUI("ui.egas_supported_by_po_44a405") + r.no}>
              <span className="hint">{translateUI("ui.supports_da0eed")}</span>
              {program.egas.map((e) => (
                <label key={e.no} className={'ie-chip' + (r.egas.includes(e.no) ? ' on' : '')} title={e.name}>
                  <input type="checkbox" checked={r.egas.includes(e.no)} onChange={() => toggleEga(i, e.no)} />{translateUI("ui.ega_4f085b") + e.no}
                </label>
              ))}
            </div>
          </div>
          <button type="button" className="ib del" aria-label={translateUI("ui.remove_po_ffe9b3") + r.no} onClick={() => edit((n) => { n.splice(i, 1); })}><Ic n="trash" /></button>
        </div>
      ))}
      <button type="button" className="link" disabled={rows.length >= 50} onClick={() => edit((n) => { n.push({ key: ++tmp, no: Math.max(0, ...n.map((r) => r.no), ...program.pos.map((r) => r.no)) + 1, short: '', text: '', egas: [] }); })}>{translateUI("ui.add_program_outcome_cd9147")}</button>
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
    if (clos[i].id && !window.confirm(tr('Delete CLO ' + (i + 1) + '? ILOs in saved syllabi that are tagged with it will show the tag as unresolved until faculty fix them.'))) return;
    edit((n) => { n.splice(i, 1); });
  };
  const save = () => run(async () => {
    const saved = await coursesApi.saveClos(course.id, clos.map((c) => ({ id: c.id, title: c.title, level: c.level, statement: c.statement, egas: c.egas, pos: c.pos })), course.version);
    mark(false); onSaved(saved); notify(translateUI("ui.learning_outcomes_saved_faculty_see_them_the_next_time_they_open__956f63"));
  });
  return (
    <Card title={translateUI("ui.course_learning_outcomes_503861")} scope={tr(course.code + ' only')} dirty={dirty} st={st} onSave={save} onReload={onReload} canSave={!!valid} saveLabel={tr("Save outcomes")}>
      {!clos.length && <div className="info-banner warning">{translateUI("ui.this_subject_has_no_learning_outcomes_yet_faculty_cannot_tag_thei_0cb03e")}</div>}
      {clos.map((c, i) => (
        <div className="clorow" key={c.key || c.tmp}>
          <div><span className={'code lg k' + (i % 6)}>{translateUI("ui.clo_069efc") + (i + 1)}</span></div>
          <div>
            <div className="cap">
              <select className="sel" value={c.level} aria-label={translateUI("ui.level_of_clo_c01e3f") + (i + 1)} onChange={(e) => { const v = e.target.value; edit((n) => { n[i].level = v; }); }}>{LEVELS.map((l) => <option key={l} value={l}>{tr(l)}</option>)}</select>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                <button type="button" className="ib" aria-label={translateUI("ui.move_clo_baa700") + (i + 1) + translateUI("ui.up_459409")} disabled={i === 0} onClick={() => edit((n) => { n.splice(i - 1, 0, n.splice(i, 1)[0]); })}><Ic n="up" /></button>
                <button type="button" className="ib" aria-label={translateUI("ui.move_clo_baa700") + (i + 1) + translateUI("ui.down_edbf4b")} disabled={i === clos.length - 1} onClick={() => edit((n) => { n.splice(i + 1, 0, n.splice(i, 1)[0]); })}><Ic n="down" /></button>
                <button type="button" className="ib del" aria-label={translateUI("ui.delete_clo_3a0c81") + (i + 1)} onClick={() => remove(i)}><Ic n="trash" /></button>
              </span>
            </div>
            <input className="in" value={c.title} maxLength={255} placeholder={translateUI("ui.descriptor_e_g_foundational_knowledge_3cc9d7")} aria-label={translateUI("ui.title_of_clo_04eb8b") + (i + 1)} onChange={(e) => { const v = e.target.value; edit((n) => { n[i].title = v; }); }} />
            <div style={{ marginTop: 8 }}><Auto className="in" value={c.statement} label={translateUI("ui.statement_of_clo_13551f") + (i + 1)} placeholder={translateUI("ui.what_students_will_be_able_to_do_b7a91b")} onChange={(v) => edit((n) => { n[i].statement = v; })} /></div>
          </div>
          <div className="col2">
            <span className="lbl">{translateUI("ui.expected_graduate_attributes_86f980")}</span>
            <div className="tags">
              {c.egas.map((no) => <Tag key={'e' + no} info={model.tagInfo(pseudo, 'ega:' + no)} onRemove={() => edit((n) => { n[i].egas = n[i].egas.filter((v) => v !== no); })} />)}
              <button type="button" className="tagbtn" onClick={(e) => setPicker({ i, kind: 'ega', rect: e.currentTarget.getBoundingClientRect() })}>{translateUI("ui.ega_10b364")}</button>
            </div>
            <span className="lbl" style={{ marginTop: 12 }}>{translateUI("ui.program_outcomes_858de9")}</span>
            <div className="tags">
              {c.pos.map((no) => <Tag key={'p' + no} info={model.tagInfo(pseudo, 'po:' + no)} onRemove={() => edit((n) => { n[i].pos = n[i].pos.filter((v) => v !== no); })} />)}
              <button type="button" className="tagbtn" onClick={(e) => setPicker({ i, kind: 'po', rect: e.currentTarget.getBoundingClientRect() })}>{translateUI("ui.po_279301")}</button>
            </div>
            {model.missingEgas(pseudo, c).length > 0 && (
              <div className="taghint" style={{ marginTop: 8 }}>{translateUI("ui.the_program_outcomes_you_chose_support_de50e2")}{model.missingEgas(pseudo, c).map((g) => (
                <button type="button" className="link" key={g} onClick={() => edit((n) => { n[i].egas = toggle(n[i].egas, g); })}>{translateUI("ui.ega_aa8fbe") + g + ' ' + model.egaList(pseudo).find((e) => e.no === g).short}</button>
              ))}</div>
            )}
          </div>
        </div>
      ))}
      <StableButton type="button" className="btn outline" disabled={clos.length >= 20} onClick={() => edit((n) => { n.push({ tmp: ++tmp, id: null, title: '', level: 'Enabling', statement: '', egas: [], pos: [] }); })}>{translateUI("ui.add_clo_0485ad")}</StableButton>
      {picker && pc && (
        <OutcomePicker model={model} d={pseudo} kinds={[picker.kind]} rect={picker.rect} title={translateUI("ui.tag_outcomes_9af691")}
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
  const save = () => run(async () => { const saved = await coursesApi.update(course.id, head); mark(false); onSaved(saved); notify(translateUI("ui.subject_saved_9c680c")); });
  const remove = async () => {
    if (!window.confirm(tr('Delete ' + course.code + '? Syllabi that use it keep the outcomes they were saved with, but new drafts can no longer pick it.'))) return;
    try { await coursesApi.remove(course.id); notify(translateUI("ui.subject_deleted_688bd2")); onDeleted(); } catch (e) { notify(translateUI("ui.delete_failed_c834e9") + e.message); }
  };
  return (
    <Card title={translateUI("ui.subject_details_9e2fb9")} scope={tr(course.code + ' only')} dirty={dirty} st={st} onSave={save} onReload={() => {}} canSave={!!(head.code.trim() && head.title.trim())}>
      <div className="form-grid">
        <label className="field"><span>{translateUI("ui.subject_code_8e42db")}</span><input className="mono" value={head.code} maxLength={50} onChange={(e) => change('code', e.target.value)} /></label>
        <label className="field"><span>{translateUI("ui.subject_title_dce28f")}</span><input value={head.title} maxLength={255} onChange={(e) => change('title', e.target.value)} /></label>
      </div>
      <button type="button" className="asg-link sm-del" onClick={remove}>{translateUI("ui.delete_this_subject_95c760")}</button>
    </Card>
  );
}

function subjectParts(course) {
  const setup=course.standards;
  return { course, inst: { vision: setup.vision, mission: setup.mission, egas: setup.egas, version: setup.versions.vision }, program: { ...course.program, egas: setup.egas, pos: setup.pos, versions: setup.versions, subjects: [{id:course.id,code:course.code,title:course.title}] } };
}
export default function SubjectModal({ courseId, onClose, onChanged, notify }) {
  const dialogRef = useRef(null);
  const motion = useActionExit(dialogRef);
  const [data, setData] = useState(null); // { course, program, inst }
  const [error, setError] = useState('');
  const dirty = useRef({});
  const setDirtyFor = (key) => (v) => { dirty.current[key] = v; };

  const load = useCallback(async () => subjectParts(await coursesApi.get(courseId)), [courseId]);
  useEffect(() => {
    let live = true;
    load().then((d) => { if (live) setData(d); }).catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [load]);

  const guardedClose = useCallback(() => {
    if (motion.isClosing()) return;
    if (Object.values(dirty.current).some(Boolean) && !window.confirm(tr('Close without saving your changes?'))) return;
    motion.dismiss(onClose);
  }, [onClose, motion.dismiss]);
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
  const reloadAll = async () => { try { setData(await load()); dirty.current = {}; } catch (e) { notify(translateUI("ui.could_not_reload_6fda26") + e.message); } };
  const course = data && data.course;

  return (
    <div className="overlay catalog-overlay" onClick={guardedClose}>
      <div ref={dialogRef} inert={motion.closing || undefined} className="modal sm-modal catalog-surface" role="dialog" aria-modal="true" aria-labelledby="sm-title" onClick={(e) => e.stopPropagation()}>
        <header className="asg-head">
          <div>
            <span className="asg-eyebrow">{data ? data.program.code + ' · ' + data.program.name : translateUI("ui.subject_8d183d")}</span>
            <h3 id="sm-title">{course ? course.code + ' · ' + course.title : translateUI("ui.loading_33ce41")}</h3>
            <small>{translateUI("ui.vision_mission_graduate_attributes_program_outcomes_and_course_le_8288c7")}</small>
          </div>
          <button type="button" className="asg-x" onClick={guardedClose} aria-label={translateUI("ui.close_bbfa77")}>✕</button>
        </header>
        <div className="asg-body sm-body">
          {data && setupGaps(data).length > 0 && (
            <div className="info-banner warning" role="status">
              <b>{translateUI("ui.setup_incomplete_2c31f4")}</b>{translateUI("ui.faculty_cannot_finish_the_learning_outcomes_step_or_submit_a_syll_e79eee")}{setupGaps(data).join(', ')}.
            </div>
          )}
          {error && <div className="info-banner warning">{translateUI("ui.could_not_open_the_subject_feb4d2")}{tr(error)}</div>}
          {!data && !error && <div className="empty">{translateUI("ui.loading_33ce41")}</div>}
          {data && (
            <div className="sm-stack">
              <ClosCard key={'c' + course.id + '-' + course.version} course={course} program={data.program} model={model}
                onSaved={(saved) => { patch({ course: saved }); onChanged(); }} onReload={reloadAll} setDirty={setDirtyFor('clos')} notify={notify} />
              <div className="sm-pair">
                <EgaCard key={'e' + data.program.versions.egas} program={data.program} course={course}
                  onSaved={(saved) => { patch(subjectParts(saved)); onChanged(); }} onReload={reloadAll} setDirty={setDirtyFor('egas')} notify={notify} />
                <PoCard key={'p' + data.program.versions.pos} program={data.program} course={course}
                  onSaved={(saved) => patch({ program: saved })} onReload={reloadAll} setDirty={setDirtyFor('pos')} notify={notify} />
              </div>
              <div className="sm-pair">
                <VisionCard key={'v' + data.inst.version} course={course} inst={data.inst}
                  onSaved={(saved) => { patch(subjectParts(saved)); onChanged(); }} onReload={reloadAll} setDirty={setDirtyFor('vision')} notify={notify} />
                <DetailsCard key={'d' + course.id} course={course}
                  onSaved={(saved) => { patch({ course: { ...saved } }); onChanged(); }} onDeleted={() => { onChanged(); motion.dismiss(onClose); }} setDirty={setDirtyFor('details')} notify={notify} />
              </div>
            </div>
          )}
        </div>
        <footer className="asg-foot">
          <span className="asg-summary">{translateUI("ui.each_section_saves_on_its_own_c077f8")}</span>
          <button type="button" className="asg-btn ghost" onClick={guardedClose}>{translateUI("ui.close_bbfa77")}</button>
        </footer>
      </div>
    </div>
  );
}
