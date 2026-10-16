import { t as translateUI } from "../i18n/index.js";
import { useMemo } from 'react';
import { hydrateContent } from '../lib/syllabusModel';
import { useCatalog } from './builder2/useCatalog';
import FormPaper from './builder2/FormPaper';

// A submitted syllabus, read-only, as the finished form: every section, the learning plan, the references, the grading system and the
// sign-off block. It is the same form the builder's Review & Check step shows (FormPaper). The vision, mission, EGAs and program
// outcomes come from the copy stored with the version when there is one, so a later admin edit does not change what is reviewed.
export default function ReviewDocument({ content, facultyName }) {
  const d = useMemo(() => hydrateContent(content, () => 'rv' + Math.random().toString(36).slice(2, 8)), [content]);
  const { model, error } = useCatalog(d.meta.program, { snapshot: content && content.catalog ? content.catalog : null, live: false, courseId: d.meta.courseId });
  if (!model) return <div className="empty">{error ? translateUI("ui.could_not_load_the_program_outcomes_for_this_syllabus_a4ad37") + error : translateUI("ui.loading_the_syllabus_79e1d4")}</div>;
  return <div className="svm-paper"><FormPaper d={d} model={model} preparedBy={facultyName} /></div>;
}
