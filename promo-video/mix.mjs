// Muxes picture + music + sfx (+ voice-over if audio/vo.mp3 exists, ducking the music under it). Usage: node mix.mjs <toolsDir>
import { createRequire } from 'module'; import { spawnSync } from 'child_process'; import fs from 'fs';
const ffmpeg = createRequire(process.argv[2] + '/')('ffmpeg-static');
const hasVO = fs.existsSync('audio/vo.mp3') || fs.existsSync('audio/vo.wav'); const vo = fs.existsSync('audio/vo.mp3') ? 'audio/vo.mp3' : 'audio/vo.wav';
const args = ['-y', '-i', 'out/silent.mp4', '-i', 'audio/music.wav', '-i', 'audio/sfx.wav'];
let fc;
if (hasVO) { args.push('-i', vo, '-itsoffset', '0'); fc = '[1:a]volume=0.55[m];[2:a]volume=0.8[s];[3:a]aresample=44100,apad,atrim=0:25,volume=1.4,asplit[v1][v2];[m][v1]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[md];[md][s][v2]amix=inputs=3:normalize=0:duration=first,alimiter=limit=0.95[a]'; }
else fc = '[1:a]volume=0.8[m];[2:a]volume=0.8[s];[m][s]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]';
args.push('-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', '25', hasVO ? 'out/syllabus-showcase.mp4' : 'out/syllabus-showcase-novo.mp4');
const r = spawnSync(ffmpeg, args, { stdio: 'inherit' }); process.exit(r.status);
