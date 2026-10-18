import fs from 'node:fs'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const model=JSON.parse(fs.readFileSync('src/generated/chat-source.json','utf8'))
const root=process.argv[2]||'../springboot-chat-lab'
const sources=new Map(model.sources.map(source=>{
  const content=execFileSync('git',['show',model.revision+':'+source.file],{cwd:root,encoding:'utf8'}).replace(/\r\n/g,'\n')
  assert.equal(crypto.createHash('sha256').update(content).digest('hex'),source.sha256,source.file)
  return [source.file,content]
}))
let count=0
for(const [flow,steps] of Object.entries(model.flows))for(const step of steps){
  const lines=sources.get(step.file).split('\n')
  assert.deepEqual(lines.slice(step.line-1,step.line-1+step.lines.length),step.lines,flow+' snippet at '+step.file)
  assert.ok(step.lines.join('\n').includes(step.highlight),flow+' highlight missing')
  count++
}
assert.ok(sources.get('src/main/java/dev/portfolio/chat/SocketConfig.java').includes('addHandler(socket, "/ws/chat")'))
assert.deepEqual(model.flows.join.slice(0,3).map(step=>step.highlight),['const ws=new WebSocket','ws.onopen=',"ws.send(JSON.stringify({type:'join'"])
assert.equal(model.flows.disconnect[0].highlight,'socket?.close();socket=null')
assert.equal(model.flows.read.length,5)
assert.equal(model.flows.typing.length,4)
assert.equal(model.flows.interrupted.length,7)
assert.equal(model.flows.retry.length,7)
assert.equal(model.flows.kafkaSend.length,7)
assert.equal(model.flows.kafkaDeliver.length,5)
assert.equal(model.flows.kafkaPublish.length,2)
assert.equal(model.flows.kafkaUnavailable.length,7)
assert.ok(model.flows.kafkaUnavailable[5].highlight.includes('if(!brokerRunning)'))
assert.ok(model.flows.kafkaUnavailable[6].highlight.includes('Keep unpublished Outbox rows'))
assert.ok(model.flows.kafkaSend[3].highlight.includes('INSERT INTO chat_outbox'))
assert.ok(model.flows.kafkaSend[5].highlight.includes('kafka.send'))
assert.ok(sources.get('src/main/java/dev/portfolio/chat/KafkaDelivery.java').includes('if(brokerRunning&&workerRunning&&service.databaseRunning())consumer.resume();else consumer.pause();'))
assert.ok(model.flows.interrupted.at(-1).highlight.includes('interruptBeforeAck'))
assert.ok(model.flows.retry.at(-1).highlight.includes('pending=remaining; // Matching ACK'))
assert.ok(model.flows.typing.every(step=>step.node!=='database'))
assert.ok(sources.get('src/main/java/dev/portfolio/chat/ChatSocket.java').includes('peer.clientId().equals(source.clientId())'))
assert.ok(sources.get('src/main/resources/schema.sql').includes('PRIMARY KEY(room_id, client_id)'))
assert.ok(sources.get('src/main/java/dev/portfolio/chat/ChatService.java').includes('GREATEST(last_read_id, ?)'))
console.log('Verified '+count+' source steps and '+sources.size+' file hashes at '+model.revision)

assert.equal(model.flows.databaseUnavailable.length,4)
assert.equal(model.flows.databaseRetry.length,7)
assert.equal(model.flows.databaseRetryKafka.length,7)
assert.equal(model.flows.databaseRetryOutbox.length,7)
assert.ok(model.flows.databaseUnavailable[2].highlight.includes('DB_UNAVAILABLE'))
assert.ok(sources.get('src/main/java/dev/portfolio/chat/ChatSocket.java').includes('TransactionPhase.AFTER_COMMIT'))

assert.ok(sources.get('src/main/resources/static/chat-queue.js').includes('if (this.inFlight) return null'))
assert.ok(sources.get('src/main/resources/static/chat.js').includes('store();render();flush();'))

assert.equal(model.flows.cancel.length,3)
assert.ok(model.flows.cancel.every(step=>step.node==='sender'))
assert.ok(model.flows.cancel[1].highlight.includes('Cancellation preserves'))
assert.ok(sources.get('src/main/resources/static/chat-queue.js').includes('request.cancelable = false'))

assert.equal(model.flows.requeue.length,3)
assert.ok(model.flows.requeue.every(step=>step.node==='sender'))
assert.ok(model.flows.requeue[0].highlight.includes('New identity'))
assert.ok(model.flows.requeue[1].highlight.includes('tail'))
