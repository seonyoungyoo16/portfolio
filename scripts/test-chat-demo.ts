import assert from 'node:assert/strict'
import {emptyChat,storeChat,deliverChat,chatHistory,type ChatClient} from '../src/chat-demo.ts'
const client=(id:string,roomId='lobby',connected=true):ChatClient=>({id,name:id,roomId,connected,messages:[]})
const a=client('a'),b=client('b'),outside=client('c','design'),offline=client('d','lobby',false)
let db=emptyChat();const first=storeChat(db,a,'안녕하세요','request-1');db=first.database
const recipients=deliverChat([a,b,outside,offline],first.message)
assert.equal(recipients[0].messages.length,1);assert.equal(recipients[1].messages.length,1);assert.equal(recipients[2].messages.length,0);assert.equal(recipients[3].messages.length,0)
assert.equal(deliverChat(recipients,first.message)[1].messages.length,1)
const duplicate=storeChat(db,a,'재전송','request-1');assert.equal(duplicate.duplicate,true);assert.equal(duplicate.database.messages.length,1);assert.equal(duplicate.message.id,first.message.id)
assert.equal(chatHistory(db,'lobby')[0].id,first.message.id);assert.equal(chatHistory(db,'design').length,0)
assert.throws(()=>storeChat(db,offline,'메시지','r2'));assert.throws(()=>storeChat(db,a,'  ','r2'));assert.throws(()=>storeChat(db,a,'a'.repeat(2001),'r2'));assert.throws(()=>storeChat(db,{...a,roomId:'design'},'재전송','request-1'))
for(let i=0;i<105;i++)db=storeChat(db,a,'메시지 '+i,'batch-'+i).database
assert.equal(chatHistory(db,'lobby').length,100);assert.equal(chatHistory(db,'lobby').at(-1)?.id,106)
console.log('Chat demo: room isolation, offline exclusion, duplicate ACK, history and input rules passed.')
