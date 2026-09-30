// Streaming cost of the plugin's document-wide observers. Simulates an
// assistant reply arriving token by token and compares Chromium's script,
// layout and style-recalc work with and without the plugin.
// Usage: PLAYWRIGHT_PATH=... node tools/bench-streaming.cjs
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),path=require('node:path');
const plugin=fs.readFileSync(path.join(__dirname,'../desktop/plugin.js'),'utf8');
const RUNS=3, TOKENS=1500;

const sdkStub=`
const atom=v=>({get:()=>v,listen:()=>()=>{}});
export const THEMES_AREA='themes';
export const CHAT_EMPTY_AREA='chat.empty';
export function requestTheme(){return true}
export const host={state:{activeSessionId:atom('s1'),focusedSessionId:atom('s1'),focusedStoredSessionId:atom('s1'),
  focusedSessionOwner:atom({connectionId:'local',profile:'default'}),cwd:atom('/Users/me/acme'),connectionId:atom('local')},
  connections:async()=>[],notify(){}};
export const queryClient={getQueryCache:()=>({findAll:()=>[],subscribe:()=>()=>{}})};`;

const rows=Array.from({length:120},(_,i)=>`<div class="${i===3?'bg-(--ui-row-active-background)':''}"><span class="hover-marquee-inner">Session ${i}</span></div>`).join('');
const turns=Array.from({length:40},(_,i)=>`<div data-slot="aui_user-message-root"><div data-slot="aui_user-bubble-actions"><div class="composer-human-message">Question ${i}</div></div></div><div data-slot="aui_assistant-message-content"><div class="aui-md">${'<p>Earlier answer paragraph with some words.</p>'.repeat(6)}</div></div>`).join('');
const html=withPlugin=>`<!doctype html><html data-hermes-theme="t3-code-theme"><head><script type="importmap">{"imports":{"@hermes/plugin-sdk":"/sdk.js","react/jsx-runtime":"/jsx.js"}}</script></head><body>
<aside data-tour="sessions-sidebar">${rows}</aside>
<div data-window-top="true"><div data-panel-header></div>
<main data-chat-surface data-composer-target="main"><section data-slot="aui_thread-content">${turns}
<div data-slot="aui_assistant-message-content" id="live"><div class="aui-md"><p id="para"></p></div></div></section>
<div data-slot="composer-dock"><div data-slot="composer-root"><div data-slot="composer-surface">
<div data-slot="composer-fade"><div class="grid"><div class="[grid-area:menu]"><button><i class="codicon codicon-add"></i></button></div>
<div class="[grid-area:input]"><div data-slot="composer-rich-input" data-placeholder="Add more context"></div></div>
<div class="[grid-area:controls]"><button data-tour="model-pill" aria-expanded="false" aria-label="Anthropic: claude-opus-5-5[1m]"><span>Opus</span></button><button data-testid="reasoning-pill"><span>High</span></button></div></div></div>
<div class="status-drawer"><div class="status-drawer-content"><div class="coding-status-bar"><span>main</span></div></div></div>
</div></div></div></main></div><div data-slot="statusbar"></div>
<script type="module">
${withPlugin?`import plugin from '/plugin.js';const data=new Map();plugin.register({register(){return()=>{}},onDispose(){},storage:{get:(k,d)=>data.has(k)?data.get(k):d,set:(k,v)=>data.set(k,v)}});`:''}
window.ready=true;</script></body></html>`;

async function run(browser,withPlugin){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.route('http://bench.test/**',route=>{
    const p=new URL(route.request().url()).pathname;
    if(p==='/plugin.js')return route.fulfill({contentType:'text/javascript',body:plugin});
    if(p==='/jsx.js')return route.fulfill({contentType:'text/javascript',body:'export const jsx=()=>null;'});
    if(p==='/sdk.js')return route.fulfill({contentType:'text/javascript',body:sdkStub});
    return route.fulfill({contentType:'text/html',body:html(withPlugin)});
  });
  await page.goto('http://bench.test/');await page.waitForFunction(()=>window.ready);
  await page.waitForTimeout(2000); // let startup syncs and the DOM check settle
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  const before=await metrics();
  // assistant-ui style stream: mostly text appends, a new inline node every
  // few tokens, one token per animation frame.
  await page.evaluate(n=>new Promise(done=>{let i=0;const para=document.getElementById('para');let text=para.appendChild(document.createTextNode(''));
    const tick=()=>{if(i++>=n)return done();if(i%5===0){const code=document.createElement('code');code.textContent='x';para.append(code);text=para.appendChild(document.createTextNode(''))}else text.appendData(' token');requestAnimationFrame(tick)};requestAnimationFrame(tick)}),TOKENS);
  const after=await metrics();await page.close();
  return {script:(after.ScriptDuration-before.ScriptDuration)*1000,layouts:after.LayoutCount-before.LayoutCount,recalcs:after.RecalcStyleCount-before.RecalcStyleCount,layoutMs:(after.LayoutDuration-before.LayoutDuration)*1000};
}
(async()=>{const browser=await chromium.launch();try{
  const median=xs=>xs.sort((a,b)=>a-b)[Math.floor(xs.length/2)];
  const result={};
  for(const withPlugin of [false,true]){const rs=[];for(let i=0;i<RUNS;i++)rs.push(await run(browser,withPlugin));
    result[withPlugin?'plugin':'baseline']=Object.fromEntries(Object.keys(rs[0]).map(k=>[k,Math.round(median(rs.map(r=>r[k]))*10)/10]))}
  const perToken=ms=>Math.round(ms/TOKENS*1000)/1000;
  console.log(JSON.stringify(result));
  console.log(`extra script per token: ${perToken(result.plugin.script-result.baseline.script)} ms, extra layouts: ${result.plugin.layouts-result.baseline.layouts} over ${TOKENS} tokens`);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
