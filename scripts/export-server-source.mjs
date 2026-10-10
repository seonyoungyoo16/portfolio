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
  const source=sources[name],start=source.lines.findIndex(l=>{const access=l.search(/\b(public|private) /);if(access<0)return false;const declaration=l.slice(access).split('{')[0];return new RegExp('(?:public|private) .*\\b'+methodName+'\\('+argument).test(declaration)})
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
// Ordered interpretation of the inspected Java expressions, including nested arguments.
const step=(label,methodName,highlight)=>({label,methodName,highlight})
const lock=step('게시글 조회 · 쓰기 잠금','locked','posts.findLocked(id)')
const user=step('사용자 조회','user','users.findById(id)')
const owner=step('작성자 권한 확인','owner','!authorId.equals(actor)')
const comment=step('댓글 조회 · 게시글 소속 확인','comment','comments.findById(id)')
const response=step('응답 DTO 생성','view','new PostView')
const commentResponse=step('댓글 응답 DTO 생성','view','new CommentView')
const sequences={
  create:[user,step('게시글 객체 생성','create','new Post(user(actor), title.trim(), body.trim())'),step('게시글 저장 · INSERT','create','posts.saveAndFlush'),response],
  like:[lock,user,step('좋아요 중복 확인','like','!likes.existsByPostIdAndUserId(id, actor)'),step('없는 경우에만 좋아요 INSERT','like','likes.saveAndFlush(new PostLike(p, u))'),response],
  unlike:[lock,user,step('현재 사용자 좋아요 조회 · 있으면 DELETE','unlike','likes.findByPostIdAndUserId(id, actor).ifPresent(likes::delete)'),step('변경 DB 반영','unlike','likes.flush()'),response],
  update:[lock,user,owner,step('버전 충돌 확인','update','!p.version.equals(version)'),step('제목·본문 변경','update','p.title = title.trim(); p.body = body.trim()'),step('변경 DB 반영 · UPDATE','update','posts.flush()'),response],
  delete:[lock,user,owner,step('댓글 삭제','delete','comments.deleteByPostId(id)'),step('좋아요 삭제','delete','likes.deleteByPostId(id)'),step('연관 삭제 DB 반영','delete','comments.flush(); likes.flush()'),step('게시글 삭제 · DB 반영','delete','posts.delete(p); posts.flush()')],
  comment:[lock,user,step('댓글 객체 생성','addComment','new Comment(p, user(actor), body.trim())'),step('댓글 저장 · INSERT','addComment','comments.saveAndFlush'),commentResponse],
  commentUpdate:[lock,comment,user,owner,step('댓글 본문 변경','updateComment','c.body = body.trim()'),step('변경 DB 반영 · UPDATE','updateComment','comments.flush()'),commentResponse],
  commentDelete:[lock,comment,user,owner,step('댓글 삭제','deleteComment','comments.delete(c)')],
}
const operations=model.operations.map(op=>{
  const controller=method('BoardController.java',op.method),service=method('BoardService.java',op.method)
  const helperNames=['locked','post','user','owner','comment','view'].filter(name=>new RegExp('\\b'+name+'\\(').test(service.lines.join('\n')))
  if(helperNames.includes('owner')&&!helperNames.includes('user'))helperNames.push('user')
  const helpers=helperNames.map(name=>({name,...method('BoardService.java',name,name==='view'&&op.id.startsWith('comment')?'Comment':'')}))
  const calls=[...service.lines,...helpers.flatMap(h=>h.lines)].join('\n')
  const relevant=Object.entries({users:'UserRepository',posts:'PostRepository',comments:'CommentRepository',likes:'LikeRepository'}).filter(([variable])=>calls.includes(variable+'.')).map(([,name])=>name)
  const endpoint=model.endpoints.find(e=>e.source.line===controller.line)
  if(!endpoint)throw Error('Missing endpoint '+op.id)
  const trace=[{label:'Controller → Service 호출',layer:'CONTROLLER',snippet:controller,highlight:'service.'+op.method+'('},...sequences[op.id].map(step=>{
    const code=method('BoardService.java',step.methodName,step.methodName==='view'&&op.id.startsWith('comment')?'Comment':'')
    if(!code.lines.join('\n').includes(step.highlight))throw Error('Missing trace evidence '+op.id+' / '+step.highlight)
    return {label:step.label,layer:'SERVICE / JPA',snippet:code,highlight:step.highlight}
  })]
  return {id:op.id,method:op.method,endpoint,controller,service,helpers,trace,repositories:repositories.filter(r=>relevant.includes(r.name))}
})
fs.writeFileSync('src/generated/server-source.json',JSON.stringify({revision,operations},null,2)+'\n')
console.log('Extracted source flows: '+operations.length+' at '+revision)
