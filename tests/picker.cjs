const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../desktop/plugin.js'),'utf8');
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage();page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')console.log('browser:',m.text())});await page.setContent('<html data-hermes-theme="t3-code-theme"><body></body></html>');
await page.addScriptTag({content:source.replace(/^import .*\n/gm,'').replace('export default','globalThis.plugin =')});
const result=await page.evaluate(()=>{
 const available=typeof favoriteKey==='function'&&typeof resolveCatalog==='function';if(!available)return {available};
 const state={activeSessionId:{get:()=> 'one'},focusedSessionId:{get:()=> 'one'},focusedSessionOwner:{get:()=>({connectionId:'local',profile:'default'})}};
 const q=(key,value)=>({queryKey:key,state:{data:value},getObserversCount:()=>1});
 const good={providers:[{slug:'exact:A',name:'A',models:['same']} ]};
 const queries=[q(['model-options','default','one','owner','remote'],{wrong:true}),q(['model-options','default','global','owner','local'],{global:true}),q(['model-options','default','one','owner','local'],good)];
 const client={getQueryCache:()=>({findAll:()=>queries})};
 const selected=resolveCatalog({state},client);
 state.focusedSessionId={get:()=> 'tile'};
 return {available,key:favoriteKey('p:a','b'),other:favoriteKey('p','a:b'),exact:favoriteKey(' P ','M/Case'),selected:selected?.data===good,tile:resolveCatalog({state},client)};
});
assert(result.available,'Picker must expose tested exact identity and owner-safe catalog resolution');
assert.notEqual(result.key,result.other,'Provider/model keys must never collide');assert.equal(result.exact,JSON.stringify([' P ','M/Case']));
assert(result.selected,'Read only the exact native owner/session cache entry');assert.equal(result.tile,null,'Unsupported tile must fall back, never primary/global');
const malformed=await page.evaluate(()=>{
 // Hermes row markup (captured 2026-09-27): name span, one chip per tag/fast/effort, then a caret.
 const chip=t=>'<span class="shrink-0 rounded-sm border text-(--ui-text-tertiary)">'+t+'</span>';
 const nativeRow=(name,...chips)=>{const row=document.createElement('div');row.innerHTML='<span class="flex min-w-0 flex-1 items-center gap-1.5"><span class="min-w-0 truncate">'+name+'</span>'+chips.map(chip).join('')+'</span><i class="codicon codicon-chevron-right"></i>';return row};
 const fable=nativeRow('Fable 5.1','High');
 const collision=identifyNativeRow(fable,{models:['claude-fable-5.1','vendor/claude-fable-5.1']});
 const variant=identifyNativeRow(fable,{models:['claude-fable-5.1','claude-fable-5.1-fast']});
 const tagged=identifyNativeRow(nativeRow('Gemini 3.1 Pro','Preview','High'),{models:['gemini-3.1-pro','gemini-3.1-pro-preview']});
 const claude={models:['claude-sonnet-5[1m]','claude-sonnet-5','claude-haiku-4-5-20251001','claude-opus-5-5[1m]']};
 // Two chips (context tag + effort) must still resolve the tagged id, not the base one.
 const sonnet1m=identifyNativeRow(nativeRow('Sonnet 5','1M','High'),claude);
 const sonnet=identifyNativeRow(nativeRow('Sonnet 5','High'),claude);
 const haiku=identifyNativeRow(nativeRow('Haiku 4.5','High'),claude);
 // Fast mode adds a chip after the name; the untagged base model still matches.
 const fastOn=identifyNativeRow(nativeRow('GPT-6-sol','Fast','Med'),{models:['gpt-6-sol','gpt-6-sol-fast','gpt-6-luna']});
 // Search splits the name into highlight spans; the chips stay separate.
 const searched=nativeRow('Opus 5.5','1M','High');searched.querySelector('.truncate').innerHTML='<mark>Op</mark>us 5.5';
 const highlighted=identifyNativeRow(searched,claude);
 const favorites=Array.from(readFavorites({get:()=>['not-json','[1,2]','["p","m"]','["p",""]']}));
 return {collision,variant,tagged,sonnet1m,sonnet,haiku,fastOn,highlighted,favorites};
});
assert.equal(malformed.collision,null,'Ambiguous formatted names must NOT get an invented favorite ID');
assert.equal(malformed.variant,'claude-fable-5.1','Native fast family uses exact base ID');
assert.equal(malformed.tagged,'gemini-3.1-pro-preview','Tagged variant must not collide with a base model');
assert.equal(malformed.sonnet1m,'claude-sonnet-5[1m]','1M chip picks the 1M route');
assert.equal(malformed.sonnet,'claude-sonnet-5','No tag chip picks the base route');
assert.equal(malformed.haiku,'claude-haiku-4-5-20251001','Date-pinned id matches its short name');
assert.equal(malformed.fastOn,'gpt-6-sol','Fast-mode chip is not a model tag');
assert.equal(malformed.highlighted,'claude-opus-5-5[1m]','Search highlights keep the row identified');
assert.deepEqual(malformed.favorites,['["p","m"]']);
console.log('PASS exact favorite identifiers, source/session cache isolation, tile fallback');
const discovery=fs.readFileSync(require('node:path').join(__dirname,'live-picker-raw.jsonl'),'utf8').trim().split('\n').map(JSON.parse).find(r=>r.phase==='discovery-v1');
// The capture predates Hermes' chip rows: rebuild each row label as a name span,
// one chip per metadata word and the trailing caret, as Hermes renders them now.
discovery.menu=discovery.menu.replace(/<span class="min-w-0 flex-1 truncate">([^<]*)(?:<span class="text-\(--ui-text-tertiary\)"> ([^<]*)<\/span>)?<\/span>/g,(m,name,meta='')=>
 '<span class="flex min-w-0 flex-1 items-center gap-1.5"><span class="min-w-0 truncate">'+name+'</span>'+meta.split(' ').filter(Boolean).map(t=>'<span class="shrink-0 rounded-sm text-(--ui-text-tertiary)">'+t+'</span>').join('')+'</span><i aria-hidden="true" class="codicon codicon-chevron-right ml-auto"></i>');
