// DOM hook self-check: a Hermes markup change must surface as a warning, not
// as a theme that silently falls back to native.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../desktop/plugin.js'),'utf8');
const fixture=`
<main data-chat-surface>
  <div data-window-top="true"><div data-panel-header></div><div data-chat-surface></div></div>
  <div data-slot="aui_thread-viewport"><section data-slot="aui_thread-content">
    <div data-slot="aui_user-message-root"><div data-slot="aui_user-bubble-actions"><div class="composer-human-message">hi</div></div></div>
  </section></div>
  <div data-slot="composer-dock"><div data-slot="composer-root"><div data-slot="composer-surface">
    <div data-slot="composer-fade"><div class="grid">
      <div class="[grid-area:menu]"><button><i class="codicon codicon-add"></i></button></div>
      <div class="[grid-area:input]"><div data-slot="composer-rich-input" data-placeholder="Add more context"></div></div>
      <div class="[grid-area:controls]"><button data-tour="model-pill" aria-expanded="false"></button><button data-testid="reasoning-pill"><span>High</span></button></div>
    </div></div>
  </div></div></div>
  <div data-slot="statusbar"></div>
</main>`;
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage();
await page.setContent('<html data-hermes-theme="t3-code-theme"><body>'+fixture+'</body></html>');
await page.addScriptTag({content:source.replace(/^import .*\n/gm,'').replace('export default','globalThis.plugin =')});

const full=await page.evaluate(()=>checkDomHooks());
assert.deepEqual(full.missing,[],'Current Hermes markup must pass with no misses');
assert.deepEqual(full.checked.sort(),['chat header','composer','reasoning pill','thread'],'Only groups whose anchor is on screen are checked');

// Only a tile is mounted (the primary pane unmounts while another tab is active):
// its pill has no data-tour, so the plugin's own mark must satisfy the hook.
const tileOnly=await page.evaluate(()=>{const pill=document.querySelector('[data-tour="model-pill"]');pill.removeAttribute('data-tour');pill.setAttribute('data-t3-model-pill','');
  const r=checkDomHooks().missing;pill.removeAttribute('data-t3-model-pill');const bare=checkDomHooks().missing;pill.setAttribute('data-tour','model-pill');return {r,bare}});
assert.deepEqual(tileOnly.r,[],'A tile-only composer is not drift');
assert.deepEqual(tileOnly.bare,['composer: model pill'],'A composer with no recognizable pill still warns');

const drift=await page.evaluate(()=>{document.querySelector('.codicon-add').className='codicon codicon-plus';const r=checkDomHooks();document.querySelector('.codicon-plus').className='codicon codicon-add';return r});
assert.deepEqual(drift.missing,['composer: context menu icon'],'A renamed Hermes icon must be reported by name');

// A model without reasoning efforts has no pill: that is not drift.
const noReasoning=await page.evaluate(()=>{const pill=document.querySelector('[data-testid="reasoning-pill"]');pill.remove();const r=checkDomHooks();document.querySelector('[data-tour="model-pill"]').after(pill);return r.missing});
assert.deepEqual(noReasoning,[],'A missing reasoning pill must not warn');

// Picker open but no row identified: the model-name adapter drifted.
const picker=await page.evaluate(()=>{
  document.querySelector('[data-tour="model-pill"]').setAttribute('aria-expanded','true');
  document.body.insertAdjacentHTML('beforeend','<div data-t3-picker><div data-slot="dropdown-menu-search"><input></div><div data-t3-group><div data-slot="dropdown-menu-sub-trigger" data-t3-model=""><span><span>Sonnet 5</span><span>High</span></span></div></div></div>');
  document.querySelector('[data-tour="model-pill"]').dataset.t3Provider='anthropic';
  return checkDomHooks().missing;
});
assert.deepEqual(picker,['model picker: identified model rows'],'Unidentified model rows mean nativeModelParts drifted');
// Rows without a name span mean Hermes changed the row markup itself.
const markup=await page.evaluate(()=>{const row=document.querySelector('[data-t3-picker] [data-slot="dropdown-menu-sub-trigger"]');row.innerHTML='<span>Sonnet 5 High</span>';return checkDomHooks().missing});
assert(markup.includes('model picker: row name span'),'A flattened row label must be reported');

// Wiring: warn once per new set of misses, remember the result.
const wired=await page.evaluate(async()=>{
  document.querySelector('.codicon-add').remove();
  const store=new Map(),notes=[],disposers=[];
  const ctx={storage:{get:(k,d)=>store.has(k)?store.get(k):d,set:(k,v)=>store.set(k,v)},onDispose:fn=>disposers.push(fn)};
  const sdk={host:{notify:n=>notes.push(n)}};
  installDomCheck(ctx,sdk);await new Promise(r=>setTimeout(r,1700));
  disposers.forEach(fn=>fn());
  installDomCheck(ctx,sdk);await new Promise(r=>setTimeout(r,1700));
  disposers.forEach(fn=>fn());
  return {notes:notes.length,detail:notes[0]?.detail,saved:store.get('domCheck.v1')};
});
assert.equal(wired.notes,1,'The same breakage must not toast on every reload');
assert.match(wired.detail,/composer: context menu icon/);
assert(wired.saved.missing.includes('composer: context menu icon'),'Result is kept in plugin storage');

const off=await page.evaluate(async()=>{
  document.documentElement.dataset.hermesTheme='nous';
  const notes=[];const ctx={storage:{get:(k,d)=>d,set(){}},onDispose(){}};
  installDomCheck(ctx,{host:{notify:n=>notes.push(n)}});await new Promise(r=>setTimeout(r,1700));
  return notes.length;
});
assert.equal(off,0,'Another theme active: nothing of ours is expected, so no warning');
// HUD window: no panel header, statusbar or tray toggle. Those are not drift.
const hud=await page.evaluate(()=>{
  document.body.insertAdjacentHTML('afterbegin','<div data-hud-shell id="hudmark"></div>');
  document.querySelector('[data-panel-header]').remove();document.querySelector('[data-slot="statusbar"]').remove();
  const r=checkDomHooks();document.getElementById('hudmark').remove();return r;
});
assert(!hud.missing.some(m=>/^(chat header|status tray):/.test(m)),'HUD chrome differences must not warn');
assert(!hud.checked.includes('chat header'),'Chat header is not checked in the HUD');
console.log('PASS DOM hook self-check: per-group anchors, named misses, one warning per breakage, theme scoped');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
