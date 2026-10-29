import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {createHardwareModel,disposeHardwareScene,setHardwareStatus} from '../three/hardware-models';

const steps=[{title:'요청 대기',detail:'PC·서버·DB 장비를 같은 조형 규칙으로 배치합니다.',path:[]},{title:'사용자 요청',detail:'요청 패킷이 사용자 PC에서 서버로 이동합니다.',path:['client','server']},{title:'서버 내부 검증',detail:'서버 안의 처리입니다. 장비 사이를 이동하는 패킷은 표시하지 않습니다.',path:['server']},{title:'저장소 왕복',detail:'서버 → DB → 서버의 왕복을 표현합니다. 커밋 완료는 별도 배지로 표시합니다.',path:['server','database','server']},{title:'결과 응답',detail:'응답 패킷이 서버에서 PC로 돌아옵니다.',path:['server','client']},{title:'표시 완료',detail:'장비의 형태를 유지하고 상태 표시만 성공으로 바꿉니다.',path:['client']}];
export default function ComponentFlowExample(){
  const [step,setStep]=useState(0),[playing,setPlaying]=useState(false),[ready,setReady]=useState(false);
  const mount=useRef<HTMLDivElement>(null),latest=useRef({step,playing}),control=useRef<(()=>void)|null>(null);latest.current={step,playing};
  useEffect(()=>{if(!playing)return;const timer=setTimeout(()=>{if(step===steps.length-1)setPlaying(false);else setStep(step+1);},1150);return()=>clearTimeout(timer);},[step,playing]);
  useEffect(()=>{
    const host=mount.current;if(!host)return;let renderer:THREE.WebGLRenderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));host.appendChild(renderer.domElement);
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-8,8,4,-4,.1,100);camera.position.set(0,7.5,14);camera.lookAt(0,0,0);
    scene.add(new THREE.AmbientLight(0xc8dcea,2.6));const light=new THREE.DirectionalLight(0xffefda,3);light.position.set(-4,7,6);scene.add(light);
    const models={client:createHardwareModel('desktop'),server:createHardwareModel('server'),database:createHardwareModel('database')};
    (Object.keys(models) as (keyof typeof models)[]).forEach((key,index)=>{models[key].position.x=(index-1)*4.8;scene.add(models[key]);});
    const grid=new THREE.GridHelper(25,40,0x385366,0x213541);grid.position.y=-1.53;scene.add(grid);
    const edges=new Map<string,{curve:THREE.QuadraticBezierCurve3;line:THREE.Line;arrow:THREE.Mesh}>();
    for(const [from,to] of [['client','server'],['server','database']] as const){const a=models[from].position.clone().add(new THREE.Vector3(0,1.45,0)),b=models[to].position.clone().add(new THREE.Vector3(0,1.45,0)),middle=a.clone().lerp(b,.5);middle.y+=.7;const curve=new THREE.QuadraticBezierCurve3(a,middle,b),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)),new THREE.LineBasicMaterial({color:0x526c7f})),arrow=new THREE.Mesh(new THREE.ConeGeometry(.12,.28,8),new THREE.MeshBasicMaterial({color:0x799caf}));scene.add(line,arrow);edges.set(from+'>'+to,{curve,line,arrow});}
    const packet=new THREE.Mesh(new THREE.BoxGeometry(.27,.17,.2),new THREE.MeshStandardMaterial({color:0xffc58c,emissive:0x64421c,emissiveIntensity:.3}));scene.add(packet);
    let tick=0,start=performance.now(),disposed=false,lost=false;const reduce=matchMedia('(prefers-reduced-motion: reduce)');
    const render=()=>{
      if(disposed||lost)return;const {step,playing}=latest.current,path=steps[step].path;
      (Object.keys(models) as (keyof typeof models)[]).forEach(key=>setHardwareStatus(models[key],step===5?'success':path.includes(key)?'active':'idle'));
      const legs=path.slice(1).map((to,i)=>{const from=path[i],forward=edges.get(from+'>'+to);return {edge:forward||edges.get(to+'>'+from),reverse:!forward};}).filter(leg=>leg.edge);
      const progress=playing&&!reduce.matches?Math.min(1,(performance.now()-start)/Math.max(650,legs.length*400)):.55,total=legs.reduce((sum,leg)=>sum+leg.edge!.curve.getLength(),0);let distance=progress*total,index=0;
      for(let i=0;i<legs.length;i++){const length=legs[i].edge!.curve.getLength();if(distance<=length||i===legs.length-1){index=i;break;}distance-=length;}
      for(const edge of edges.values()){const active=legs[index]?.edge===edge,reverse=active&&legs[index].reverse,t=reverse ? .35 : .65;(edge.line.material as THREE.LineBasicMaterial).color.set(active?0xffbe82:0x4b6679);edge.arrow.position.copy(edge.curve.getPoint(t));edge.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),edge.curve.getTangent(t).multiplyScalar(reverse?-1:1).normalize());(edge.arrow.material as THREE.MeshBasicMaterial).color.set(active?0xffd29a:0x799caf);}
      packet.visible=legs.length>0;if(packet.visible){const leg=legs[index],fraction=Math.min(1,distance/leg.edge!.curve.getLength());packet.position.copy(leg.edge!.curve.getPoint(leg.reverse?1-fraction:fraction));}
      host.dataset.progress=progress.toFixed(3);host.dataset.arrived=progress===1?(path.at(-1)||''):'';renderer.render(scene,camera);if(playing&&!reduce.matches&&legs.length&&progress<1)tick=requestAnimationFrame(render);
    };
    const restart=()=>{cancelAnimationFrame(tick);start=performance.now();render();};control.current=restart;
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight,halfWidth=Math.max(8.2,3*w/h),halfHeight=halfWidth*h/w;camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfHeight;camera.bottom=-halfHeight;camera.updateProjectionMatrix();renderer.setSize(w,h);restart();};const observer=new ResizeObserver(resize);observer.observe(host);resize();setReady(true);
    const onLost=(event:Event)=>{event.preventDefault();lost=true;cancelAnimationFrame(tick);setReady(false);},onRestored=()=>{lost=false;resize();setReady(true);};renderer.domElement.addEventListener('webglcontextlost',onLost);renderer.domElement.addEventListener('webglcontextrestored',onRestored);reduce.addEventListener('change',restart);
    return()=>{disposed=true;control.current=null;cancelAnimationFrame(tick);observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',onLost);renderer.domElement.removeEventListener('webglcontextrestored',onRestored);reduce.removeEventListener('change',restart);disposeHardwareScene(scene);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[]);
  useEffect(()=>control.current?.(),[step,playing]);
  return <section className="component-composition" data-step={step} data-route={steps[step].path.join('>')} data-ready={ready}>
    <div className="composition-canvas" ref={mount} aria-hidden="true"/>
    {!ready&&<p className="hardware-fallback">3D 대신 단계 이름과 경로로 예시를 확인할 수 있습니다.</p>}
    <div className="composition-labels"><span>사용자 PC</span><span>애플리케이션 서버</span><span>DB 저장소</span></div>
    <div className="composition-current"><strong>{step+1} / {steps.length} · {steps[step].title}</strong><p>{steps[step].detail}</p>{step===2&&<span className="logic-chip tone-success">✓ 검증 통과 · 서버 내부</span>}{step>=4&&<span className="logic-chip tone-success">✓ COMMIT · 표현 예시</span>}</div>
    <div className="composition-controls"><button type="button" onClick={()=>{if(step===0||step===5)setStep(1);setPlaying(!playing);}}>{playing?'일시 정지':'처리 예시 재생'}</button><button type="button" onClick={()=>{setPlaying(false);setStep((step+1)%steps.length);}}>다음 단계 →</button></div>
    <ol className="composition-steps">{steps.map((item,index)=><li key={item.title}><button type="button" aria-current={step===index?'step':undefined} onClick={()=>{setPlaying(false);setStep(index);}}>{index+1}. {item.title}</button></li>)}</ol>
  </section>;
}
