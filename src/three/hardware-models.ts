import * as THREE from 'three';

export type HardwareKind='desktop'|'mobile'|'server'|'database'|'cache'|'files'|'broker'|'external';
export type HardwareStatus='idle'|'active'|'success'|'error';
export const hardwareDefinitions: {kind:HardwareKind;name:string;component:string;role:string;example:string}[]=[
  {kind:'desktop',name:'사용자 PC',component:'DesktopModel',role:'요청이 시작되고 결과를 확인하는 클라이언트 장비',example:'게시판 작성 · 투두 조작 · 결제 요청'},
  {kind:'mobile',name:'사용자 모바일',component:'MobileModel',role:'PC와 같은 클라이언트 역할의 모바일 장비',example:'모바일 로그인 · 인증 링크 열기'},
  {kind:'server',name:'애플리케이션 서버',component:'ServerModel',role:'서버 프로그램이 실행되는 호스트. 업무 로직은 이 장비 위의 별도 표시로 표현',example:'Spring Boot · API 서버 A/B'},
  {kind:'database',name:'데이터베이스',component:'DatabaseModel',role:'영속 데이터를 저장하는 저장소를 원통 스택으로 표현',example:'게시글 · 회원 · 결제 원장'},
  {kind:'cache',name:'공유 캐시·세션',component:'CacheModel',role:'빠른 공유 저장소를 메모리 모듈로 표현. Redis의 실행 역할과 TTL은 별도 표기',example:'로그인 세션 · 조회 캐시'},
  {kind:'files',name:'파일·오브젝트 저장소',component:'FileStoreModel',role:'파일과 이미지를 보관하는 저장 서비스를 드라이브 장비로 표현',example:'게시판 첨부 이미지 · 다운로드'},
  {kind:'broker',name:'메시지 브로커 호스트',component:'BrokerModel',role:'메시지를 전달하는 서버 장비. 큐와 이벤트는 장비 앞의 논리 표시로 표현',example:'Kafka · 비동기 메시지 전달'},
  {kind:'external',name:'외부 시스템',component:'ExternalModel',role:'외부 신뢰 영역의 별도 서비스. 같은 서버 조형을 다른 영역 안에 배치',example:'PG · SSO 제공자 · SMTP'},
];

const colors={body:0x273b4d,edge:0x7e9cb2,panel:0x152533,light:0xc4d9e5,screen:0x0b1d2a,stand:0x718c9f,signal:0x76938b};
function box(group:THREE.Group,w:number,h:number,d:number,x:number,y:number,z:number,color:number){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.65,metalness:.18}));mesh.position.set(x,y,z);group.add(mesh);return mesh;
}
function cylinder(group:THREE.Group,r:number,h:number,x:number,y:number,z:number,color:number){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,40),new THREE.MeshStandardMaterial({color,roughness:.47,metalness:.26}));mesh.position.set(x,y,z);group.add(mesh);return mesh;
}
function signal(group:THREE.Group,x:number,y:number,z:number,w=.13){
  const mesh=box(group,w,.07,.035,x,y,z,colors.signal);
  (group.userData.signals ||= []).push(mesh);return mesh;
}
function foundation(){
  const group=new THREE.Group();group.userData.signals=[];
  box(group,2.8,.11,2.2,0,-1.38,0,0x6f8d9e);box(group,2.95,.05,2.32,0,-1.47,0,0x1b3042);
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.5,.025,8,72),new THREE.MeshBasicMaterial({color:0xffb76f}));halo.rotation.x=-Math.PI/2;halo.position.y=-1.33;halo.visible=false;group.add(halo);group.userData.halo=halo;
  return group;
}
function display(group:THREE.Group,w:number,h:number,x:number,y:number,z:number){
  box(group,w,h,.15,x,y,z,colors.edge);box(group,w-.13,h-.13,.025,x,y,z+.09,colors.screen);
  box(group,w-.23,.08,.02,x,y+h/2-.13,z+.11,0x9cbfce);
  for(let i=0;i<3;i++)box(group,w*(.66-i*.08),.045,.02,x-w*.04,y+h*.14-i*.2,z+.12,i===2?0xc7b588:0x789aaf);
}

export function DesktopModel(){
  const group=foundation();display(group,2.16,1.38,-.12,.2,-.35);
  box(group,.18,.7,.18,-.12,-.83,-.35,colors.stand);box(group,1.03,.09,.62,-.12,-1.2,-.3,0xa0bbcb);
  box(group,1.65,.08,.52,-.15,-1.21,.67,0x2d465e);
  for(let row=0;row<3;row++)for(let col=0;col<8;col++)box(group,.135,.018,.09,-.76+col*.17,-1.157,.5+row*.12,0x8fa8b8);
  const tower=new THREE.Group();box(tower,.46,1.27,.71,0,-.68,0,0x355269);box(tower,.31,.18,.035,0,-.31,.37,0x92b6cb);signal(tower,0,-.72,.38);group.add(tower);tower.position.set(1.1,0,.02);(group.userData.signals as THREE.Mesh[]).push(...tower.userData.signals||[]);
  signal(group,.8,-1.1,.88);return group;
}

export function MobileModel(){
  const group=foundation();const phone=new THREE.Group();phone.rotation.z=-.11;
  box(phone,1.18,2.25,.18,0,-.02,0,0x1c303f);box(phone,1.07,2.12,.035,0,-.02,.11,0x9eb8c7);box(phone,.95,1.92,.025,0,-.02,.14,colors.screen);
  box(phone,.27,.045,.02,0,.89,.17,0x96adba);for(let i=0;i<4;i++){box(phone,.13,.1,.02,-.3,.54-i*.33,.17,i===0?0xa8c4b6:0x5d7b8b);box(phone,.47,.045,.02,.08,.54-i*.33,.17,0x8faabb);}
  box(phone,.38,.035,.02,0,-.89,.17,0xaac8d3);signal(phone,.34,.88,.18,.12);group.add(phone);(group.userData.signals as THREE.Mesh[]).push(...phone.userData.signals||[]);return group;
}

