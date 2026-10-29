import { useState } from 'react';
import todo from '../generated/todo-source.json';
import '../todo-project.css';

export function TodoPreview() {
  return <div className="todo-preview" aria-hidden="true">
    <div className="todo-preview-top"><b>oddk<span> · 오늘의 계획</span></b><small>REACT TODO</small></div>
    <div className="todo-preview-heading"><span>TODAY'S RHYTHM</span><strong>할 일에, 시간을 더하다.</strong></div>
    <div className="todo-preview-body">
      <div className="todo-preview-list"><small>오늘 할 일</small>
        <div><i>✓</i><span>자료 모으기<small>완료</small></span></div>
        <div><i>○</i><span>기획안 작성<small>작업 50분 · 여유 10분</small></span></div>
        <div><i>○</i><span>하루 돌아보기<small>계획과 실제 기록 비교</small></span></div>
      </div>
      <div className="todo-preview-timeline"><small>TIME BLOCK</small><span>09:00</span><div>기획안 작성<b>작업 50분</b></div><em>여유 10분</em><span>10:00</span></div>
    </div>
    <p className="todo-preview-caption">화면 구성 예시 · 계획 60분 = 작업 50분 + 여유 10분</p>
  </div>;
}

const steps = [
  {key:'add', title:'할 일 모으기', short:'제목으로 시작', description:'제목만으로 업무를 등록하고, 날짜·분류·목표를 나중에 정합니다. 오늘·이번 주·전체 목록에서 같은 업무를 이어서 봅니다.', boundary:'입력 → 제목 검증 → 같은 ID의 할 일 → 계획 저장', why:'모든 정보를 입력해야 시작할 수 있는 부담을 줄이고, 아직 날짜를 정하지 않은 일도 보관합니다.'},
  {key:'plan', title:'작업과 여유 정하기', short:'ALPEN 하루 계획', description:'ALPEN의 수집·시간 예상·여유 확보·우선순위 선택·점검을 하루 계획에 연결합니다. 작업 50분과 여유 10분은 계획 60분으로 저장합니다.', boundary:'작업·여유 입력 → 정수·범위 검증 → 합계 계산 → 계획 시간', why:'작업과 여유를 함께 배정하고, 계획한 시간과 실제 수행 시간을 구분합니다.'},
  {key:'schedule', title:'시간표에 배치하기', short:'타임블로킹', description:'날짜와 시작·종료를 정해 하루 시간표에 배치합니다. 겹친 구간은 나란히 표시하고 충돌을 드러내며, 바로 이어지는 일정은 구분합니다.', boundary:'시간 구간 → 시작 순 정렬 → 겹침·열 계산 → 시간표 표시', why:'해야 할 일의 목록을 언제 실행할지 정한 하루 계획으로 옮깁니다.'},
  {key:'record', title:'실행하고 점검하기', short:'계획과 실제 비교', description:'작업 시작·일시정지·휴식·종료로 실제 시간을 기록하고 계획과 비교합니다. 비로그인 실제 기록은 IndexedDB 트랜잭션의 완료를 확인한 뒤 저장 성공을 반환합니다.', boundary:'기록 변경 → IndexedDB 트랜잭션 → 커밋 완료 → 결과 반영', why:'예상한 시간과 실제 기록을 따로 유지해 다음 계획을 조정할 근거로 사용합니다.'},
] as const;

