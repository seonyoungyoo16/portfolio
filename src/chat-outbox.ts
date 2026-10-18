import {storeChat,validateChatRequest,type ChatClient,type ChatDatabase,type ChatMessage,type DeliveryMode} from './chat-demo.ts'

export type PendingChat={clientId:string;roomId:string;requestId:string;body:string;mode?:DeliveryMode;failed?:boolean;queued?:boolean;cut?:boolean;cancelable?:boolean}
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

// Stable array order is the send order; a broadcast or unrelated ACK cannot advance it.
export function nextPendingChat(outbox:PendingChat[],clients:ChatClient[]){
  for(const request of outbox){
    const actor=clients.findIndex(c=>c.connected&&c.id===request.clientId&&c.roomId===request.roomId)
    if(actor>=0)return {request,actor}
  }
  return null
}

// Only an explicitly unsent request (or confirmed rolled-back write) can be canceled.
export function canCancelChat(request:PendingChat,activeRequest?:PendingChat|null){
  return request.cancelable===true&&!(activeRequest&&activeRequest.clientId===request.clientId&&activeRequest.roomId===request.roomId&&activeRequest.requestId===request.requestId)
}
export function cancelPendingChat(outbox:PendingChat[],request:PendingChat,activeRequest?:PendingChat|null){
  const current=outbox.find(p=>p.clientId===request.clientId&&p.roomId===request.roomId&&p.requestId===request.requestId)
  if(!current||!canCancelChat(current,activeRequest))return outbox
  return outbox.filter(p=>p!==current)
}
export function markChatAttempted(outbox:PendingChat[],request:PendingChat){
  return outbox.map(p=>p.clientId===request.clientId&&p.roomId===request.roomId&&p.requestId===request.requestId?{...p,cancelable:false}:p)
}
