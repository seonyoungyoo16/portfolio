import {useEffect,useRef,useState} from 'react'
import ChatScene from './ChatScene'
import model from '../generated/chat-source.json'
import {chatHistory,waitingChat,readChat,hasReadChat,nextReadChat,deliverChat,emptyChat,storeChat,type ChatClient,type ChatRead,type ChatDatabase,type ChatMessage} from '../chat-demo'
import '../chat.css'

type Flow=keyof typeof model.flows
type Saved=ReturnType<typeof storeChat>
type Trace={kind:Flow;actor:number;run:number;body:string;roomId:string;job:Saved|null;recoveryCount:number;readUpTo:number;applyRead:boolean}
const cacheKey='chat-lab:v1'
function initialDatabase():ChatDatabase{try{const db=JSON.parse(localStorage.getItem(cacheKey)||'null');if(db&&Array.isArray(db.messages)&&Number.isSafeInteger(db.nextId))return db}catch{}return emptyChat()}
const format=(m:ChatMessage)=>new Date(m.createdAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})
const flowName:Record<Flow,string>={join:'입장과 대화 복구',send:'메시지 전송',duplicate:'중복 전송 방지',disconnect:'오프라인으로 전환',read:'읽음 확인'}
export default function ChatProject(){
  const [db,setDb]=useState(initialDatabase)
  const [clients,setClients]=useState<ChatClient[]>(()=>[0,1].map(i=>({id:'demo-'+(i?'b':'a'),name:'참가자 '+(i?'B':'A'),roomId:'lobby',connected:false,messages:[]})))
  const [drafts,setDrafts]=useState(['','']),[notice,setNotice]=useState('참가자 A와 B의 다시 접속을 눌러 시작하세요. 오프라인에서도 메시지는 서버에 보관됩니다.')
  const [trace,setTrace]=useState<Trace>({kind:'join',actor:0,run:0,body:'채팅방 입장',roomId:'lobby',job:null,recoveryCount:0,readUpTo:0,applyRead:false})
  const [step,setStep]=useState(0),[playing,setPlaying]=useState(false),[running,setRunning]=useState(false),[lastRequests,setLastRequests]=useState<(ChatMessage|null)[]>([null,null])
  const [sourceOpen,setSourceOpen]=useState(false)
  const [receipts,setReceipts]=useState<ChatRead[][]>(()=>[initialDatabase().reads||[],initialDatabase().reads||[]]),[readTick,setReadTick]=useState(0)
  const pendingConnection=useRef(false)
  const committed=useRef(false),delivered=useRef(false),acknowledged=useRef(false)
  const messageLists=useRef<(HTMLDivElement|null)[]>([])
  const timelines=model.flows[trace.kind],current=timelines[Math.min(step,timelines.length-1)]
  useEffect(()=>{try{localStorage.setItem(cacheKey,JSON.stringify(db))}catch{setNotice('저장 공간이 부족해 현재 화면에서만 대화가 유지됩니다.')}},[db])
  useEffect(()=>{messageLists.current.forEach(list=>{if(list)list.scrollTop=list.scrollHeight})},[clients])
  useEffect(()=>{if(!playing||!running)return;const timer=setInterval(()=>setStep(i=>{if(i>=timelines.length-1){setRunning(false);setPlaying(false);return i}return i+1}),1100);return()=>clearInterval(timer)},[playing,running,timelines.length,trace.run])
  useEffect(()=>{
    if(trace.kind==='join'&&pendingConnection.current&&step>=timelines.length-1){pendingConnection.current=false;setReceipts(rs=>rs.map((r,i)=>i===trace.actor?db.reads||[]:r));setClients(cs=>cs.map((c,i)=>i===trace.actor?{...c,connected:true,messages:chatHistory(db,trace.roomId)}:c));setNotice(clients[trace.actor].name+' 다시 접속 완료 · 미수신 '+trace.recoveryCount+'건을 최근 대화에서 받아왔습니다.')}
    if(trace.kind==='read'&&trace.applyRead){
      if(step>=2&&!committed.current){committed.current=true;setDb(database=>readChat(database,clients[trace.actor],trace.readUpTo))}
      if(step>=timelines.length-1&&!delivered.current){delivered.current=true;setReceipts(rs=>rs.map((r,i)=>clients[i].connected&&clients[i].roomId===trace.roomId?db.reads||[]:r));setNotice(clients[trace.actor].name+'가 #'+trace.readUpTo+'까지 읽었습니다. 같은 방의 온라인 참가자에게 읽음 확인을 전달했습니다.')}
    }
    const job=trace.job;if(!job)return
    if(trace.kind==='send'&&step>=4&&!committed.current){committed.current=true;setDb(job.database)}
    if(trace.kind==='send'&&step>=5&&!delivered.current){delivered.current=true;setClients(cs=>deliverChat(cs,job.message))}
    if(step>=timelines.length-1&&!acknowledged.current){acknowledged.current=true;setLastRequests(last=>last.map((m,i)=>i===trace.actor?job.message:m));setNotice(job.duplicate?'같은 requestId · INSERT와 방송 없이 기존 메시지 #'+job.message.id+'로 ACK했습니다.':'메시지 #'+job.message.id+' 서버 저장·ACK 완료 · 오프라인 참가자는 다시 접속할 때 받아옵니다.')}
  },[step,trace,timelines.length])
  const start=(kind:Flow,actor:number,body:string,job:Saved|null=null,connect=false,roomId=clients[actor].roomId,recoveryCount=waitingChat(db,{...clients[actor],roomId}).length,readUpTo=0,applyRead=false)=>{pendingConnection.current=connect;committed.current=false;delivered.current=false;acknowledged.current=false;setTrace(t=>({kind,actor,body,roomId,job,recoveryCount,readUpTo,applyRead,run:t.run+1}));setStep(0);setPlaying(true);setRunning(true)}
  const send=(index:number,repeat=false)=>{try{const previous=lastRequests[index];const body=repeat?previous?.body||'':drafts[index];const requestId=repeat?previous?.requestId||'':crypto.randomUUID();const result=storeChat(db,clients[index],body,requestId);start(result.duplicate?'duplicate':'send',index,result.message.body,result);if(!repeat)setDrafts(d=>d.map((v,i)=>i===index?'':v));setNotice('JSON 프레임 전송 · '+requestId.slice(0,12))}catch(error){setNotice(error instanceof Error?error.message:'전송할 수 없습니다.')}}
  const connection=(index:number)=>{const connected=!clients[index].connected;if(!connected)setClients(cs=>cs.map((c,i)=>i===index?{...c,connected:false}:c));start(connected?'join':'disconnect',index,connected?'다시 접속 → 서버 대화 조회 → PC로 대화 복구':'오프라인 전환 · 메시지는 서버에 계속 보관됩니다',null,connected);setNotice(clients[index].name+(connected?' 다시 접속 중 · 서버에 보관된 대화를 받아옵니다…':' 오프라인 · 메시지는 서버에 보관되며 다시 접속하면 받아옵니다.'))}
  const roomChange=(index:number,roomId:string)=>{const connected=clients[index].connected;setClients(cs=>cs.map((c,i)=>i===index?{...c,roomId,connected:false,messages:[]}:c));if(connected){start('join',index,'방 변경 · 서버에서 대화 불러오기',null,true,roomId)}setNotice(connected?'소켓을 다시 연결하고 새 방에 입장합니다.':'방을 선택했습니다. 다시 접속하면 이 방의 대화를 받아옵니다.')}
  useEffect(()=>{
    const changed=()=>setReadTick(t=>t+1),observer=new IntersectionObserver(changed,{threshold:[0,.1,1]})
    messageLists.current.forEach(list=>{if(list)observer.observe(list)})
    document.addEventListener('visibilitychange',changed)
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',changed)}
  },[])
  useEffect(()=>{
    if(running||document.hidden)return
    const index=clients.findIndex((client,i)=>{
      if(!nextReadChat(db,client))return false
      const list=messageLists.current[i];if(!list||list.scrollHeight-list.scrollTop-list.clientHeight>24)return false
      const end=list.lastElementChild?.getBoundingClientRect();if(!end)return false
      let top=0,bottom=innerHeight
      for(let el:HTMLElement|null=list;el;el=el.parentElement){if(el===list||/(auto|scroll|hidden)/.test(getComputedStyle(el).overflowY)){const box=el.getBoundingClientRect();top=Math.max(top,box.top);bottom=Math.min(bottom,box.bottom)}}
      return end.bottom>top&&end.bottom<=bottom+2
    })
    if(index>=0){start('read',index,'대화 화면에서 메시지 확인 → READ → 읽음 확인 전달',null,false,clients[index].roomId,0,nextReadChat(db,clients[index]),true);setNotice(clients[index].name+'가 대화를 확인했습니다. 읽음 신호를 서버로 보내는 중입니다.')}
  },[clients,db,running,readTick])
  const waiting=clients.map(client=>waitingChat(db,client).length)
  const sourceLink=`${model.repo}/blob/${model.revision}/${current.file}#L${current.line}`
  return <main className="chat-project"><div className="project-topline"><a href="#projects">← 프로젝트 목록</a><span>PROJECT 02 / REALTIME MESSAGE FLOW</span><a href={model.repo} target="_blank" rel="noopener noreferrer">GitHub 소스 ↗</a></div>
    <section className="chat-intro"><div><span className="eyebrow">SPRING BOOT · WEBSOCKET · JPA</span><h1>메시지는 어떻게<br/><em>상대에게 도착할까요?</em></h1><p>연결은 유지하고, 메시지는 저장하고, 같은 방에만 전달합니다.<br/>두 참가자로 대화하며 그 사이의 흐름을 따라가 보세요.</p></div><div className="chat-intro-note"><span>Chat Lab.</span><p>보내기 → 저장 → 방송 → ACK</p><small>브라우저 시뮬레이션 · 실제 WebSocket 서버는 GitHub 저장소에서 실행</small><a href={model.repo+'#실행'} target="_blank" rel="noopener noreferrer">실제 서버 실행 방법 ↗</a></div></section>
    <div className="chat-workspace"><section className="chat-playground" aria-label="두 참가자 채팅 체험"><div className="chat-section-head"><div><span className="eyebrow">TWO CLIENTS / ONE ROOM</span><h2>직접 대화해 보세요.</h2></div><span className="chat-demo-label">브라우저 체험</span></div><p className="chat-boundary">아래 체험은 이 브라우저에서 처리합니다. 독립 서버 앱은 실제 WebSocket으로 서로 다른 브라우저를 연결합니다.</p>
      <div className="chat-clients">{clients.map((client,index)=><section key={client.id} className={'chat-client client-'+index} aria-label={client.name+' 채팅'}><header><div><span className="chat-avatar">{index?'B':'A'}</span><div><h3>{client.name}</h3><small className={client.connected?'online':'offline'}>{client.connected?'● 온라인':'○ 오프라인'}</small></div></div><button className="chat-text-action" disabled={running} onClick={()=>connection(index)}>{client.connected?'오프라인으로 전환':'다시 접속'}</button></header><label className="chat-room-select">ROOM<select aria-label={client.name+' 채팅방'} value={client.roomId} disabled={running} onChange={e=>roomChange(index,e.target.value)}>{model.rooms.map(room=><option key={room.id} value={room.id}>{room.name}</option>)}</select></label>{!client.connected?<div className="chat-offline-state" role="status"><span>오프라인 · 메시지는 서버에 보관됩니다</span><strong>최근 대화 중 미수신 {waiting[index]}건</strong><small>다시 접속하면 최근 100개 대화를 받아옵니다.</small></div>:trace.kind==='join'&&trace.actor===index&&step===timelines.length-1&&<div className="chat-recovered" role="status">서버 → PC · 미수신 {trace.recoveryCount}건 복구 완료</div>}<div ref={list=>{messageLists.current[index]=list}} onScroll={()=>setReadTick(t=>t+1)} className="chat-messages" role="log" aria-label={client.name+' 메시지'} aria-live="polite">{client.messages.length===0?<div className="chat-empty">{client.connected?'첫 메시지를 기다리고 있어요.':'오프라인 상태입니다.'}<small>같은 방에 있는 참가자끼리만 대화합니다.</small></div>:client.messages.map(message=><article key={message.id} className={'chat-bubble '+(message.clientId===client.id?'mine':'')}><small>{message.sender} · #{message.id} · {format(message)}</small><p>{message.body}</p>{message.clientId===client.id&&<span className="chat-read-state" data-read-state={hasReadChat(receipts[index],message,clients[1-index].id)?'read':'unread'}>{hasReadChat(receipts[index],message,clients[1-index].id)?'읽음':'안 읽음'}</span>}</article>)}{trace.job&&trace.actor===index&&running&&step<timelines.length-1&&<p className="chat-pending">{trace.kind==='duplicate'?'중복 요청 확인 중…':'서버 확인을 기다리는 중…'}</p>}</div><form className="chat-compose" onSubmit={e=>{e.preventDefault();send(index)}}><textarea aria-label={client.name+' 메시지 입력'} placeholder={client.connected?'메시지를 입력하세요':'다시 접속하면 대화를 받아옵니다'} maxLength={model.bodyMax} rows={2} required disabled={!client.connected||running} value={drafts[index]} onChange={e=>setDrafts(d=>d.map((v,i)=>i===index?e.target.value:v))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/><button aria-label={client.name+' 보내기'} disabled={!client.connected||running||!drafts[index].trim()}>보내기 ↑</button></form><div className="chat-client-foot"><span>{client.messages.length} messages</span><button className="chat-text-action" disabled={running||!client.connected||!lastRequests[index]} onClick={()=>send(index,true)}>같은 요청 다시 보내기</button></div></section>)}</div><p className="chat-read-hint">온라인 참가자가 대화창의 맨 아래를 보고 있을 때 읽음 신호를 보냅니다. 서버 저장 ACK와 읽음은 별개입니다.</p><p role="status" className="chat-notice">{notice}</p></section>
      <section className={"chat-flow-pane "+(sourceOpen?"source-open":"")} aria-label="메시지 흐름 시각화"><div className="chat-section-head"><div><span className="eyebrow">LIVE MESSAGE FLOW</span><h2>연결 사이에서 일어나는 일</h2></div><div className="chat-flow-tools"><button disabled={!running} onClick={()=>setPlaying(!playing)} aria-label={playing?'채팅 흐름 일시 정지':'채팅 흐름 재개'}>{playing?'Ⅱ':'▷'}</button><button onClick={()=>start(trace.kind,trace.actor,trace.body,null,false,trace.roomId,trace.recoveryCount,trace.readUpTo)} disabled={running||trace.run===0}>다시 보기 ↻</button></div></div><div className="chat-flow-status"><span>{flowName[trace.kind]}</span><strong>{String(step+1).padStart(2,'0')} / {timelines.length} · {trace.run===0?'다시 접속 버튼으로 시작하세요':current.label}</strong></div>
        <ChatScene clients={clients} actor={trace.actor} kind={trace.kind} step={step} node={current.node} body={trace.body} run={trace.run} playing={playing} running={running} total={timelines.length} waiting={waiting} stored={db.messages.length} recoveryCount={trace.recoveryCount} readUpTo={trace.readUpTo}/><div className="chat-scene-legend"><span>A 왼쪽 · B 오른쪽 고정</span><span>링 = 채팅방 · 선 = 소켓 연결</span></div><div className="chat-payload"><span>{step===timelines.length-1&&(trace.kind==='send'||trace.kind==='duplicate')?'SERVER ACK':trace.kind==='read'?'READ RECEIPT':trace.kind==='join'?'CONNECT / OPEN / JOIN':'JSON FRAME'}</span><p>{trace.body}</p>{trace.job&&<small>requestId: {trace.job.message.requestId.slice(0,18)}… · room: {trace.roomId}</small>}</div>
        <ol className="chat-steps">{timelines.map((item,index)=><li key={index} className={step===index?'active':index<step?'done':''}><button onClick={()=>{if(running)return;setStep(index);setPlaying(false)}} disabled={running} aria-current={step===index?'step':undefined}><span>{index<step?'✓':String(index+1).padStart(2,'0')}</span>{item.label}</button></li>)}</ol>
        <div className="chat-db-count"><span>chat_messages</span><strong>{db.messages.length} rows</strong><small>UNIQUE (client_id, request_id)</small></div>
        <button className="chat-source-toggle" aria-expanded={sourceOpen} onClick={()=>setSourceOpen(!sourceOpen)}>소스 흐름 {sourceOpen?'닫기 −':'열기 +'}<span>{model.revision.slice(0,7)}</span></button>{sourceOpen&&<div className="chat-source-panel"><p>현재 단계의 실제 소스 · 처리 순서 해석이며 서버 로그 수집은 아닙니다.</p><h3>{current.label}</h3><div className="chat-code">{current.lines.map((line,index)=>{const at=line.indexOf(current.highlight);return <div key={index} className={at>=0?'executing':''}><span>{current.line+index}</span><code>{at>=0?<>{line.slice(0,at)}<mark>{current.highlight}</mark>{line.slice(at+current.highlight.length)}</>:line}</code></div>})}</div><a href={sourceLink} target="_blank" rel="noopener noreferrer">{current.file.split('/').at(-1)}:{current.line} · 원본 소스 ↗</a></div>}
      </section></div><div className="chat-design-notes"><article><span>01 / CONNECTION</span><h3>연결은 한 번, 대화는 계속.</h3><p>HTTP 업그레이드 후 연결을 유지합니다. 메시지마다 새 요청을 만드는 대신 같은 소켓으로 프레임을 주고받습니다.</p></article><article><span>02 / COMMIT FIRST</span><h3>저장한 메시지만 전달합니다.</h3><p>서버가 메시지 ID를 발급하고 트랜잭션이 끝나면 같은 방으로 방송합니다. 화면에 보이는 ID는 저장된 한 메시지를 가리킵니다.</p></article><article><span>03 / REQUEST ID</span><h3>다시 보내도 한 번만 남깁니다.</h3><p>재접속 후 같은 requestId로 재시도하면 INSERT와 방송을 생략합니다. 발신자는 기존 메시지의 ACK로 결과를 확인합니다.</p></article></div>
  </main>
}
