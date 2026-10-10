import {useEffect,useRef,useState} from 'react'
import model from '../../generated/board-model.json'
import source from '../../generated/server-source.json'

type Snippet={file:string;line:number;lines:string[]}
function Code({snippet,highlight=''}: {snippet:Snippet;highlight?:string}){
  return <div className="server-code">{snippet.lines.map((line,i)=>{const at=highlight?line.indexOf(highlight):-1;return <div key={i} className={at>=0?'executing-line':''}><span>{snippet.line+i}</span><code>{at>=0?<>{line.slice(0,at)}<mark>{highlight}</mark>{line.slice(at+highlight.length)}</>:line}</code></div>})}</div>
}
const href=(s:Snippet)=>`${model.repo}/blob/${source.revision}/${s.file}#L${s.line}`
function SourceBlock({name,snippet}: {name:string;snippet:Snippet}){
  return <details className="server-source-block"><summary>{name}<span>코드 펼치기</span></summary><Code snippet={snippet}/><a href={href(snippet)} target="_blank" rel="noopener noreferrer">{snippet.file.split('/').at(-1)}:{snippet.line} ↗</a></details>
}
type Props={operation:string;phase:string;traceIndex:number;runKey:number;playing:boolean;onToggle:()=>void;onReplay:()=>void;onClose:()=>void}
export default function ServerLogView({operation,phase,traceIndex,runKey,playing,onToggle,onReplay,onClose}:Props){
  const close=useRef<HTMLButtonElement>(null),scroll=useRef<HTMLDivElement>(null)
  const [inspect,setInspect]=useState<number|null>(null)
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();return()=>{if(previous?.isConnected)previous.focus()}},[])
  useEffect(()=>{setInspect(null);scroll.current?.scrollTo({top:0})},[operation,runKey])
  useEffect(()=>{if(inspect===null)scroll.current?.scrollTo({top:0})},[traceIndex,inspect])
  const flow=source.operations.find(o=>o.id===operation)!,op=model.operations.find(o=>o.id===operation)!
  const index=inspect??Math.max(0,Math.min(traceIndex,flow.trace.length-1)),step=flow.trace[index]
  const active=traceIndex>=0&&phase==='insert'&&inspect===null
  return <section className="server-log-view" aria-label="Spring Boot 소스 흐름" onKeyDown={e=>{if(e.key==='Escape')onClose()}}>
    <header><div><span className="terminal-dots" aria-hidden="true">● ● ●</span><strong>Spring Boot · 소스 흐름</strong></div><button ref={close} onClick={onClose} aria-label="서버 로그 화면 닫기">닫기 ×</button></header>
    <div className="server-trace-toolbar"><span>{op.title} · {index+1}/{flow.trace.length}</span><div><button onClick={()=>{setInspect(null);onToggle()}} aria-label={playing?'소스 흐름 일시 정지':'소스 흐름 재개'}>{playing?'Ⅱ 일시 정지':'▷ 재개'}</button><button onClick={()=>{setInspect(null);onReplay()}}>다시 재생 ↻</button></div></div>
    <div ref={scroll} className="server-log-scroll"><div className="server-log-context"><span>{flow.endpoint.method} {flow.endpoint.path}</span><p>실제 소스의 정상 처리 순서 해석 · 실행 로그 수집 아님</p></div>
      <div className={'server-current-code '+(active?'processing':'')} aria-label="현재 강조 코드"><div className="server-step-status" role="status">{inspect!==null?'선택한 단계':phase==='idle'?'재생 대기':phase==='request'||phase==='transfer'?'서버 도착 대기':phase==='complete'?'재생 완료 · 마지막 코드':phase==='response'?'응답 전달 중':playing?'현재 처리 중':'일시 정지'}<span>{step.layer}</span></div><h4>{String(index+1).padStart(2,'0')} · {step.label}</h4><Code snippet={step.snippet} highlight={traceIndex>=0||inspect!==null?step.highlight:''}/><a href={href(step.snippet)} target="_blank" rel="noopener noreferrer">{step.snippet.file.split('/').at(-1)}:{step.snippet.line} · 원본 코드 ↗</a></div>
      <ol className="server-trace-steps" aria-label="호출 순서">{flow.trace.map((s,i)=><li key={i} className={i===index?'active':i<traceIndex?'done':''}><button aria-current={i===index?'step':undefined} onClick={()=>{if(playing)onToggle();setInspect(i);scroll.current?.scrollTo({top:0})}}><span>{i<traceIndex?'✓':String(i+1).padStart(2,'0')}</span>{s.label}</button></li>)}</ol>
      <details className="server-full-source"><summary>전체 메서드와 Repository 보기</summary><SourceBlock name={'BoardController.'+flow.method+'()'} snippet={flow.controller}/><SourceBlock name={'BoardService.'+flow.method+'()'} snippet={flow.service}/>{flow.helpers.map(helper=><SourceBlock key={helper.name} name={helper.name+'() · 내부 호출'} snippet={helper}/>) }{flow.repositories.map(repo=><SourceBlock key={repo.name} name={repo.name} snippet={repo}/>)}</details>
      <p className="server-log-footnote">조건부 코드는 조건을 만족할 때만 실행됩니다. 검증 실패나 예외가 발생하면 정상 흐름을 중단합니다. commit {source.revision.slice(0,7)}</p>
    </div>
  </section>
}
