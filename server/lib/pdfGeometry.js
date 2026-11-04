function positionedText(items, viewport) {
  return items.filter(item => item.str?.trim()).map(item => {
    const [a, b, c, d, x, y] = item.transform;
    const h = item.height || Math.hypot(c, d), w = item.width;
    const ax = Math.hypot(a, b) || 1, ay = Math.hypot(c, d) || 1;
    const dx = a / ax * w, dy = b / ax * w, hx = c / ay * h, hy = d / ay * h;
    const corners = [[x, y], [x + dx, y + dy], [x + hx, y + hy], [x + dx + hx, y + dy + hy]].map(p => viewport.convertToViewportPoint(...p));
    const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]);
    return { text: item.str, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  });
}
function vectorBoxes(operators, pdfjs, viewport) {
  const boxes = [], stack = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  const point = (x, y) => viewport.convertToViewportPoint(matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]);
  const line = (from, to) => {
    if (!from || !to) return;
    const a = point(...from), b = point(...to);
    if (Math.abs(a[0] - b[0]) > 2 && Math.abs(a[1] - b[1]) > 2) return;
    boxes.push({ left: Math.min(a[0], b[0]), right: Math.max(a[0], b[0]), top: Math.min(a[1], b[1]), bottom: Math.max(a[1], b[1]) });
  };
  for (let i = 0; i < operators.fnArray.length; i++) {
    const op = operators.fnArray[i], args = operators.argsArray[i];
    if (op === pdfjs.OPS.save) { stack.push([...matrix]); continue; }
    if (op === pdfjs.OPS.restore) { matrix = stack.pop() || [1, 0, 0, 1, 0, 0]; continue; }
    if (op === pdfjs.OPS.transform) { matrix = pdfjs.Util.transform(matrix, args); continue; }
    if (op !== pdfjs.OPS.constructPath) continue;
    // PDF.js 6 exposes packed MoveTo/LineTo/CurveTo/Close commands. Parsing
    // individual segments also handles writers that draw an entire grid in one path.
    for (const path of args[1] || []) {
      let current, start;
      for (let at = 0; at < path.length;) {
        const command = path[at++];
        if (command === 0) { current = start = [path[at++], path[at++]]; }
        else if (command === 1) { const next = [path[at++], path[at++]]; line(current, next); current = next; }
        else if (command === 2) { at += 4; current = [path[at++], path[at++]]; }
        else if (command === 3) { at += 2; current = [path[at++], path[at++]]; }
        else if (command === 4) { line(current, start); current = start; }
        else break; // unknown path commands must not create invented boundaries
      }
    }
  }
  return boxes;
}
// Recover printed grid lines from a scanned page. Only long continuous dark
// lines count; actual column labels still have to identify the syllabus table.
function rasterBoxes(canvas, scale) {
  const { width, height } = canvas, data = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  const dark = (x, y) => { const p = (y * width + x) * 4; return data[p + 3] > 100 && data[p] + data[p + 1] + data[p + 2] < 450; };
  const bars = [];
  for (let y = 0; y < height; y++) {
    let start = -1;
    for (let x = 0; x <= width; x++) {
      if (x < width && dark(x, y)) { if (start < 0) start = x; }
      else if (start >= 0) { if (x - start > width * .35) bars.push({ y, left: start, right: x }); start = -1; }
    }
  }
  const grouped = [];
  for (const bar of bars) {
    const previous = grouped.at(-1);
    if (previous && bar.y - previous.y < Math.max(3, 2 * scale)) { previous.y = bar.y; previous.left = Math.min(previous.left, bar.left); previous.right = Math.max(previous.right, bar.right); }
    else grouped.push({ ...bar });
  }
  const boxes = [];
  for (let i = 1; i < grouped.length; i++) {
    const top = grouped[i - 1], bottom = grouped[i];
    if (bottom.y - top.y < 8 * scale || Math.abs(top.left - bottom.left) > 5 * scale || Math.abs(top.right - bottom.right) > 5 * scale) continue;
    for (let x = Math.max(0, top.left - 3); x < Math.min(width, top.right + 3); x++) {
      let count = 0;
      for (let y = top.y + 3; y < bottom.y - 3; y++) if (dark(x, y)) count++;
      if (count / Math.max(1, bottom.y - top.y - 6) > .8) boxes.push({ left: x / scale, right: x / scale, top: top.y / scale, bottom: bottom.y / scale });
    }
  }
  return boxes;
}
module.exports = { positionedText, vectorBoxes, rasterBoxes };
