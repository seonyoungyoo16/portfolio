import type {ChatMessage,DeliveryMode} from './chat-demo'

export type PendingChat={clientId:string;roomId:string;requestId:string;body:string;mode?:DeliveryMode}
// Broadcast/history are not acknowledgements. Keep the original request until its ACK arrives.
export function enqueueChat(outbox:PendingChat[],request:PendingChat){
  return outbox.some(p=>p.clientId===request.clientId&&p.requestId===request.requestId)?outbox:[...outbox,request]
}
export function acknowledgeChat(outbox:PendingChat[],message:ChatMessage){
  return outbox.filter(p=>p.clientId!==message.clientId||p.requestId!==message.requestId||p.roomId!==message.roomId)
}
export function pendingFor(outbox:PendingChat[],clientId:string,roomId:string){return outbox.filter(p=>p.clientId===clientId&&p.roomId===roomId)}
