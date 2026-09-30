// Tab layout chrome: each pane gets its own project crumb and its own
// Local/server chip, and chat tabs get Codex-style chrome with their pane's
// provider icon. A tile must never borrow the primary chat's project or icon,
// and the primary chat must never show a focused tile's connection.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../desktop/plugin.js'),'utf8');
const layoutCss=source.match(/const css = `([\s\S]*?)\n`/)[1];
const pickerCss=source.match(/const pickerCss = `([\s\S]*?)\n`/)[1].replace(/\$\{[^}]+\}/g,'none');
const pane=(anchor,target,hidden,pill='')=>`<div ${hidden?'data-pane-hidden':''}><div data-chat-surface data-session-anchor="${anchor}" data-composer-target="${target}">
  <div data-slot="composer-bounds" style="position:relative;height:300px"><div data-slot="aui_thread-viewport"></div></div>
  <div data-slot="composer-fade"><div class="[grid-area:controls]">${pill}</div></div>
  <div data-slot="composer-dock"><div data-slot="composer-surface"><div class="status-drawer"><div class="status-drawer-content"><div class="coding-status-bar"><span>main</span></div></div></div></div></div>
</div></div>`;
// Hermes' PaneTab (components/ui/pane-tab.tsx): status-dot lead, uppercase label, hover close slot.
// Session tabs sit in a ContextMenu trigger (asChild), which swaps data-slot to "context-menu-trigger".
const tab=(id,title,active,dot)=>`<div role="tab" data-slot="${id==='sessions'?'pane-tab':'context-menu-trigger'}" data-tree-tab="${id}" data-active="${active}" data-closeable aria-selected="${active}" class="h-full">
  <div class="pane-tab-content">${dot?`<span><span><span class="tab-key-hint-icon"><span>${dot}</span></span></span></span>`:''}<span class="label"><span class="uppercase">${title}</span></span></div>
  <span class="close-slot opacity-0"><button aria-label="Close" class="close">x</button></span></div>`;