export default function TodoProject() {
  const [selected,setSelected] = useState(0);
  const step = steps[selected], source = todo.sources[step.key];
  const sourceUrl = `${todo.repo}/blob/${todo.revision}/${source.file}#L${source.line}`;
  return <main className="todo-project">
    <div className="todo-topline"><a href="#projects">← 프로젝트 목록</a><span>PROJECT 06 / REACT PRODUCTIVITY</span><a href={todo.repo} target="_blank" rel="noopener noreferrer">독립 프로젝트 소스 ↗</a></div>
    <section className="todo-intro">
      <div><span className="eyebrow">REACT · NEXT.JS · TYPESCRIPT</span><h1>해야 할 일에서,<br/><em>실행할 하루로.</em></h1><p>oddk · 리액트 투두리스트<br/>할 일을 모으고, 여유를 두어 계획하고,<br/>시간표와 실제 기록으로 하루를 돌아봅니다.</p>
        <div className="todo-actions"><a className="todo-primary" href={todo.appUrl} target="_blank" rel="noopener noreferrer">투두리스트 앱 열기 ↗</a><a href={todo.repo} target="_blank" rel="noopener noreferrer">GitHub 소스 보기 ↗</a></div>
      </div>
      <div className="todo-app-preview"><TodoPreview/><p>기능과 구조를 소개하는 화면입니다. 실제 등록·수정·저장은 위의 oddk 앱에서 체험할 수 있습니다.</p></div>
    </section>
    <section className="todo-flow-section" aria-labelledby="todo-flow-heading">
      <div className="todo-section-heading"><div><span className="eyebrow">COLLECT → PLAN → SCHEDULE → REVIEW</span><h2 id="todo-flow-heading">사용 흐름에서 구현까지.</h2></div><p>단계를 선택해 설계 의도와<br/>해당 기능의 실제 소스를 살펴보세요.</p></div>
      <ol className="todo-flow-steps">{steps.map((item,i)=><li key={item.key}><button type="button" aria-pressed={i===selected} aria-controls="todo-flow-detail" onClick={()=>setSelected(i)}><small>0{i+1} / {item.short}</small><strong>{item.title}</strong><span aria-hidden="true">↗</span></button></li>)}</ol>
      <div className="todo-flow-detail" id="todo-flow-detail">
        <div className="todo-flow-copy"><span className="eyebrow">0{selected+1} / USER ACTION</span><h3>{step.title}</h3><p>{step.description}</p><div className="todo-boundary">{step.boundary}</div><p className="todo-design-reason">{step.why}</p><a href={sourceUrl} target="_blank" rel="noopener noreferrer">이 기능의 원본 코드 ↗</a></div>
        <div className="todo-code"><div><span>{source.name}()</span><small>{todo.revision.slice(0,7)}</small></div><a href={sourceUrl} target="_blank" rel="noopener noreferrer">{source.file}:{source.line} ↗</a><pre aria-label="선택한 기능의 실제 소스">{source.lines.map((line,i)=><div key={i}><span>{source.line+i}</span><code>{line || ' '}</code></div>)}</pre></div>
      </div>
    </section>
    <section className="todo-notes" aria-label="프로젝트 구현과 실행 범위">
      <article><span className="eyebrow">ONE TASK, MULTIPLE VIEWS</span><h2>목록·시간표·목표를 같은 업무로.</h2><p>오늘·이번 주·전체 할 일과 목표 연결이 같은 업무 ID를 사용합니다. 표시 방식이 바뀌어도 작업의 날짜·시간·완료 상태를 이어서 확인합니다.</p></article>
      <article><span className="eyebrow">PLAN & ACTUAL</span><h2>계획과 실제 기록을 나누어.</h2><p>비로그인 계획은 브라우저 localStorage, 실제 시간 기록은 IndexedDB에 보관합니다. 로그인한 계정의 확정 계획·목표·실적은 계정 동기화로 이어갑니다.</p><a href={`${todo.repo}/blob/${todo.revision}/README.md`} target="_blank" rel="noopener noreferrer">실행 방법·저장 범위 ↗</a></article>
    </section>
    <div className="todo-evidence"><p>고정 커밋 <code>{todo.revision.slice(0,7)}</code>의 실제 소스로 기능을 설명합니다. 앱의 기존 검증 결과와 이번 포트폴리오 연결 확인은 별도로 기록합니다.</p><a href={`${todo.repo}/blob/${todo.revision}/docs/ux/UX13-ACCEPTANCE.md`} target="_blank" rel="noopener noreferrer">앱의 검증 결과·남은 확인 범위 ↗</a></div>
  </main>;
}
