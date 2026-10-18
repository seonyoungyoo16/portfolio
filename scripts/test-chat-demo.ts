import assert from 'node:assert/strict'
import {emptyChat,storeChat,deliverChat,chatHistory,waitingChat,readChat,hasReadChat,nextReadChat,type ChatClient} from '../src/chat-demo.ts'
import {relayChatTyping,cleanChatTyping,visibleChatTyping} from '../src/chat-typing.ts'
import {attemptChat,enqueueChat,acknowledgeChat,pendingFor,nextPendingChat,canCancelChat,cancelPendingChat,markChatAttempted,type PendingChat} from '../src/chat-outbox.ts'
const client=(id:string,roomId='lobby',connected=true):ChatClient=>({id,name:id,roomId,connected,viewOpen:true,messages:[]})
const a=client('a'),b=client('b'),outside=client('c','design'),offline=client('d','lobby',false)
let db=emptyChat();const first=storeChat(db,a,'안녕하세요','request-1');db=first.database
const recipients=deliverChat([a,b,outside,offline],first.message)
assert.equal(recipients[0].messages.length,1);assert.equal(recipients[1].messages.length,1);assert.equal(recipients[2].messages.length,0);assert.equal(recipients[3].messages.length,0)
assert.equal(deliverChat(recipients,first.message)[1].messages.length,1)
const duplicate=storeChat(db,a,'재전송','request-1');assert.equal(duplicate.duplicate,true);assert.equal(duplicate.database.messages.length,1);assert.equal(duplicate.message.id,first.message.id)
assert.equal(chatHistory(db,'lobby')[0].id,first.message.id);assert.equal(chatHistory(db,'design').length,0)
// Messages survive an offline interval; reconnect replaces history without duplication.
let asleep={...recipients[1],connected:false}
const duringSleep=storeChat(db,a,'오프라인 중 서버 보관','offline-1');db=duringSleep.database
assert.equal(deliverChat([asleep],duringSleep.message)[0].messages.length,1)
assert.equal(waitingChat(db,asleep).length,1)
assert.equal(waitingChat(db,outside).length,0)
assert.equal(waitingChat(storeChat(db,a,'중복','offline-1').database,asleep).length,1)
asleep={...asleep,connected:true,messages:chatHistory(db,asleep.roomId)}
assert.equal(waitingChat(db,asleep).length,0)
assert.equal(asleep.messages.at(-1)?.body,'오프라인 중 서버 보관')
assert.equal(hasReadChat(db.reads||[],duringSleep.message,b.id),false)
assert.equal(nextReadChat(db,asleep),duringSleep.message.id)
assert.equal(nextReadChat(db,{...asleep,connected:false}),0)
assert.throws(()=>readChat(db,{...asleep,connected:false},duringSleep.message.id))
assert.throws(()=>readChat(db,outside,duringSleep.message.id))
assert.throws(()=>readChat(db,{...asleep,messages:[]},duringSleep.message.id))
const closed={...recipients[1],viewOpen:false}
const closedDelivered=deliverChat([closed],duringSleep.message)[0]
assert.equal(closedDelivered.connected,true)
assert.equal(closedDelivered.viewOpen,false)
assert.equal(closedDelivered.messages.length,2)
assert.equal(nextReadChat(db,closedDelivered),0)
assert.equal(hasReadChat(db.reads||[],duringSleep.message,closedDelivered.id),false)
assert.throws(()=>readChat(db,closedDelivered,duringSleep.message.id))
assert.equal(nextReadChat(db,{...closedDelivered,viewOpen:true}),duringSleep.message.id)
db=readChat(db,asleep,duringSleep.message.id)
assert.equal(hasReadChat(db.reads||[],duringSleep.message,b.id),true)
assert.equal(hasReadChat(db.reads||[],duringSleep.message,'other'),false)
assert.equal(nextReadChat(db,asleep),0)
assert.deepEqual(readChat(db,asleep,first.message.id).reads,db.reads)
assert.equal(storeChat(db,a,'중복','offline-1').database.reads?.[0].lastReadId,duringSleep.message.id)
assert.equal(JSON.parse(JSON.stringify(db)).reads[0].lastReadId,duringSleep.message.id)
assert.throws(()=>storeChat(db,offline,'메시지','r2'));assert.throws(()=>storeChat(db,a,'  ','r2'));assert.throws(()=>storeChat(db,a,'a'.repeat(2001),'r2'));assert.throws(()=>storeChat(db,{...a,roomId:'design'},'재전송','request-1'))
for(let i=0;i<105;i++)db=storeChat(db,a,'메시지 '+i,'batch-'+i).database
assert.equal(chatHistory(db,'lobby').length,100);assert.equal(chatHistory(db,'lobby').at(-1)?.id,107)
console.log('Chat demo: room isolation, offline exclusion, duplicate ACK, history and input rules passed.')
const typing=relayChatTyping([], [a,b,outside,offline],0,true,1000)
assert.deepEqual(visibleChatTyping(typing,b,1000),[a.name])
assert.deepEqual(visibleChatTyping(typing,a,1000),[])
assert.deepEqual(visibleChatTyping(typing,outside,1000),[])
assert.deepEqual(visibleChatTyping(typing,{...b,viewOpen:false},1000),[])
assert.deepEqual(visibleChatTyping(typing,b,5000),[])
assert.equal(relayChatTyping(typing,[a,b],0,true,2000).length,1)
assert.equal(relayChatTyping(typing,[a,b],0,false,2000).length,0)
assert.equal(cleanChatTyping(typing,[{...a,viewOpen:false},b],1100).length,0)
assert.equal(cleanChatTyping(typing,[a,{...b,connected:false}],1100).length,0)
assert.equal(cleanChatTyping(typing,[a,{...b,roomId:'design'}],1100).length,0)
assert.equal(cleanChatTyping(typing,[a,b],5000).length,0)
assert.equal(db.messages.length,107)
console.log('Typing: same-room relay, sender exclusion, closed/offline states, refresh, stop and expiry passed.')

