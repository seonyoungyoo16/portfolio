import {useState} from 'react';
import HardwareGallery from './HardwareGallery';
import ComponentFlowExample from './ComponentFlowExample';
import {hardwareDefinitions,type HardwareKind,type HardwareStatus} from '../three/hardware-models';
import '../component-gallery.css';

const statusNames:Record<HardwareStatus,string>={idle:'대기',active:'처리 중',success:'성공',error:'실패'};
const modelSource='https://github.com/seonyoungyoo16/portfolio/blob/main/src/three/hardware-models.ts';
const logicDefinitions=[
  {kind:'process',name:'처리 로직',component:'ProcessOverlay',description:'장비 위의 패널로 함수·업무 처리를 표시합니다. React는 브라우저 영역에 둡니다.'},
  {kind:'gate',name:'검증·분기',component:'DecisionGate',description:'조건과 통과·거부를 표시합니다. 장비 자체와 분리합니다.'},
  {kind:'flow',name:'경로·패킷',component:'FlowPath / DataPacket',description:'호출 방향과 요청·응답 이동을 구분합니다. 내부 계산에는 이동 패킷을 만들지 않습니다.'},
  {kind:'data',name:'데이터 변화',component:'DataSnapshot',description:'같은 ID의 변경 전·후 값을 카드로 연결합니다.'},
  {kind:'status',name:'처리 상태',component:'StatusBadge',description:'장비 모양은 유지하고 글자·아이콘·색으로 상태를 구분합니다.'},
  {kind:'source',name:'소스 연결',component:'SourceAnchor',description:'선택한 요소의 실제 구현으로 이동합니다. 아래 링크는 서버 모델 생성 코드입니다.'},
  {kind:'boundary',name:'실행 영역',component:'ExecutionBoundary',description:'브라우저·서버·외부 시스템의 실행 위치를 구분합니다.'},
  {kind:'queue',name:'큐·이벤트',component:'MessageQueue',description:'메시지 대기와 순서를 표시합니다. 브로커 장비 위에 겹쳐 사용합니다.'},
  {kind:'worker',name:'백그라운드 작업',component:'WorkerBadge',description:'같은 서버에 실행되는 작업자입니다. 별도 장비처럼 보이지 않게 배지를 씁니다.'},
  {kind:'lock',name:'잠금·소유권',component:'LockOverlay',description:'누가 점유하고 있는지와 해제 여부를 함께 보여줍니다.'},
  {kind:'reservation',name:'금액·자원 예약',component:'ReservationRing',description:'예약한 수량과 해제 상태를 표시합니다. 성공·커밋과 구분합니다.'},
  {kind:'transaction',name:'트랜잭션 경계',component:'TransactionBoundary',description:'함께 확정되는 변경을 묶습니다. 장비 도착과 COMMIT을 구분합니다.'},
  {kind:'ttl',name:'TTL·만료',component:'ExpiryBadge',description:'실제 단위와 만료 여부를 붙입니다. 장비 모양만으로 영속성을 추측하지 않게 합니다.'},
  {kind:'recovery',name:'재시도·복구',component:'RecoveryPath',description:'실패한 위치와 다시 들어가는 경로를 별도로 표시합니다.'},
];

