import type {ChatClient} from './chat-demo.ts'
export const typingTtl=4000
export type TypingNotice={senderId:string;recipientId:string;roomId:string;name:string;expiresAt:number}
export function relayChatTyping(previous:TypingNotice[],clients:ChatClient[],actor:number,active:boolean,now:number){
  const source=clients[actor],others=previous.filter(notice=>notice.senderId!==source.id)
  if(!active||!source.connected||!source.viewOpen)return others
  return [...others,...clients.filter(peer=>peer.connected&&peer.id!==source.id&&peer.roomId===source.roomId).map(peer=>({senderId:source.id,recipientId:peer.id,roomId:source.roomId,name:source.name,expiresAt:now+typingTtl}))]
}
export function cleanChatTyping(notices:TypingNotice[],clients:ChatClient[],now:number){return notices.filter(notice=>{const from=clients.find(c=>c.id===notice.senderId),to=clients.find(c=>c.id===notice.recipientId);return notice.expiresAt>now&&from?.connected&&from.viewOpen&&to?.connected&&from.roomId===notice.roomId&&to.roomId===notice.roomId})}
export function visibleChatTyping(notices:TypingNotice[],client:ChatClient,now:number){return client.connected&&client.viewOpen?notices.filter(notice=>notice.recipientId===client.id&&notice.roomId===client.roomId&&notice.expiresAt>now).map(notice=>notice.name):[]}
