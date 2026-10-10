import { useEffect, useState } from 'react'
import BankingScene from './components/ui/banking-scene'
import { stations, steps, type Mode, type View, type StationId } from './data'

export default function App() {
  const [mode, setMode] = useState<Mode>('overview')
  const [view, setView] = useState<View>('overview')
  const [focusedStation, setFocusedStation] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [selected, setSelected] = useState<StationId | null>(null)
  const [step, setStep] = useState(0)
  const station = stations.find(s => s.id === selected)
  useEffect(() => {
    if (!selected) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
      if (event.key !== 'Tab') return
      const focusable = document.querySelectorAll<HTMLElement>('.detail-panel button, .detail-panel a')
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [selected])
  const modes: [Mode, string, string][] = [['overview', '전체 구조', '◇'], ['inside', '내부 보기', '▤'], ['stations', '장비별 보기', '▱'], ['flow', '요청 따라가기', '▷']]
  return <>
    <header className="header"><a href="#" className="brand"><span className="brand-mark">B<span>.</span></span><span>BACKEND / AI<small>DEVELOPER PORTFOLIO</small></span></a><nav aria-label="메인 메뉴"><a href="#projects">프로젝트</a><a href="#experience">경력</a><a href="#about">개발 방향 <span>↗</span></a></nav></header>
    <main>
      <section className="hero" aria-label="금융 시스템 3D 포트폴리오">
        <div className="hero-copy"><div className="eyebrow"><i /> BANKING SYSTEMS, CONNECTED</div><h1>금융을 이해하고,<br />기술로 <em>연결합니다.</em></h1><p>금융 업무를 이해하는 백엔드,<br />AI로 확장하는 개발.</p><div className="hero-actions"><a className="primary" href="#projects">프로젝트 살펴보기 <span>↗</span></a><button className="text-button" onClick={() => {setMode('flow'); setPlaying(true)}}>요청 흐름 재생 <span>▷</span></button></div><div className="hero-caption"><span>01 — SYSTEM EXPLORER</span><p>장비를 선택하면 관련 개발 경험을 볼 수 있습니다.</p></div></div>
        <div className="scene-wrap"><BankingScene mode={mode} view={view} focusedStation={focusedStation} playing={playing} selected={selected} onSelect={id => { setFocusedStation(stations.findIndex(s => s.id === id)); setSelected(id) }} onStep={setStep} /><div className="scene-meta"><span><i /> {playing ? 'SYSTEM EXPLORING' : 'ANIMATION PAUSED'}</span><span>5 NODES / 1 CONNECTED SYSTEM</span></div><div className="scene-hint">드래그하여 회전 · 장비를 클릭하여 탐색</div></div>
        <div className="toolbar"><div className="mode-tabs" role="group" aria-label="시스템 모드">{modes.map(([id, name, icon]) => <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}><span>{icon}</span>{name}</button>)}</div><div className="view-tabs" role="group" aria-label="카메라"><span>VIEW</span>{([['overview','Overview'],['side','Side'],['top','Top'],['station','Station'],['flight','Flight']] as const).map(([id, name]) => <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{name}</button>)}<button className="play" onClick={() => setPlaying(!playing)} aria-label={playing ? '애니메이션 일시 정지' : '애니메이션 재개'}>{playing ? 'Ⅱ' : '▷'}</button></div>{view === 'station' && <div className="station-picker" aria-label="근접 장비 선택"><button aria-label="이전 장비" onClick={() => setFocusedStation((focusedStation + 4) % 5)}>←</button><span aria-live="polite">{stations[focusedStation].name}</span><button aria-label="다음 장비" onClick={() => setFocusedStation((focusedStation + 1) % 5)}>→</button></div>}</div>
      </section>
      <section className="flow-strip" aria-label="요청 흐름"><span className="flow-label">REQUEST JOURNEY<small>설명을 위한 개념적 흐름</small></span><ol>{steps.map((s, i) => <li key={s} className={mode === 'flow' && step === i ? 'active' : ''}><span>0{i+1}</span>{s}{i < 4 && <b>→</b>}</li>)}</ol></section>
      <section id="projects" className="section"><div className="section-heading"><div><span className="eyebrow">02 — SELECTED EXPERIENCE</span><h2>경험을 연결하는 다섯 가지 관점.</h2></div><p>장비 또는 아래 항목을 선택해<br />담당 업무와 프로젝트를 살펴보세요.</p></div><div className="project-grid">{stations.map((s,i) => <button className="project-card" key={s.id} onClick={() => setSelected(s.id)}><span className="card-index">0{i+1}<span>↗</span></span><small>{s.en}</small><h3>{s.category}</h3><p>{s.summary}</p><div className="tags">{s.tags.map(t => <span key={t}>{t}</span>)}</div><span className="card-link">담당 경험 보기 <span>→</span></span></button>)}</div></section>
      <section id="experience" className="section experience"><div><span className="eyebrow">03 — PROFESSIONAL EXPERIENCE</span><h2>업무의 맥락에서<br />개발을 시작합니다.</h2><p className="muted">금융권 SI와 업무 시스템 개발 경험.</p></div><div className="timeline"><article><div className="company"><h3>닉컴퍼니</h3><span>프로 · 금융권 SI / 사내 프로젝트</span></div><ul><li><strong>IBK기업은행</strong><p>재외국민 인증서 발급 · BPR 연계, RA 관리자 포탈 대응</p><p>KISA 간편인증 · 공유이력 조회, 통계, 테스트 페이지 개발</p></li><li><strong>대구은행</strong><p>비대면 계좌개설 · 전자금융 가입 기능 구현</p></li><li><strong>사내 프로젝트</strong><p>FinsightAI 거래내역 관리 자동화 / 직원 마음챙김 사이트</p></li></ul></article><article><div className="company"><h3>리드정보기술</h3><span>사원 · 업무 시스템 개발 / 유지보수</span></div><ul><li><strong>업무 시스템</strong><p>교육관리시스템 제안 프로젝트 참여</p><p>비즈맨 ERP 유지보수 / 대한건설기계협회 접수번호 관리</p></li></ul></article></div></section>
      <section id="about" className="section about"><span className="eyebrow">04 — NEXT CONNECTION</span><h2>업무 경험 위에,<br /><em>AI의 가능성을 더합니다.</em></h2><p>지식베이스, 서재 챗봇, Qwen 로컬 LLM.<br />정보를 활용 가능한 지식과 서비스로 연결하는 개인 프로젝트를 이어갑니다.</p><div className="tags"><span>Knowledge Base</span><span>Chatbot</span><span>Local LLM</span></div></section>
    </main>
    <footer><span>BACKEND / AI · DEVELOPER PORTFOLIO</span><p>3D 장비와 요청 흐름은 포트폴리오용 개념도입니다.<br />실제 금융 시스템의 내부 구조나 인증 절차를 나타내지 않습니다.</p><a href="#">맨 위로 ↑</a></footer>
    {station && <div className="modal-backdrop" onClick={() => setSelected(null)}><section className="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title" onClick={e => e.stopPropagation()}><button autoFocus className="close" aria-label="상세 닫기" onClick={() => setSelected(null)}>×</button><span className="eyebrow">{station.en} / {station.name}</span><h2 id="detail-title">{station.title}</h2><p>{station.summary}</p><h3>담당 업무와 프로젝트</h3><ul>{station.projects.map(p => <li key={p}>{p}</li>)}</ul><div className="tags">{station.tags.map(t => <span key={t}>{t}</span>)}</div><p className="detail-note">{station.note}</p><a className="primary" href="#experience" onClick={() => setSelected(null)}>경력 전체 보기 <span>↗</span></a></section></div>}
  </>
}
