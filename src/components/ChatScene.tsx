import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import type {ChatClient} from '../chat-demo'

type Props={pendingCounts:number[];databaseRunning:boolean;pendingCount:number;brokerRunning:boolean;outboxCount:number;roomId:string;mode:'direct'|'kafka';workerRunning:boolean;queueCount:number;clients:ChatClient[];actor:number;kind:string;step:number;node:string;body:string;run:number;playing:boolean;running:boolean;total:number;waiting:number[];stored:number;recoveryCount:number;readUpTo:number;typingActive:boolean}
export default function ChatScene(props:Props){
  const host=useRef<HTMLDivElement>(null),latest=useRef(props),[failed,setFailed]=useState(false)
  latest.current=props
  useEffect(()=>{
    const target=host.current;if(!target)return
    let renderer:THREE.WebGLRenderer
    try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true})}catch{setFailed(true);return}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));target.prepend(renderer.domElement)
    renderer.domElement.setAttribute('aria-hidden','true')
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.1,50)
    camera.position.set(0,5.5,9);camera.lookAt(0,0,0)
    scene.add(new THREE.HemisphereLight(0xdcefff,0x152235,2.5))
    const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(-3,7,5);scene.add(light)
    const materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[]
    function material(color:number){const m=new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.15});materials.push(m);return m}
    const shell=material(0x38516a),screen=material(0x122635),accent=material(0xffb47a),blue=material(0x8fcaff),green=material(0x8ed8b4),muted=material(0x45586a)
    function mesh(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=scene){geometries.push(g);const obj=new THREE.Mesh(g,m);parent.add(obj);return obj}
    function box(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material){const obj=mesh(new RoundedBoxGeometry(w,h,d,2,.06),m,parent);obj.position.set(x,y,z);return obj}
    const positions=[new THREE.Vector3(-3,0,0),new THREE.Vector3(3,0,0)],server=new THREE.Vector3(0,.2,0),db=new THREE.Vector3(0,-.5,1.8)
    const pcs=positions.map((v,i)=>{const group=new THREE.Group();group.position.copy(v);scene.add(group);box(group,1.45,.95,.14,0,.35,0,shell);group.userData.display=box(group,1.25,.72,.04,0,.35,.1,screen);box(group,.13,.38,.14,0,-.27,0,shell);box(group,.7,.07,.4,0,-.48,.05,shell);box(group,.45,.06,.03,0,.35,.14,i?accent:blue);box(group,.35,.7,.1,.95,-.05,.15,shell);box(group,.27,.52,.03,.95,-.05,.22,screen);return group})
    const rack=new THREE.Group();rack.position.copy(server);scene.add(rack);box(rack,.95,1.5,.7,0,.2,0,shell)
    for(let i=0;i<3;i++){box(rack,.8,.3,.07,0,.65-i*.45,.4,screen);box(rack,.1,.06,.03,.25,.65-i*.45,.45,green)}
    const databaseDisks:THREE.Mesh[]=[]
    for(let i=0;i<3;i++){const disk=mesh(new THREE.CylinderGeometry(.5,.5,.2,40),i===2?green:shell);disk.position.copy(db).add(new THREE.Vector3(0,i*.22,0));databaseDisks.push(disk)}
    const broker=new THREE.Vector3(-1.25,.3,-1.85),worker=new THREE.Vector3(1.25,.3,-1.85)
    const kafkaGroup=new THREE.Group();scene.add(kafkaGroup)
    const brokerDisks:THREE.Mesh[]=[]
    for(let i=0;i<3;i++){const disk=mesh(new THREE.CylinderGeometry(.38,.38,.18,32),accent,kafkaGroup);disk.position.copy(broker).add(new THREE.Vector3(0,i*.21,0));brokerDisks.push(disk)}
    const outboxCards=Array.from({length:6},(_,i)=>box(kafkaGroup,.45,.25,.04,.65+i*.04,-.1+i*.07,1.9,blue))
    const deliveryRack=new THREE.Group();deliveryRack.position.copy(worker);kafkaGroup.add(deliveryRack)
    box(deliveryRack,.65,.95,.45,0,.22,0,shell);box(deliveryRack,.5,.18,.06,0,.42,.26,screen)
    const workerLed=box(deliveryRack,.12,.07,.04,.12,.1,.28,green)
    const kafkaCards=Array.from({length:6},(_,i)=>box(kafkaGroup,.4,.22,.04,broker.x-.55+i*.04,.3+i*.07,broker.z+.2,accent))
    function route(a:THREE.Vector3,b:THREE.Vector3){const curve=new THREE.LineCurve3(a,b);mesh(new THREE.TubeGeometry(curve,16,.014,6,false),muted,kafkaGroup)}
    route(db,broker);route(broker,worker);positions.forEach(v=>route(worker,v))
    const storedCards=Array.from({length:6},(_,i)=>box(scene,.62,.28,.04,-.78+i*.055,-.05+i*.09,1.85,accent))
    const clientCards=positions.map(v=>Array.from({length:6},(_,i)=>box(scene,.44,.25,.04,v.x-.55+i*.025,-.22+i*.06,.7,blue)))
    const rings=positions.map(v=>{const ring=mesh(new THREE.TorusGeometry(1.15,.018,8,70),green);ring.rotation.x=Math.PI/2;ring.position.copy(v).add(new THREE.Vector3(.15,-.5,0));return ring})
    const lines=positions.map(v=>{const curve=new THREE.QuadraticBezierCurve3(v.clone().add(new THREE.Vector3(0,.25,0)),new THREE.Vector3(v.x/2,.3,-.8),server);return mesh(new THREE.TubeGeometry(curve,40,.018,6,false),green)})
    const dbCurve=new THREE.LineCurve3(server,db);mesh(new THREE.TubeGeometry(dbCurve,12,.014,6,false),muted)
    const packetCanvas=document.createElement('canvas');packetCanvas.width=512;packetCanvas.height=160
    const ctx=packetCanvas.getContext('2d')!,texture=new THREE.CanvasTexture(packetCanvas);texture.colorSpace=THREE.SRGBColorSpace
    const ink=new THREE.MeshBasicMaterial({map:texture,transparent:true});materials.push(ink)
    const packets=[0,1].map(()=>{const g=new THREE.Group();scene.add(g);box(g,1.35,.46,.09,0,0,0,accent);box(g,.15,.15,.05,-.36,-.2,0,accent);const face=mesh(new THREE.PlaneGeometry(1.23,.37),ink,g);face.position.z=.06;return g})
    const resize=()=>{const w=target.clientWidth,h=target.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}
    const observer=new ResizeObserver(resize);observer.observe(target);resize()
    let frame=0,last=performance.now(),elapsed=0,key='',text='',visible=true
    const intersection=new IntersectionObserver(e=>{visible=e[0].isIntersecting});intersection.observe(target)
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
    function animate(now:number){frame=requestAnimationFrame(animate);const dt=Math.min(now-last,50);last=now;if(!visible||document.hidden)return
      const p=latest.current,newKey=p.run+':'+p.step;if(key!==newKey){key=newKey;elapsed=0}if(p.playing)elapsed+=dt
      const progress=reduced?.7:Math.min(elapsed/(p.kind==='typing'?350:1000),1),same=p.clients[0].roomId===p.clients[1].roomId
      pcs.forEach((pc,i)=>{pc.scale.setScalar(p.clients[i].connected?1:.92);pc.userData.display.material=p.clients[i].viewOpen?screen:muted;rings[i].visible=p.clients[i].connected;rings[i].material=same?green:muted;lines[i].material=(p.clients[i].connected||(p.run>0&&p.kind==='join'&&i===p.actor&&p.step>=1))?green:muted})
      const pending=Math.max(...p.waiting.filter((_,i)=>!p.clients[i].connected),0);storedCards.forEach((card,i)=>{card.visible=i<Math.min(pending,6)})
      clientCards.forEach((cards,actor)=>cards.forEach((card,i)=>{card.visible=i<Math.min(p.pendingCounts[actor],6)}))
      databaseDisks.forEach((disk,i)=>{disk.material=p.databaseRunning?(i===2?green:shell):muted})
      kafkaGroup.visible=p.mode==='kafka';brokerDisks.forEach(disk=>{disk.material=p.brokerRunning?accent:muted});outboxCards.forEach((card,i)=>{card.visible=i<Math.min(p.outboxCount,6)});workerLed.material=p.workerRunning&&p.brokerRunning&&p.databaseRunning?green:muted;kafkaCards.forEach((card,i)=>{card.visible=i<Math.min(p.queueCount,6)})
      const routes:[THREE.Vector3,THREE.Vector3][]=[];let label=''
      const actor=positions[p.actor].clone().add(new THREE.Vector3(0,.35,.2)),hub=server.clone().add(new THREE.Vector3(0,.45,.6))
      if(p.run>0){
        if(p.kind==='databaseUnavailable'){if(p.step===0){routes.push([actor,hub]);label='저장 요청'}else if(p.step===1){routes.push([hub,hub.clone().lerp(db,.65)]);label='DB 접근 실패 ×'}else if(p.step===2){routes.push([hub,actor]);label='저장 실패 · ACK 없음'}else{routes.push([actor,actor]);label='PC 전송 대기'}}
        else if(p.kind==='kafkaPublish'){routes.push(p.step===0?[db,broker]:[broker,broker]);label=p.step===0?'이벤트 재발행':'Kafka 기록'}
        else if(['kafkaSend','kafkaInterrupted','kafkaUnavailable','kafkaUnavailableInterrupted','databaseRetryKafka','databaseRetryOutbox'].includes(p.kind)){
          if(p.step===0){routes.push([actor,hub]);label=p.kind.startsWith('databaseRetry')?'같은 ID 재전송':'mode: kafka'}
          else if(p.step===2){routes.push([hub,db]);label='중복 조회'}
          else if(p.step===3){routes.push([hub,db]);label='DB + Outbox'}
          else if(p.step===4){routes.push([hub,p.kind.endsWith('Interrupted')?hub.clone().lerp(actor,.48):actor]);label=p.kind.endsWith('Interrupted')?'ACK × 연결 끊김':'저장 ACK ✓'}
          else if(p.step===5){routes.push([db,p.brokerRunning?broker:db.clone().lerp(broker,.4)]);label=p.brokerRunning?'이벤트 발행':'발행 보류 ×'}
          else if(p.step===6){routes.push(p.brokerRunning?[broker,broker]:[db,db]);label=!p.brokerRunning?'Outbox '+p.outboxCount+'건':p.workerRunning?'Consumer 대기':'대기 '+p.queueCount+'건'}
          else{routes.push([hub,hub]);label='VALIDATE'}
        }
        else if(p.kind==='kafkaDeliver'){
          if(p.step===0){routes.push([broker,worker]);label='POLL 이벤트'}
          else if(p.step===1){routes.push([worker,worker]);label='처리 ID 확인'}
          else if(p.step===2){routes.push([worker,db]);label='처리 기록 · COMMIT'}
          else if(p.step===3){p.clients.forEach((c,i)=>{if(c.connected&&c.roomId===p.roomId)routes.push([worker,positions[i]])});label=p.body.slice(0,10)}
          else{routes.push([worker,broker]);label='OFFSET ✓'}
        }
        else if(p.kind==='typing'){if(p.step===0){routes.push([actor,hub])}else if(p.step<3){routes.push([hub,hub])}else{const other=p.clients[1-p.actor];if(other.connected&&same)routes.push([hub,positions[1-p.actor]])}label=p.typingActive?'TYPING …':'입력 표시 해제'}
        else if(p.kind==='read'){if(p.step===0){routes.push([actor,actor]);label='대화 읽기'}else if(p.step===1){routes.push([actor,hub]);label='READ #'+p.readUpTo}else if(p.step===2){routes.push([hub,db]);label='읽음 저장'}else{const other=p.clients[1-p.actor];routes.push([hub,other.connected&&same?positions[1-p.actor]:hub]);label=p.step===3?'읽음 확인':'읽음 ✓'}}
        else if(p.kind==='join'){if(p.step===0){routes.push([actor,hub]);label='CONNECT'}else if(p.step===1){routes.push([hub,actor]);label='OPEN'}else if(p.step===2){routes.push([actor,hub]);label='JOIN'}else if(p.node==='database-return'){routes.push([db,hub]);label=p.recoveryCount?'미수신 '+p.recoveryCount+'건':'최근 대화'}else if(p.node==='database'){routes.push([hub,db]);label='SELECT'}else if(p.step===p.total-1){p.clients.forEach((c,i)=>{if(c.connected&&c.roomId===p.roomId)routes.push([hub,positions[i]])});label='PRESENCE'}else if(p.node==='recipient'){routes.push([hub,actor]);label=p.recoveryCount?'미수신 '+p.recoveryCount+'건':'최근 대화'}}
        else if(p.kind==='disconnect'){if(p.step===0){routes.push([actor,hub]);label='CLOSE'}else if(p.step===1){routes.push([hub,hub]);label='닫힘 감지'}else{const other=p.clients[1-p.actor];if(other.connected&&same)routes.push([hub,positions[1-p.actor]]);label='PRESENCE'}}
        else if(p.kind==='interrupted'&&p.step===p.total-1){routes.push([hub,hub.clone().lerp(actor,.48)]);label='ACK × 연결 끊김'}
        else if(p.step===0){routes.push([actor,hub]);label=(p.kind==='retry'||p.kind==='databaseRetry')?'같은 ID 재전송':p.body.slice(0,10)}
        else if(p.step===p.total-1||(p.kind==='retry'&&p.step===p.total-2)){routes.push([hub,actor]);label=p.kind==='retry'?'기존 ID ACK ✓':'ACK ✓'}
        else if((p.kind==='send'||p.kind==='interrupted'||p.kind==='databaseRetry')&&p.step===5){p.clients.forEach((c,i)=>{if(c.connected&&c.roomId===p.roomId)routes.push([hub,positions[i]])});label=p.body.slice(0,10)}
        else if(p.node==='database'){routes.push([hub,db]);label=(p.kind==='send'||p.kind==='interrupted'||p.kind==='databaseRetry')&&p.step===4?'INSERT':'SELECT'}
        else{routes.push([hub,hub]);label=(p.kind==='duplicate'||p.kind==='retry')?'중복 확인':'VALIDATE'}
      }
      if(label!==text){text=label;ctx.clearRect(0,0,512,160);ctx.fillStyle='#14212f';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 47px sans-serif';ctx.fillText(label,256,80);texture.needsUpdate=true}
      packets.forEach((packet,i)=>{packet.visible=!!routes[i];if(routes[i]){const [a,b]=routes[i];packet.position.lerpVectors(a,b,progress);packet.position.y+=Math.sin(progress*Math.PI)*.6+.35;packet.quaternion.copy(camera.quaternion)}})
      renderer.render(scene,camera)
    }
    frame=requestAnimationFrame(animate)
    return()=>{cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();renderer.dispose();renderer.domElement.remove()}
  },[])
  return <div ref={host} className={"chat-three-scene "+(props.mode==='kafka'?'kafka-scene':'')} role="img" aria-label={`고정 위치: 왼쪽 참가자 A, 오른쪽 참가자 B. ${props.clients[props.actor].name}의 ${props.kind} 단계 ${props.step+1}`}>
    {failed&&<p className="chat-three-fallback">3D 화면을 불러올 수 없습니다. 아래 단계에서 같은 흐름을 확인하세요.</p>}
    <span className="scene-label scene-a"><b>참가자 A</b><small>{props.clients[0].connected?'● 온라인':'○ 오프라인'} · {props.clients[0].roomId}</small><small className="scene-view-state">{props.clients[0].viewOpen?'대화창 열림':'대화창 닫힘'}</small>{props.pendingCounts[0]>0&&<small className="scene-pending-count">PC 전송 대기 {props.pendingCounts[0]}건</small>}</span>
    <span className="scene-label scene-server"><b>{props.mode==='kafka'?'메시지 수신 서버':'WebSocket 서버'}</b><small>/ws/chat</small></span>
    {props.mode==='kafka'&&<><span className="scene-label scene-kafka"><b>Kafka {props.brokerRunning?'':'· 중단'}</b><small>{props.brokerRunning?'전달 대기 '+props.queueCount+'건':'발행·소비 불가'}</small></span><span className="scene-label scene-consumer"><b>전달 서버</b><small>{props.workerRunning?(props.brokerRunning?'● 실행 중':'Kafka 연결 대기'):'○ 중단됨'}</small></span></>}
    <span className="scene-label scene-b"><b>참가자 B</b><small>{props.clients[1].connected?'● 온라인':'○ 오프라인'} · {props.clients[1].roomId}</small><small className="scene-view-state">{props.clients[1].viewOpen?'대화창 열림':'대화창 닫힘'}</small>{props.pendingCounts[1]>0&&<small className="scene-pending-count">PC 전송 대기 {props.pendingCounts[1]}건</small>}</span>
    {!props.databaseRunning&&<span className="scene-database-outage">DB 저장 불가 · PC 전송 대기 {props.pendingCount}건</span>}{props.databaseRunning&&!props.brokerRunning&&props.mode==='kafka'&&<span className="scene-broker-outage">Kafka 연결 불가 · Outbox에 보관</span>}{props.kind==='interrupted'&&props.step===props.total-1&&<span className="scene-connection-lost">ACK 미수신 · PC에 요청 보관</span>}<span className="scene-label scene-db">{props.databaseRunning?'서버 대화 기록':'DB 중단 · 마지막 저장'} · {props.stored}건<small>{!props.databaseRunning?'저장/조회 불가 · ACK 없음':props.mode==='kafka'&&props.outboxCount>0?'Outbox 미발행 '+props.outboxCount+'건':props.kind==='retry'?'중복 요청 · 추가 저장 / 방송 없음':props.kind==='typing'?'입력 신호 · DB 저장 없음':props.kind==='read'&&props.step>=2?'읽음 위치 #'+props.readUpTo:props.clients.map((c,i)=>!c.connected&&props.waiting[i]>0?`${i?'B':'A'} 미수신 ${props.waiting[i]}건`:null).filter(Boolean).join(' · ')||'오프라인이어도 서버에 보관'}</small></span>
  </div>
}
