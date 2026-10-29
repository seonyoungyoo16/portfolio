import { useEffect, useRef, useState } from 'react';
import { emptyTodo, todoTimeline, type TodoAction } from '../todo-demo';
import { readTodoState, resetTodoState, TODO_STORAGE_KEY } from '../todo-storage';
import { performTodoAction, type TodoNode, type TodoRun } from '../todo-trace';
import { clockLabel } from '../generated/todo-timeline';
import original from '../generated/todo-source.json';
import executed from '../generated/todo-demo-source.json';
import TodoScene from './TodoScene';
import '../todo-workbench.css';

type Source={file:string;name:string;line:number;lines:string[];sha256:string};
function initialTodo(){try{return {state:readTodoState(localStorage),error:''};}catch(error){return {state:emptyTodo(),error:error instanceof Error?error.message:'체험 저장소를 열지 못했어요.'};}}

export default function TodoWorkbench(){
  const [initial]=useState(initialTodo),[state,setState]=useState(initial.state),[problem,setProblem]=useState(initial.error);
  const [title,setTitle]=useState(''),[selected,setSelected]=useState(initial.state.tasks[0]?.id||''),[start,setStart]=useState('09:00'),[work,setWork]=useState('50'),[buffer,setBuffer]=useState('10');
  const [run,setRun]=useState<TodoRun|null>(null),[step,setStep]=useState(0),[playing,setPlaying]=useState(false),[panel,setPanel]=useState<'service'|'flow'>('service');
  const [sourceMode,setSourceMode]=useState<'executed'|'original'>('executed'),[confirmReset,setConfirmReset]=useState(false);
  const section=useRef<HTMLElement>(null),titleInput=useRef<HTMLInputElement>(null);
  const frame=run?.frames[step]||null,view=frame?.state||state,layout=todoTimeline(state),chosen=state.tasks.find(t=>t.id===selected),busy=playing;
  const isCopied=frame?.source==='timeline';
  const source:Source|undefined=frame?(sourceMode==='original'||isCopied?original.sources[isCopied&&sourceMode==='executed'?'schedule':frame.original]:(executed.sources as Record<string,Source>)[frame.source]):undefined;
  const sourceRepo=sourceMode==='original'||isCopied?original.repo:executed.repo,sourceRevision=sourceMode==='original'||isCopied?original.revision:executed.revision;
  useEffect(()=>{if(!playing||!run)return;const timer=setTimeout(()=>{if(step>=run.frames.length-1)setPlaying(false);else setStep(step+1);},1100);return()=>clearTimeout(timer);},[playing,run,step]);
  useEffect(()=>{
    const update=(event:StorageEvent)=>{if(event.key!==TODO_STORAGE_KEY&&event.key!==null)return;try{const next=readTodoState(localStorage);setState(next);setProblem('');setRun(null);setPlaying(false);}catch(error){setProblem(error instanceof Error?error.message:'다른 탭의 저장 내용을 읽지 못했어요.');}};
    window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update);
  },[]);
  function runAction(action:TodoAction){
    if(playing||problem)return;
    const result=performTodoAction(state,action,localStorage);
    setRun(result);setStep(0);setPlaying(true);setSourceMode('executed');
    if(result.ok){
      setState(result.after);
      if(action.kind==='add'){setTitle('');setSelected(action.id);setStart('09:00');setWork('50');setBuffer('10');titleInput.current?.focus();}
    }
  }
  function chooseTask(id:string){
    setSelected(id);const task=state.tasks.find(t=>t.id===id);
    setStart(task?.startTime||'09:00');setWork(task?.minutes!=null?String(task.minutes-task.bufferMinutes!):'50');setBuffer(task?.bufferMinutes!=null?String(task.bufferMinutes):'10');
  }
  function reset(){try{const next=resetTodoState(localStorage);setState(next);setProblem('');setRun(null);setStep(0);setPlaying(false);setSelected('');setTitle('');setConfirmReset(false);}catch{setProblem('체험 자료를 초기화하지 못했어요. 저장 설정을 확인해주세요.');}}
  function showFlow(){setPanel('flow');section.current?.scrollIntoView({block:'start',behavior:'instant'});}
  function selectFrame(index:number){setStep(index);setPlaying(false);}
  return <section className="todo-playground" id="todo-playground" ref={section} data-panel={panel} aria-label="투두리스트 직접 체험">
    <div className="todo-lab-heading"><div><span className="eyebrow">INTERACTIVE REACT LAB</span><h2>직접 행동하고, 코드까지 따라가 보세요.</h2></div><span>이 페이지 전용 브라우저 저장</span></div>
    <p className="todo-lab-scope">여기서 만든 할 일은 포트폴리오 전용 localStorage에 저장됩니다. oddk 본 앱·계정과 분리된 당일 계획 체험입니다.</p>
    <div className="todo-lab-tabs" role="group" aria-label="투두 체험 패널"><button type="button" aria-pressed={panel==='service'} onClick={()=>setPanel('service')}>체험</button><button type="button" aria-pressed={panel==='flow'} onClick={showFlow}>흐름·소스</button></div>
    <div className="todo-lab-columns">
      <div className="todo-lab-service">
        <div className="todo-lab-toolbar"><b>01 추가 → 02 시간 배치 → 03 완료</b><button type="button" onClick={()=>setConfirmReset(!confirmReset)} disabled={busy}>처음부터</button></div>
        {confirmReset&&<div className="todo-reset-confirm"><p>이 페이지의 체험 할 일만 모두 지울까요?</p><button type="button" onClick={reset}>체험 자료 초기화</button><button type="button" onClick={()=>setConfirmReset(false)}>유지하기</button></div>}
        {problem&&<p className="todo-lab-error" role="alert">{problem}</p>}
        {busy&&<div className="todo-record-playing"><span>실행한 행동의 처리 기록을 재생 중이에요.</span><button type="button" onClick={()=>{setStep(run!.frames.length-1);setPlaying(false);}}>결과 바로 보기</button></div>}
        <form className="todo-add-form" noValidate onSubmit={event=>{event.preventDefault();runAction({kind:'add',title,id:crypto.randomUUID()});}}>
          <label htmlFor="todo-lab-title"><span>01 / 할 일 추가</span><input id="todo-lab-title" ref={titleInput} value={title} maxLength={120} onChange={event=>setTitle(event.target.value)} placeholder="예: 기획안 작성" disabled={busy||!!problem}/></label><button type="submit" disabled={busy||!!problem}>할 일 추가 →</button>
        </form>
        <div className="todo-real-list"><div><h3>내 할 일</h3><span>{state.tasks.filter(t=>t.done).length} / {state.tasks.length} 완료</span></div>
          {!state.tasks.length&&<p className="todo-lab-empty">첫 번째 할 일을 추가하면 시간 배치와 완료를 이어서 체험할 수 있어요.</p>}
          <ul>{state.tasks.map(task=><li key={task.id} data-task-id={task.id} data-done={task.done} data-selected={task.id===selected}>
            <input type="checkbox" aria-label={`${task.title} 완료`} checked={task.done} disabled={busy||!!problem} onChange={()=>runAction({kind:'complete',id:task.id})}/>
            <button type="button" className="todo-task-select" aria-pressed={task.id===selected} disabled={busy} onClick={()=>chooseTask(task.id)}><strong>{task.title}</strong><small>{task.startTime?`${task.startTime}–${clockLabel(Number(task.startTime.slice(0,2))*60+Number(task.startTime.slice(3))+task.minutes!)} · 작업 ${task.minutes!-task.bufferMinutes!} / 여유 ${task.bufferMinutes}분`:'시간 미설정 · 선택해서 배치'}{task.done?' · 완료':''}</small></button>
          </li>)}</ul>
        </div>
        <form className="todo-schedule-form" noValidate onSubmit={event=>{event.preventDefault();runAction({kind:'schedule',id:selected,start,work,buffer});}}>
          <h3>02 / 선택한 할 일 시간 배치</h3><p>{chosen?chosen.title:'위에서 할 일을 먼저 추가해주세요.'}</p>
          <fieldset disabled={busy||!!problem||!chosen||chosen.done}><legend className="sr-only">시작 시각과 작업·여유 설정</legend><label>시작 시각<input aria-label="체험 시작 시각" type="time" value={start} onChange={event=>setStart(event.target.value)}/></label><label>작업 시간 · 분<input aria-label="체험 작업 시간" type="number" min={1} max={239} step={1} value={work} onChange={event=>setWork(event.target.value)}/></label><label>여유 시간 · 분<input aria-label="체험 여유 시간" type="number" min={1} max={239} step={1} value={buffer} onChange={event=>setBuffer(event.target.value)}/></label></fieldset>
          <small>계획 = 작업 + 포함된 여유 · 합계 최대 240분 · 당일 종료</small><button type="submit" disabled={busy||!!problem||!chosen||chosen.done}>시간표에 배치 →</button>
          {chosen?.done&&<small>완료를 취소하면 다시 배치할 수 있어요.</small>}
        </form>
        <div className="todo-real-timeline" aria-label="진행 중인 할 일 시간표"><div><h3>03 / 시간표에서 확인하고 완료</h3><span>미완료 계획 {layout.items.reduce((n,t)=>n+t.end-t.start,0)}분</span></div><p>목록의 체크박스를 누르면 완료되고, 진행 중인 시간표에서 빠집니다.</p>
          {layout.items.some(t=>t.conflict)&&<p className="todo-lab-warning">겹치는 일정이 있어 나란히 표시했어요. 시간을 조정해보세요.</p>}
          {!layout.items.length?<p className="todo-lab-empty">아직 진행 중인 시간 블록이 없어요.</p>:<div className="todo-timeline-grid" style={{height:Math.max(170,(layout.end-layout.start)*.9)}}>{Array.from({length:Math.floor((layout.end-layout.start)/60)+1},(_,i)=><div className="todo-hour" key={i} style={{top:`${i*60/(layout.end-layout.start)*100}%`}}><span>{clockLabel(layout.start+i*60)}</span></div>)}{layout.items.map(item=><button type="button" key={item.id} className="todo-time-block" data-conflict={item.conflict} data-task-id={item.id} style={{top:`${(item.start-layout.start)/(layout.end-layout.start)*100}%`,height:`${(item.end-item.start)/(layout.end-layout.start)*100}%`,left:`calc(50px + (100% - 54px) * ${item.lane/item.columns})`,width:`calc((100% - 54px) / ${item.columns} - 4px)`}} onClick={()=>chooseTask(item.id)} disabled={busy}><strong>{item.title}</strong><small>{clockLabel(item.start)}–{clockLabel(item.end)}</small><span className="todo-time-buffer" style={{height:`${item.bufferMinutes/(item.end-item.start)*100}%`}}>여유 {item.bufferMinutes}분</span></button>)}</div>}
        </div>
        {run&&<div className="todo-run-result" data-ok={run.ok} role="status"><b>방금 행동의 결과</b><p>{run.message}</p><button type="button" className="todo-show-flow" onClick={showFlow}>방금 행동의 흐름·소스 보기 →</button></div>}
      </div>
      <div className="todo-lab-flow" aria-label="투두 처리 흐름과 실제 소스">
        <div className="todo-flow-toolbar"><div><span className="eyebrow">ACTION → STATE → SOURCE</span><h3>방금 한 행동이 코드로 흐르는 과정</h3></div><span>{run?`${step+1} / ${run.frames.length}`:'READY'}</span></div>
        <div className="todo-flow-action"><b>방금 한 행동</b><p>{run?.action||'왼쪽에서 첫 번째 할 일을 추가해보세요.'}</p><small>실행을 마친 동작의 기록입니다. 단계 선택은 데이터를 다시 저장하지 않습니다.</small></div>
        <TodoScene frame={frame} playing={playing} onNode={node=>{if(!run)return;const index=run.frames.findIndex(f=>f.path.includes(node as TodoNode));if(index>=0)selectFrame(index);}}/>
        {run&&<><div className="todo-flow-controls"><button type="button" onClick={()=>{if(step===run.frames.length-1)setStep(0);setPlaying(!playing);}}>{playing?'흐름 일시 정지':'흐름 다시보기'}</button><button type="button" disabled={step===run.frames.length-1} onClick={()=>selectFrame(step+1)}>다음 단계 →</button></div><ol className="todo-live-steps">{run.frames.map((item,index)=><li key={index}><button type="button" aria-current={index===step?'step':undefined} onClick={()=>selectFrame(index)}><span>{index+1}</span>{item.title}</button></li>)}</ol></>}
        <div className="todo-selected-frame" data-failed={frame?.failed||false}><b>{frame?.title||'실제 조작으로 시작하세요.'}</b><p>{frame?.detail||'할 일 추가·배치·완료가 목록과 시간표에 반영되고, 처리 코드가 자동으로 바뀝니다.'}</p></div>
        <div className="todo-frame-data"><b>선택한 단계의 데이터</b><span>저장 버전 {view.revision} · 할 일 {view.tasks.length} · 완료 {view.tasks.filter(t=>t.done).length}</span><ul>{view.tasks.map(task=><li key={task.id}><strong>{task.title}</strong><span>{task.startTime||'시간 미설정'} · {task.minutes===null?'계획 없음':`${task.minutes}분(여유 ${task.bufferMinutes}분)`} · {task.done?'완료':'진행'}</span></li>)}</ul></div>
        <section className="todo-live-source" aria-label="현재 처리 단계 실제 소스"><div className="todo-source-modes" role="group" aria-label="소스 종류"><button type="button" aria-pressed={sourceMode==='executed'} onClick={()=>setSourceMode('executed')}>체험 실행 코드</button><button type="button" aria-pressed={sourceMode==='original'} onClick={()=>setSourceMode('original')}>oddk 기준 구현</button></div>
          {frame&&source?<><p>{sourceMode==='original'?'원본 앱에서 대응하는 규칙입니다. 이 페이지의 실행 코드는 왼쪽 탭에서 확인하세요.':isCopied?'oddk에서 그대로 가져와 이 체험이 실제 호출하는 시간표 함수입니다.':'이 페이지에서 실제 호출한 함수입니다. 저장은 전용 체험 키만 사용합니다.'}</p><a href={`${sourceRepo}/blob/${sourceRevision}/${source.file}#L${source.line}`} target="_blank" rel="noopener noreferrer">{source.file}:{source.line} · {sourceRevision.slice(0,7)} ↗</a><pre tabIndex={0} aria-label="선택 단계 코드">{source.lines.map((line,index)=><div key={index}><span>{source.line+index}</span><code>{line||' '}</code></div>)}</pre></>:<p>{frame?'현재 실행 소스의 고정 리비전을 준비 중입니다.':'행동을 실행하면 해당 처리 단계의 코드가 표시됩니다.'}</p>}
        </section>
      </div>
    </div>
  </section>;
}