function rack(group:THREE.Group,x=0,scale=1){
  const rackGroup=new THREE.Group();rackGroup.userData.signals=[];rackGroup.position.set(x,-1.3*(1-scale),0);rackGroup.scale.setScalar(scale);group.add(rackGroup);
  box(rackGroup,1.72,2.49,1.18,0,-.03,0,colors.body);box(rackGroup,1.86,.12,1.28,0,1.28,0,colors.light);
  box(rackGroup,.1,2.5,.12,-.8,-.03,.65,colors.edge);box(rackGroup,.1,2.5,.12,.8,-.03,.65,colors.edge);
  for(let row=0;row<4;row++){
    const y=.86-row*.57;box(rackGroup,1.47,.45,.1,0,y,.65,0x4b677e);box(rackGroup,1.31,.3,.04,0,y,.72,colors.panel);
    for(let vent=0;vent<4;vent++)box(rackGroup,.56,.018,.025,-.28,y+.078-vent*.053,.75,0x7894a5);
    signal(rackGroup,.49,y,.76,.14);
  }
  (group.userData.signals as THREE.Mesh[]).push(...rackGroup.userData.signals);return rackGroup;
}

export function ServerModel(){const group=foundation();rack(group);return group;}

export function DatabaseModel(){
  const group=foundation();for(let i=0;i<4;i++){
    const y=-1.04+i*.54;cylinder(group,.95,.43,0,y,0,i%2?0x466b7e:0x36556b);cylinder(group,.95,.045,0,y+.24,0,0xa2c1cd);
    box(group,.78,.035,.02,-.16,y,.94,0x9bbac9);signal(group,.55,y,.95,.14);
  }
  cylinder(group,.56,.025,0,.86,0,0x8aaeb7);return group;
}

export function CacheModel(){
  const group=foundation();box(group,2.24,.17,1.6,0,-1.15,0,0x294b59);
  for(let row=0;row<3;row++){
    const module=new THREE.Group();module.position.z=-.5+row*.5;box(module,2.12,1.25,.1,0,-.46,0,0x3b6a60);
    for(let i=0;i<4;i++){box(module,.35,.48,.08,-.72+i*.48,-.41,.09,0x1c343b);box(module,.2,.06,.03,-.72+i*.48,-.02,.08,0x7d9c8c);}
    for(let i=0;i<12;i++)box(module,.09,.12,.04,-.94+i*.17,-1.03,.04,0xbdaa77);
    group.add(module);
  }
  signal(group,.99,-.38,.61,.12);return group;
}

export function FileStoreModel(){
  const group=foundation();box(group,2.15,1.96,1.42,0,-.28,0,0x38546a);box(group,2.24,.12,1.5,0,.76,0,colors.light);
  for(let i=0;i<2;i++){
    const x=-.48+i*.96;box(group,.8,1.62,.1,x,-.25,.78,0x1b3142);box(group,.67,1.35,.04,x,-.24,.85,0x6c8595);box(group,.53,.08,.07,x,-.85,.91,0x152c3d);
    for(let j=0;j<6;j++)box(group,.43,.018,.02,x,.24-j*.14,.89,0x314b5d);signal(group,x,.46,.9,.15);
  }
  return group;
}

export function BrokerModel(){
  const group=foundation();rack(group,0,.82);
  box(group,2.05,.3,1.25,0,-1.13,.16,0x4e7488);
  for(let i=0;i<5;i++){box(group,.23,.1,.06,-.72+i*.36,-1.1,.84,0x172b3a);signal(group,-.72+i*.36,-.96,.85,.1);}
  return group;
}

export function ExternalModel(){
  const group=foundation();rack(group,-.6,.64);rack(group,.6,.64);
  box(group,2.45,.09,1.55,0,-1.31,0,0x8ea6b5);
  const arch=new THREE.Group();box(arch,.11,2.1,.11,-1.25,-.13,-.54,0x6588a5);box(arch,.11,2.1,.11,1.25,-.13,-.54,0x6588a5);box(arch,2.6,.11,.11,0,.93,-.54,0x9ab9ce);group.add(arch);
  return group;
}

export function createHardwareModel(kind:HardwareKind):THREE.Group {
  const factory={desktop:DesktopModel,mobile:MobileModel,server:ServerModel,database:DatabaseModel,cache:CacheModel,files:FileStoreModel,broker:BrokerModel,external:ExternalModel};
  const group=factory[kind]();group.userData.kind=kind;return group;
}

export function setHardwareStatus(group:THREE.Group,status:HardwareStatus){
  const tint={idle:0x718890,active:0xf2ba78,success:0x8ed2ac,error:0xe99791}[status];
  (group.userData.signals as THREE.Mesh[]).forEach(mesh=>{const material=mesh.material as THREE.MeshStandardMaterial;material.color.set(tint);material.emissive.set(status==='idle'?0x000000:tint);material.emissiveIntensity=status==='idle'?0:.18;});
  (group.userData.halo as THREE.Mesh).visible=status==='active';group.userData.status=status;
}

export function disposeHardwareScene(scene:THREE.Object3D){
  scene.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)mesh.geometry.dispose();if(mesh.material)(Array.isArray(mesh.material)?mesh.material:[mesh.material]).forEach(material=>material.dispose());});
}
