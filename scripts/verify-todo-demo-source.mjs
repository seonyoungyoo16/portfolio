import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import actual from '../src/generated/todo-demo-source.json' with {type:'json'};
import original from '../src/generated/todo-source.json' with {type:'json'};
assert.match(actual.revision,/^[a-f0-9]{40}$/);assert.equal(Object.keys(actual.sources).length,6);
const remote=process.argv.includes('--remote'),files=new Map();
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('src/generated/todo-timeline.ts')).digest('hex'),original.sources.schedule.sha256,'verbatim executed timeline');
for(const [key,source] of Object.entries(actual.sources)){
 const text=execFileSync('git',['show',`${actual.revision}:${source.file}`],{encoding:'utf8'}).replaceAll('\r\n','\n');
 assert.equal(crypto.createHash('sha256').update(text).digest('hex'),source.sha256,key);
 assert.deepEqual(text.split('\n').slice(source.line-1,source.line-1+source.lines.length),source.lines,key);
 assert.equal(fs.readFileSync(source.file,'utf8').replaceAll('\r\n','\n'),text,'executed working file differs: '+source.file);
 if(remote){if(!files.has(source.file)){const response=await fetch(`https://raw.githubusercontent.com/seonyoungyoo16/portfolio/${actual.revision}/${source.file}`);assert.equal(response.status,200);files.set(source.file,(await response.text()).replaceAll('\r\n','\n'));}assert.equal(files.get(source.file),text);}
}
if(remote)for(const source of Object.values(original.sources)){
 const fileKey='oddk:'+source.file;
 if(!files.has(fileKey)){const response=await fetch(`https://raw.githubusercontent.com/seonyoungyoo16/oddk-todo/${original.revision}/${source.file}`);assert.equal(response.status,200);files.set(fileKey,(await response.text()).replaceAll('\r\n','\n'));}
 const text=files.get(fileKey);assert.equal(crypto.createHash('sha256').update(text).digest('hex'),source.sha256);assert.deepEqual(text.split('\n').slice(source.line-1,source.line-1+source.lines.length),source.lines);
}
fs.mkdirSync('docs/todo-interactive-verification',{recursive:true});fs.writeFileSync(`docs/todo-interactive-verification/source${remote?'-remote':''}.json`,JSON.stringify({status:'passed',verifiedAt:new Date().toISOString(),revision:actual.revision,functions:6,oddkRevision:original.revision,oddkFunctions:7,verbatimTimeline:true,remote},null,2)+'\n');
console.log('Verified 6 actual executed Todo functions'+(remote?' including GitHub originals':''));
