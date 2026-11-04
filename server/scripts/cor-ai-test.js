// Reads the images in sample_cor/ (or the paths given) with the AI and prints the extracted fields. Needs GEMINI_API_KEY or OPENROUTER_API_KEY.
//   node scripts/ocr-cor-test.js [image ...]
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const { extractCor } = require('../lib/corAi');

(async () => {
  const dir = path.join(__dirname, '..', 'sample_cor');
  const args = process.argv.slice(2);
  const files = args.length ? args : fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f)).map((f) => path.join(dir, f));
  for (const f of files) {
    console.log('==', path.basename(f));
    console.log(JSON.stringify(await extractCor(fs.readFileSync(f)), null, 2));
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
