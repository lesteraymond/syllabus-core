import test from 'node:test';
import assert from 'node:assert/strict';
import { animateCatalogChange, animateActionExit, completeActionExit, readCatalogLayout } from './catalogMotion.js';
function fixture(reduced = false) {
  const listeners = new Set();
  const animations = [];
  let height = 160;
  const rows = [];
  const media = { matches: reduced, addEventListener: (_, listener) => listeners.add(listener), removeEventListener: (_, listener) => listeners.delete(listener) };
  const document = { defaultView: { matchMedia: () => media, getComputedStyle: () => ({ paddingTop:'16px', paddingBottom:'16px', marginTop:'0px', marginBottom:'16px', borderTopWidth:'1px', borderBottomWidth:'1px', opacity:'1', transform:'none' }) } };
  function animate(frames, options) {
    let resolve, reject;
    const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
    const animation = { target: this, frames, options, finished, cancelled: false, finish: resolve, cancel() { this.cancelled = true; reject(new Error('cancelled')); } };
    animations.push(animation); return animation;
  }
  const element = { ownerDocument: document, animate, get offsetHeight() { return height; }, getBoundingClientRect: () => ({ top:100, height }), querySelectorAll: () => rows, closest: () => null };
  const row = (id, top, text=id) => { const value = { dataset:{ catalogRow:id }, textContent:text, top, animate, getBoundingClientRect() { return {top:100+this.top,height:40}; } }; rows.push(value); return value; };
  return { element, rows, row, animations, listeners, media, document, animate, setHeight: value => { height=value; } };
}
test('surviving rows move from their previous position instead of fading the whole table', async () => {
  const f=fixture(); f.row('first',40); const survivor=f.row('second',80);
  const before=readCatalogLayout(f.element); f.rows.shift(); survivor.top=40; f.setHeight(120);
  const stop=animateCatalogChange(f.element,before);
  const move=f.animations.find(animation=>animation.target===survivor);
  assert.equal(move.frames[0].transform,'translateY(40px)'); assert.equal(move.frames[0].opacity,1);
  assert.equal(move.frames[1].transform,'translateY(0)');
  const resize=f.animations.find(animation=>animation.target===f.element);
  assert.equal(resize.frames[0].height,'160px'); assert.equal(resize.frames[1].height,'120px');
  assert.ok(!resize.frames.some(frame=>'opacity' in frame));
  f.animations.forEach(animation=>animation.finish()); await Promise.all(f.animations.map(animation=>animation.finished)); await Promise.resolve();
  stop(); assert.equal(f.listeners.size,0);
});
test('new rows enter locally and unchanged rows are left alone', () => {
  const f=fixture(); f.row('existing',40); const before=readCatalogLayout(f.element); const added=f.row('added',80);
  const stop=animateCatalogChange(f.element,before);
  assert.equal(f.animations.length,1); assert.equal(f.animations[0].target,added); assert.equal(f.animations[0].frames[0].opacity,0);
  stop();
});
test('reduced motion skips movement and cancels an in-progress group when enabled', () => {
  const reduced=fixture(true); reduced.row('first',40); animateCatalogChange(reduced.element); assert.equal(reduced.animations.length,0);
  const f=fixture(); f.row('first',40); animateCatalogChange(f.element);
  for(const listener of f.listeners)listener({matches:true});
  assert.ok(f.animations.every(animation=>animation.cancelled)); assert.equal(f.listeners.size,0);
});
test('dialog exit coordinates panel movement and backdrop fade before finishing', async () => {
  const f=fixture(); const panel={ ownerDocument:f.document, animate:f.animate, closest:()=>f.element };
  const exit=animateActionExit(panel);
  assert.equal(f.animations.length,2);
  const panelMove=f.animations.find(animation=>animation.target===panel);
  assert.match(panelMove.frames[1].transform,/translateY.*scale/);
  let done=false; exit.finished.then(()=>{done=true;}); await Promise.resolve(); assert.equal(done,false);
  f.animations.forEach(animation=>animation.finish()); await exit.finished; assert.equal(done,true);
  exit.cancel(); assert.equal(f.listeners.size,0);
});
test('inline forms collapse their occupied space rather than disappearing at full height', async () => {
  const f=fixture(); const exit=animateActionExit(f.element); const frames=f.animations[0].frames;
  assert.equal(frames[0].height,'160px'); assert.equal(frames[1].height,'0px'); assert.equal(frames[1].paddingTop,'0px'); assert.equal(frames[1].marginBottom,'0px');
  f.animations[0].finish(); await exit.finished; exit.cancel();
});
test('missing animation support and reduced-motion exit never block dismissal', async () => {
  const f=fixture(true); await animateActionExit(f.element).finished; assert.equal(f.animations.length,0);
  await animateActionExit(null).finished;
  await animateActionExit({ offsetHeight:10, animate() { throw new Error('unsupported'); } }).finished;
  assert.doesNotThrow(()=>animateCatalogChange(null)());
});

test('cancel during entry starts from the painted height and stops competing animations', async () => {
  const f=fixture();
  const original=f.document.defaultView.getComputedStyle;
  f.document.defaultView.getComputedStyle=element=>({...original(element), height:'48px', paddingTop:'4px', opacity:'.3', transform:'matrix(1, 0, 0, 1, 0, -5)'});
  let stopped=false;
  f.element.getAnimations=()=>[{cancel(){stopped=true;}}];
  const exit=animateActionExit(f.element);
  assert.equal(stopped,true);
  const frames=f.animations[0].frames;
  assert.equal(frames[0].height,'48px');
  assert.equal(frames[0].paddingTop,'4px');
  assert.equal(frames[0].opacity,.3);
  assert.equal(frames[0].transform,'matrix(1, 0, 0, 1, 0, -5)');
  f.animations[0].finish(); await exit.finished; exit.cancel();
});
test('dismissal commits removal before the held exit frame can be released', async () => {
  const events=[];
  let removed=false;
  const callback=()=>{events.push('request removal');};
  const commit=update=>{update();removed=true;events.push('DOM removal committed');};
  await completeActionExit(callback,commit);
  assert.equal(removed,true);
  events.push('release exit frame');
  assert.deepEqual(events,['request removal','DOM removal committed','release exit frame']);
});
test('dismissal preserves asynchronous completion and propagates failures', async () => {
  let finish;
  const pending=new Promise(resolve=>{finish=resolve;});
  let completed=false;
  const result=completeActionExit(()=>pending,fn=>fn()).then(()=>{completed=true;});
  await Promise.resolve(); assert.equal(completed,false);
  finish(); await result; assert.equal(completed,true);
  await assert.rejects(completeActionExit(()=>{throw new Error('refresh failed');},fn=>fn()),/refresh failed/);
});
