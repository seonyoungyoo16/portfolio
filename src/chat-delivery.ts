import type {ChatDatabase} from './chat-demo'

export function publishChatEvent(db:ChatDatabase,messageId:number,brokerRunning=true):ChatDatabase{
  if(!brokerRunning)return db
  const event=db.kafkaEvents?.find(e=>e.messageId===messageId)
  if(!event||event.published)return db
  const offset=Math.max(-1,...(db.kafkaEvents||[]).filter(e=>e.partition===event.partition&&e.published).map(e=>e.offset??-1))+1
  return {...db,kafkaEvents:db.kafkaEvents!.map(e=>e.messageId===messageId?{...e,published:true,offset}:e)}
}
export function nextDelivery(db:ChatDatabase,brokerRunning=true){return brokerRunning?(db.kafkaEvents||[]).filter(e=>e.published&&!e.consumed).sort((a,b)=>a.messageId-b.messageId)[0]:undefined}
export function consumeChatEvent(db:ChatDatabase,messageId:number):ChatDatabase{
  if(!db.kafkaEvents?.some(e=>e.messageId===messageId&&e.published))throw Error('Kafka에 기록된 이벤트만 처리할 수 있습니다.')
  return {...db,kafkaEvents:db.kafkaEvents.map(e=>e.messageId===messageId?{...e,consumed:true}:e)}
}
export function deliveryStats(db:ChatDatabase){
  const events=db.kafkaEvents||[]
  return {outbox:events.filter(e=>!e.published).length,queued:events.filter(e=>e.published&&!e.consumed).length,processed:events.filter(e=>e.consumed).length}
}
