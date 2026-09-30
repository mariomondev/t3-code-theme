// Opening a chat from the sidebar: Hermes empties the primary transcript for a
// frame or two and mounts "chat.empty" before the rows land. The headline and
// the centered composer belong to a truly empty chat, so while the primary
// chat is switching they must stand down, or the composer flashes in the
// middle and drops to the bottom. Tiles are not switching and keep theirs.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../desktop/plugin.js'),'utf8');
const layoutCss=source.match(/const css = `([\s\S]*?)\n`/)[1];
const surface=(attrs)=>`<main data-chat-surface ${attrs} style="position:relative;height:600px"><div><h1 data-t3-hero data-t3-empty-hero>What should we build?</h1></div>
  <div data-slot="composer-dock" style="position:absolute;bottom:0;height:100px"></div></main>`;
(async()=>{const browser=await chromium.launch();try{
const page=await browser.newPage();
await page.setContent(`<html data-hermes-theme="t3-code-theme"><head><style>${layoutCss}</style></head><body>
<div id="main">${surface('data-composer-target="main"')}</div><div id="tile">${surface('data-composer-target="tile:1"')}</div></body></html>`);
const read=()=>page.evaluate(()=>{const q=(id,s)=>getComputedStyle(document.querySelector(`#${id} ${s}`));
  return {mainTop:q('main','[data-slot="composer-dock"]').top,mainHero:q('main','[data-t3-empty-hero]').display,tileTop:q('tile','[data-slot="composer-dock"]').top}});
const idle=await read();
assert.equal(idle.mainTop,'300px','A truly empty primary chat centers its composer');
assert.notEqual(idle.mainHero,'none');
await page.evaluate(()=>document.documentElement.setAttribute('data-t3-switching',''));
const switching=await read();
assert.equal(switching.mainTop,'500px','While a chat opens the composer stays at the bottom');
assert.equal(switching.mainHero,'none','No headline flashes over a hydrating chat');
assert.equal(switching.tileTop,'300px','An empty tile is not switching and stays centered');
console.log('PASS switch hero: no centered composer or headline while the primary chat hydrates, tiles unaffected');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
