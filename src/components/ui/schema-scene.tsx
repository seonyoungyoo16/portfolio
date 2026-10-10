import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js'
import model from '../../generated/board-model.json'
import type {View} from '../../data'

type Props={view:View;playing:boolean;selected:string;active:string[];counts:Record<string,number>;onSelect:(name:string)=>void}
export default function SchemaScene(props:Props){
  const root=useRef<HTMLDivElement>(null),latest=useRef(props)
  const [error,setError]=useState(false)
  useEffect(()=>{latest.current=props},[props])
  useEffect(()=>{
    const host=root.current!;let renderer:THREE.WebGLRenderer
    try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true})}catch{setError(true);return}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;host.append(renderer.domElement)
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,100),controls=new OrbitControls(camera,renderer.domElement)
    controls.enableDamping=true;controls.enablePan=false;controls.enableZoom=false;controls.maxPolarAngle=Math.PI*.46;controls.target.set(0,1,0)
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose()
    scene.add(new THREE.HemisphereLight(0xc7dfff,0x29222a,3));const light=new THREE.DirectionalLight(0xffecd9,4);light.position.set(-4,10,7);scene.add(light)
    const rim=new THREE.DirectionalLight(0x9bbdff,3);rim.position.set(6,6,-7);scene.add(rim)
    const geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[],textures:THREE.Texture[]=[],labels:HTMLButtonElement[]=[],edgeLabels:HTMLSpanElement[]=[]
    const mat=(color:number,metalness=.5)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness:.3});materials.push(m);return m}
    const dark=mat(0x171f2a),steel=mat(0x667182,.8),body=mat(0x303b4b,.7),orange=mat(0xff954f)
    const box=(g:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{const geo=new RoundedBoxGeometry(w,h,d,2,.04);geometries.push(geo);const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);g.add(mesh);return mesh}
    const system=new THREE.Group();scene.add(system);box(system,11,.22,8,0,-.16,0,dark);box(system,10.9,.05,7.9,0,-.025,0,steel);box(system,10.8,.05,7.8,0,.015,0,body)
    const bases=[new THREE.Vector3(-3.3,0,0),new THREE.Vector3(0,0,-2.3),new THREE.Vector3(0,0,2.3),new THREE.Vector3(3.3,0,0)]
    const colors=[0xff954f,0x75b9ff,0x98dfb3,0xc6a2ff],nodes:THREE.Group[]=[],glows:THREE.MeshStandardMaterial[]=[]
    model.tables.forEach((table,i)=>{
      const node=new THREE.Group();node.position.copy(bases[i]);node.userData.table=table.name;system.add(node);nodes.push(node)
      const glow=new THREE.MeshStandardMaterial({color:colors[i],metalness:.35,roughness:.3,emissive:colors[i],emissiveIntensity:.2});materials.push(glow);glows.push(glow)
      box(node,2.7,.15,1.65,0,.18,0,dark);box(node,2.6,.035,1.55,0,.27,0,glow)
      box(node,2.25,2.15,.3,0,1.45,-.2,body);box(node,2.25,.09,.35,0,2.56,-.2,glow)
      const canvas=document.createElement('canvas');canvas.width=720;canvas.height=720;const c=canvas.getContext('2d')!;c.fillStyle='#121c29';c.fillRect(0,0,720,720);c.fillStyle='#'+colors[i].toString(16);c.fillRect(0,0,720,9);c.font='bold 50px monospace';c.fillText(table.name,32,79);c.font='22px monospace';c.fillStyle='#607990';c.fillText(table.entity.toUpperCase()+' / JPA ENTITY',32,118)
      table.columns.forEach((col,j)=>{const fk=table.relations.some(r=>r.column===col.name);c.fillStyle=j%2?'#192638':'#152131';c.fillRect(18,156+j*66,684,61);c.font='28px monospace';c.fillStyle=col.primary?'#ffc28b':fk?'#9ac8ff':'#b6c1d3';c.fillText((col.primary?'PK':fk?'FK':'  ')+'  '+col.name,32,196+j*66);c.font='17px monospace';c.fillStyle='#71879c';c.fillText(col.type.replace('TIMESTAMP WITH TIME ZONE','TIMESTAMP').replace('GENERATED',''),485,194+j*66)})
      const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);const m=new THREE.MeshBasicMaterial({map:t});materials.push(m);box(node,2.1,2.02,.02,0,1.46,-.035,m)
      const label=document.createElement('button');label.className='schema-node-label';label.onclick=()=>latest.current.onSelect(table.name);label.setAttribute('aria-label',table.name+' 테이블 보기');host.append(label);labels.push(label)
    })
    const curves:THREE.CatmullRomCurve3[]=[],packets:THREE.Mesh[]=[]
    model.relations.forEach((rel,i)=>{
      const from=bases[model.tables.findIndex(t=>t.name===rel.from)],to=bases[model.tables.findIndex(t=>t.name===rel.to)]
      const mid=from.clone().lerp(to,.5);mid.y=.32;mid.z+=(i-2)*.18
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(from.x,.32,from.z),mid,new THREE.Vector3(to.x,.32,to.z)]);curves.push(curve)
      const geo=new THREE.TubeGeometry(curve,40,.025,8,false);geometries.push(geo);system.add(new THREE.Mesh(geo,orange))
      const pgeo=new THREE.SphereGeometry(.07,10,8);geometries.push(pgeo);const packet=new THREE.Mesh(pgeo,orange);system.add(packet);packets.push(packet)
      const label=document.createElement('span');label.className='schema-edge-label';label.textContent=rel.column+' · N → 1';host.append(label);edgeLabels.push(label)
    })
    const grid=new THREE.GridHelper(30,30,0x27364a,0x182231);grid.position.y=-.35;scene.add(grid)
    let w=1,h=1;const resize=()=>{w=host.clientWidth;h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()};const ro=new ResizeObserver(resize);ro.observe(host);resize()
    const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;controls.enableRotate=!matchMedia('(pointer:coarse)').matches
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let startX=0,startY=0
    const down=(e:PointerEvent)=>{startX=e.clientX;startY=e.clientY},up=(e:PointerEvent)=>{if(Math.hypot(e.clientX-startX,e.clientY-startY)>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(nodes,true)[0];if(!hit)return;let o:THREE.Object3D|null=hit.object;while(o&&!o.userData.table)o=o.parent;if(o)latest.current.onSelect(o.userData.table)}
    renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointerup',up)
    let frame=0,time=0,last=performance.now(),lastView='',lastSelected='',transition=1
    const position=new THREE.Vector3(),target=new THREE.Vector3(),proj=new THREE.Vector3()
    camera.position.set(11,11,14).multiplyScalar(w<500?1.15:1)
    function draw(now:number){frame=requestAnimationFrame(draw);const dt=Math.max(0,Math.min((now-last)/1000,.05));last=now;const p=latest.current;if(p.playing&&!reduced)time+=dt
      if(lastView!==p.view||lastSelected!==p.selected){transition=1;lastView=p.view;lastSelected=p.selected}
      const distance=w<500?1.2:1;target.set(0,.8,0)
      if(p.view==='station'){const i=Math.max(0,model.tables.findIndex(t=>t.name===p.selected));target.copy(bases[i]);target.y=1.35;position.copy(target).add(new THREE.Vector3(2.4,2.4,6).multiplyScalar(distance))}
      else if(p.view==='flight'){const a=reduced?.6:time*.16+.6;position.set(Math.sin(a)*18,10,Math.cos(a)*18).multiplyScalar(distance)}
      else position.copy(p.view==='top'?new THREE.Vector3(.01,20,.01):p.view==='side'?new THREE.Vector3(18,7,1):new THREE.Vector3(11,11,14)).multiplyScalar(distance)
      controls.enabled=p.view!=='flight';if(transition>0||p.view==='flight'){camera.position.lerp(position,reduced?1:.09);controls.target.lerp(target,reduced?1:.09);transition=Math.max(0,transition-dt*.6)}controls.update()
      nodes.forEach((node,i)=>{const t=model.tables[i],active=p.active.includes(t.name);glows[i].emissiveIntensity=active?1.5:p.selected===t.name?.7:.12;proj.set(0,2.9,0);node.localToWorld(proj);proj.project(camera);const x=(proj.x*.5+.5)*w,y=(-proj.y*.5+.5)*h;const labelX=w<800?(i%2===0?80:w-80):x,labelY=w<800?(i<2?58:118):y;labels[i].style.transform=`translate(${labelX}px,${labelY}px) translate(-50%,-100%)`;labels[i].style.visibility=w<800?'visible':x<0||x>w||y<0||y>h?'hidden':'visible';labels[i].classList.toggle('active',active||p.selected===t.name);labels[i].innerHTML=`<strong>${t.name}</strong><small>${p.counts[t.name]??0} ROWS · ${t.columns.length} FIELDS</small>`})
      curves.forEach((curve,i)=>{packets[i].position.copy(curve.getPoint((time*.3+i*.18)%1));proj.copy(curve.getPoint(.5));proj.y+=.1;proj.project(camera);const x=(proj.x*.5+.5)*w,y=(-proj.y*.5+.5)*h;edgeLabels[i].style.transform=`translate(${x}px,${y}px) translate(-50%,0)`;edgeLabels[i].style.visibility=p.view==='station'||x<0||x>w||y<0||y>h?'hidden':'visible'})
      renderer.render(scene,camera)
    }frame=requestAnimationFrame(draw)
    return()=>{cancelAnimationFrame(frame);ro.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',down);renderer.domElement.removeEventListener('pointerup',up);renderer.domElement.remove();labels.forEach(l=>l.remove());edgeLabels.forEach(l=>l.remove());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());grid.geometry.dispose();(grid.material as THREE.Material).dispose();env.dispose();renderer.dispose()}
  },[])
  return <div ref={root} className="schema-scene" aria-label="게시판 DB 테이블 관계 3D">{error&&<div className="scene-error">WebGL을 사용할 수 없습니다. 아래 테이블·관계 목록에서 동일한 설계를 확인할 수 있습니다.</div>}</div>
}
