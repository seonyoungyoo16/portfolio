import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import executed from '../src/generated/todo-demo-source.json' with {type:'json'};
import original from '../src/generated/todo-source.json' with {type:'json'};
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5191/',key='portfolio:todo-lab:v1';
const out=path.join('docs/todo-interactive-verification',new URL(base).hostname.endsWith('github.io')?'published':'local');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),page=await context.newPage();
const checks=[],pageErrors=[],backendRequests=[];
context.on('page',p=>{p.on('pageerror',e=>pageErrors.push(e.message));p.on('request',r=>{if(['fetch','xhr'].includes(r.resourceType()))backendRequests.push(r.url());});});
page.on('pageerror',e=>pageErrors.push(e.message));page.on('request',r=>{if(['fetch','xhr'].includes(r.resourceType()))backendRequests.push(r.url());});
const service=()=>page.locator('.todo-lab-service'),flow=()=>page.locator('.todo-lab-flow');
const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),key);
async function finish(p=page){await expect(p.getByRole('button',{name:'결과 바로 보기',exact:true})).toBeVisible();await p.getByRole('button',{name:'결과 바로 보기',exact:true}).click();}
async function add(title,p=page){await p.getByLabel('01 / 할 일 추가',{exact:true}).fill(title);await p.getByRole('button',{name:'할 일 추가 →',exact:true}).click();await finish(p);}
async function check(name,run){await run();checks.push(name);console.log('PASS '+name);}
function codeLink(collection,source){return `${collection.repo}/blob/${collection.revision}/${source.file}#L${source.line}`;}
try{
 await page.goto(base+'#project/todo');
 await check('real add stores one isolated task and immediately links the action to its processing record',async()=>{
   await expect(page.locator('.todo-real-list li')).toHaveCount(0);await add('기획안 작성');
   const saved=await state();assert.equal(saved.revision,1);assert.equal(saved.tasks.length,1);assert.equal(saved.tasks[0].title,'기획안 작성');
   await expect(page.locator('.todo-real-list li')).toHaveCount(1);await expect(flow().locator('.todo-flow-action')).toContainText('기획안 작성');
   await expect(page.locator('.todo-scene canvas')).toHaveCount(1);await expect(page.locator('.todo-scene')).toHaveAttribute('data-ready','true');
 });
 await check('every recorded phase has the actual executed source, valid route and correct pre/post-save snapshot; observation never writes',async()=>{
   const saved=JSON.stringify(await state()),expected=[['render','input>react',0],['prepare','react',0],['commit','react>storage>react',1],['timeline','react>view',1],['render','view',1]];
   for(const [i,[sourceKey,route,revision]] of expected.entries()){
     await flow().locator('.todo-live-steps button').nth(i).click();await expect(page.locator('.todo-scene')).toHaveAttribute('data-route',route);await expect(page.locator('.todo-scene')).toHaveAttribute('data-source',sourceKey);
     await expect(flow().locator('.todo-frame-data')).toContainText('저장 버전 '+revision);
     const collection=sourceKey==='timeline'?original:executed,source=sourceKey==='timeline'?original.sources.schedule:executed.sources[sourceKey];
     await expect(flow().locator('.todo-live-source>a')).toHaveAttribute('href',codeLink(collection,source));assert.deepEqual(await flow().locator('.todo-live-source code').allTextContents(),source.lines.map(s=>s||' '));
   }
   await flow().locator('.todo-scene-nodes button').nth(2).click();await expect(page.locator('.todo-scene')).toHaveAttribute('data-source','commit');
   await expect(page.locator('.todo-scene-canvas')).toHaveAttribute('data-active-link','react>storage');
   await flow().getByRole('button',{name:'oddk 기준 구현',exact:true}).click();await expect(flow().locator('.todo-live-source>a')).toHaveAttribute('href',codeLink(original,original.sources.save));
   await flow().getByRole('button',{name:'체험 실행 코드',exact:true}).click();assert.equal(JSON.stringify(await state()),saved);
 });
 await check('schedule preserves identity and stores 50 work + 10 buffer = 60 in one actual timeline block',async()=>{
   const before=await state();await service().getByRole('button',{name:'시간표에 배치 →',exact:true}).click();await finish();
   const saved=await state();assert.equal(saved.tasks[0].id,before.tasks[0].id);assert.equal(saved.tasks[0].minutes,60);assert.equal(saved.tasks[0].bufferMinutes,10);assert.equal(saved.tasks[0].startTime,'09:00');
   await expect(page.locator('.todo-time-block')).toHaveCount(1);await expect(page.locator('.todo-time-block')).toContainText('09:00–10:00');
   await flow().locator('.todo-live-steps button').nth(2).click();
   await page.locator('.todo-playground').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'action-flow-source-1440.png'),fullPage:true});
   await page.locator('.todo-playground').screenshot({path:path.join(out,'workspace-1440.png')});
 });
 await check('completion and undo keep task data, update the active timeline and survive reload',async()=>{
   const before=await state();await page.getByRole('checkbox',{name:'기획안 작성 완료',exact:true}).check();await finish();
   let saved=await state();assert.equal(saved.tasks[0].done,true);assert.equal(saved.tasks[0].id,before.tasks[0].id);assert.equal(saved.tasks[0].minutes,60);await expect(page.locator('.todo-time-block')).toHaveCount(0);
   await flow().getByRole('button',{name:'oddk 기준 구현',exact:true}).click();await expect(flow().locator('.todo-live-source>a')).toHaveAttribute('href',codeLink(original,original.sources.complete));
   await page.getByRole('checkbox',{name:'기획안 작성 완료',exact:true}).uncheck();await finish();await expect(page.locator('.todo-time-block')).toHaveCount(1);
   await page.reload();await expect(page.locator('.todo-real-list li')).toHaveCount(1);await expect(page.locator('.todo-time-block')).toHaveCount(1);saved=await state();assert.equal(saved.tasks[0].id,before.tasks[0].id);assert.equal(saved.tasks[0].done,false);
 });
 await check('duplicate title, invalid duration and midnight overflow keep input and the last persisted state',async()=>{
   const before=JSON.stringify(await state());await page.getByLabel('체험 작업 시간').fill('239');await service().getByRole('button',{name:'시간표에 배치 →',exact:true}).click();await finish();assert.equal(JSON.stringify(await state()),before);await expect(page.getByLabel('체험 작업 시간')).toHaveValue('239');await expect(page.locator('.todo-run-result')).toContainText('240분');
   await page.getByLabel('체험 작업 시간').fill('50');await page.getByLabel('체험 시작 시각').fill('23:30');await service().getByRole('button',{name:'시간표에 배치 →',exact:true}).click();await finish();assert.equal(JSON.stringify(await state()),before);await expect(page.locator('.todo-run-result')).toContainText('당일');
   await add('중복 확인');const second=JSON.stringify(await state());await add('중복 확인');assert.equal(JSON.stringify(await state()),second);await expect(page.getByLabel('01 / 할 일 추가',{exact:true})).toHaveValue('중복 확인');await expect(page.locator('.todo-selected-frame')).toHaveAttribute('data-failed','true');await expect(page.locator('.todo-scene')).toHaveAttribute('data-route','react');
 });
 await check('overlapping tasks show two lanes and completion removes only its own block',async()=>{
   await page.getByLabel('체험 시작 시각').fill('09:30');await service().getByRole('button',{name:'시간표에 배치 →',exact:true}).click();await finish();await expect(page.locator('.todo-time-block')).toHaveCount(2);await expect(page.locator('.todo-time-block[data-conflict=true]')).toHaveCount(2);
   await page.getByRole('checkbox',{name:'중복 확인 완료',exact:true}).check();await finish();await expect(page.locator('.todo-time-block')).toHaveCount(1);await expect(page.locator('.todo-time-block[data-conflict=true]')).toHaveCount(0);
 });
 await check('real browser storage failure leaves the old list and typed input, then retry succeeds',async()=>{
   const before=JSON.stringify(await state());
   await page.evaluate(k=>{const previous=Storage.prototype.setItem;window.__todoOriginalSet=previous;Storage.prototype.setItem=function(key,value){if(key===k)throw new DOMException('Injected quota','QuotaExceededError');return previous.call(this,key,value);};},key);
   await add('저장 실패 확인');assert.equal(JSON.stringify(await state()),before);await expect(page.getByLabel('01 / 할 일 추가',{exact:true})).toHaveValue('저장 실패 확인');await expect(page.locator('.todo-run-result')).toContainText('저장하지 못했어요');await expect(page.locator('.todo-scene')).toHaveAttribute('data-route','react>storage');
   await page.evaluate(()=>{Storage.prototype.setItem=window.__todoOriginalSet;});await page.getByRole('button',{name:'할 일 추가 →',exact:true}).click();await finish();assert.equal((await state()).tasks.length,3);
 });
 await check('another tab observes the same isolated record, and corrupted data is preserved until explicit scoped reset',async()=>{
   const other=await context.newPage();await other.goto(base+'#project/todo');await expect(other.locator('.todo-real-list li')).toHaveCount(3);await add('두 탭 확인',other);await expect(page.locator('.todo-real-list li')).toHaveCount(4);await other.close();
   const bad=await browser.newContext();await bad.addInitScript(k=>{localStorage.setItem(k,'{broken');localStorage.setItem('oddk.plan','original-sentinel');},key);const badPage=await bad.newPage();await badPage.goto(base+'#project/todo');await expect(badPage.locator('.todo-lab-error')).toContainText('원본은 유지');assert.equal(await badPage.evaluate(k=>localStorage.getItem(k),key),'{broken');
   await badPage.getByRole('button',{name:'처음부터',exact:true}).click();await badPage.getByRole('button',{name:'체험 자료 초기화',exact:true}).click();assert.equal(await badPage.evaluate(()=>localStorage.getItem('oddk.plan')),'original-sentinel');await expect(badPage.locator('.todo-lab-error')).toHaveCount(0);await bad.close();
 });
 await check('mobile users perform all three actions, switch to matching flow/source, and return without losing work',async()=>{
   await page.setViewportSize({width:390,height:844});await page.reload();await expect(page.locator('.todo-lab-tabs')).toBeVisible();await add('모바일 할 일');await service().getByRole('button',{name:'시간표에 배치 →',exact:true}).click();await finish();await page.getByRole('checkbox',{name:'모바일 할 일 완료',exact:true}).check();await finish();
   const before=JSON.stringify(await state());await page.getByRole('button',{name:'방금 행동의 흐름·소스 보기 →',exact:true}).click();await expect(flow()).toBeVisible();await expect(service()).toBeHidden();await expect(flow().locator('.todo-live-source>a')).toHaveAttribute('href',codeLink(executed,executed.sources.render));
   await page.screenshot({path:path.join(out,'flow-source-390.png'),fullPage:true});await page.locator('.todo-lab-tabs').getByRole('button',{name:'체험',exact:true}).click();await expect(service()).toBeVisible();assert.equal(JSON.stringify(await state()),before);await page.screenshot({path:path.join(out,'actions-390.png'),fullPage:true});
 });
 await check('320/390/768/1440/1800 widths retain native controls and source without horizontal overflow',async()=>{
   for(const width of [320,390,768,1440,1800]){
     await page.setViewportSize({width,height:1000});await page.locator('.todo-lab-tabs').isVisible().then(async visible=>{if(visible)await page.locator('.todo-lab-tabs').getByRole('button',{name:'체험',exact:true}).click();});await expect(page.getByLabel('01 / 할 일 추가',{exact:true})).toBeVisible();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'service overflow '+width);
     if(width<=1100)await page.locator('.todo-lab-tabs').getByRole('button',{name:'흐름·소스',exact:true}).click();await expect(flow().locator('.todo-live-source>a')).toBeVisible();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'flow overflow '+width);
   }
 });
 await check('WebGL unavailable retains real actions, recorded snapshots and executed source',async()=>{
   const noGl=await browser.newContext({viewport:{width:390,height:844}});await noGl.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return old.call(this,type,...args);};});const fallback=await noGl.newPage();await fallback.goto(base+'#project/todo');await add('대체 화면 체험',fallback);await fallback.getByRole('button',{name:'방금 행동의 흐름·소스 보기 →',exact:true}).click();await expect(fallback.locator('.todo-scene-fallback')).toBeVisible();await expect(fallback.locator('.todo-live-source>a')).toHaveAttribute('href',codeLink(executed,executed.sources.render));await noGl.close();
 });
 await check('normal motion reaches each rendered endpoint, including the full storage round trip before advancing',async()=>{
   const movingContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'}),moving=await movingContext.newPage();
   await moving.goto(base+'#project/todo');await moving.getByLabel('01 / 할 일 추가',{exact:true}).fill('경로 도착 확인');await moving.getByRole('button',{name:'할 일 추가 →',exact:true}).click();
   const canvas=moving.locator('.todo-scene-canvas');await expect(canvas).toHaveAttribute('data-arrived','react',{timeout:1050});await finish(moving);
   await moving.locator('.todo-live-steps button').nth(2).click();await moving.locator('.todo-flow-controls').getByRole('button',{name:'흐름 다시보기',exact:true}).click();
   await expect(canvas).toHaveAttribute('data-arrived','react',{timeout:1050});await expect(moving.locator('.todo-scene')).toHaveAttribute('data-route','react>storage>react');
   await movingContext.close();
 });
 assert.equal(pageErrors.length,0);assert.equal(backendRequests.length,0);
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({status:'passed',verifiedAt:new Date().toISOString(),base,executedSource:executed.revision,oddkSource:original.revision,checks,pageErrors,backendRequests,scope:'Real isolated browser-local CRUD/storage, recorded actual transitions, frozen executed/source mapping, Chromium viewports. Not oddk account/backend I/O.'},null,2)+'\n');console.log(checks.length+' interactive Todo browser groups passed');
}catch(error){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw error;}finally{await browser.close();}
