import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'

const root=path.resolve(process.argv[2]||'../springboot-board-lab')
const model=JSON.parse(fs.readFileSync('src/generated/board-model.json','utf8'))
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()
if(revision!==model.revision)throw Error('Board source revision mismatch')
const java='src/main/java/dev/portfolio/board/'
const files=['BoardController.java','BoardService.java','Repositories.java']
const sources=Object.fromEntries(files.map(name=>{
  const file=java+name,original=execFileSync('git',['show',revision+':'+file],{cwd:root,encoding:'utf8'}),content=original.replace(/\r\n/g,'\n')
  const expected=model.sources.find(s=>s.file===file)
  const hashes=[content,content.replace(/\n/g,'\r\n')].map(text=>crypto.createHash('sha256').update(text).digest('hex'))
  if(expected&&!hashes.includes(expected.sha256))throw Error('Changed source '+file)
  return [name,{file,content,lines:content.split('\n')}]
}))
const snippet=(name,start,end)=>({file:sources[name].file,line:start+1,lines:sources[name].lines.slice(start,end+1)})
function method(name,methodName,argument=''){
  const source=sources[name],start=source.lines.findIndex(l=>new RegExp('(?:public|private) .*\\b'+methodName+'\\('+argument).test(l))
  if(start<0)throw Error('Missing method '+methodName)
  let depth=0,opened=false
  for(let i=start;i<source.lines.length;i++){
    const line=source.lines[i].slice(i===start?source.lines[i].indexOf('public ')>=0?source.lines[i].indexOf('public '):source.lines[i].indexOf('private '):0)
    for(const char of line){if(char==='{'){depth++;opened=true}else if(char==='}')depth--}
    if(opened&&depth===0)return snippet(name,start,i)
  }
  throw Error('Unclosed method')
}
const repositories=['UserRepository','PostRepository','CommentRepository','LikeRepository'].map(name=>{
  const s=sources['Repositories.java'],start=s.lines.findIndex(l=>l.startsWith('interface '+name+' '))
  const end=s.lines[start].endsWith('{}')?start:s.lines.findIndex((l,i)=>i>start&&l==='}')
  return {name,...snippet('Repositories.java',start,end)}
})
const operations=model.operations.map(op=>{
  const controller=method('BoardController.java',op.method),service=method('BoardService.java',op.method)
  const helperNames=['locked','post','user','owner','comment','view'].filter(name=>new RegExp('\\b'+name+'\\(').test(service.lines.join('\n')))
  if(helperNames.includes('owner')&&!helperNames.includes('user'))helperNames.push('user')
  const helpers=helperNames.map(name=>({name,...method('BoardService.java',name,name==='view'&&op.id.startsWith('comment')?'Comment':'')}))
  const calls=[...service.lines,...helpers.flatMap(h=>h.lines)].join('\n')
  const relevant=Object.entries({users:'UserRepository',posts:'PostRepository',comments:'CommentRepository',likes:'LikeRepository'}).filter(([variable])=>calls.includes(variable+'.')).map(([,name])=>name)
  const endpoint=model.endpoints.find(e=>e.source.line===controller.line)
  if(!endpoint)throw Error('Missing endpoint '+op.id)
  return {id:op.id,method:op.method,endpoint,controller,service,helpers,repositories:repositories.filter(r=>relevant.includes(r.name))}
})
fs.writeFileSync('src/generated/server-source.json',JSON.stringify({revision,operations},null,2)+'\n')
console.log('Extracted source flows: '+operations.length+' at '+revision)
