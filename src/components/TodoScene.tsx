import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { TodoFrame, TodoNode } from '../todo-trace';

const names: Record<TodoNode,string> = {input:'사용자 입력',react:'React 로직',storage:'전용 localStorage',view:'목록·시간표'};
export default function TodoScene({frame,playing,onNode}:{frame:TodoFrame | null; playing:boolean; onNode:(node:TodoNode)=>void}) {
  const host=useRef<HTMLDivElement>(null), latest=useRef({frame,playing}), control=useRef<{restart:()=>void}|null>(null);
  latest.current={frame,playing};
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const mount=host.current;if(!mount)return;
    let renderer:THREE.WebGLRenderer;
    try {renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{setReady(false);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));mount.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-6,6,3,-3,.1,100);
    camera.position.set(0,6.8,12);camera.lookAt(0,0,0);
    scene.add(new THREE.AmbientLight(0xbfd9ea,2.4));const light=new THREE.DirectionalLight(0xffedd0,3);light.position.set(-4,7,5);scene.add(light);
    const grid=new THREE.GridHelper(20,28,0x344d5b,0x203440);grid.position.y=-.68;scene.add(grid);
    const nodes:Record<TodoNode,THREE.Group>={input:new THREE.Group(),react:new THREE.Group(),storage:new THREE.Group(),view:new THREE.Group()};
    const palette={input:0x8ca9cc,react:0xd8b174,storage:0x93d5b5,view:0xa1cbd7};
    const box=(group:THREE.Group,size:[number,number,number],pos:[number,number,number],color:number)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:.55}));mesh.position.set(...pos);group.add(mesh);return mesh;};
    const rings:Record<string,THREE.Mesh>={};
    (Object.keys(nodes) as TodoNode[]).forEach((key,i)=>{
      const node=nodes[key];node.position.x=-3.9+i*2.6;scene.add(node);
      box(node,[1.8,.12,1.5],[0,-.58,0],0x28404d);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.025,8,50),new THREE.MeshBasicMaterial({color:0xffbd79}));ring.rotation.x=-Math.PI/2;ring.position.y=-.48;node.add(ring);rings[key]=ring;
      if(key==='storage'){
        for(let j=0;j<3;j++){const disk=new THREE.Mesh(new THREE.CylinderGeometry(.58,.58,.34,24),new THREE.MeshStandardMaterial({color:j===2?palette[key]:0x3b5967,roughness:.45}));disk.position.y=-.24+j*.34;node.add(disk);}
      }else if(key==='react'){
        box(node,[.95,1.35,.6],[0,.12,0],0x385266);box(node,[.75,.35,.05],[0,.38,.33],palette[key]);box(node,[.75,.25,.05],[0,-.08,.33],0x102331);
      }else{
        box(node,[1.5,.9,.12],[0,.34,0],0x506e85);box(node,[1.32,.7,.03],[0,.34,.09],0x142937);
        for(let j=0;j<3;j++)box(node,[1.04-j*.14,.045,.03],[-j*.06,.53-j*.2,.12],j===0?palette[key]:0x5e8896);
        box(node,[.15,.43,.15],[0,-.2,0],0x6b8a9f);box(node,[.8,.06,.45],[0,-.42,.08],0x779caf);
      }
    });
    const edges=new Map<string,{curve:THREE.QuadraticBezierCurve3;line:THREE.Line;arrow:THREE.Mesh}>();
    for(const [from,to] of [['input','react'],['react','storage'],['react','view']] as [TodoNode,TodoNode][]){
      const a=nodes[from].position.clone().add(new THREE.Vector3(0,1.05,0)),b=nodes[to].position.clone().add(new THREE.Vector3(0,1.05,0));
      const midpoint=a.clone().lerp(b,.5);midpoint.y+=to==='view'?1.35:.5;midpoint.z=to==='view'?-1:0;
      const curve=new THREE.QuadraticBezierCurve3(a,midpoint,b),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)),new THREE.LineBasicMaterial({color:0x405866}));scene.add(line);
      const arrow=new THREE.Mesh(new THREE.ConeGeometry(.08,.2,8),new THREE.MeshBasicMaterial({color:0x6d8795}));scene.add(arrow);edges.set(from+'>'+to,{curve,line,arrow});
    }
    const packet=new THREE.Mesh(new THREE.BoxGeometry(.2,.13,.16),new THREE.MeshStandardMaterial({color:0xffce8c,emissive:0x8d521b,emissiveIntensity:.5}));scene.add(packet);
    let request=0,start=performance.now(),lost=false,disposed=false;
    const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    const render=()=>{
      if(disposed||lost)return;
      const {frame,playing}=latest.current,path=frame?.path||[],legs=path.slice(1).map((to,i)=>{const from=path[i],forward=edges.get(from+'>'+to);const edge=forward||edges.get(to+'>'+from);return {edge,reverse:!forward};}).filter(leg=>leg.edge);
      const total=legs.reduce((sum,leg)=>sum+leg.edge!.curve.getLength(),0);
      const progress=frame?.failed ? .52 : playing&&!reduce.matches?((performance.now()-start)/1800)%1:.54;
      let distance=total*progress,active=0;
      for(let i=0;i<legs.length;i++){const length=legs[i].edge!.curve.getLength();if(distance<=length||i===legs.length-1){active=i;break;}distance-=length;}
      for(const [key,edge] of edges){
        const activeEdge=legs[active]?.edge===edge;
        (edge.line.material as THREE.LineBasicMaterial).color.set(activeEdge?(frame?.failed?0xe38b87:0xffbd79):0x3d5665);
        const reverse=activeEdge&&legs[active].reverse,t=reverse ? .35 : .65;
        edge.arrow.position.copy(edge.curve.getPoint(t));const tangent=edge.curve.getTangent(t).multiplyScalar(reverse?-1:1);
        edge.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tangent.normalize());
        (edge.arrow.material as THREE.MeshBasicMaterial).color.set(activeEdge?0xffcc8e:0x587181);
        if(activeEdge)mount.dataset.activeLink=key;
      }
      packet.visible=legs.length>0;
      if(packet.visible){const leg=legs[active],fraction=Math.min(1,distance/leg.edge!.curve.getLength());packet.position.copy(leg.edge!.curve.getPoint(leg.reverse?1-fraction:fraction));(packet.material as THREE.MeshStandardMaterial).color.set(frame?.failed?0xe38b87:0xffce8c);}
      else delete mount.dataset.activeLink;
      for(const key of Object.keys(rings))rings[key].visible=path.includes(key as TodoNode);
      renderer.render(scene,camera);
      if(playing&&!reduce.matches&&legs.length&&!frame?.failed)request=requestAnimationFrame(render);
    };
    const restart=()=>{cancelAnimationFrame(request);start=performance.now();render();};control.current={restart};
    const resize=()=>{const w=mount.clientWidth,h=mount.clientHeight,halfWidth=Math.max(5.6,3.2*w/h),halfHeight=halfWidth*h/w;camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();renderer.setSize(w,h);restart();};
    const observer=new ResizeObserver(resize);observer.observe(mount);resize();setReady(true);
    const onLost=(event:Event)=>{event.preventDefault();lost=true;cancelAnimationFrame(request);setReady(false);};const onRestored=()=>{lost=false;setReady(true);resize();};
    renderer.domElement.addEventListener('webglcontextlost',onLost);renderer.domElement.addEventListener('webglcontextrestored',onRestored);reduce.addEventListener('change',restart);
    return()=>{disposed=true;control.current=null;cancelAnimationFrame(request);observer.disconnect();reduce.removeEventListener('change',restart);renderer.domElement.removeEventListener('webglcontextlost',onLost);renderer.domElement.removeEventListener('webglcontextrestored',onRestored);scene.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(m=>m.dispose());});renderer.dispose();renderer.domElement.remove();};
  },[]);
  useEffect(()=>control.current?.restart(),[frame,playing]);
  return <div className="todo-scene" data-route={frame?.path.join('>')||'ready'} data-source={frame?.source||'ready'} data-ready={ready}>
    <div className="todo-scene-canvas" ref={host} aria-hidden="true" />
    {!ready&&<p className="todo-scene-fallback">3D 대신 아래 요소와 처리 단계로 흐름을 확인할 수 있습니다.</p>}
    <div className="todo-scene-nodes">{(Object.keys(names) as TodoNode[]).map(key=><button type="button" key={key} aria-pressed={!!frame?.path.includes(key)} onClick={()=>onNode(key)}>{names[key]}</button>)}</div>
    <p className="todo-scene-route">{frame?frame.path.map(key=>names[key]).join(' → '):'할 일 추가 → 시간표 배치 → 완료를 순서대로 체험하세요.'}</p>
    <small>주황색 = 선택한 처리 경로 · 브라우저 안에서 실행</small>
  </div>;
}
