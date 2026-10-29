import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createHardwareModel,disposeHardwareScene,hardwareDefinitions,setHardwareStatus} from '../src/three/hardware-models.ts';
const checks:string[]=[];
const check=(name:string,run:()=>void)=>{run();checks.push(name);console.log('PASS '+name);};
check('all eight roles create independent volumetric models with finite geometry and real status lights',()=>{
 assert.equal(hardwareDefinitions.length,8);const ids=new Set<string>();
 for(const def of hardwareDefinitions){const model=createHardwareModel(def.kind);assert(!ids.has(model.uuid));ids.add(model.uuid);const size=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());assert(size.x>2.7&&size.y>1.4&&size.z>2,'3D volume '+def.kind);assert([size.x,size.y,size.z].every(Number.isFinite));assert(model.userData.signals.length>0,def.kind);let meshes=0;model.traverse(item=>{if(item instanceof THREE.Mesh){meshes++;assert(item.geometry.getAttribute('position').count>0);}});assert(meshes>=10,def.kind);disposeHardwareScene(model);}
});
check('status changes only indicators and the active halo, keeping equipment appearance stable',()=>{
 const model=createHardwareModel('server'),signals=new Set(model.userData.signals),before=new Map<string,number>();
 model.traverse(item=>{if(item instanceof THREE.Mesh&&item!==model.userData.halo&&!signals.has(item))before.set(item.uuid,(item.material as THREE.MeshStandardMaterial).color.getHex());});
 for(const status of ['idle','active','success','error'] as const){setHardwareStatus(model,status);assert.equal(model.userData.status,status);assert.equal(model.userData.halo.visible,status==='active');model.traverse(item=>{if(before.has(item.uuid))assert.equal(((item as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex(),before.get(item.uuid));});}
 disposeHardwareScene(model);
});
check('instances never share mutable geometry or material resources',()=>{
 const first=createHardwareModel('database'),second=createHardwareModel('database');setHardwareStatus(first,'error');setHardwareStatus(second,'success');const a=first.userData.signals[0],b=second.userData.signals[0];assert.notEqual(a.material,b.material);assert.notEqual(a.geometry,b.geometry);assert.notEqual(a.material.color.getHex(),b.material.color.getHex());disposeHardwareScene(first);disposeHardwareScene(second);
});
check('every model geometry and material receives disposal during teardown',()=>{
 for(const def of hardwareDefinitions){const model=createHardwareModel(def.kind);let geometries=0,materials=0,geometryEvents=0,materialEvents=0;model.traverse(item=>{if(item instanceof THREE.Mesh){geometries++;item.geometry.addEventListener('dispose',()=>geometryEvents++);for(const material of Array.isArray(item.material)?item.material:[item.material]){materials++;material.addEventListener('dispose',()=>materialEvents++);}}});disposeHardwareScene(model);assert.equal(geometryEvents,geometries,def.kind);assert.equal(materialEvents,materials,def.kind);}
});
fs.mkdirSync('docs/component-gallery-verification',{recursive:true});fs.writeFileSync('docs/component-gallery-verification/model.json',JSON.stringify({status:'passed',verifiedAt:new Date().toISOString(),checks,scope:'Example 3D model geometry, state indicators and resource lifecycle. No backend I/O.'},null,2)+'\n');
