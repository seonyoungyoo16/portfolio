import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5191/',published=new URL(base).hostname.endsWith('github.io'),out=path.join('docs/component-gallery-verification',published?'published':'local');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),checks=[],pageErrors=[],backendRequests=[];
page.on('pageerror',e=>pageErrors.push(e.message));page.on('request',r=>{if(['fetch','xhr'].includes(r.resourceType()))backendRequests.push(r.url());});
const mode=label=>page.locator('.component-mode').getByRole('button',{name:label,exact:true});
const check=async(name,run)=>{await run();checks.push(name);console.log('PASS '+name);};
try{
 await check('home links the additive component gallery while preserving six project cards',async()=>{
   await page.goto(base+'#projects');await expect(page.locator('.featured-project')).toHaveCount(6);await page.getByRole('link',{name:'공통 3D 요소 예시 보기 ↗',exact:true}).click();await expect(page.locator('.component-showroom h1')).toContainText('장비는 입체로');await expect(page.locator('.hardware-card')).toHaveCount(8);await expect(page.locator('.hardware-gallery')).toHaveAttribute('data-ready','true');await expect(page.locator('.hardware-gallery canvas')).toHaveCount(1);await page.locator('.hardware-gallery').screenshot({path:path.join(out,'models-1440.png')});await page.screenshot({path:path.join(out,'gallery-1440.png'),fullPage:true});
 });
 await check('eight equipment models render distinct pixels and share one WebGL renderer',async()=>{
   const hashes=new Set();for(const kind of ['desktop','mobile','server','database','cache','files','broker','external']){const card=page.locator(`.hardware-card[data-kind="${kind}"]`);await card.click();const viewport=card.locator('.hardware-viewport');await expect(viewport).toHaveAttribute('data-rendered-state','active');hashes.add(crypto.createHash('sha256').update(await viewport.screenshot()).digest('hex'));}
   assert.equal(hashes.size,8);await expect(page.locator('.hardware-gallery canvas')).toHaveCount(1);
 });
 await check('selection, rotation and four status examples update the actual selected model',async()=>{
   const card=page.locator('.hardware-card[data-kind=database]');await card.click();const viewport=card.locator('.hardware-viewport'),before=crypto.createHash('sha256').update(await viewport.screenshot()).digest('hex');await page.getByRole('button',{name:'선택 모델 돌려보기 ↻',exact:true}).click();await expect(viewport).toHaveAttribute('data-rotation','0.785');assert.notEqual(crypto.createHash('sha256').update(await viewport.screenshot()).digest('hex'),before);
   for(const [label,value] of [['대기','idle'],['처리 중','active'],['성공','success'],['실패','error']]){await page.locator('.hardware-state').getByRole('button',{name:label,exact:true}).click();await expect(viewport).toHaveAttribute('data-rendered-state',value);await expect(page.locator('.hardware-selection')).toContainText(label);}
 });
 await check('fourteen logical overlays stay separate and their gate lock transaction TTL and recovery examples respond',async()=>{
   await mode('논리 표시 14종').click();await expect(page.locator('.logic-example')).toHaveCount(14);await expect(page.locator('.component-showroom canvas')).toHaveCount(0);
   const gate=page.locator('.logic-example[data-kind=gate]');await gate.getByRole('button',{name:'거부 예시 보기',exact:true}).click();await expect(gate).toContainText('조건 불충족');
   const lock=page.locator('.logic-example[data-kind=lock]');await lock.getByRole('button',{name:'잠금 해제 예시',exact:true}).click();await expect(lock).toContainText('소유자 없음');
   await page.locator('.logic-example[data-kind=transaction] button').click();await expect(page.locator('.transaction-example')).toContainText('COMMIT 완료');await page.locator('.logic-example[data-kind=ttl] button').click();await expect(page.locator('.ttl-example')).toContainText('만료됨');await page.locator('.logic-example[data-kind=recovery] button').click();await expect(page.locator('.recovery-example')).toContainText('같은 작업 재조회');
   await expect(page.locator('.source-example>a')).toHaveAttribute('href','https://github.com/seonyoungyoo16/portfolio/blob/main/src/three/hardware-models.ts');await page.screenshot({path:path.join(out,'logical-overlays-1440.png'),fullPage:true});
 });
 await check('the composition uses the physical models and distinguishes internal work roundtrip and response',async()=>{
   await mode('조합 예시').click();await expect(page.locator('.component-composition')).toHaveAttribute('data-ready','true');await expect(page.locator('.component-showroom canvas')).toHaveCount(1);
   for(const [label,route] of [['3. 서버 내부 검증','server'],['4. 저장소 왕복','server>database>server'],['5. 결과 응답','server>client']]){await page.locator('.composition-steps').getByRole('button',{name:label,exact:true}).click();await expect(page.locator('.component-composition')).toHaveAttribute('data-route',route);}
   await page.locator('.composition-steps').getByRole('button',{name:'4. 저장소 왕복',exact:true}).click();await page.locator('.component-composition').screenshot({path:path.join(out,'composition-1440.png')});
 });
 await check('320/390/768/1440/1800 layouts retain all model and overlay controls without horizontal overflow',async()=>{
   for(const width of [320,390,768,1440,1800]){await page.setViewportSize({width,height:1000});await mode('3D 장비 8종').click();await expect(page.locator('.hardware-gallery')).toHaveAttribute('data-ready','true');await expect(page.locator('.hardware-card')).toHaveCount(8);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'hardware overflow '+width);if(width===390)await page.screenshot({path:path.join(out,'gallery-390.png'),fullPage:true});await mode('논리 표시 14종').click();await expect(page.locator('.logic-example')).toHaveCount(14);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'logic overflow '+width);await mode('조합 예시').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'composition overflow '+width);}
 });
 await check('WebGL context loss and restoration retain selected model rotation and status with one canvas',async()=>{
   await mode('3D 장비 8종').click();await page.locator('.hardware-card[data-kind=server]').click();await page.locator('.hardware-state').getByRole('button',{name:'성공',exact:true}).click();
   await page.locator('.hardware-gallery canvas').evaluate(canvas=>{window.galleryContext=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');window.galleryContext.loseContext();});await expect(page.locator('.hardware-gallery')).toHaveAttribute('data-ready','false');await expect(page.locator('.hardware-fallback')).toBeVisible();await page.evaluate(()=>window.galleryContext.restoreContext());await expect(page.locator('.hardware-gallery')).toHaveAttribute('data-ready','true');await expect(page.locator('.hardware-gallery canvas')).toHaveCount(1);await expect(page.locator('.hardware-card[data-kind=server] .hardware-viewport')).toHaveAttribute('data-rendered-state','success');
 });
 await check('WebGL unavailable retains role names and logical examples and existing project routes still open',async()=>{
   const fallbackContext=await browser.newContext({viewport:{width:390,height:844}});await fallbackContext.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return old.call(this,type,...args);};});const fallback=await fallbackContext.newPage();await fallback.goto(base+'#components');await expect(fallback.locator('.hardware-fallback')).toBeVisible();await expect(fallback.locator('.hardware-card')).toHaveCount(8);await fallback.locator('.component-mode').getByRole('button',{name:'논리 표시 14종',exact:true}).click();await expect(fallback.locator('.logic-example')).toHaveCount(14);await fallbackContext.close();
   for(const [route,selector] of [['board','.board-demo-section'],['chat','.chat-project'],['login','.login-project'],['signup','.signup-project'],['payment','.payment-project'],['todo','.todo-playground']]){await page.goto(base+'#project/'+route);await expect(page.locator(selector)).toBeVisible();}
   await page.goto(base+'#components');await expect(page.locator('.hardware-gallery canvas')).toHaveCount(1);
 });
 if(published){const response=await fetch('https://raw.githubusercontent.com/seonyoungyoo16/portfolio/main/src/three/hardware-models.ts');assert.equal(response.status,200);const remote=(await response.text()).replaceAll('\r\n','\n'),local=fs.readFileSync('src/three/hardware-models.ts','utf8').replaceAll('\r\n','\n');assert.equal(remote,local,'public model source matches this build');}
 assert.equal(pageErrors.length,0);assert.equal(backendRequests.length,0);
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({status:'passed',verifiedAt:new Date().toISOString(),base,checks,pageErrors,backendRequests,scope:'3D component proposal gallery and illustrative overlays only; no real backend operations or project data changes.'},null,2)+'\n');console.log(checks.length+' component gallery browser groups passed');
}catch(error){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw error;}finally{await browser.close();}
