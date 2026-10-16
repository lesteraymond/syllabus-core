// Runs OCR + the COR parser on the images in sample_cor/ (or the paths given) and prints what was extracted.
//   node scripts/ocr-cor-test.js [image ...]      add --text to also print the raw OCR text
const fs = require('fs');
const path = require('path');
const { readText } = require('../lib/corOcr');
const { parseCor } = require('../lib/corParser');

(async () => {
  const dir = path.join(__dirname, '..', 'sample_cor');
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const files = args.length ? args : fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f)).map((f) => path.join(dir, f));
  for (const f of files) {
    const text = await readText(f);
    console.log('==', path.basename(f));
    if (process.argv.includes('--text')) console.log(text);
    console.log(JSON.stringify(parseCor(text), null, 2));
  }
})().catch((e) => { console.error(e); process.exit(1); });