// Stand-ins for the Tailwind classes Hermes puts on these nodes (same specificity).
const tabClasses='.tabs{display:flex}.h-full{position:relative;display:flex;flex-shrink:0;align-items:center;height:31px}[data-slot="pane-tab"][data-closeable]{--pane-tab-close-width:1.5rem}.pane-tab-content{display:flex;flex:1;min-width:0;max-width:100%;height:100%;align-items:center}.label{display:flex;min-width:0;overflow:hidden;padding:0 8px}.uppercase{display:block;white-space:nowrap}.close-slot{position:absolute;top:0;bottom:0;right:0;display:flex}.close{display:grid;place-items:center;width:var(--pane-tab-close-width)}.uppercase{font-size:9px;text-transform:uppercase}.opacity-0{opacity:0;pointer-events:none}';
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage();
await page.setContent(`<html data-hermes-theme="t3-code-theme"><head><style>${tabClasses}${layoutCss}${pickerCss}</style></head><body>
<div data-tree-group="grp-main" data-window-top="true"><div data-panel-header><div role="tablist" class="tabs">
  ${tab('workspace','Crear tema',false,'<span role="status" class="size-1.5 rounded-full"></span>')}
  ${tab('session-tile:t1','Describir proyecto',true,'<span class="size-1 rounded-full"></span>')}
  ${tab('session-tile:draft','New session',false,'<span class="size-1.5 rounded-full border"></span>')}
  ${tab('session-tile:t2','Not visited yet',false,'<span class="size-1 rounded-full"></span>')}
  ${tab('session-tile:t3','New session',false,'<span class="size-1.5 rounded-full border"></span>')}
  <span class="flex shrink-0 items-center"><button>+</button></span>
</div></div>${pane('workspace','main',true,'<button data-tour="model-pill" data-t3-provider="anthropic"></button>')}${pane('session-tile:t1','tile:t1',false,'<button aria-label="Model · groq: llama" data-t3-provider="groq"></button>')}${pane('session-tile:draft','tile:draft',true)}</div>
<div data-tree-group="grp-side"><div data-panel-header><div role="tablist">${tab('sessions','Sessions',true,'')}</div></div></div></body></html>`);
await page.addScriptTag({content:source.replace(/^import .*\n/gm,'').replace('export default','globalThis.plugin =')});
const r=await page.evaluate(async()=>{
  const mut=v=>{const fns=[];return {v,get(){return this.v},set(x){this.v=x;fns.forEach(f=>f())},listen(f){fns.push(f);return()=>{}}}};
  const stored=mut('t1'),owner=mut({connectionId:'server',profile:'default'});
  const sdk={host:{state:{cwd:mut('/Users/me/acme'),focusedStoredSessionId:stored,focusedSessionOwner:owner,activeSessionId:mut('s1'),connectionId:mut('local')},
    connections:async()=>[{id:'server',label:'Home server',kind:'remote'},{id:'local',kind:'local'}],
    // The tile lives in another repo than the primary chat; the draft is not persisted yet.
    listPersistedSessions:async()=>({sessions:[{id:'t1',cwd:'/srv/other/apps/api',git_repo_root:'/srv/other'},{id:'s-old',cwd:'/tmp/x'},{id:'t2',cwd:'/srv/other',billing_provider:'openai-codex'}]})},
    // The cached global catalog reports the default model a new chat starts on.
    queryClient:{getQueryCache:()=>({findAll:({queryKey})=>queryKey[0]==='model-options'&&queryKey[2]==='global'?[{state:{data:{provider:'gemini',model:'gemini-3.1-pro'}}}]:[],subscribe:()=>()=>{}})}};
  const disposers=[];const ctx={register:()=>()=>{},onDispose:fn=>disposers.push(fn),storage:{get:(k,d)=>window.saved?.[k]??d,set(k,v){(window.saved??={})[k]=v}}};
  installComposerExtras(ctx,sdk);
  await new Promise(r=>setTimeout(r,200));
  const read=anchor=>{const s=document.querySelector(`[data-session-anchor="${anchor}"]`),bar=s.querySelector('[data-t3-tab-crumb]'),chip=s.querySelector('[data-t3-connection]');
    return {crumb:bar?.textContent,project:!!bar?.querySelector('[data-t3-crumb-project]'),chip:chip?.textContent,kind:chip?.dataset.t3ConnectionKind,
      pad:getComputedStyle(s.querySelector('[data-slot="aui_thread-viewport"]')).paddingTop}};
  const out={primary:read('workspace'),tile:read('session-tile:t1'),draft:read('session-tile:draft')};
  const t=id=>{const e=document.querySelector(`[data-tree-tab="${id}"]`),c=getComputedStyle(e),label=getComputedStyle(e.querySelector('.uppercase'));
    return {icon:e.dataset.t3TabIcon||null,height:c.height,radius:c.borderRadius,border:c.borderTopColor,label:[label.fontSize,label.textTransform],
      lead:e.querySelector('.pane-tab-content > span:first-child').matches(':has(.tab-key-hint-icon)')?getComputedStyle(e.querySelector('.pane-tab-content > span:first-child')).display:null,
      close:getComputedStyle(e.querySelector(':scope > span:last-child')).opacity,closeColor:getComputedStyle(e.querySelector(':scope > span:last-child > button')).color,overlap:(()=>{const text=e.querySelector('.uppercase').getBoundingClientRect(),x=e.querySelector(':scope > span:last-child > button').getBoundingClientRect();return text.right>x.left})(),before:getComputedStyle(e,'::before').maskImage.slice(0,30),slot:[getComputedStyle(e,'::before').width,getComputedStyle(e,'::before').animationName],titleX:Math.round(e.querySelector('.uppercase').getBoundingClientRect().left-e.getBoundingClientRect().left)}};
  out.tabs={primary:t('workspace'),tile:t('session-tile:t1'),draft:t('session-tile:draft'),unvisited:t('session-tile:t2'),unopenedDraft:t('session-tile:t3'),sidebar:t('sessions')};
  // Hermes unmounts the primary pane while another tab is active and may redraw its tab.
  document.querySelector('[data-session-anchor="workspace"]').parentElement.remove();
  const oldTab=document.querySelector('[data-tree-tab="workspace"]'),fresh=oldTab.cloneNode(true);for(const a of Array.from(fresh.attributes))if(a.name.startsWith('data-t3'))fresh.removeAttribute(a.name);fresh.removeAttribute('style');oldTab.replaceWith(fresh);
  await new Promise(r=>setTimeout(r,100));
  out.unmountedPrimary=document.querySelector('[data-tree-tab="workspace"]').dataset.t3TabIcon||null;
  out.saved=window.saved?.['tabProviders.v1'];
  document.documentElement.dataset.hermesTheme='nous';
  await new Promise(r=>setTimeout(r,100));
  out.afterTheme=document.querySelectorAll('[data-t3-tab-crumb],[data-t3-connection],[data-t3-chat-tab],[data-t3-chat-strip],[data-t3-tab-icon]').length;
  disposers.forEach(fn=>fn());
  return out;
});
assert.equal(r.primary.crumb,'ACacme','Primary pane: badge and project; the tab already shows the title');
assert.equal(r.tile.crumb,'OTother','Tile pane: its own project from its persisted row');
assert.equal(r.draft.crumb,undefined,'Unpersisted draft tile: no bar, never the primary project');
assert.equal(r.draft.pad,'0px','No bar, no reserved space');
// Codex-style chat tabs: each carries its own pane's provider icon.
assert.equal(r.tabs.primary.icon,'anthropic');assert.equal(r.tabs.tile.icon,'groq','A tile tab shows its own provider, not the primary one');
assert.equal(r.tabs.draft.icon,null,'No provider yet: no icon');
assert.deepEqual(r.tabs.draft.slot,['14px','t3-skeleton'],'No provider yet: a skeleton holds the icon slot');
assert.deepEqual(r.tabs.tile.slot,['14px','t3-icon-in'],'The icon fades into the same slot');
assert.equal(r.tabs.draft.titleX,r.tabs.tile.titleX,'The title does not move when the icon arrives');
assert.equal(r.tabs.unvisited.icon,'openai-codex','A tab whose pane is not mounted yet takes its provider from the session row');
assert.equal(r.unmountedPrimary,'anthropic','The primary tab keeps its last provider while its pane is unmounted');
assert.equal(r.tabs.unopenedDraft.icon,'gemini','A draft tab never opened (no row, no pane) shows the default provider for new chats');
assert.equal(r.saved?.['session-tile:t3'],undefined,'That guess is never remembered over the real provider');
assert.equal(r.saved?.workspace,'anthropic','and remembers it across reloads');
assert.deepEqual(r.tabs.unvisited.label,['13px','none'],'and gets the same chrome');
assert(r.tabs.tile.before.startsWith('url('),'Icon painted before the label');
assert.deepEqual([r.tabs.tile.height,r.tabs.tile.radius,r.tabs.tile.border],['26px','8px','rgba(255, 255, 255, 0.08)'],'Active tab: rounded, hairline border');
assert.equal(r.tabs.primary.border,'rgba(0, 0, 0, 0)','Inactive tab: no border');
assert.deepEqual(r.tabs.tile.label,['13px','none'],'Sentence-case 13px titles, not uppercase');
assert.equal(r.tabs.tile.lead,'none','Idle dot hidden');assert.equal(r.tabs.draft.lead,'none','Draft dot hidden');
assert.notEqual(r.tabs.primary.lead,'none','A working/unread dot stays');
assert.equal(r.tabs.tile.close,'1','Active tab always shows its close button');assert.equal(r.tabs.tile.closeColor,'rgb(163, 163, 163)','Close glyph is readable on the dark tab');
for(const k of ['primary','tile','unvisited'])assert.equal(r.tabs[k].overlap,false,`${k}: the title never runs under the close button`);assert.equal(r.tabs.primary.close,'0','Inactive tabs show it on hover');
assert.deepEqual(r.tabs.sidebar.label,['9px','uppercase'],'Non-chat strips keep Hermes tabs');
assert.equal(r.tile.chip,'Home server','Focused tile shows its own connection');
assert.equal(r.tile.kind,'remote');
assert.equal(r.primary.chip,'Local','Primary keeps the active connection, not the focused tile\'s');
assert.equal(r.tile.pad,'40px','Transcript starts below the crumb bar');
assert.equal(r.afterTheme,0,'Another theme removes every crumb, chip and tab mark');
console.log('PASS tab layout: Codex-style chat tabs with per-pane provider icon, project-only crumb, per-pane Local/server chip, cleanup');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