// Commit succeeded but the sender lost its socket before receiving ACK.
let retryDb=emptyChat(),outbox:PendingChat[]=[]
const request={clientId:a.id,roomId:a.roomId,requestId:'lost-ack',body:'전송 중 끊김'}
outbox=enqueueChat(outbox,request)
outbox=enqueueChat(outbox,request)
assert.equal(outbox.length,1)
const saved=storeChat(retryDb,a,request.body,request.requestId);retryDb=saved.database
const broadcast=deliverChat([a,b],saved.message)
assert.equal(pendingFor(outbox,a.id,'lobby').length,1)
assert.equal(pendingFor(outbox,b.id,'lobby').length,0)
assert.equal(pendingFor(outbox,a.id,'design').length,0)
// Reload and history delivery still do not acknowledge a request.
outbox=JSON.parse(JSON.stringify(outbox))
const rejoined={...a,messages:chatHistory(retryDb,a.roomId)}
const retryJob=storeChat(retryDb,rejoined,outbox[0].body,outbox[0].requestId)
assert.equal(retryJob.duplicate,true)
assert.equal(retryJob.database.messages.length,1)
assert.equal(retryJob.database.nextId,2)
assert.equal(retryJob.message.id,saved.message.id)
assert.equal(broadcast[1].messages.length,1)
assert.equal(deliverChat(broadcast,retryJob.message)[1].messages.length,1)
assert.equal(acknowledgeChat(outbox,{...retryJob.message,clientId:b.id}).length,1)
assert.equal(acknowledgeChat(outbox,{...retryJob.message,roomId:'design'}).length,1)
assert.equal(acknowledgeChat(outbox,{...retryJob.message,requestId:'other'}).length,1)
outbox=acknowledgeChat(outbox,retryJob.message)
assert.equal(outbox.length,0)
console.log('Lost ACK: pending survives broadcast/history/reload, retry keeps original ID and one row, matching ACK clears pending.')

