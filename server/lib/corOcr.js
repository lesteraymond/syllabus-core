// Image -> text for a COR photo. The photo is cleaned up first (rotated by its EXIF orientation, grayscale, enlarged,
// contrast stretched), which makes a noticeable difference on phone pictures. A photo with no orientation tag that was
// taken or saved sideways or upside down is handled by reading it in each direction and keeping the one that gives the
// most usable fields (see readText).
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');
const { parseCor } = require('./corParser');

const cleanup = (img, width) => img.resize({ width, withoutEnlargement: false }).grayscale().normalise().sharpen().png().toBuffer();

// How much of a COR a reading recovered. Word-counting is not used: Tesseract can partly read sideways text by itself,
// so only the parsed fields say whether a direction is really the right one.
function quality(text) {
  const p = parseCor(text);
  return (p.studentId ? 3 : 0) + (p.bsit === 'yes' ? 2 : p.bsit === 'maybe' ? 1 : 0) + (p.studentName ? 1 : 0) + (p.term ? 1 : 0) + (p.yearLevel ? 1 : 0) + Math.min(p.subjects.length, 3);
}
const good = (text) => { const p = parseCor(text); return !!p.studentId && p.bsit !== 'no' && !!p.term; };

// Reads the whole page upright-first, then sideways/upside down only if the first reading was not good. The winning
// direction is read again on its header (top half, where the labels are) two ways, because each pass gets different
// words right on a tilted photo and the parser looks for its fields across all of them.
async function readText(input) {
  const worker = await createWorker('eng');
  try {
    const base = await sharp(input).rotate().png().toBuffer(); // lossless; applies the EXIF orientation when there is one
    let best = null;
    for (const angle of [0, 270, 90, 180]) {
      const full = await cleanup(sharp(base).rotate(angle), 2000);
      await worker.setParameters({ tessedit_pageseg_mode: '3' });
      const text = (await worker.recognize(full)).data.text;
      const q = quality(text);
      if (!best || q > best.q) best = { angle, full, text, q };
      if (good(text)) break; // clearly the right direction: no need to try the rest
    }
    const meta = await sharp(best.full).metadata();
    const header = await sharp(best.full).extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.5) }).resize({ width: 2400 }).png().toBuffer();
    // The labels at the top of the page, read gently: on a photo with shadows, sharpening makes the small label text
    // worse, and a single-block read keeps each label on one line with its value.
    const upright = sharp(base).rotate(best.angle);
    const umeta = await sharp(await upright.clone().png().toBuffer()).metadata();
    const gentle = await upright.clone().extract({ left: 0, top: 0, width: umeta.width, height: Math.round(umeta.height * 0.4) }).resize({ width: 2400 }).grayscale().normalise().png().toBuffer();
    const texts = [best.text];
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    texts.push((await worker.recognize(gentle)).data.text);
    for (const psm of ['6', '4']) {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      texts.push((await worker.recognize(header)).data.text);
    }
    return texts.join('\n');
  } finally {
    await worker.terminate();
  }
}

module.exports = { readText };
