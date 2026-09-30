// Session tiles (a chat opened in another tab, e.g. from a project): Hermes
// puts data-tour only on the primary pill, so the theme must find the tile's
// pill itself or the tile renders half-native.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../desktop/plugin.js'),'utf8');
const layoutCss=source.match(/const css = `([\s\S]*?)\n`/)[1];
const pickerCss=source.match(/const pickerCss = `([\s\S]*?)\n`/)[1].replace(/\$\{[^}]+\}/g,'none');
const composer=(tour,label)=>`<div data-slot="composer-fade"><div class="grid">
  <div class="[grid-area:menu]"><button><i class="codicon codicon-add"></i></button></div>
  <div class="[grid-area:input]"><div data-slot="composer-rich-input"></div></div>
  <div class="[grid-area:controls]"><div class="flex"><button ${tour} aria-label="${label}"><span>GPT-6-Sol</span></button><button data-testid="reasoning-pill" aria-label="Effort: Low"><span>Low</span></button></div>
  <div class="flex items-center"><button aria-label="Voice dictation">m</button></div></div></div></div>`;
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage();
await page.setContent(`<html data-hermes-theme="t3-code-theme"><head><style>${layoutCss}</style></head><body>
<main data-chat-surface data-composer-target="main">${composer('data-tour="model-pill"','Model · ChatGPT or Codex Subscription: gpt-6-sol')}</main>
<main data-chat-surface data-composer-target="tile:1" id="tile">${composer('','Model · ChatGPT or Codex Subscription: gpt-6-sol')}
  <div class="empty"><h1 data-t3-hero data-t3-empty-hero>What should we build?</h1></div>
  <div data-slot="composer-dock"></div></main>
<main data-chat-surface id="bot"><div class="empty"><h1 data-t3-hero data-t3-empty-hero>What should we build?</h1><div data-slot="bot_chat_empty">Bot</div></div></main>
</body></html>`);
await page.addScriptTag({content:source.replace(/^import .*\n/gm,'').replace('export default','globalThis.plugin =')});
const result=await page.evaluate(async()=>{
  const atom=v=>({get:()=>v,listen:()=>()=>{}});
  const providers=[{slug:'openai-codex',name:'ChatGPT or Codex Subscription',models:['gpt-6-sol']}];
  const q={queryKey:['model-options','default','s1','owner','local'],state:{data:{providers}},getObserversCount:()=>1};
  const sdk={queryClient:{getQueryCache:()=>({findAll:()=>[q],subscribe:()=>()=>{}})},
    // Tile focused: the owner-bound catalog does not resolve, as in the real app.
    host:{state:{activeSessionId:atom('s1'),focusedSessionId:atom('tile-runtime'),focusedSessionOwner:atom({connectionId:'local',profile:'default'})}}};
  const disposers=[];const ctx={onDispose:fn=>disposers.push(fn),storage:{get:(k,d)=>d,set(){}}};
  installPicker(ctx,sdk);await new Promise(r=>setTimeout(r,50));
  const tilePill=document.querySelector('#tile [aria-label^="Model"]');
  const primary=document.querySelector('[data-tour="model-pill"]');
  const order=e=>getComputedStyle(e).order;
  const out={marked:tilePill.hasAttribute('data-t3-model-pill'),primaryMarked:primary.hasAttribute('data-t3-model-pill'),
    tileIcon:tilePill.dataset.t3Provider,primaryIcon:primary.dataset.t3Provider,
    pillOrder:order(tilePill),reasoningOrder:order(document.querySelector('#tile [data-testid="reasoning-pill"]')),
    voiceMarked:document.querySelector('#tile [aria-label="Voice dictation"]').hasAttribute('data-t3-model-pill'),
    heroTile:getComputedStyle(document.querySelector('#tile [data-t3-empty-hero]')).display,
    heroBot:getComputedStyle(document.querySelector('#bot [data-t3-empty-hero]')).display};
  document.documentElement.dataset.hermesTheme='nous';
  out.heroOtherTheme=getComputedStyle(document.querySelector('#tile [data-t3-empty-hero]')).display;
  document.documentElement.dataset.hermesTheme='t3-code-theme';
  disposers.forEach(fn=>fn());
  out.cleaned=!tilePill.hasAttribute('data-t3-model-pill')&&!tilePill.dataset.t3Provider&&!primary.dataset.t3Provider;
  return out;
});
assert(result.marked,'Tile pill must be found without data-tour');
assert(!result.primaryMarked,'Primary pill keeps its native data-tour hook only');
assert(!result.voiceMarked,'Only the model pill is marked, never another control');
assert.equal(result.tileIcon,'openai-codex','Tile pill gets its provider icon from its own label');
assert.equal(result.primaryIcon,'openai-codex');
assert.equal(result.pillOrder,'1','Tile model pill comes first, like T3');
assert.equal(result.reasoningOrder,'2');
assert.notEqual(result.heroTile,'none','Empty tile shows the T3 headline');
assert.equal(result.heroBot,'none','A bot that owns the empty state keeps it alone');
assert(result.cleaned,'Dispose removes tile markers and icons');
assert.equal(result.heroOtherTheme,'none','Other themes never show the headline');

