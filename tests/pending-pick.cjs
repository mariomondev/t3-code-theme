// Model pick in a live chat: Hermes repaints only its draft atom, so the
// primary pill kept the old model for ~1s, until the gateway's session.info.
// The pill must show the pick at once, and give the label back to Hermes as
// soon as Hermes has its own answer, a confirm dialog asks, or the switch
// never lands (a failed switch must not leave a lie on the pill).
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../desktop/plugin.js'),'utf8');
const pickerCss=source.match(/const pickerCss = `([\s\S]*?)\n`/)[1];
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage();
await page.setContent(`<html data-hermes-theme="t3-code-theme"><head><style>${pickerCss}</style></head><body>
<div data-slot="composer-fade"><button data-tour="model-pill" aria-expanded="true" aria-controls="menu1" aria-label="Model · Codex: gpt-6-sol"><span class="truncate">GPT-6-Sol</span></button></div>
<div id="menu1" data-slot="dropdown-menu-content" data-t3-picker="v2">
  <div id="sol" data-slot="dropdown-menu-sub-trigger" data-t3-model="gpt-6-sol" data-t3-provider="openai-codex" data-t3-current><span>Sol</span></div>
  <div id="luna" data-slot="dropdown-menu-sub-trigger" data-t3-model="gpt-6-luna" data-t3-provider="openai-codex"><span>Luna</span><button data-t3-favorite="x">*</button></div>
  <div id="opus" data-slot="dropdown-menu-sub-trigger" data-t3-model="claude-opus-5-5" data-t3-provider="anthropic"><span>Opus</span></div>
</div></body></html>`);
await page.addScriptTag({content:source.replace(/^import .*\n/gm,'').replace('export default','globalThis.plugin =')});
await page.evaluate(()=>{
  const v=x=>({get:()=>x,listen:()=>()=>{}});
  window.disposers=[];
  installPicker({storage:{get:(k,d)=>d,set(){}},onDispose:fn=>window.disposers.push(fn)},
    {host:{state:{activeSessionId:v('one'),focusedSessionId:v('one'),focusedStoredSessionId:v('one'),focusedSessionOwner:v({connectionId:'local'})}},
     queryClient:{getQueryCache:()=>({findAll:()=>[{queryKey:['model-options','other'],state:{data:{providers:[{slug:'anthropic',name:'Anthropic'},{slug:'openai-codex',name:'Codex'}]}},getObserversCount:()=>0}],subscribe:()=>()=>{}})}});
});
const pill=page.locator('[data-tour=model-pill]');
const shown=()=>pill.evaluate(p=>{const s=p.querySelector('.truncate');const before=getComputedStyle(s,'::before').content;return before&&before!=='none'&&getComputedStyle(s).fontSize==='0px'?JSON.parse(before):s.textContent});
const flush=()=>page.evaluate(()=>new Promise(r=>setTimeout(r,20)));

await page.locator('#luna [data-t3-favorite]').evaluate(e=>e.click());
assert.equal(await pill.getAttribute('data-t3-pending-label'),null,'Starring a model is not a pick');
await page.locator('#sol').evaluate(e=>e.click());
assert.equal(await pill.getAttribute('data-t3-pending-label'),null,'Re-picking the current model changes nothing');

await page.locator('#opus').evaluate(e=>e.click());
assert.equal(await shown(),'Claude Opus 5.5','The pill shows the pick on the click, not after the gateway');
assert.equal(await pill.getAttribute('data-t3-provider'),'anthropic','The provider icon follows the pick too');
await pill.evaluate(p=>p.setAttribute('aria-expanded','false'));await flush();
assert.equal(await shown(),'Claude Opus 5.5','Closing the menu keeps the pending pick');

await pill.evaluate(p=>{p.setAttribute('aria-label','Model · Anthropic: claude-opus-5-5');p.querySelector('.truncate').textContent='Claude Opus 5.5'});await flush();
assert.equal(await pill.getAttribute('data-t3-pending-label'),null,'Hermes\' own label takes over once session.info lands');

await page.locator('#luna').evaluate(e=>e.click());
await page.evaluate(()=>{const d=document.createElement('div');d.setAttribute('role','dialog');d.dataset.slot='dialog-content';d.id='confirm';document.body.append(d);document.body.setAttribute('data-x','1')});
await pill.evaluate(p=>p.setAttribute('aria-expanded','false'));await flush();
assert.equal(await pill.getAttribute('data-t3-pending-label'),null,'A confirm dialog means the switch was not applied: show the real model');
await page.evaluate(()=>document.getElementById('confirm').remove());

await page.locator('#luna').evaluate(e=>e.click());
await page.waitForFunction(()=>!document.querySelector('[data-tour=model-pill]').hasAttribute('data-t3-pending-label'),null,{timeout:6000});
assert.equal(await shown(),'Claude Opus 5.5','A switch that never lands falls back to the real model');
assert.equal(await pill.getAttribute('data-t3-provider'),'anthropic','and to its icon');

await page.locator('#luna').evaluate(e=>e.click());
await page.evaluate(()=>window.disposers.forEach(fn=>fn()));
assert.equal(await pill.getAttribute('data-t3-pending-label'),null,'Dispose clears a pending pick');
console.log('PASS pending pick: instant pill label and icon, handed back on session.info, confirm, timeout, dispose');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
