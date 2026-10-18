import {storeChat,validateChatRequest,type ChatClient,type ChatDatabase,type ChatMessage,type DeliveryMode} from './chat-demo.ts'

export type PendingChat={clientId:string;roomId:string;requestId:string;body:string;mode?:DeliveryMode;failed?:boolean}
// Broadcast/history are not acknowledgements. Keep the original request until its ACK arrives.
export function enqueueChat(outbox:PendingChat[],request:PendingChat){
  return outbox.some(p=>p.clientId===request.clientId&&p.requestId===request.requestId)?outbox:[...outbox,request]
}
export function acknowledgeChat(outbox:PendingChat[],message:ChatMessage){
  return outbox.filter(p=>p.clientId!==message.clientId||p.requestId!==message.requestId||p.roomId!==message.roomId)
}
export function pendingFor(outbox:PendingChat[],clientId:string,roomId:string){return outbox.filter(p=>p.clientId===clientId&&p.roomId===roomId)}

// Before commit, the only durable copy is the client's pending request, never DB Outbox.
export function attemptChat(db:ChatDatabase,client:ChatClient,request:PendingChat,databaseRunning:boolean){
  validateChatRequest(client,request.body,request.requestId,request.mode||'direct')
  if(!databaseRunning)return {request:{...request,failed:true},saved:null}
  return {request,saved:storeChat(db,client,request.body,request.requestId,request.mode||'direct')}
}