// Route selection, durable outbox, paused consumer and independent read cursors.
const {publishChatEvent,consumeChatEvent,nextDelivery,deliveryStats}=await import('../src/chat-delivery.ts')
let brokerDb=emptyChat();const queuedIds:number[]=[]
for(let i=0;i<3;i++){const job=storeChat(brokerDb,a,'Kafka 대기 '+i,'kafka-'+i,'kafka');brokerDb=job.database;queuedIds.push(job.message.id)}
assert.deepEqual(deliveryStats(brokerDb),{outbox:3,queued:0,processed:0})
assert.throws(()=>consumeChatEvent(brokerDb,queuedIds[0]))
for(const id of queuedIds)brokerDb=publishChatEvent(brokerDb,id)
assert.deepEqual(deliveryStats(brokerDb),{outbox:0,queued:3,processed:0})
assert.deepEqual(brokerDb.kafkaEvents?.map(e=>e.offset),[0,1,2])
assert.deepEqual(publishChatEvent(brokerDb,queuedIds[0]),brokerDb)
assert.equal(storeChat(brokerDb,a,'Kafka 대기 0','kafka-0','kafka').database.kafkaEvents?.length,3)
const immediate=storeChat(brokerDb,a,'Consumer 중단 중 직접 전달','direct-later','direct');brokerDb=immediate.database
let viewer=deliverChat([b],immediate.message)[0]
assert.equal(viewer.messages.length,1)
brokerDb=readChat(brokerDb,viewer,immediate.message.id)
assert.equal(hasReadChat(brokerDb.reads||[],brokerDb.messages[0],b.id),false)
for(const id of queuedIds){assert.equal(nextDelivery(brokerDb)?.messageId,id);viewer=deliverChat([viewer],brokerDb.messages.find(m=>m.id===id)!)[0];brokerDb=consumeChatEvent(brokerDb,id)}
assert.equal(viewer.messages.length,4)
assert.equal(nextReadChat(brokerDb,viewer),queuedIds[2])
brokerDb=readChat(brokerDb,viewer,queuedIds[2])
assert.equal(hasReadChat(brokerDb.reads||[],brokerDb.messages[0],b.id),true)
assert.equal(hasReadChat(brokerDb.reads||[],immediate.message,b.id),true)
assert.equal(nextReadChat(brokerDb,viewer),0)
assert.equal(deliverChat([viewer],brokerDb.messages[0])[0].messages.length,4)
assert.deepEqual(deliveryStats(brokerDb),{outbox:0,queued:0,processed:3})
assert.equal(nextDelivery(brokerDb),undefined)
const secondRoom=storeChat(brokerDb,outside,'다른 방','other-room','kafka');const otherPartition=publishChatEvent(secondRoom.database,secondRoom.message.id)
assert.equal(otherPartition.kafkaEvents?.at(-1)?.partition,1)
assert.equal(otherPartition.kafkaEvents?.at(-1)?.offset,0)
assert.equal(deliverChat([viewer],secondRoom.message)[0].messages.length,4)
assert.equal(JSON.parse(JSON.stringify(otherPartition)).kafkaEvents.at(-1).published,true)
console.log('Kafka demo: route selection, atomic outbox, accumulation, ordered drain, room isolation, dedup and route-scoped reads passed.')

// Broker outage is independent of worker availability: unpublished rows stay in Outbox.
let outageDb=emptyChat()
const outageA=storeChat(outageDb,a,'브로커 중단 중 보관 1','broker-down-1','kafka');outageDb=outageA.database
const outageB=storeChat(outageDb,a,'브로커 중단 중 보관 2','broker-down-2','kafka');outageDb=outageB.database
for(const id of [outageA.message.id,outageB.message.id])outageDb=publishChatEvent(outageDb,id,false)
assert.deepEqual(deliveryStats(outageDb),{outbox:2,queued:0,processed:0})
assert.ok(outageDb.kafkaEvents!.every(event=>event.offset===null&&!event.published))
assert.equal(nextDelivery(outageDb,false),undefined)
assert.equal(storeChat(outageDb,a,outageA.message.body,'broker-down-1','kafka').database.kafkaEvents?.length,2)
// A reload retains the DB rows; broker recovery publishes original IDs and appends offsets once.
outageDb=JSON.parse(JSON.stringify(outageDb))
for(const id of [outageA.message.id,outageB.message.id])outageDb=publishChatEvent(outageDb,id,true)
assert.deepEqual(deliveryStats(outageDb),{outbox:0,queued:2,processed:0})
assert.equal(nextDelivery(outageDb,false),undefined)
assert.equal(nextDelivery(outageDb,true)?.messageId,outageA.message.id)
assert.deepEqual(publishChatEvent(outageDb,outageA.message.id,true),outageDb)
let recoveredClients=[a,b,outside]
for(const id of [outageA.message.id,outageB.message.id]){recoveredClients=deliverChat(recoveredClients,outageDb.messages.find(m=>m.id===id)!);outageDb=consumeChatEvent(outageDb,id)}
assert.equal(recoveredClients[1].messages.length,2)
assert.equal(recoveredClients[2].messages.length,0)
assert.deepEqual(deliveryStats(outageDb),{outbox:0,queued:0,processed:2})
assert.equal(outageDb.messages.length,2)
assert.deepEqual(outageDb.kafkaEvents!.map(e=>e.offset),[0,1])
console.log('Broker outage: Outbox retention, null offsets, reload recovery, original IDs, independent consume gate and single delivery passed.')

