import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type {View} from '../../data'
import model from '../../generated/board-model.json'

const requests:Record<string,{method:string;path:string;sql:string;icon:'document'|'heart'}>={
  create:{method:'POST',path:'/api/posts',sql:'게시글 INSERT · posts',icon:'document'},
  update:{method:'PUT',path:'/api/posts/{id}',sql:'게시글 UPDATE · posts',icon:'document'},
  delete:{method:'DELETE',path:'/api/posts/{id}',sql:'댓글·좋아요 삭제 → 게시글 DELETE',icon:'document'},
  comment:{method:'POST',path:'/api/posts/{id}/comments',sql:'댓글 INSERT · comments',icon:'document'},
  commentUpdate:{method:'PUT',path:'/api/posts/{id}/comments/{commentId}',sql:'댓글 UPDATE · comments',icon:'document'},
  commentDelete:{method:'DELETE',path:'/api/posts/{id}/comments/{commentId}',sql:'댓글 DELETE · comments',icon:'document'},
  like:{method:'PUT',path:'/api/posts/{id}/likes/me',sql:'중복 확인 → 좋아요 INSERT · post_likes',icon:'heart'},
  unlike:{method:'DELETE',path:'/api/posts/{id}/likes/me',sql:'좋아요 DELETE · post_likes',icon:'heart'},
}
// Endpoint declarations must match the inspected controller snapshot.
Object.values(requests).forEach(r=>{if(!model.endpoints.some(e=>e.method===r.method&&e.path===r.path))throw new Error('소스에 없는 API 경로')})
type Props={view:View;playing:boolean;operation:string;runKey:number;station:number;onStation:(index:number)=>void}
export default function RequestScene(props:Props){
  const root=useRef<HTMLDivElement>(null),latest=useRef(props)
  const [phase,setPhase]=useState('idle'),[error,setError]=useState(false)
  useEffect(()=>{latest.current=props},[props])
  useEffect(()=>{
    const host=root.current!;let renderer:THREE.WebGLRenderer
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})}catch{setError(true);return}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;host.append(renderer.domElement)
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,80),controls=new OrbitControls(camera,renderer.domElement)
    controls.enableDamping=true;controls.enablePan=false;controls.enableZoom=false;controls.maxPolarAngle=Math.PI*.47;controls.target.set(0,.7,0)
    scene.add(new THREE.HemisphereLight(0xd2e8ff,0x192135,3));const sun=new THREE.DirectionalLight(0xffe5cb,5);sun.position.set(-4,8,7);scene.add(sun)
    const rim=new THREE.DirectionalLight(0x89bfff,4);rim.position.set(6,5,-4);scene.add(rim)
    const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[],textures:THREE.Texture[]=[]
    const mat=(color:number,metalness=.25)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness:.36});materials.push(m);return m}
    const dark=mat(0x182335),metal=mat(0x566b85,.65),white=mat(0xe9f0f8),blue=mat(0x76c2ff),orange=mat(0xff994e),red=mat(0xff6287),green=mat(0x84e7b0)
    const box=(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{const g=new RoundedBoxGeometry(w,h,d,3,.04);geometries.push(g);const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);return mesh}
    const bases=[-3.7,0,3.7],nodes=bases.map(x=>{const n=new THREE.Group();n.position.x=x;scene.add(n);return n})
    nodes.forEach((n,i)=>{box(n,2.65,.13,2.15,0,-.05,0,dark);box(n,2.5,.035,2,0,.035,0,i===0?blue:i===1?orange:green)})
    // User PC + mobile app.
    const pc=nodes[0];box(pc,1.95,1.4,.16,-.2,1.25,0,metal);box(pc,.15,.65,.14,-.2,.4,0,metal);box(pc,.85,.09,.6,-.2,.15,.08,metal)
    box(pc,1.7,1.14,.025,-.2,1.25,.094,dark);box(pc,1.5,.14,.035,-.2,1.6,.113,blue)
    for(let i=0;i<3;i++)box(pc,1.4,.07,.035,-.2,1.34-i*.18,.113,i===2?orange:metal)
    box(pc,1.7,.065,.6,-.2,.16,.7,dark)
    const phone=new THREE.Group();phone.position.set(1,0,.4);phone.rotation.z=-.12;pc.add(phone);box(phone,.55,1.15,.15,0,.8,0,metal);box(phone,.44,.92,.025,0,.8,.09,dark);box(phone,.32,.12,.035,0,1.02,.11,blue);box(phone,.28,.2,.035,0,.7,.11,orange)
    // API is a logical request boundary, not another deployed server.
    const api=nodes[1];box(api,1.35,1.65,.42,0,.95,0,dark);box(api,1.15,1.35,.035,0,.95,.24,metal)
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=360;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#182335';ctx.fillRect(0,0,320,360);ctx.fillStyle='#ffb277';ctx.font='bold 75px sans-serif';ctx.textAlign='center';ctx.fillText('API',160,180);ctx.font='26px monospace';ctx.fillStyle='#a5bbd5';ctx.fillText('HTTP REQUEST',160,240)
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);const screen=new THREE.MeshBasicMaterial({map:texture});materials.push(screen);box(api,1.02,1.15,.012,0,.95,.268,screen)
    // Spring Boot server rack.
    const server=nodes[2];box(server,1.55,2.2,.9,0,1.17,0,metal);box(server,1.3,1.95,.08,0,1.17,.49,dark)
    for(let i=0;i<4;i++){box(server,1.1,.32,.06,0,1.85-i*.46,.55,metal);box(server,.12,.1,.04,.36,1.85-i*.46,.6,green);box(server,.48,.045,.04,-.16,1.85-i*.46,.6,dark)}
    const serverGlow=new THREE.MeshStandardMaterial({color:0x85eab8,emissive:0x85eab8,emissiveIntensity:.2});materials.push(serverGlow);box(server,1.4,.08,.96,0,2.3,0,serverGlow)
    // Each route shows a document or heart travelling through the same HTTP path.
    const documentToken=new THREE.Group();box(documentToken,.52,.7,.06,0,0,0,white);for(let i=0;i<3;i++)box(documentToken,.34,.035,.02,0,.16-i*.14,.045,blue)
    const shape=new THREE.Shape();shape.moveTo(0,-.35);shape.bezierCurveTo(-.1,-.2,-.5,.05,-.5,.3);shape.bezierCurveTo(-.5,.65,-.05,.7,0,.4);shape.bezierCurveTo(.05,.7,.5,.65,.5,.3);shape.bezierCurveTo(.5,.05,.1,-.2,0,-.35)
    const heartGeo=new THREE.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.04,bevelThickness:.04});geometries.push(heartGeo);const heart=new THREE.Mesh(heartGeo,red);heart.scale.setScalar(.67)
    const packet=new THREE.Group();packet.add(documentToken,heart);scene.add(packet)
    const ackGeo=new THREE.SphereGeometry(.11,12,12);geometries.push(ackGeo);const ack=new THREE.Mesh(ackGeo,green);scene.add(ack)
    const route=new THREE.CatmullRomCurve3([new THREE.Vector3(-3.7,1.5,.65),new THREE.Vector3(0,1.8,.65),new THREE.Vector3(3.7,1.5,.65)])
    const wireGeo=new THREE.TubeGeometry(route,60,.022,8,false);geometries.push(wireGeo);scene.add(new THREE.Mesh(wireGeo,blue))
    for(const x of [-1.9,1.9]){const g=new THREE.ConeGeometry(.09,.28,10);geometries.push(g);const arrow=new THREE.Mesh(g,blue);arrow.rotation.z=-Math.PI/2;arrow.position.set(x,1.72,.65);scene.add(arrow)}
    const grid=new THREE.GridHelper(16,24,0x334862,0x1b293b);grid.position.y=-.13;scene.add(grid)
    let width=1,height=1;const resize=()=>{width=host.clientWidth;height=host.clientHeight;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(host);resize()
    const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;controls.enableRotate=!matchMedia('(pointer:coarse)').matches
    let frame=0,last=performance.now(),elapsed=0,seenKey=0,seenPhase='idle',time=0,lastView='',lastStation=-1,transition=1
    const target=new THREE.Vector3(),position=new THREE.Vector3()
    function draw(now:number){frame=requestAnimationFrame(draw);const dt=Math.max(0,Math.min((now-last)/1000,.05));last=now;const p=latest.current
      if(seenKey!==p.runKey){seenKey=p.runKey;elapsed=0}
      if(p.playing){elapsed+=dt;time+=dt}const hasRun=p.runKey>0,t=reduced?4.5:elapsed
      const current=!hasRun?'idle':t<1.2?'request':t<2.4?'transfer':t<3.2?'insert':t<4.2?'response':'complete'
      if(seenPhase!==current){seenPhase=current;setPhase(current)}
      documentToken.visible=requests[p.operation]?.icon!=='heart';heart.visible=!documentToken.visible
      packet.visible=hasRun&&!reduced&&t<2.4;packet.position.copy(route.getPoint(Math.min(t/2.4,1)));packet.rotation.y=Math.sin(time*3)*.15
      serverGlow.emissiveIntensity=current==='insert'?1.7:.2
      ack.visible=current==='response'&&!reduced;ack.position.copy(route.getPoint(Math.max(0,1-(t-3.2))))
      const distance=Math.max(5.5,11.5/(2*Math.tan(THREE.MathUtils.degToRad(18))*(width/height)))/9
      target.set(0,.85,0)
      if(p.view==='station'){target.set(bases[p.station],1,0);position.copy(target).add(new THREE.Vector3(0,2,5.5))}
      else if(p.view==='top')position.set(.01,9*distance,.01)
      else if(p.view==='side')position.set(0,2.3,9*distance)
      else if(p.view==='flight'){const a=reduced?.3:Math.sin(time*.13)*.3;position.set(Math.sin(a)*9,3.7,Math.cos(a)*9).multiplyScalar(distance)}
      else position.set(0,3.7,8.8).multiplyScalar(distance)
      if(lastView!==p.view||lastStation!==p.station){transition=1;lastView=p.view;lastStation=p.station}
      controls.enabled=p.view!=='flight';if(transition>0||p.view==='flight'){camera.position.lerp(position,reduced?1:.12);controls.target.lerp(target,reduced?1:.12);transition=Math.max(0,transition-dt)}controls.update();renderer.render(scene,camera)
    }
    camera.position.set(0,5.2,16);frame=requestAnimationFrame(draw)
    return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();renderer.domElement.remove();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());grid.geometry.dispose();(grid.material as THREE.Material).dispose();renderer.dispose()}
  },[])
  const request=requests[props.operation]||requests.create
  const stage=phase==='request'?0:phase==='transfer'?1:phase==='insert'||phase==='response'||phase==='complete'?2:-1
  return <div className="request-scene"><div ref={root} className="request-canvas" aria-label="PC·앱에서 API를 거쳐 Spring Boot 서버로 전달되는 요청 흐름"/>
    <div className="request-stages">{['사용자 · PC / 앱','API 요청','Spring Boot 서버'].map((name,i)=><button key={name} className={stage===i?'active':''} onClick={()=>props.onStation(i)}>{name}</button>)}</div>
    <div className="request-caption" aria-live="polite"><span>{request.method} {request.path}</span><strong>{phase==='idle'?'게시판을 조작하거나 흐름 다시 보기를 눌러보세요.':phase==='request'?'사용자 요청 · '+(request.icon==='heart'?'좋아요 전달':'문서 전달'):phase==='transfer'?'API 요청이 서버로 전달됩니다.':phase==='insert'?request.sql:phase==='response'?'처리 결과 응답 · 서버 → 사용자':'처리 완료 · '+request.sql}</strong></div>
    {error&&<p className="request-fallback">사용자 PC / 앱 → {request.method} {request.path} → 서버: {request.sql}</p>}
  </div>
}
