import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBareLinkAsApa7, splitApa7Segments } from './apaFormat.js';

const join = (segs) => segs.map((s) => s.text).join('');
const italics = (segs) => segs.filter((s) => s.italic).map((s) => s.text);

test('formatBareLinkAsApa7 formats standalone URLs and leaves APA citations untouched', () => {
  assert.equal(
    formatBareLinkAsApa7('https://docs.python.org/3/tutorial/classes.html'),
    'Python Software Foundation. (n.d.). Classes. https://docs.python.org/3/tutorial/classes.html',
  );
  const existing = 'Awari, G. K. (2022). Ethics in information technology. CRC Press.';
  assert.equal(formatBareLinkAsApa7(existing), existing);
});

test('splitApa7Segments italicizes book and webpage titles without italicizing edition or publisher', () => {
  const book = 'Cormen, T. H., Leiserson, C. E., Rivest, R. L., & Stein, C. (2022). Introduction to algorithms (4th ed.). MIT Press.';
  const segs = splitApa7Segments(book);
  assert.equal(join(segs), book);
  assert.deepEqual(italics(segs), ['Introduction to algorithms']);

  const web = 'MDN Web Docs. (2024, March 1). Fetch API. https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API';
  const webSegs = splitApa7Segments(web);
  assert.equal(join(webSegs), web);
  assert.deepEqual(italics(webSegs), ['Fetch API']);
});

test('splitApa7Segments italicizes journal name and volume only (not article title, issue, or pages)', () => {
  const article = 'Smith, A. B., & Cruz, J. (2023). Adaptive syllabus compliance checking. Journal of Computing Education, 14(2), 101-118. https://doi.org/10.1000/jce.2023.14';
  const segs = splitApa7Segments(article);
  assert.equal(join(segs), article);
  assert.deepEqual(italics(segs), ['Journal of Computing Education, 14']);
});

test('splitApa7Segments italicizes edited book title in chapter references', () => {
  const chapter = 'Reyes, M. (2023). Curriculum alignment. In L. Santos (Ed.), Modern higher education (pp. 45-68). University Press.';
  const segs = splitApa7Segments(chapter);
  assert.equal(join(segs), chapter);
  assert.deepEqual(italics(segs), ['Modern higher education']);
});

test('splitApa7Segments converts bare URLs and italicizes their title', () => {
  const segs = splitApa7Segments('https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API');
  assert.equal(join(segs), 'MDN Web Docs. (n.d.). Fetch API. https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API');
  assert.deepEqual(italics(segs), ['Fetch API']);
});
