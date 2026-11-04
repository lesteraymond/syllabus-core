const test = require('node:test');
const assert = require('node:assert/strict');
const { recoverTables, paragraphs } = require('./pdfLayout');
const { rasterBoxes } = require('./pdfGeometry');
const xs = [20, 80, 210, 340, 470, 600, 730];
const item = (text, x, y, width = 70) => ({ text, x, y, width, height: 10 });
function band(top, bottom, edges = xs) { return edges.map(x => ({ left: x, right: x, top, bottom })); }
const header = ['SCHEDULE', 'INTENDED LEARNING OUTCOMES', 'LEARNING CONTENTS', 'SUGGESTED LEARNING ACTIVITIES', 'SUGGESTED ASSESSMENT TASKS', 'EXPECTED VALUES TO BE INTEGRATED'];
test('table columns remain separate and page continuations append to the same week', () => {
  const first = { number: 1, width: 760, height: 600, boxes: [...band(20, 55), ...band(55, 300)], items: [
    ...header.map((text, i) => item(text, xs[i] + 5, 25)),
    item('Week1', 25, 80), item('ILO1: Analyze a', 85, 80), item('sensor circuit', 85, 95),
    item('Amplifiers', 215, 80), item('Build a circuit', 345, 80), item('Circuit defense', 475, 80), item('Humility', 605, 80),
  ] };
  const second = { number: 2, width: 760, height: 600, boxes: [...band(20, 200), ...band(200, 300)], items: [
    item('and justify its output. [CLO 3]', 85, 30), item('using a simulator.', 345, 30),
    item('Week 2-3', 25, 220), item('ILO2: Design a filter. [CLO 1]', 85, 220), item('Filters', 215, 220), item('Studio', 345, 220), item('Design report', 475, 220), item('Courage', 605, 220),
  ] };
  const result = recoverTables([first, second]);
  assert.equal(result.planRows.length, 2);
  assert.equal(result.planRows[0].week, '1');
  assert.match(result.planRows[0].ilo, /sensor circuit\nand justify/);
  assert.equal(result.planRows[0].ilo.includes('Humility'), false);
  assert.equal(result.planRows[0].contents, 'Amplifiers');
  assert.deepEqual(result.planRows[0].sourcePages, [1, 2]);
  assert.equal(result.planRows[1].week, '2-3');
  assert.deepEqual(result.warnings, []);
});
test('outcome columns never mix program outcomes into CLO statements', () => {
  const edges = [20, 220, 420, 730];
  const page = { number: 1, width: 760, height: 600, boxes: [...band(20, 50, edges), ...band(50, 300, edges)], items: [
    item('EXPECTED GRADUATE ATTRIBUTES', 25, 25), item('PROGRAM OUTCOMES', 225, 25), item('COURSE LEARNING OUTCOMES', 425, 25),
    item('EGA 1: Creative thinker', 25, 70), item('PO1. Design a system', 225, 70), item('CLO 3: Analyze a signal.', 425, 70), item('[EGA 1] [PO 1]', 425, 85),
  ] };
  const result = recoverTables([page]);
  assert.equal(result.fields.clos, 'CLO 3: Analyze a signal. [EGA 1] [PO 1]');
  assert.equal(result.fields.pos, 'PO1. Design a system');
});
test('split section headings end the learning table; requirements never become a week', () => {
  const page = { number: 1, width: 760, height: 600, boxes: [...band(20, 55), ...band(55, 150), ...band(150, 250, [20, 730])], items: [
    ...header.map((text, i) => item(text, xs[i] + 5, 25)), item('18', 25, 80), item('FINALS EXAMINATION', 215, 80),
    item('VIII.', 25, 170, 20), item('COURSE REQUIREMENTS', 50, 170), item('1. Final report', 50, 190),
  ] };
  const result = recoverTables([page]);
  assert.equal(result.planRows.length, 1);
  assert.equal(result.planRows[0].kind, 'exam');
  assert.deepEqual(result.warnings, []);
});
test('scanned grid detection recovers cell boundaries without sending images to a provider', () => {
  const { createCanvas } = require('@napi-rs/canvas');
  const canvas = createCanvas(760, 400), context = canvas.getContext('2d');
  context.fillStyle = 'white'; context.fillRect(0, 0, 760, 400);
  context.strokeStyle = 'black'; context.lineWidth = 1;
  for (const y of [20, 60, 300]) { context.beginPath(); context.moveTo(20, y); context.lineTo(730, y); context.stroke(); }
  for (const x of xs) { context.beginPath(); context.moveTo(x, 20); context.lineTo(x, 300); context.stroke(); }
  const boxes = rasterBoxes(canvas, 1);
  assert.ok(boxes.filter(b => b.top < 30 && b.bottom > 50).length >= 7);
  assert.ok(boxes.filter(b => b.top > 50 && b.bottom > 290).length >= 7);
});
test('wrapped words stay within their cell while bullet boundaries remain visible', () => {
  assert.equal(paragraphs([item('A worked', 10, 10), item('example.', 10, 25), item('• Verify it.', 10, 40)]), 'A worked example.\n• Verify it.');
});
