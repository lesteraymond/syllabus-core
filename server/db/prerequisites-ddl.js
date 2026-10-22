// A subject's prerequisites, in the order the curriculum prints them. A row is a link to another subject (prereq_course_id) or, when the
// prerequisite is not a subject of the catalog (3rd Yr, PATHFit 1, MA 7 ...), just its printed label. `label` is also kept for a link, as
// what was printed; the form shows the linked subject's current code. Used by migrate-prerequisites.js; schema.sql has the same definition.
module.exports = {
  tables: [
    `CREATE TABLE IF NOT EXISTS course_prerequisites (
    course_id INT NOT NULL,
    position INT NOT NULL,
    prereq_course_id INT NULL,
    label VARCHAR(60) NOT NULL,
    PRIMARY KEY (course_id, position),
    FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE CASCADE,
    FOREIGN KEY (prereq_course_id) REFERENCES courses(course_id) ON DELETE SET NULL
  )`,
  ],
};
