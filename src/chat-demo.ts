export type DeliveryMode='direct'|'kafka'
export type DeliveryEvent={messageId:number;roomId:string;published:boolean;partition:number;offset:number|null;consumed:boolean}
export type ChatMessage={id:number;roomId:string;clientId:string;requestId:string;sender:string;body:string;createdAt:string;deliveryMode?:DeliveryMode}
export type ChatRead={roomId:string;clientId:string;lastReadId:number;deliveryMode?:DeliveryMode}
export type ChatDatabase={messages:ChatMessage[];nextId:number;reads?:ChatRead[];kafkaEvents?:DeliveryEvent[]}
export type ChatClient={id:string;name:string;roomId:string;connected:boolean;viewOpen:boolean;messages:ChatMessage[]}
export function emptyChat():ChatDatabase{return {messages:[],nextId:1,reads:[]}}
export function chatHistory(db:ChatDatabase,roomId:string){return db.messages.filter(m=>m.roomId===roomId).sort((a,b)=>a.id-b.id).slice(-100)}
// This is a demo-side comparison with the loaded history, not a server read receipt.
export function waitingChat(db:ChatDatabase,client:ChatClient){const loaded=new Set(client.messages.map(m=>m.id));return chatHistory(db,client.roomId).filter(m=>!loaded.has(m.id))}
export function storeChat(db:ChatDatabase,client:ChatClient,body:string,requestId:string,mode:DeliveryMode='direct'){
  if(!['direct','kafka'].includes(mode))throw Error('전송 방식을 선택하세요.')
  if(!client.connected)throw Error('먼저 채팅방에 연결해 주세요.')
  if(!['lobby','design'].includes(client.roomId))throw Error('존재하지 않는 채팅방입니다.')
  if(!body.trim()||body.length>2000)throw Error('메시지는 1~2000자입니다.')
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(requestId))throw Error('요청 식별자가 올바르지 않습니다.')
  const previous=db.messages.find(m=>m.clientId===client.id&&m.requestId===requestId)
  if(previous){if(previous.roomId!==client.roomId)throw Error('다른 방에서 사용한 요청 ID입니다.');return {database:db,message:previous,duplicate:true}}
  const message:ChatMessage={id:db.nextId,roomId:client.roomId,clientId:client.id,requestId,sender:client.name,body:body.trim(),createdAt:new Date().toISOString(),deliveryMode:mode}
  const kafkaEvents=mode==='kafka'?[...(db.kafkaEvents||[]),{messageId:message.id,roomId:client.roomId,published:false,partition:client.roomId==='lobby'?0:1,offset:null,consumed:false}]:db.kafkaEvents
  return {database:{...db,messages:[...db.messages,message],nextId:db.nextId+1,kafkaEvents},message,duplicate:false}
}
export function deliverChat(clients:ChatClient[],message:ChatMessage){return clients.map(c=>!c.connected||c.roomId!==message.roomId?c:{...c,messages:[...c.messages.filter(m=>m.id!==message.id),message].sort((a,b)=>a.id-b.id).slice(-100)})}
export function readChat(db:ChatDatabase,client:ChatClient,upToId:number):ChatDatabase{
  if(!client.connected||!client.viewOpen||!Number.isSafeInteger(upToId)||!client.messages.some(m=>m.id===upToId&&m.roomId===client.roomId))throw Error('열린 대화창에 불러온 현재 방의 메시지만 읽을 수 있습니다.')
  const mode=db.messages.find(m=>m.id===upToId)?.deliveryMode||'direct'
  const previous=(db.reads||[]).find(r=>r.roomId===client.roomId&&r.clientId===client.id&&(r.deliveryMode||'direct')===mode)
  const receipt={roomId:client.roomId,clientId:client.id,deliveryMode:mode,lastReadId:Math.max(previous?.lastReadId||0,upToId)}
  return {...db,reads:[...(db.reads||[]).filter(r=>r.roomId!==client.roomId||r.clientId!==client.id||(r.deliveryMode||'direct')!==mode),receipt]}
}
export function hasReadChat(reads:ChatRead[],message:ChatMessage,readerId:string){return reads.some(r=>r.roomId===message.roomId&&r.clientId===readerId&&(r.deliveryMode||'direct')===(message.deliveryMode||'direct')&&r.lastReadId>=message.id)}
export function nextReadChat(db:ChatDatabase,client:ChatClient){return client.connected&&client.viewOpen?Math.max(0,...client.messages.filter(m=>m.clientId!==client.id&&m.roomId===client.roomId&&!hasReadChat(db.reads||[],m,client.id)).map(m=>m.id)):0}