// DB failure must leave only a client request: no reserved server ID, message or DB Outbox.
for(const mode of ['direct','kafka'] as const){
  const original=emptyChat(),request:PendingChat={clientId:a.id,roomId:a.roomId,requestId:'db-recover-'+mode,body:'DB 복구 확인',mode}
  const failed=attemptChat(original,a,request,false)
  assert.equal(failed.saved,null);assert.equal(failed.request.failed,true)
  assert.deepEqual(original,emptyChat())
  let pending=enqueueChat([],failed.request)
  const restored=JSON.parse(JSON.stringify(pending)) as PendingChat[]
  const retry=attemptChat(original,a,restored[0],true).saved!
  assert.equal(retry.message.requestId,request.requestId);assert.equal(retry.message.deliveryMode,mode)
  assert.equal(retry.database.messages.length,1);assert.equal(retry.database.kafkaEvents?.length||0,mode==='kafka'?1:0)
  const duplicate=attemptChat(retry.database,a,restored[0],true).saved!
  assert.equal(duplicate.duplicate,true);assert.equal(duplicate.message.id,retry.message.id)
  assert.equal(duplicate.database.messages.length,1)
  pending=acknowledgeChat(pending,retry.message);assert.equal(pending.length,0)
  let peers=deliverChat([a,b],retry.message);peers=deliverChat(peers,duplicate.message)
  assert.equal(peers[1].messages.length,1)
}
assert.throws(()=>attemptChat(emptyChat(),a,{clientId:a.id,roomId:a.roomId,requestId:'bad-request',body:'',mode:'direct'},false))
console.log('DB outage: no write/ID/Outbox before recovery, persisted original request, both routes and one stored/delivered message passed.')

// Multi-message recovery: keep insertion order and resume the unacknowledged head after a second outage.
for(const mode of ['direct','kafka'] as const){
  let database=emptyChat(),pending:PendingChat[]=[],peers=[a,b,outside],accepted:string[]=[]
  const requests=Array.from({length:4},(_,i)=>({clientId:a.id,roomId:a.roomId,requestId:'fifo-'+mode+'-'+i,body:'대기 '+i,mode}))
  for(const request of requests.slice(0,3))pending=enqueueChat(pending,attemptChat(database,a,request,false).request)
  assert.equal(database.messages.length,0);pending=JSON.parse(JSON.stringify(pending))
  let next=nextPendingChat(pending,peers)!
  const committed=storeChat(database,peers[next.actor],next.request.body,next.request.requestId,next.request.mode);database=committed.database
  // Lost ACK: head remains; append another request while it is pending.
  pending=enqueueChat(pending,{...requests[3],queued:true})
  assert.equal(nextPendingChat(pending,peers)!.request.requestId,requests[0].requestId)
  while(pending.length){
    next=nextPendingChat(pending,peers)!
    const saved=storeChat(database,peers[next.actor],next.request.body,next.request.requestId,next.request.mode);database=saved.database
    accepted.push(saved.message.requestId);pending=acknowledgeChat(pending,saved.message)
    if(mode==='direct')peers=deliverChat(peers,saved.message)
    else database=publishChatEvent(database,saved.message.id)
    if(accepted.length===1){ // Another DB outage must not skip/recreate the second request.
      const head=nextPendingChat(pending,peers)!.request
      assert.equal(attemptChat(database,a,head,false).saved,null)
      assert.equal(nextPendingChat(pending,peers)!.request.requestId,requests[1].requestId)
    }
  }
  if(mode==='kafka')for(let event=nextDelivery(database);event;event=nextDelivery(database)){
    peers=deliverChat(peers,database.messages.find(m=>m.id===event.messageId)!);database=consumeChatEvent(database,event.messageId)
  }
  assert.deepEqual(accepted,requests.map(r=>r.requestId));assert.equal(database.messages.length,4)
  assert.deepEqual(peers[1].messages.map(m=>m.requestId),requests.map(r=>r.requestId));assert.equal(peers[2].messages.length,0)
  for(const request of requests)assert.equal(storeChat(database,a,request.body,request.requestId,request.mode).duplicate,true)
}
// Eligible requests follow enqueue order across A/B rather than prioritizing participant A.
const fairQueue:PendingChat[]=[{clientId:b.id,roomId:b.roomId,requestId:'b-first',body:'B 먼저'},{clientId:a.id,roomId:a.roomId,requestId:'a-second',body:'A 다음'}]
assert.equal(nextPendingChat(fairQueue,[a,b])!.actor,1)
assert.equal(nextPendingChat(fairQueue,[a,{...b,connected:false}])!.actor,0)
console.log('Multiple pending: FIFO original IDs, enqueue during send, lost ACK, second outage, both delivery routes and one delivery per message passed.')

