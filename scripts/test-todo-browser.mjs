import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import todo from '../src/generated/todo-source.json' with {type:'json'};
const base=process.env.PORTFOLIO_URL || 'http://127.0.0.1:5191/';
const out=path.join('docs/todo-verification',new URL(base).hostname.endsWith('github.io')?'published':'local');
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch(), context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}), page=await context.newPage();
const pageErrors=[], checks=[];
page.on('pageerror',e=>pageErrors.push(e.message));
async function check(name,run){await run();checks.push(name);console.log('PASS '+name)}
try {
  await check('six equally sized project cards include the React Todo route',async()=>{
    await page.goto(base+'#projects');
    await expect(page.locator('.project-list>.featured-project')).toHaveCount(6);
    await expect(page.locator('.todo-featured')).toContainText('oddk · React Todo');
    await page.locator('.todo-featured').scrollIntoViewIfNeeded();
    await page.locator('.todo-featured').screenshot({path:path.join(out,'project-card.png')});
    await page.locator('.todo-featured').click();
    await expect(page.locator('.todo-project h1')).toContainText('실행할 하루로.');
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
    await expect(page.locator('.header nav').getByRole('link',{name:'GitHub ↗'})).toHaveAttribute('href',todo.repo);
  });
  await check('four user-flow selections show exact frozen source text and public source hashes',async()=>{
    await page.locator('.todo-reference>summary').click();
    for(const [i,source] of ['add','plan','schedule','record'].map(key=>todo.sources[key]).entries()){
      await page.locator('.todo-flow-steps button').nth(i).click();
      await expect(page.locator('.todo-flow-steps button').nth(i)).toHaveAttribute('aria-pressed','true');
      await expect(page.locator('.todo-code>a')).toHaveAttribute('href',`${todo.repo}/blob/${todo.revision}/${source.file}#L${source.line}`);
      assert.deepEqual(await page.locator('.todo-code pre code').allTextContents(),source.lines.map(s=>s||' '));
      const response=await fetch(`https://raw.githubusercontent.com/seonyoungyoo16/oddk-todo/${todo.revision}/${source.file}`);
      assert.equal(response.status,200);const text=(await response.text()).replaceAll('\r\n','\n');
      assert.equal(crypto.createHash('sha256').update(text).digest('hex'),source.sha256);
      assert.deepEqual(text.split('\n').slice(source.line-1,source.line-1+source.lines.length),source.lines);
    }
    await page.locator('.todo-flow-steps button').nth(1).click();
    await page.screenshot({path:path.join(out,'detail-1440.png'),fullPage:true});
  });
  await check('primary app link opens the actual deployed Todo app in a separate tab',async()=>{
    const link=page.getByRole('link',{name:'투두리스트 앱 열기 ↗'});
    await expect(link).toHaveAttribute('href',todo.appUrl);
    const [service]=await Promise.all([context.waitForEvent('page'),link.click()]);
    await service.waitForLoadState();
    assert.equal(service.url(),todo.appUrl);
    await expect(service.getByRole('heading',{name:'할 일 리스트',exact:true})).toBeVisible();
    await expect(service.getByRole('button',{name:'오늘 계획',exact:true})).toBeVisible();
    await service.close();
  });
  await check('320/390/768/1440/1800 layouts keep all six cards and Todo source readable',async()=>{
    for(const width of [320,390,768,1440,1800]){
      await page.setViewportSize({width,height:1000});
      await page.goto(base+'#projects');await page.evaluate(()=>document.fonts.ready);
      const cards=await page.locator('.project-list>.featured-project').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
      assert(Math.max(...cards)-Math.min(...cards)<1,'uniform card widths '+width);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'home overflow '+width);
      await page.locator('.todo-featured').click();
      await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);
      await page.locator('.todo-reference>summary').click();
      for(const button of await page.locator('.todo-flow-steps button').all()){await button.click();await expect(page.locator('.todo-code>a')).toBeVisible();}
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Todo overflow '+width);
      if(width===390)await page.screenshot({path:path.join(out,'detail-390.png'),fullPage:true});
    }
  });
  await check('direct hash reload, return navigation and all existing project routes remain available',async()=>{
    await page.reload();await expect(page.locator('.todo-project')).toBeVisible();
    await page.locator('.todo-topline').getByRole('link',{name:'← 프로젝트 목록'}).click();
    await expect(page.locator('.project-list>.featured-project')).toHaveCount(6);
    for(const [route,selector] of [['board','.board-demo-section'],['chat','.chat-project'],['login','.login-project'],['signup','.signup-project'],['payment','.payment-project']]){
      await page.goto(base+'#project/'+route);await expect(page.locator(selector)).toBeVisible();
    }
  });
  assert.equal(pageErrors.length,0);
  fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({status:'passed',verifiedAt:new Date().toISOString(),base,todoSource:todo.revision,checks,pageErrors,scope:'Portfolio card/detail, fixed original source, live app link and responsive browser checks. No Todo account or backend mutation.'},null,2)+'\n');
  console.log(`${checks.length} Todo portfolio browser groups passed`);
} catch(e){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw e} finally{await browser.close()}