function LogicExamples(){
  const [allowed,setAllowed]=useState(true),[locked,setLocked]=useState(true),[committed,setCommitted]=useState(false),[expired,setExpired]=useState(false),[pulse,setPulse]=useState(0),[retry,setRetry]=useState(false);
  return <div className="logic-gallery">{logicDefinitions.map(item=><article className="logic-example" key={item.kind} data-kind={item.kind}>
    <div className="logic-preview">
      {item.kind==='process'&&<div className="process-example"><small>React / Service</small><b>입력 검증 → 업무 처리</b><span>장비 위의 논리 패널</span></div>}
      {item.kind==='gate'&&<div className="gate-example"><div className={'decision-diamond '+(allowed?'allow':'deny')}><span>{allowed?'✓':'×'}</span></div><span>{allowed?'검증 통과':'조건 불충족'}</span><button type="button" onClick={()=>setAllowed(!allowed)}>{allowed?'거부 예시 보기':'통과 예시 보기'}</button></div>}
      {item.kind==='flow'&&<div className="packet-example"><div className="example-path"><span key={pulse} className={pulse?'example-packet moving':'example-packet'}/><small>요청 →</small></div><div className="example-path response"><small>← 응답</small></div><button type="button" onClick={()=>setPulse(pulse+1)}>패킷 이동 보기</button></div>}
      {item.kind==='data'&&<div className="snapshot-example"><small>샘플 · task-01</small><span>done <b>false → true</b></span><span>version <b>1 → 2</b></span></div>}
      {item.kind==='status'&&<div className="status-example"><span className="logic-chip">◷ 대기</span><span className="logic-chip tone-active">● 처리 중</span><span className="logic-chip tone-success">✓ 성공</span><span className="logic-chip tone-error">× 실패</span><span className="logic-chip tone-unknown">? 결과 불명</span></div>}
      {item.kind==='source'&&<div className="source-example"><span>ServerModel()</span><a href={modelSource} target="_blank" rel="noopener noreferrer">모델 구현 소스 ↗</a><small>실제 갤러리 모델 코드</small></div>}
      {item.kind==='boundary'&&<div className="boundary-example"><div><small>BROWSER</small><b>React 처리</b></div><span>→</span><div><small>SERVER</small><b>Spring 처리</b></div></div>}
      {item.kind==='queue'&&<div className="queue-example"><small>대기 순서 · 예시</small><div><span>event-01</span><span>event-02</span><span>event-03</span></div><b>먼저 들어온 메시지 → 소비</b></div>}
      {item.kind==='worker'&&<div className="worker-example"><span className="logic-chip tone-active">WORKER · 메일 발송</span><div><span>대기</span><i>→</i><b>작업 실행</b><i>→</i><span>결과 기록</span></div><small>서버 호스트 위에 붙는 배지</small></div>}
      {item.kind==='lock'&&<div className="lock-example"><div className={'lock-symbol '+(!locked?'unlocked':'')} aria-hidden="true"/><strong>{locked?'owner: request-01':'소유자 없음'}</strong><button type="button" onClick={()=>setLocked(!locked)}>{locked?'잠금 해제 예시':'잠금 예시'}</button></div>}
      {item.kind==='reservation'&&<div className="reservation-example"><div><b>R</b><span>3,000원 예약</span></div><small>예약 상태의 시각화 예시</small></div>}
      {item.kind==='transaction'&&<div className={'transaction-example '+(committed?'committed':'')}><small>하나의 트랜잭션</small><div><span>상태 변경</span><span>원장 기록</span></div><button type="button" onClick={()=>setCommitted(!committed)}>{committed?'✓ COMMIT 완료':'COMMIT 전 · 눌러서 확정 표시'}</button></div>}
      {item.kind==='ttl'&&<div className="ttl-example"><b>{expired?'만료됨':'TTL 1,800s'}</b><div className="ttl-track"><span style={{width:expired?'0%':'68%'}}/></div><button type="button" onClick={()=>setExpired(!expired)}>{expired?'남은 시간 예시':'만료 표시 보기'}</button></div>}
      {item.kind==='recovery'&&<div className="recovery-example"><span className={'logic-chip '+(retry?'tone-active':'tone-error')}>{retry?'↻ 같은 작업 재조회':'× 응답 확인 실패'}</span><div className={'retry-path '+(retry?'retrying':'')}>실패 지점 ───↶ 복구 경로</div><button type="button" onClick={()=>setRetry(!retry)}>{retry?'실패 표시로':'복구 경로 보기'}</button></div>}
    </div>
    <div className="logic-caption"><small>{item.component}</small><h3>{item.name}</h3><p>{item.description}</p></div>
  </article>)}</div>;
}

