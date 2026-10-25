import { t as translateUI } from "../i18n/index.js";
import { useMemo } from 'react';
import { GROUPS, hydrateContent, renderMarkup } from '../lib/syllabusModel';

const html = (t) => ({ __html: renderMarkup(t) }); // the text is escaped first; only bullets and bold are added (same as the form)

// A syllabus as plain sections that fit a phone: the same content as the form, without the wide tables. The form (ReviewDocument) stays
// the choice on a wide screen and "View as form" on a phone.
export default function StudentSyllabusReader({ content }) {
  const d = useMemo(() => hydrateContent(content, () => 'rd' + Math.random().toString(36).slice(2, 8)), [content]);
  const paragraphs = d.description.filter((p) => p.t && p.t.trim());
  const reqs = d.reqs.filter((r) => r.t && r.t.trim());
  return (
    <article className="sr">
      <dl className="sr-facts">
        <div><dt>{translateUI("student.prereq_5d3e81")}</dt><dd>{d.meta.prereq || '—'}</dd></div>
        <div><dt>{translateUI("student.units_a62c09")}</dt><dd>{[d.meta.lecture && d.meta.lecture + ' lec', d.meta.lab && d.meta.lab + ' lab'].filter(Boolean).join(' · ') || '—'}</dd></div>
      </dl>

      {paragraphs.length > 0 && (
        <section><h3>{translateUI("student.secDescription_0b94f7")}</h3>{paragraphs.map((p) => <p key={p.id}>{p.t}</p>)}</section>
      )}

      {d.clos.length > 0 && (
        <section>
          <h3>{translateUI("student.secClos_c47a12")}</h3>
          <ol className="sr-clos">{d.clos.map((c, i) => <li key={c.id}><b>{translateUI("student.cloLabel_b19e47", { n: i + 1 })}</b>{c.level ? <em>{c.level}</em> : null}<span>{c.statement}</span></li>)}</ol>
        </section>
      )}

      {d.plan.length > 0 && (
        <section>
          <h3>{translateUI("student.secPlan_9e1d36")}</h3>
          {d.plan.map((r) => (
            <div key={r.id} className={'sr-week' + (r.kind === 'exam' ? ' exam' : '')}>
              <h4>{translateUI("student.week_f08b4a", { week: r.week || '—' })}</h4>
              {r.kind === 'exam'
                ? <div dangerouslySetInnerHTML={html(r.contents)} />
                : (
                  <>
                    {r.ilos.filter((il) => il.text && il.text.trim()).map((il) => <p key={il.id} className="sr-ilo">{il.text}</p>)}
                    {[['student.contents_73ad02', r.contents], ['student.activities_e5b8c1', r.activities], ['student.tasks_1f9a64', r.tasks], ['student.values_b3d70e', r.values]].filter(([, v]) => v && v.trim()).map(([k, v]) => (
                      <div key={k} className="sr-field"><small>{translateUI(k)}</small><div dangerouslySetInnerHTML={html(v)} /></div>
                    ))}
                  </>
                )}
            </div>
          ))}
        </section>
      )}

      {reqs.length > 0 && <section><h3>{translateUI("student.secReqs_2c6f85")}</h3><ul>{reqs.map((r) => <li key={r.id}>{r.t}</li>)}</ul></section>}

      <section>
        <h3>{translateUI("student.secRefs_a84e0d")}</h3>
        {GROUPS.map(([key, title]) => {
          const grp = d.refs[key];
          const items = grp && !grp.na ? grp.items.filter((r) => r.t && r.t.trim()) : [];
          if (!grp || (!grp.na && items.length === 0)) return null;
          return (
            <div key={key} className="sr-field">
              <small>{title}</small>
              {grp.na ? <p className="muted">{translateUI("student.notApplicable_46d1b9")}</p> : <ul>{items.map((r) => <li key={r.id}>{r.t}</li>)}</ul>}
            </div>
          );
        })}
      </section>

      {d.grading.rows.length > 0 && (
        <section>
          <h3>{translateUI("student.secGrading_d95c27")}</h3>
          <ul className="sr-grading">{d.grading.rows.map((g) => <li key={g.id}><span>{g.label}</span><b>{(Number(g.pct) || 0) + '%'}</b></li>)}</ul>
        </section>
      )}
    </article>
  );
}
