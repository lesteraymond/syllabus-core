// Renders promo.html frame by frame. Usage: node render.mjs <toolsDir> [out.mp4 | still:<t1,t2,...>]
import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path'; import url from 'url'; import fs from 'fs';
const tools = process.argv[2]; const mode = process.argv[3] || 'video.mp4';
const require = createRequire(tools + '/');
const puppeteer = require('puppeteer-core'); const ffmpeg = require('ffmpeg-static');
const TL = createRequire(import.meta.url)('./timeline.cjs');
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', defaultViewport: { width: 1920, height: 1080 }, args: ['--force-device-scale-factor=1'] });
const p = await b.newPage();
await p.goto(url.pathToFileURL(path.resolve('promo.html')).href); await p.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 800));
if (mode.startsWith('still:')) {
  fs.mkdirSync('stills', { recursive: true });
  for (const t of mode.slice(6).split(',')) { await p.evaluate(t => render(t), +t); await p.screenshot({ path: `stills/t${t}.jpg`, type: 'jpeg', quality: 85 }); }
} else {
  const ff = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-framerate', String(TL.fps), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'medium', mode], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = TL.duration * TL.fps;
  for (let f = 0; f < n; f++) { await p.evaluate(t => render(t), f / TL.fps); const buf = await p.screenshot({ type: 'jpeg', quality: 96 }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await b.close();
