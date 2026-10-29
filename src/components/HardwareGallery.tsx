import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {createHardwareModel,disposeHardwareScene,hardwareDefinitions,setHardwareStatus,type HardwareKind,type HardwareStatus} from '../three/hardware-models';

export default function HardwareGallery({selected,status,angles,onSelect}:{selected:HardwareKind;status:HardwareStatus;angles:Partial<Record<HardwareKind,number>>;onSelect:(kind:HardwareKind)=>void}){
  const root=useRef<HTMLDivElement>(null),viewports=useRef<Partial<Record<HardwareKind,HTMLDivElement|null>>>({}),latest=useRef({selected,status,angles}),redraw=useRef<(()=>void)|null>(null);
  latest.current={selected,status,angles};const [ready,setReady]=useState(false);
  useEffect(()=>{
    const host=root.current;if(!host)return;
    let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});}catch{return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0x000000,0);renderer.domElement.className='component-gallery-canvas';host.appendChild(renderer.domElement);
    const entries=hardwareDefinitions.map(def=>{
      const scene=new THREE.Scene(),model=createHardwareModel(def.kind),camera=new THREE.OrthographicCamera(-3,3,2.2,-2.2,.1,60);scene.add(model);
      camera.position.set(4.6,3.1,5.8);camera.lookAt(0,-.1,0);scene.add(new THREE.AmbientLight(0xc8dcea,2.5));const key=new THREE.DirectionalLight(0xfff1dd,3.5);key.position.set(-3,5,6);scene.add(key);const fill=new THREE.DirectionalLight(0x89b6d9,1.1);fill.position.set(4,2,-3);scene.add(fill);
      return {...def,scene,model,camera};
    });
    let lost=false,disposed=false;
    const render=()=>{
      if(disposed||lost)return;
      const bounds=host.getBoundingClientRect();renderer.setSize(bounds.width,bounds.height,false);renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
      for(const entry of entries){
        const viewport=viewports.current[entry.kind];if(!viewport)continue;const box=viewport.getBoundingClientRect();if(!box.width||!box.height)continue;
        const x=box.left-bounds.left,y=bounds.bottom-box.bottom,aspect=box.width/box.height,halfWidth=Math.max(2.25,2.15*aspect),halfHeight=halfWidth/aspect;
        entry.camera.left=-halfWidth;entry.camera.right=halfWidth;entry.camera.top=halfHeight;entry.camera.bottom=-halfHeight;entry.camera.updateProjectionMatrix();entry.model.rotation.y=latest.current.angles[entry.kind]||0;
        const current=latest.current.selected===entry.kind?latest.current.status:'idle';setHardwareStatus(entry.model,current);viewport.dataset.renderedState=current;viewport.dataset.rotation=entry.model.rotation.y.toFixed(3);
        renderer.setViewport(x,y,box.width,box.height);renderer.setScissor(x,y,box.width,box.height);renderer.clearDepth();renderer.render(entry.scene,entry.camera);
      }
    };
    redraw.current=render;const resize=new ResizeObserver(render);resize.observe(host);render();setReady(true);
    const onLost=(event:Event)=>{event.preventDefault();lost=true;setReady(false);};const onRestored=()=>{lost=false;render();setReady(true);};renderer.domElement.addEventListener('webglcontextlost',onLost);renderer.domElement.addEventListener('webglcontextrestored',onRestored);
    return()=>{disposed=true;redraw.current=null;resize.disconnect();renderer.domElement.removeEventListener('webglcontextlost',onLost);renderer.domElement.removeEventListener('webglcontextrestored',onRestored);entries.forEach(entry=>disposeHardwareScene(entry.scene));renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[]);
  useEffect(()=>redraw.current?.(),[selected,status,angles]);
  return <div className="hardware-gallery" ref={root} data-ready={ready}>
    {!ready&&<p className="hardware-fallback">3D 사용이 어려운 환경입니다. 아래 이름과 역할로 구성 예시를 확인할 수 있습니다.</p>}
    <div className="hardware-grid">{hardwareDefinitions.map(def=><button type="button" className="hardware-card" key={def.kind} aria-pressed={selected===def.kind} onClick={()=>onSelect(def.kind)} data-kind={def.kind}>
      <div className="hardware-viewport" ref={element=>{viewports.current[def.kind]=element;}} aria-hidden="true"/>
      <div className="hardware-caption"><span>{def.component}</span><strong>{def.name}</strong><small>{def.example}</small></div>
    </button>)}</div>
  </div>;
}
