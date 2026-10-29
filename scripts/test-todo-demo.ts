import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { emptyTodo, prepareTodoAction, todoTimeline, validTodoState } from '../src/todo-demo.ts';
import { readTodoState, resetTodoState, TODO_STORAGE_KEY } from '../src/todo-storage.ts';
import { performTodoAction } from '../src/todo-trace.ts';
const checks:string[]=[];
function check(name:string,run:()=>void){run();checks.push(name);console.log('PASS '+name);}
class StorageFixture { data=new Map<string,string>(); writes=0; fail=false; getItem(key:string){return this.data.get(key)??null} setItem(key:string,value:string){if(this.fail)throw Error('quota');this.data.set(key,value);this.writes++} removeItem(key:string){this.data.delete(key)} }
const add=(title='기획안 작성',id='task-a')=>({kind:'add' as const,title,id});
const schedule=(id='task-a',start='09:00',work='50',buffer='10')=>({kind:'schedule' as const,id,start,work,buffer});

check('add trims title, preserves immutable state and rejects empty or duplicate pending identities',()=>{
 const original=emptyTodo(),next=prepareTodoAction(original,add('  기획안 작성  '));assert.equal(next.tasks[0].title,'기획안 작성');assert.equal(original.tasks.length,0);assert.equal(next.revision,1);
 assert.throws(()=>prepareTodoAction(next,add('기획안 작성','task-b')),/이미/);assert.throws(()=>prepareTodoAction(original,add(' ')),/1~120/);assert.throws(()=>prepareTodoAction(original,add('가'.repeat(121))),/1~120/);
});
check('schedule keeps the same task ID and conserves work + buffer without silently extending time',()=>{
 const one=prepareTodoAction(emptyTodo(),add()),next=prepareTodoAction(one,schedule());assert.equal(next.tasks[0].id,one.tasks[0].id);assert.equal(next.tasks[0].minutes,60);assert.equal(next.tasks[0].bufferMinutes,10);assert.equal(one.tasks[0].startTime,null);
 const layout=todoTimeline(next);assert.equal(layout.items[0].start,540);assert.equal(layout.items[0].end,600);
 for(const args of [schedule('task-a','09:00','239','2'),schedule('task-a','23:30'),schedule('task-a','25:00'),schedule('task-a','09:00','1.5'),schedule('task-a','09:00','50','0')]) assert.throws(()=>prepareTodoAction(one,args));
});
check('verbatim oddk timeline handles overlaps and adjacency with stable task IDs',()=>{
 const source=JSON.parse(fs.readFileSync('src/generated/todo-source.json','utf8'));assert.equal(crypto.createHash('sha256').update(fs.readFileSync('src/generated/todo-timeline.ts')).digest('hex'),source.sources.schedule.sha256);
 let state=prepareTodoAction(emptyTodo(),add());state=prepareTodoAction(state,schedule());state=prepareTodoAction(state,add('검토','task-b'));state=prepareTodoAction(state,schedule('task-b','09:30'));
 let layout=todoTimeline(state);assert.equal(layout.columns,2);assert(layout.items.every(t=>t.conflict));state=prepareTodoAction(state,schedule('task-b','10:00'));layout=todoTimeline(state);assert.equal(layout.columns,1);assert(layout.items.every(t=>!t.conflict));
});
check('complete and undo preserve the task and its schedule while changing the active timeline',()=>{
 const scheduled=prepareTodoAction(prepareTodoAction(emptyTodo(),add()),schedule()),done=prepareTodoAction(scheduled,{kind:'complete',id:'task-a'});assert.equal(done.tasks[0].minutes,60);assert.equal(done.tasks[0].done,true);assert.equal(todoTimeline(done).items.length,0);assert.equal(todoTimeline(prepareTodoAction(done,{kind:'complete',id:'task-a'})).items[0].id,'task-a');
 let state=prepareTodoAction(emptyTodo(),add());state=prepareTodoAction(state,{kind:'complete',id:'task-a'});state=prepareTodoAction(state,add('기획안 작성','task-b'));assert.throws(()=>prepareTodoAction(state,{kind:'complete',id:'task-a'}),/같은 제목/);
});
check('successful actions write only the isolated key and record precommit and postcommit snapshots',()=>{
 const store=new StorageFixture();store.data.set('oddk.plan','keep-original');const result=performTodoAction(emptyTodo(),add(),store);assert.equal(result.ok,true);assert.equal(store.writes,1);assert.equal(result.frames.length,5);assert.equal(result.frames[1].state.tasks.length,0);assert.equal(result.frames[2].state.tasks.length,1);assert.equal(result.frames[2].source,'commit');assert.equal(store.getItem('oddk.plan'),'keep-original');assert.deepEqual(readTodoState(store),result.after);
});
check('storage failure preserves old data and stops before a view-success frame',()=>{
 const store=new StorageFixture(),first=performTodoAction(emptyTodo(),add(),store),raw=store.getItem(TODO_STORAGE_KEY);store.fail=true;const failed=performTodoAction(first.after,schedule(),store);assert.equal(failed.ok,false);assert.equal(failed.after,first.after);assert.equal(store.getItem(TODO_STORAGE_KEY),raw);assert.equal(failed.frames.at(-1)?.failed,true);assert.equal(failed.frames.at(-1)?.source,'commit');assert.deepEqual(failed.frames.at(-1)?.path,['react','storage']);assert(!failed.frames.some(f=>f.source==='timeline'));
});
check('a stale tab cannot overwrite a newer committed version',()=>{
 const store=new StorageFixture(),first=performTodoAction(emptyTodo(),add(),store),raw=store.getItem(TODO_STORAGE_KEY);const stale=performTodoAction(emptyTodo(),add('다른 탭','other'),store);assert.equal(stale.ok,false);assert.match(stale.message,/다른 탭/);assert.equal(store.getItem(TODO_STORAGE_KEY),raw);assert.equal(store.writes,1);assert.equal(readTodoState(store).revision,first.after.revision);
});
check('corrupt persistence is preserved and reset removes no other application data',()=>{
 const store=new StorageFixture();store.data.set(TODO_STORAGE_KEY,'{broken');store.data.set('oddk.plan','keep-original');assert.throws(()=>readTodoState(store),/원본은 유지/);assert.equal(store.getItem(TODO_STORAGE_KEY),'{broken');assert.equal(validTodoState({schemaVersion:1,revision:0,tasks:[{}]}),false);assert.deepEqual(resetTodoState(store),emptyTodo());assert.equal(store.getItem('oddk.plan'),'keep-original');
});
fs.mkdirSync('docs/todo-interactive-verification',{recursive:true});fs.writeFileSync('docs/todo-interactive-verification/model.json',JSON.stringify({status:'passed',verifiedAt:new Date().toISOString(),checks,scope:'Browser-local model, real persistence boundary with injected storage failures, verbatim original timeline hash. Not backend I/O.'},null,2)+'\n');
console.log(checks.length+' Todo model groups passed');