export default function ComponentGallery(){
  const [mode,setMode]=useState<'hardware'|'logic'|'composition'>('hardware'),[selected,setSelected]=useState<HardwareKind>('server'),[status,setStatus]=useState<HardwareStatus>('active'),[angles,setAngles]=useState<Partial<Record<HardwareKind,number>>>({});
  const current=hardwareDefinitions.find(item=>item.kind===selected)!;
  return <main className="component-showroom">
    <div className="component-topline"><a href="#projects">← 프로젝트 목록</a><span>COMPONENT SHOWROOM · 표준화 예시</span><a href={modelSource} target="_blank" rel="noopener noreferrer">공통 모델 소스 ↗</a></div>
    <header className="component-intro"><div><span className="eyebrow">PHYSICAL IN 3D, LOGIC AS OVERLAYS</span><h1>장비는 입체로,<br/><em>역할은 분명하게.</em></h1></div><p>같은 역할은 같은 조형을 사용합니다.<br/>장비의 형태는 유지하고, 처리·상태·소스는 그 위에 표시합니다.</p></header>
    <p className="component-example-note">표현 방식과 재사용 컴포넌트를 비교하는 갤러리입니다. 상태·데이터·처리 흐름은 예시이며 실제 서버 요청이나 프로젝트 데이터를 변경하지 않습니다.</p>
    <div className="component-mode" role="group" aria-label="예시 종류"><button type="button" aria-pressed={mode==='hardware'} onClick={()=>setMode('hardware')}>3D 장비 8종</button><button type="button" aria-pressed={mode==='logic'} onClick={()=>setMode('logic')}>논리 표시 14종</button><button type="button" aria-pressed={mode==='composition'} onClick={()=>setMode('composition')}>조합 예시</button></div>
    {mode==='hardware'&&<section aria-label="물리 역할의 3D 컴포넌트 예시">
      <div className="hardware-tools"><div><strong>{current.name}</strong><span>선택한 모델의 표현 상태</span></div><div className="hardware-state" role="group" aria-label="모델 표현 상태">{(Object.keys(statusNames) as HardwareStatus[]).map(value=><button type="button" key={value} aria-pressed={status===value} onClick={()=>setStatus(value)}>{statusNames[value]}</button>)}</div><button type="button" className="hardware-rotate" onClick={()=>setAngles(previous=>({...previous,[selected]:((previous[selected]||0)+Math.PI/4)%(Math.PI*2)}))}>선택 모델 돌려보기 ↻</button></div>
      <HardwareGallery selected={selected} status={status} angles={angles} onSelect={setSelected}/>
      <div className="hardware-selection" role="status"><span className={'logic-chip tone-'+status}>{statusNames[status]} · 표현 예시</span><div><b>{current.component}</b><p>{current.role}</p></div></div>
      <p className="component-design-rule">서버는 호스트 장비, DB는 저장소의 원통 표현입니다. Redis·브로커·외부 서비스의 장비 표현에도 실제 역할과 실행 영역을 별도로 붙입니다.</p>
    </section>}
    {mode==='logic'&&<section aria-label="장비 위에 결합하는 논리 컴포넌트 예시"><div className="component-section-label"><h2>장비와 분리해서 읽는 표시</h2><p>버튼을 눌러 통과·거부, 잠금, 만료와 복구 표현을 비교할 수 있습니다.</p></div><LogicExamples/></section>}
    {mode==='composition'&&<section aria-label="3D 장비와 논리 표시 조합 예시"><div className="component-section-label"><h2>PC → 서버 → DB</h2><p>장비 모델을 재사용하고, 현재 경로·내부 검증·커밋 표시를 따로 얹은 예시입니다.</p></div><ComponentFlowExample/></section>}
    <div className="component-footer-note"><b>공통 규칙</b><span>주황 = 현재 처리 · 초록+✓ = 성공 · 빨강+× = 실패 · 상태는 색과 글자로 함께 표시</span><span>모델과 실행 위치, 처리 상태를 각각 구분하는 표준화 시안입니다.</span></div>
  </main>;
}