// Picker in a tile: enhanced only while THAT tile holds focus, from its own
// owner-bound catalog; any mismatch keeps the native picker.
const picker=await page.evaluate(async()=>{
  const menuHtml='<div id="tile-menu" data-slot="dropdown-menu-content"><div data-slot="dropdown-menu-search"><input placeholder="Search models"></div><div data-slot="dropdown-menu-group"><div data-slot="dropdown-menu-item"><span>ChatGPT or Codex Subscription</span></div><div data-slot="dropdown-menu-sub-trigger"><span class="flex min-w-0 flex-1 items-center gap-1.5"><span class="min-w-0 truncate">GPT-6-sol</span><span class="text-(--ui-text-tertiary)">Low</span></span><i class="codicon codicon-chevron-right"></i></div></div></div>';
  document.body.insertAdjacentHTML('beforeend',menuHtml);
  const pill=document.querySelector('#tile [aria-label^="Model"]');
  pill.setAttribute('aria-controls','tile-menu');pill.setAttribute('aria-expanded','true');
  const mut=v=>{const fns=[];return {v,get(){return this.v},set(x){this.v=x;fns.forEach(f=>f())},listen(f){fns.push(f);return()=>{}}}};
  const stored=mut('1');
  const providers=[{slug:'openai-codex',name:'ChatGPT or Codex Subscription',models:['gpt-6-sol']}];
  const q=(key,obs)=>({queryKey:key,state:{data:{providers}},getObserversCount:()=>obs});
  const queries=[q(['model-options','default','s1','owner','local'],1),q(['model-options','default','rt-tile','owner','local'],1)];
  const sdk={queryClient:{getQueryCache:()=>({findAll:({queryKey})=>queries.filter(x=>JSON.stringify(x.queryKey)===JSON.stringify(queryKey)),subscribe:()=>()=>{}})},
    host:{state:{activeSessionId:mut('s1'),focusedSessionId:mut('rt-tile'),focusedStoredSessionId:stored,focusedSessionOwner:mut({connectionId:'local',profile:'default'})}}};
  const disposers=[];installPicker({onDispose:fn=>disposers.push(fn),storage:{get:(k,d)=>d,set(){}}},sdk);
  await new Promise(r=>setTimeout(r,50));
  const menu=document.getElementById('tile-menu');
  const focused={enhanced:menu.hasAttribute('data-t3-picker'),row:menu.querySelector('[data-t3-model]')?.getAttribute('data-t3-model')};
  stored.set('2');await new Promise(r=>setTimeout(r,50));
  const otherFocused=menu.hasAttribute('data-t3-picker');
  disposers.forEach(fn=>fn());
  return {focused,otherFocused};
});
assert(picker.focused.enhanced,'Focused tile gets the T3 picker');
assert.equal(picker.focused.row,'gpt-6-sol','Rows are identified from the tile\'s own catalog');
assert(!picker.otherFocused,'Another session focused: the tile picker falls back to native');
console.log('PASS tiles: pill found without data-tour, focused-tile picker with native fallback, icon and order, empty-session headline, bot stands alone, cleanup');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
