import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import type {ChatClient} from '../chat-demo'

type Props={clients:ChatClient[];actor:number;kind:string;step:number;node:string;body:string;run:number;playing:boolean;running:boolean;total:number}
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
    const pcs=positions.map((v,i)=>{const group=new THREE.Group();group.position.copy(v);scene.add(group);box(group,1.45,.95,.14,0,.35,0,shell);box(group,1.25,.72,.04,0,.35,.1,screen);box(group,.13,.38,.14,0,-.27,0,shell);box(group,.7,.07,.4,0,-.48,.05,shell);box(group,.45,.06,.03,0,.35,.14,i?accent:blue);box(group,.35,.7,.1,.95,-.05,.15,shell);box(group,.27,.52,.03,.95,-.05,.22,screen);return group})
    const rack=new THREE.Group();rack.position.copy(server);scene.add(rack);box(rack,.95,1.5,.7,0,.2,0,shell)
    for(let i=0;i<3;i++){box(rack,.8,.3,.07,0,.65-i*.45,.4,screen);box(rack,.1,.06,.03,.25,.65-i*.45,.45,green)}
    for(let i=0;i<3;i++){const disk=mesh(new THREE.CylinderGeometry(.5,.5,.2,40),i===2?green:shell);disk.position.copy(db).add(new THREE.Vector3(0,i*.22,0))}
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
      const progress=reduced?.7:Math.min(elapsed/1000,1),same=p.clients[0].roomId===p.clients[1].roomId
      pcs.forEach((pc,i)=>{pc.scale.setScalar(p.clients[i].connected?1:.92);rings[i].visible=p.clients[i].connected;rings[i].material=same?green:muted;lines[i].material=(p.clients[i].connected||(p.run>0&&p.kind==='join'&&i===p.actor&&p.step>=1))?green:muted})
      const routes:[THREE.Vector3,THREE.Vector3][]=[];let label=''
      const actor=positions[p.actor].clone().add(new THREE.Vector3(0,.35,.2)),hub=server.clone().add(new THREE.Vector3(0,.45,.6))
      if(p.run>0){
        if(p.kind==='join'){if(p.step===0){routes.push([actor,hub]);label='CONNECT'}else if(p.step===1){routes.push([hub,actor]);label='OPEN'}else if(p.step===2){routes.push([actor,hub]);label='JOIN'}else if(p.node==='database'){routes.push([hub,db]);label='SELECT'}else if(p.step===p.total-1){p.clients.forEach((c,i)=>{if(c.connected&&c.roomId===p.clients[p.actor].roomId)routes.push([hub,positions[i]])});label='PRESENCE'}else if(p.node==='recipient'){routes.push([hub,actor]);label='HISTORY'}}
        else if(p.kind==='disconnect'){if(p.step===0){routes.push([actor,hub]);label='CLOSE'}else if(p.step===1){routes.push([hub,hub]);label='닫힘 감지'}else{const other=p.clients[1-p.actor];if(other.connected&&same)routes.push([hub,positions[1-p.actor]]);label='PRESENCE'}}
        else if(p.step===0){routes.push([actor,hub]);label=p.body.slice(0,10)}
        else if(p.step===p.total-1){routes.push([hub,actor]);label='ACK ✓'}
        else if(p.kind==='send'&&p.step===5){p.clients.forEach((c,i)=>{if(c.connected&&c.roomId===p.clients[p.actor].roomId)routes.push([hub,positions[i]])});label=p.body.slice(0,10)}
        else if(p.node==='database'){routes.push([hub,db]);label=p.kind==='send'&&p.step===4?'INSERT':'SELECT'}
        else{routes.push([hub,hub]);label=p.kind==='duplicate'?'중복 확인':'VALIDATE'}
      }
      if(label!==text){text=label;ctx.clearRect(0,0,512,160);ctx.fillStyle='#14212f';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 47px sans-serif';ctx.fillText(label,256,80);texture.needsUpdate=true}
      packets.forEach((packet,i)=>{packet.visible=!!routes[i];if(routes[i]){const [a,b]=routes[i];packet.position.lerpVectors(a,b,progress);packet.position.y+=Math.sin(progress*Math.PI)*.6+.35;packet.quaternion.copy(camera.quaternion)}})
      renderer.render(scene,camera)
    }
    frame=requestAnimationFrame(animate)
    return()=>{cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();renderer.dispose();renderer.domElement.remove()}
  },[])
  return <div ref={host} className="chat-three-scene" role="img" aria-label={`고정 위치: 왼쪽 참가자 A, 오른쪽 참가자 B. ${props.clients[props.actor].name}의 ${props.kind} 단계 ${props.step+1}`}>
    {failed&&<p className="chat-three-fallback">3D 화면을 불러올 수 없습니다. 아래 단계에서 같은 흐름을 확인하세요.</p>}
    <span className="scene-label scene-a"><b>참가자 A</b><small>{props.clients[0].connected?'● 연결됨':'○ 연결 전 / 종료'} · {props.clients[0].roomId}</small></span>
    <span className="scene-label scene-server"><b>WebSocket 서버</b><small>/ws/chat</small></span>
    <span className="scene-label scene-b"><b>참가자 B</b><small>{props.clients[1].connected?'● 연결됨':'○ 연결 전 / 종료'} · {props.clients[1].roomId}</small></span>
    <span className="scene-label scene-db">메시지 저장소</span>
  </div>
}
