// Image -> text for a COR photo. The photo is cleaned up first (rotated by its EXIF orientation, grayscale, enlarged,
// contrast stretched), which makes a noticeable difference on phone pictures.
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');

async function prepare(input) {
  return sharp(input)
    .rotate()
    .resize({ width: 2000, withoutEnlargement: false })
    .grayscale()
    .normalise()
    .sharpen()
    .png()
    .toBuffer();
}

// Several passes, joined: the whole page, then the header (top half, where the labels are) read two ways. Each pass
// gets different words right on a tilted photo, and the parser looks for its fields across all of them.
async function readText(input) {
  const worker = await createWorker('eng');
  try {
    const full = await prepare(input);
    const meta = await sharp(full).metadata();
    const header = await sharp(full).extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.5) }).resize({ width: 2400 }).png().toBuffer();
    const texts = [];
    for (const [img, psm] of [[full, '3'], [header, '6'], [header, '4']]) {
      await worker.setParameters({ tessedit_pageseg_mode: psm });
      texts.push((await worker.recognize(img)).data.text);
    }
    return texts.join('\n');
  } finally {
    await worker.terminate();
  }
}

module.exports = { readText };