assert(discovery.menu.includes('codicon-chevron-right'),'Fixture rows were rebuilt');
await page.evaluate(r=>{
 document.body.innerHTML='<div data-slot="composer-fade"><button data-tour="model-pill" aria-expanded="true" aria-controls="'+r.controls+'" aria-label="'+r.before[0].label+'"><span>GPT-6-astra</span></button><button data-testid="reasoning-pill">High</button></div>'+r.menu;
 const state={activeSessionId:{get:()=>r.state.active},focusedSessionId:{get:()=>r.state.focused},focusedSessionOwner:{get:()=>r.state.owner}};
 window.cache={getQueryCache:()=>({findAll:()=>r.queries.map(q=>({...q,queryKey:q.key,state:{data:q.data},getObserversCount:()=>q.observers})),subscribe:()=>()=>{}})};
 window.store=new Map();window.disposers=[];window.nativeClicks=[];window.state=state;
 window.ctx={storage:{get:(k,d)=>window.store.has(k)?window.store.get(k):d,set:(k,v)=>window.store.set(k,v),remove:k=>window.store.delete(k)},onDispose:fn=>window.disposers.push(fn)};
 document.querySelectorAll('[data-slot="dropdown-menu-sub-trigger"]').forEach(e=>e.addEventListener('click',()=>window.nativeClicks.push(e.id)));
 window.available=typeof installPicker==='function';
 if(window.available)installPicker(window.ctx,{host:{state},queryClient:window.cache});
},discovery);
assert(await page.evaluate(()=>window.available),'Native picker enhancement must be installed');
await page.waitForSelector('[data-t3-picker="v2"]');
assert.equal(await page.locator('[data-tour=model-pill]').getAttribute('data-t3-provider'),'openai-codex');
assert.equal(await page.locator('[data-t3-provider-filter="all"]').count(),0,'No Todos shortcut');
assert.equal(await page.locator('[data-t3-provider-filter="openai-codex"]').getAttribute('aria-pressed'),'true','Default filter is active chat provider');
assert(await page.locator('[data-t3-model]:visible').evaluateAll(es=>es.every(e=>e.dataset.t3Provider==='openai-codex')));
assert.equal(await page.locator('[data-t3-sidebar] button > span:last-child').first().evaluate(e=>getComputedStyle(e).display),'none','Icon-only rail');
assert(await page.locator('[data-tour=model-pill]').evaluate(e=>decodeURIComponent(getComputedStyle(e,'::before').maskImage).includes('239.184')),'Trigger uses licensed OpenAI mark, not a mock monogram');
await page.evaluate(()=>{const row=document.createElement('div');row.dataset.slot='dropdown-menu-sub-trigger';row.id='unsupported-native-row';row.innerHTML='<span>Unmapped native label</span>';document.querySelector('[data-t3-group]').append(row)});
await page.waitForFunction(()=>document.getElementById('unsupported-native-row').hasAttribute('data-t3-model'));
assert.notEqual(await page.locator('#unsupported-native-row').evaluate(e=>getComputedStyle(e).display),'grid','Unmapped options keep the native row layout');
assert.equal(await page.locator('#unsupported-native-row [data-t3-favorite]').count(),0);
await page.locator('#unsupported-native-row').evaluate(e=>e.remove());
const original=await page.locator('[data-t3-model]').first().elementHandle();
const hover=await page.locator('[data-t3-model]').first().evaluate(row=>{let bubbled=false;const fn=()=>{bubbled=true};document.addEventListener('pointermove',fn);row.dispatchEvent(new PointerEvent('pointermove',{bubbles:true}));document.removeEventListener('pointermove',fn);return bubbled});assert.equal(hover,false,'Model hover must not reach Radix submenu handler');
assert(await page.locator('[data-t3-provider-icon=gemini]').evaluate(e=>getComputedStyle(e).backgroundImage.includes('data:image/svg')),'Gemini uses colored T3 SVG');
assert(await page.locator('[data-t3-provider-icon=openrouter]').evaluate(e=>decodeURIComponent(getComputedStyle(e).maskImage).includes('16.778')),'OpenRouter uses its logo');
assert.equal(await page.locator('[data-t3-picker]').evaluate(e=>getComputedStyle(e).overflowY),'hidden','Only model list scrolls; rail stays fixed');
// T3 row anatomy: vendor label, provider sub-line and a jump label on the first nine rows.
const anatomy=await page.locator('[data-t3-model]:visible').first().evaluate(r=>({label:r.querySelector(':scope > span').dataset.t3Label,sub:r.dataset.t3Sub,kbd:r.dataset.t3Kbd,star:!!r.querySelector('[data-t3-favorite] svg')}));
assert.equal(anatomy.sub.split(' · ')[0],'Codex','Provider short name under the model');assert.equal(anatomy.kbd,'⌘1');assert(anatomy.star,'Star lives inside the row');
assert.match(anatomy.label,/^GPT-6-/,'T3 display label');
const hidden=await page.locator('[data-t3-model]:visible').first().evaluate(r=>({chips:Array.from(r.querySelectorAll(':scope > span > span ~ span')).map(e=>getComputedStyle(e).display),caret:getComputedStyle(r.querySelector('.codicon-chevron-right')).display}));
assert(hidden.chips.length>0&&hidden.chips.every(d=>d==='none'),'Effort/tag chips are hidden in T3 rows');assert.equal(hidden.caret,'none','No submenu caret in T3 rows');
assert(await page.locator('[data-t3-header]').first().evaluate(e=>getComputedStyle(e).display==='none'),'Rail replaces provider labels');
const second=await page.locator('[data-t3-model]:visible').nth(1).getAttribute('id');
await page.locator('[data-slot=dropdown-menu-search] input').focus();await page.keyboard.press('Meta+2');
assert.deepEqual(await page.evaluate(()=>window.nativeClicks.splice(0)),[second],'Cmd+2 delegates the second visible native row');
await page.locator('[data-t3-provider-filter="gemini"]').click();
assert((await page.locator('[data-t3-model]:visible').count())>0);
assert(await page.locator('[data-t3-model]:visible').evaluateAll(es=>es.every(e=>e.dataset.t3Provider==='gemini')));
await page.locator('[data-slot=dropdown-menu-search] input').focus();await page.keyboard.press('ArrowUp');
assert.equal(await page.locator('[data-t3-kb-active]').getAttribute('id'),await page.locator('[data-t3-model]:visible').last().getAttribute('id'),'ArrowUp from search starts at last visible row');
await page.locator('[data-t3-provider-filter="openai-codex"]').click();
const star=page.locator('[data-t3-favorite]').first();const key=await star.getAttribute('data-t3-favorite');
await star.click();assert.equal(await star.getAttribute('aria-pressed'),'true');
assert.deepEqual(await page.evaluate(()=>window.nativeClicks),[],'Favorite must not select a model');
assert.deepEqual(await page.evaluate(()=>window.store.get('modelFavorites.v1')),[key]);
await page.locator('[data-t3-provider-filter="favorites"]').click();assert.equal(await page.locator('[data-t3-model]:visible').count(),1);
await page.locator('[data-slot=dropdown-menu-search] input').focus();await page.keyboard.press('ArrowDown');
const target=await page.locator('[data-t3-kb-active]').getAttribute('id');assert(target);
assert.equal(await page.locator('[data-slot=dropdown-menu-search] input').getAttribute('aria-activedescendant'),target,'Screen reader follows keyboard row');
assert.equal(await page.locator('[data-t3-current]').first().getAttribute('aria-current'),'true','Current model exposed accessibly');
await page.keyboard.press('Enter');assert.deepEqual(await page.evaluate(()=>window.nativeClicks),[target],'Keyboard delegates ONLY visible exact native row');
assert(await original.evaluate(e=>e===document.querySelector('[data-t3-model]')),'Do not clone/reparent native options');
await page.locator('[data-t3-favorite]:visible').click();assert.equal(await page.locator('[data-t3-model]:visible').count(),0);
assert.deepEqual(await page.evaluate(()=>window.store.get('modelFavorites.v1')),[]);
await page.evaluate(()=>{window.state.focusedSessionId={get:()=> 'another-tile'};document.documentElement.dataset.hermesTheme='nous'});
await page.waitForFunction(()=>!document.querySelector('[data-t3-picker]'));
assert.equal(await page.locator('[data-t3-favorite]').count(),0);assert.equal(await page.locator('[data-t3-filtered]').count(),0);
assert.equal(await page.locator('[data-tour=model-pill]').getAttribute('data-t3-provider'),null);
await page.evaluate(()=>window.disposers.forEach(fn=>fn()));
console.log('PASS real-catalog fixture: provider filtering, persistent favorites, visible-only keyboard/native delegation, no clone, cleanup');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