for(const mode of ['direct','kafka'] as const){
  let database=emptyChat(),peers=[a,b,outside]
  const requests:PendingChat[]=[1,2,3,4].map(n=>({clientId:a.id,roomId:a.roomId,requestId:'cancel-'+mode+'-'+n,body:'취소 테스트 '+n,mode,cancelable:true}))
  let pending=requests.map(request=>attemptChat(database,a,request,false).request)
  pending=cancelPendingChat(pending,requests[1]);pending=JSON.parse(JSON.stringify(pending))
  assert.deepEqual(pending.map(r=>r.requestId),[requests[0],requests[2],requests[3]].map(r=>r.requestId))
  assert.equal(cancelPendingChat(pending,requests[1]),pending)
  assert.equal(cancelPendingChat(pending,{...requests[0],clientId:b.id}),pending)
  assert.equal(cancelPendingChat(pending,requests[0],requests[0]),pending)
  assert.equal(canCancelChat({...requests[0],cancelable:undefined}),false)
  let next=nextPendingChat(pending,peers)!,saved=storeChat(database,a,next.request.body,next.request.requestId,mode)
  pending=markChatAttempted(pending,next.request);database=saved.database
  // A persisted but unacknowledged request must remain non-cancelable after reload.
  pending=JSON.parse(JSON.stringify(pending));assert.equal(canCancelChat(pending[0]),false)
  assert.equal(cancelPendingChat(pending,pending[0]),pending)
  saved=storeChat(database,a,next.request.body,next.request.requestId,mode);assert.equal(saved.duplicate,true)
  for(const request of [...pending]){
    saved=storeChat(database,a,request.body,request.requestId,mode);database=saved.database
    pending=acknowledgeChat(pending,saved.message)
    if(mode==='direct')peers=deliverChat(peers,saved.message);else database=publishChatEvent(database,saved.message.id)
  }
  if(mode==='kafka')for(let event=nextDelivery(database);event;event=nextDelivery(database)){peers=deliverChat(peers,database.messages.find(m=>m.id===event.messageId)!);database=consumeChatEvent(database,event.messageId)}
  const expected=[requests[0],requests[2],requests[3]].map(r=>r.requestId)
  assert.deepEqual(database.messages.map(m=>m.requestId),expected);assert.deepEqual(peers[1].messages.map(m=>m.requestId),expected)
  assert.equal(database.messages.some(m=>m.requestId===requests[1].requestId),false);assert.equal(pending.length,0)
  let all=[...requests];for(const request of requests)all=cancelPendingChat(all,request);assert.equal(nextPendingChat(all,peers),null)
}
console.log('Canceled pending: no replay/write/delivery, original survivor IDs/order, all cancel, scoped identity and persisted in-flight guard passed.')
