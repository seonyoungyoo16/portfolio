export type ChatMessage={id:number;roomId:string;clientId:string;requestId:string;sender:string;body:string;createdAt:string}
export type ChatDatabase={messages:ChatMessage[];nextId:number}
export type ChatClient={id:string;name:string;roomId:string;connected:boolean;messages:ChatMessage[]}
export function emptyChat():ChatDatabase{return {messages:[],nextId:1}}
export function chatHistory(db:ChatDatabase,roomId:string){return db.messages.filter(m=>m.roomId===roomId).sort((a,b)=>a.id-b.id).slice(-100)}
// This is a demo-side comparison with the loaded history, not a server read receipt.
export function waitingChat(db:ChatDatabase,client:ChatClient){const loaded=new Set(client.messages.map(m=>m.id));return chatHistory(db,client.roomId).filter(m=>!loaded.has(m.id))}
export function storeChat(db:ChatDatabase,client:ChatClient,body:string,requestId:string){
  if(!client.connected)throw Error('먼저 채팅방에 연결해 주세요.')
  if(!['lobby','design'].includes(client.roomId))throw Error('존재하지 않는 채팅방입니다.')
  if(!body.trim()||body.length>2000)throw Error('메시지는 1~2000자입니다.')
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(requestId))throw Error('요청 식별자가 올바르지 않습니다.')
  const previous=db.messages.find(m=>m.clientId===client.id&&m.requestId===requestId)
  if(previous){if(previous.roomId!==client.roomId)throw Error('다른 방에서 사용한 요청 ID입니다.');return {database:db,message:previous,duplicate:true}}
  const message:ChatMessage={id:db.nextId,roomId:client.roomId,clientId:client.id,requestId,sender:client.name,body:body.trim(),createdAt:new Date().toISOString()}
  return {database:{messages:[...db.messages,message],nextId:db.nextId+1},message,duplicate:false}
}
export function deliverChat(clients:ChatClient[],message:ChatMessage){return clients.map(c=>!c.connected||c.roomId!==message.roomId?c:{...c,messages:[...c.messages.filter(m=>m.id!==message.id),message].sort((a,b)=>a.id-b.id).slice(-100)})}
