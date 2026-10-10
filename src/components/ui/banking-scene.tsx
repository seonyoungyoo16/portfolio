import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { stations, type Mode, type View, type StationId } from '../../data'

type Props = { mode: Mode; view: View; playing: boolean; selected: StationId | null; onSelect: (id: StationId) => void; onStep: (n: number) => void }
export default function BankingScene(props: Props) {
  const root = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  const [error, setError] = useState(false)
  useEffect(() => { latest.current = props }, [props])
  useEffect(() => {
    const host = root.current!
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({antialias:true, alpha:true}) } catch { setError(true); return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.25
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    host.append(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34,1,.1,100)
    camera.position.set(10,10,14)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.enablePan = false; controls.enableZoom = false
    controls.maxPolarAngle = Math.PI * .46; controls.minDistance = 8
    controls.target.set(0,.5,0)
    if (matchMedia('(pointer:coarse)').matches) controls.enableRotate = false
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment(), env = pmrem.fromScene(room,.04)
    scene.environment = env.texture; scene.environmentIntensity = .6; room.dispose(); pmrem.dispose()
    scene.add(new THREE.HemisphereLight(0xd5e7ff,0x493022,3))
    const key = new THREE.DirectionalLight(0xffecd4,5)
    key.position.set(-4,10,8); key.castShadow = true; key.shadow.mapSize.set(2048,2048)
    Object.assign(key.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.5,far:35}); key.shadow.normalBias = .04; scene.add(key)
    const rim = new THREE.DirectionalLight(0xb7d6ff,3); rim.position.set(8,6,-7); scene.add(rim)
    const material = (color:number,metalness=.6,roughness=.3,other:THREE.MeshStandardMaterialParameters={}) => new THREE.MeshStandardMaterial({color,metalness,roughness,...other})
    const M = {body:material(0x333b47),dark:material(0x121923),steel:material(0xa2acb8,.85,.22),ivory:material(0xe7e5dc,.3),orange:material(0xff853d,.45),light:material(0xff853d,.2,.3,{emissive:0xff6919,emissiveIntensity:1.8}),green:material(0x94edbb,.2,.3,{emissive:0x52d88a,emissiveIntensity:1.2})}
    const geometries: THREE.BufferGeometry[] = [], textures: THREE.Texture[] = [], materials: THREE.Material[] = Object.values(M)
    const mesh = (g:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material=M.body,r=.05) => {
      const geo = new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)); geometries.push(geo)
      const o = new THREE.Mesh(geo,m); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; g.add(o); return o
    }
    const cyl = (g:THREE.Object3D,r:number,h:number,x:number,y:number,z:number,m:THREE.Material=M.steel) => {
      const geo = new THREE.CylinderGeometry(r,r,h,32); geometries.push(geo);const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o
    }
    const screen = (g:THREE.Object3D,w:number,h:number,x:number,y:number,z:number,title:string,subtitle:string,color='#ff853d') => {
      const c=document.createElement('canvas');c.width=768;c.height=512;const ctx=c.getContext('2d')!
      ctx.fillStyle='#101820';ctx.fillRect(0,0,768,512);ctx.fillStyle=color;ctx.fillRect(36,36,9,36)
      ctx.font='bold 30px sans-serif';ctx.fillText(title,65,65);ctx.fillStyle='#6d8398';ctx.fillRect(36,94,696,2)
      ctx.fillStyle='#e5e9ed';ctx.font='bold 45px sans-serif';ctx.fillText(subtitle,36,165)
      for(let i=0;i<3;i++){ctx.fillStyle='#1e2b38';ctx.fillRect(36,208+i*76,696,56);ctx.fillStyle=i===0?color:'#8196a7';ctx.font='22px monospace';ctx.fillText(['CONNECTED / READY','SECURE SESSION','REQUEST PROCESSED'][i],57,244+i*76)}
      ctx.fillStyle=color;ctx.fillRect(36,460,186,8)
      const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.push(t)
      const mat=new THREE.MeshBasicMaterial({map:t});materials.push(mat)
      mesh(g,w,h,.015,x,y,z,mat,.005)
    }
    const system = new THREE.Group();scene.add(system)
    mesh(system,12,.22,8.4,0,-.18,0,M.dark,.18);mesh(system,11.9,.03,8.3,0,-.045,0,M.steel,.1);mesh(system,11.82,.05,8.22,0,0,0,M.body,.1)
    for(const x of [-5.6,5.6])for(const z of [-3.8,3.8]){cyl(system,.075,.02,x,.04,z);cyl(system,.22,.18,x,-.36,z,M.dark)}
    const bases = [new THREE.Vector3(-3.8,0,1.8),new THREE.Vector3(-3.6,0,-1.9),new THREE.Vector3(.1,0,2),new THREE.Vector3(3.7,0,1.7),new THREE.Vector3(1.4,0,-1.9)]
    const nodes:THREE.Group[] = [], covers:THREE.MeshStandardMaterial[] = [], labels:HTMLButtonElement[] = []
    stations.forEach((s,i) => {
      const g=new THREE.Group();g.position.copy(bases[i]);g.userData.id=s.id;system.add(g);nodes.push(g)
      mesh(g,2.7,.12,2.1,0,.1,0,M.dark,.1);mesh(g,2.55,.035,1.95,0,.17,0,M.orange,.08)
      const label=document.createElement('button');label.className='node-label';label.setAttribute('aria-label',s.name+' 관련 경험 보기');label.innerHTML=`<span>0${i+1}</span> ${s.name}<small>${s.en}</small>`;label.onclick=()=>latest.current.onSelect(s.id);host.append(label);labels.push(label)
    })
    const pc=nodes[0]
    mesh(pc,2.1,1.4,.18,0,1.7,-.25,M.steel,.08);mesh(pc,1.99,1.29,.08,0,1.7,-.135,M.dark);screen(pc,1.87,1.15,0,1.7,-.085,'CLIENT TERMINAL','WELCOME')
    mesh(pc,.16,.58,.16,0,.69,-.25,M.steel);mesh(pc,.84,.07,.55,0,.39,-.25,M.steel)
    mesh(pc,1.65,.09,.55,-.2,.28,.62,M.ivory)
    for(let i=0;i<12;i++)for(let j=0;j<3;j++)mesh(pc,.085,.025,.08,-.92+i*.125,.34,.43+j*.14,M.body,.008)
    mesh(pc,.26,.1,.39,.95,.3,.59,M.steel,.1)
    const banking=nodes[1]
    mesh(banking,1.8,2.3,.45,0,1.4,-.18,M.ivory,.13);mesh(banking,1.66,.12,.48,0,2.55,-.18,M.orange)
    screen(banking,1.5,1.13,0,1.76,.055,'DIGITAL BANKING','MY ACCOUNT')
    mesh(banking,1.13,.12,.055,0,.98,.065,M.dark);mesh(banking,.7,.23,.12,0,.68,.13,M.orange)
    const certificate=nodes[2]
    const card=new THREE.Group();card.rotation.y=-.17;certificate.add(card)
    mesh(card,1.57,2,.13,0,1.34,0,M.ivory,.09);mesh(card,1.57,.2,.15,0,2.24,0,M.orange)
    screen(card,1.38,.76,0,1.68,.085,'CERTIFICATE','IDENTITY')
    const seal=cyl(card,.33,.07,0,.78,.12,M.orange);seal.rotation.x=Math.PI/2
    const rimSeal=cyl(card,.22,.08,0,.78,.16,M.steel);rimSeal.rotation.x=Math.PI/2
    mesh(card,.08,.3,.08,0,.78,.23,M.orange);mesh(card,.26,.07,.08,0,.86,.23,M.orange)
    mesh(certificate,.95,.16,.75,0,.28,0,M.dark)
    function rack(g:THREE.Group,count:number,width:number,height:number,heading:string){
      const cover=material(0x36414f,.65,.24);cover.transparent=true;materials.push(cover);covers.push(cover)
      mesh(g,width,height,1.12,0,height/2+.25,-.05,cover,.08)
      mesh(g,width-.16,height-.18,.08,0,height/2+.25,.555,M.dark)
      mesh(g,width,.09,1.18,0,height+.3,-.05,M.orange)
      for(let i=0;i<count;i++){
        const y=.62+i*.46;mesh(g,width-.29,.37,.77,0,y,.23,M.steel,.025);mesh(g,width-.39,.27,.05,0,y,.65,M.body,.01)
        for(let j=0;j<7;j++)mesh(g,.025,.15,.025,-width/2+.23+j*.08,y,.69,M.dark,.003)
        mesh(g,.06,.06,.025,width/2-.33,y,.692,M.green,.02);mesh(g,.05,.05,.025,width/2-.48,y,.692,M.light,.01)
        mesh(g,.85,.05,.05,0,y,-.6,M.light)
      }
      screen(g,width-.35,.37,0,height+.01,.565,heading,'ONLINE')
    }
    rack(nodes[3],4,1.6,2.65,'AUTH / IDENTITY');rack(nodes[4],6,2.3,3.5,'CORE BANKING')
    const database=cyl(nodes[4],.46,1.15,1.6,.87,0,M.steel)
    for(let j=0;j<3;j++)cyl(nodes[4],.48,.06,1.6,.47+j*.39,0,M.orange)
    database.userData.id='server'
    const connections:THREE.CatmullRomCurve3[] = [], wires:THREE.Mesh[] = [], packets:THREE.Mesh[] = []
    for(let i=0;i<5;i++){
      const a=bases[i],b=bases[(i+1)%5],mid=a.clone().lerp(b,.5);mid.y=.18
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(a.x,.18,a.z),mid,new THREE.Vector3(b.x,.18,b.z)])
      connections.push(curve);const geo=new THREE.TubeGeometry(curve,40,.027,8,false);geometries.push(geo);const wire=new THREE.Mesh(geo,M.orange);system.add(wire);wires.push(wire)
      const pg=new THREE.SphereGeometry(.085,12,8);geometries.push(pg);const packet=new THREE.Mesh(pg,M.light);system.add(packet);packets.push(packet)
    }
    const grid=new THREE.GridHelper(40,40,0x343d48,0x1d2632);grid.position.y=-.49;scene.add(grid)
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let downX=0,downY=0
    const down=(e:PointerEvent)=>{downX=e.clientX;downY=e.clientY}
    const up=(e:PointerEvent)=>{
      if(Math.hypot(e.clientX-downX,e.clientY-downY)>6)return
      const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera)
      const hit=raycaster.intersectObjects(nodes,true)[0];if(!hit)return
      let obj:THREE.Object3D|null=hit.object;while(obj&&!obj.userData.id)obj=obj.parent
      if(obj?.userData.id)latest.current.onSelect(obj.userData.id)
    }
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up)
    let w=1,h=1,wasNarrow=false
    const resize=()=>{w=host.clientWidth;h=host.clientHeight;const narrow=w<600;if(narrow!==wasNarrow){camera.position.multiplyScalar(narrow?1.3:1/1.3);wasNarrow=narrow}renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}
    const observer=new ResizeObserver(resize);observer.observe(host);resize()
    const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches
    let frame=0,time=0,last=performance.now(),lastStep=-1,lastView:View='perspective',transition=0
    const targetPosition=new THREE.Vector3(),projection=new THREE.Vector3()
    function draw(now:number){
      frame=requestAnimationFrame(draw);const dt=Math.max(0,Math.min((now-last)/1000,.05));last=now
      const p=latest.current;if(p.playing&&!reduced)time+=dt
      const s=Math.floor(time/2.4)%5;if(s!==lastStep){lastStep=s;latest.current.onStep(s)}
      if(lastView!==p.view){lastView=p.view;transition=1}
      const distance=w<600?1.3:1
      targetPosition.copy(p.view==='top'?new THREE.Vector3(.01,21,.01):p.view==='front'?new THREE.Vector3(0,7,19):new THREE.Vector3(11,11,15)).multiplyScalar(distance)
      if(transition>0){camera.position.lerp(targetPosition,reduced?1:.09);controls.target.lerp(new THREE.Vector3(0,.5,0),.09);transition=Math.max(0,transition-dt*.55)}
      nodes.forEach((g,i)=>{
        const spread=p.mode==='stations'?1.22:1;g.position.lerp(bases[i].clone().multiplyScalar(spread),reduced?1:.08)
        g.position.y=THREE.MathUtils.lerp(g.position.y,p.mode==='flow'&&i===s?.22:0,.08)
        projection.set(0,i===4?4.1:3.1,0);g.localToWorld(projection);projection.project(camera)
        const x=(projection.x*.5+.5)*w,y=(-projection.y*.5+.5)*h
        labels[i].style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`
        labels[i].style.visibility=x<0||x>w||y<0||y>h?'hidden':'visible'
        labels[i].classList.toggle('active',p.selected===stations[i].id||(p.mode==='flow'&&s===i))
      })
      covers.forEach(c=>{c.opacity=THREE.MathUtils.lerp(c.opacity,p.mode==='inside'?.15:1,.1);c.depthWrite=p.mode!=='inside'})
      packets.forEach((o,i)=>{o.visible=p.mode!=='stations';o.position.copy(connections[i].getPoint((time*.32+i*.17)%1));o.scale.setScalar(p.mode==='flow'&&s===i?1.6:1)})
      wires.forEach(o=>o.visible=p.mode!=='stations')
      controls.update();renderer.render(scene,camera)
    }
    camera.position.copy(new THREE.Vector3(11,11,15).multiplyScalar(w<600?1.3:1));frame=requestAnimationFrame(draw)
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);controls.dispose();geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());env.dispose();renderer.dispose();renderer.domElement.remove();labels.forEach(l=>l.remove())}
  },[])
  return <div className="banking-scene" ref={root} role="region" aria-label="인터랙티브 금융 시스템 3D 개념도">{error&&<div className="scene-error"><strong>3D 화면을 시작할 수 없습니다.</strong><p>아래 프로젝트 목록에서 모든 경험을 살펴볼 수 있습니다.</p></div>}</div>
}
