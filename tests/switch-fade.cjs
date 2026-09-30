// Opening a stored chat: Hermes paints it scrolled to the top and jumps to the
// bottom a few frames later. The theme must hide the primary transcript from
// the route change until the NEW rows are pinned to the bottom, never hide it
// for a tile focus change, and never leave it hidden if the load stalls.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../desktop/plugin.js'),'utf8');
const layoutCss=source.match(/const css = `([\s\S]*?)\n`/)[1];
const rows=(chat,n)=>Array.from({length:n},(_,i)=>`<div data-slot="aui_user-message-root">${chat} ${i}</div><div style="height:400px"></div>`).join('');
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage({viewport:{width:1200,height:800}});
await page.setContent(`<html data-hermes-theme="t3-code-theme"><head><style>${layoutCss}</style></head><body>
<main data-chat-surface data-composer-target="main"><div data-slot="aui_thread-viewport" style="height:600px;overflow-y:auto">
  <div data-slot="aui_thread-content">${rows('A',3)}</div></div></main>
<main data-chat-surface data-composer-target="tile:1"><div data-slot="aui_thread-viewport" id="tile-vp"></div></main>
</body></html>`);
await page.addScriptTag({content:source.replace(/^import .*\n/gm,'').replace('export default','globalThis.plugin =')});
const result=await page.evaluate(async(chatB)=>{
  const frames=n=>new Promise(r=>{const step=()=>--n<=0?r():requestAnimationFrame(step);requestAnimationFrame(step)});
  const mut=v=>{const fns=[];return {v,get(){return this.v},set(x){this.v=x;fns.forEach(f=>f(x))},listen(f){fns.push(f);return()=>{}}}};
  const stored=mut('A');const disposers=[];
  installSwitchFade({onDispose:fn=>disposers.push(fn)},{host:{state:{focusedStoredSessionId:stored}}});
  const vp=document.querySelector('[data-composer-target="main"] [data-slot="aui_thread-viewport"]');
  const content=vp.firstElementChild;
  const opacity=()=>getComputedStyle(vp).opacity;
  const out={};
  // Tile focus: the route does not change, the primary transcript stays visible.
  stored.set('tile');await frames(2);out.tileFocus=opacity();
  // Open chat B: route changes, old rows still on screen, then B mounts at the top.
  location.hash='#/B';stored.set('B');await frames(2);out.oldRows=opacity();
  content.innerHTML=chatB;vp.scrollTop=0;await frames(3);out.atTop=opacity();
  vp.scrollTop=vp.scrollHeight;await frames(4);out.pinned=opacity();
  // Stalled load: chat C never pins to the bottom, the cap reveals it.
  location.hash='#/C';stored.set('C');await frames(2);out.stallStart=opacity();
  await new Promise(r=>setTimeout(r,400));out.stallCapped=opacity();
  location.hash='#/D';stored.set('D');await frames(2);
  disposers.forEach(fn=>fn());out.disposed=!document.documentElement.hasAttribute('data-t3-switching');
  return out;
},rows('B',4));
assert.equal(result.tileFocus,'1','Focusing a tile must not hide the primary transcript');
assert.equal(result.oldRows,'0','The previous chat must be hidden once the route changes');
assert.equal(result.atTop,'0','A new chat still scrolled to the top must stay hidden');
assert.notEqual(result.pinned,'0','The new chat must show once pinned to the bottom');
assert.equal(result.stallStart,'0');
assert.notEqual(result.stallCapped,'0','A load that never settles must not hide the chat past the cap');
assert(result.disposed,'Dispose must never leave the transcript hidden');
console.log('PASS switch fade: hides old and top-scrolled rows, shows when pinned, ignores tile focus, capped, cleaned up');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
