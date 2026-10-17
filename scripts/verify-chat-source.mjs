import fs from 'node:fs'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const model=JSON.parse(fs.readFileSync('src/generated/chat-source.json','utf8'))
const root=process.argv[2]||'../springboot-chat-lab'
const sources=new Map(model.sources.map(source=>{
  const content=execFileSync('git',['show',model.revision+':'+source.file],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n')
  assert.equal(crypto.createHash('sha256').update(content).digest('hex'),source.sha256,source.file)
  return [source.file,content]
}))
let count=0
for(const [flow,steps] of Object.entries(model.flows))for(const step of steps){
  const lines=sources.get(step.file).split('\n')
  assert.deepEqual(lines.slice(step.line-1,step.line-1+step.lines.length),step.lines,flow+' snippet at '+step.file)
  assert.ok(step.lines.join('\n').includes(step.highlight),flow+' highlight missing')
  count++
}
assert.ok(sources.get('src/main/java/dev/portfolio/chat/SocketConfig.java').includes('addHandler(socket, "/ws/chat")'))
assert.deepEqual(model.flows.join.slice(0,3).map(step=>step.highlight),['const ws=new WebSocket','ws.onopen=',"ws.send(JSON.stringify({type:'join'"])
assert.equal(model.flows.disconnect[0].highlight,'socket?.close();socket=null')
console.log('Verified '+count+' source steps and '+sources.size+' file hashes at '+model.revision)
