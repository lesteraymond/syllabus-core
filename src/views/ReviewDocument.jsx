import { t as translateUI } from "../i18n/index.js";
import { useEffect, useMemo, useRef } from 'react';
import { hydrateContent } from '../lib/syllabusModel';
import { useCatalog } from './builder2/useCatalog';
import FormPaper from './builder2/FormPaper';

// A submitted syllabus, read-only, as the finished form: every section, the learning plan, the references, the grading system and the
// sign-off block. It is the same form the builder's Review & Check step shows (FormPaper). The vision, mission, EGAs and program
// outcomes come from the copy stored with the version when there is one, so a later admin edit does not change what is reviewed.
export default function ReviewDocument({ content, facultyName }) {
  const d = useMemo(() => hydrateContent(content, () => 'rv' + Math.random().toString(36).slice(2, 8)), [content]);
  const { model, error } = useCatalog(d.meta.program, { snapshot: content && content.catalog ? content.catalog : null, live: false, courseId: d.meta.courseId });
  // The form is a fixed-width page. On a screen narrower than the page it is shrunk to fit the width (never below half size; past that it scrolls
  // sideways), so a phone shows the whole page and can still pinch to read the small print.
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    const paper = el && el.querySelector('.paper');
    if (!paper || typeof ResizeObserver === 'undefined') return undefined;
    const fit = () => {
      paper.style.zoom = '1';
      const page = paper.scrollWidth + 2;
      const room = el.clientWidth - 2;
      paper.style.zoom = page > room ? String(Math.max(0.5, Math.floor((room / page) * 100) / 100)) : '1';
    };
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(el);
    return () => { watch.disconnect(); paper.style.zoom = ''; };
  }, [model, d]);
  if (!model) return <div className="empty">{error ? translateUI("ui.could_not_load_the_program_outcomes_for_this_syllabus_a4ad37") + error : translateUI("ui.loading_the_syllabus_79e1d4")}</div>;
  return <div className="svm-paper" ref={box}><FormPaper d={d} model={model} preparedBy={facultyName} /></div>;
}
