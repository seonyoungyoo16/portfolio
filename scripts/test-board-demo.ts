import assert from 'node:assert/strict'
import {applyAction,emptyBoard,databaseRows,BoardError} from '../src/board-demo.ts'
import model from '../src/generated/board-model.json' with {type:'json'}
let state=emptyBoard()
const act=(a:Parameters<typeof applyAction>[1],actor=1)=>state=applyAction(state,a,actor,model.rules)
act({type:'create',title:'첫 글',body:'본문'})
act({type:'update',id:1,title:'수정',body:'수정 본문',version:0});assert.equal(state.posts[0].version,1)
assert.throws(()=>act({type:'update',id:1,title:'오래된 수정',body:'본문',version:0}),(e:unknown)=>e instanceof BoardError&&e.status===409)
assert.throws(()=>act({type:'delete',id:1},2),(e:unknown)=>e instanceof BoardError&&e.status===403)
act({type:'comment',id:1,body:'댓글'},2);act({type:'commentUpdate',id:1,commentId:1,body:'수정 댓글'},2);assert.equal(state.comments[0].body,'수정 댓글')
assert.throws(()=>act({type:'commentDelete',id:1,commentId:1}), (e:unknown)=>e instanceof BoardError&&e.status===403)
act({type:'like',id:1},2);act({type:'like',id:1},2);assert.equal(state.likes.length,1)
act({type:'like',id:1});assert.equal(state.likes.length,2)
for(const table of model.tables){const row=databaseRows(state)[table.name as keyof ReturnType<typeof databaseRows>][0];if(row)assert.deepEqual(Object.keys(row).sort(),table.columns.map(c=>c.name).sort())}
act({type:'unlike',id:1});act({type:'unlike',id:1});assert.equal(state.likes.length,1)
assert.throws(()=>act({type:'create',title:'a'.repeat(model.rules.titleMax+1),body:'본문'}),(e:unknown)=>e instanceof BoardError&&e.status===400)
act({type:'delete',id:1});assert.equal(state.posts.length,0);assert.equal(state.comments.length,0);assert.equal(state.likes.length,0)
assert.equal(model.tables.length,4);assert.equal(model.relations.length,5);assert.deepEqual(model.rules.uniqueLike,['post_id','user_id'])
console.log('Board demo: CRUD, ownership, versions, comments, idempotent likes, cascade and source constraints passed.')
