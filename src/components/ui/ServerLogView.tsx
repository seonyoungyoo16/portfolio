import {useEffect,useRef} from 'react'
import model from '../../generated/board-model.json'
import source from '../../generated/server-source.json'

type Snippet={file:string;line:number;lines:string[]}
function Code({snippet}: {snippet:Snippet}){
  return <div className="server-code">{snippet.lines.map((line,i)=><div key={i}><span>{snippet.line+i}</span><code>{line.trim()}</code></div>)}</div>
}
const href=(s:Snippet)=>`${model.repo}/blob/${source.revision}/${s.file}#L${s.line}`
function SourceBlock({name,snippet,expanded=false}: {name:string;snippet:Snippet;expanded?:boolean}){
  return <details className="server-source-block" open={expanded||undefined}><summary>{name}<span>코드 펼치기</span></summary><Code snippet={snippet}/><a href={href(snippet)} target="_blank" rel="noopener noreferrer">{snippet.file.split('/').at(-1)}:{snippet.line} ↗</a></details>
}
export default function ServerLogView({operation,phase,onClose}:{operation:string;phase:string;onClose:()=>void}){
  const close=useRef<HTMLButtonElement>(null),scroll=useRef<HTMLDivElement>(null)
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>{if(previous?.isConnected)previous.focus()}},[])
  useEffect(()=>{scroll.current?.scrollTo({top:0})},[operation])
  const flow=source.operations.find(o=>o.id===operation)!,op=model.operations.find(o=>o.id===operation)!
  const stage=phase==='idle'?0:phase==='request'||phase==='transfer'?0:phase==='insert'?1:2
  return <section className="server-log-view" aria-label="Spring Boot 소스 흐름" onKeyDown={e=>{if(e.key==='Escape')onClose()}}>
    <header><div><span className="terminal-dots" aria-hidden="true">● ● ●</span><strong>Spring Boot · 소스 흐름</strong></div><button ref={close} onClick={onClose} aria-label="서버 로그 화면 닫기">닫기 ×</button></header>
    <div ref={scroll} className="server-log-scroll"><div className="server-log-context"><span>{flow.endpoint.method} {flow.endpoint.path}</span><h3>{op.title}</h3><p>Controller → Service → Repository</p><p>실제 GitHub 소스 해석 · 실행 로그 수집 아님</p><small>commit {source.revision.slice(0,7)} · 동작을 바꾸면 함께 갱신됩니다.</small></div>
    <ol className="server-call-flow">
      <li className={stage===0?'active':''}><span className="server-layer">01 · CONTROLLER</span><h4>BoardController.{flow.method}()</h4><p>요청을 받아 BoardService.{flow.method}()에 전달합니다.</p><SourceBlock name="요청 매핑과 파라미터" snippet={flow.controller}/></li>
      <li className={stage===1?'active':''}><span className="server-layer">02 · SERVICE / TRANSACTION</span><h4>BoardService.{flow.method}()</h4><p>클래스의 @Transactional 범위 안에서 다음 처리를 수행합니다.</p><div className="server-business-steps">{op.steps.map((step,i)=><div key={i}><span>{i+1}</span><strong>{step.label}</strong><small>{step.table}</small></div>)}</div><SourceBlock name="현재 동작의 구현" snippet={flow.service} expanded/>{flow.helpers.map(helper=><SourceBlock key={helper.name} name={helper.name+'() · 내부 호출'} snippet={helper}/>)}</li>
      <li className={stage===2?'active':''}><span className="server-layer">03 · REPOSITORY / JPA</span><h4>데이터 조회·변경</h4><p>Service에서 아래 Repository를 호출합니다. saveAndFlush·flush·delete 등 기본 메서드는 JpaRepository에서 상속합니다.</p>{flow.repositories.map(repo=><SourceBlock key={repo.name} name={repo.name} snippet={repo}/>)}</li>
    </ol><p className="server-log-footnote">요청 검증 실패나 예외가 발생하면 정상 흐름을 중단합니다. 여기에 표시된 코드는 해당 commit의 실제 선언입니다.</p></div>
  </section>
}
