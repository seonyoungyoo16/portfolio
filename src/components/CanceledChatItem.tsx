import {useState} from 'react'
import type {CanceledChat} from '../chat-outbox'

type Props={request:CanceledChat;clientName:string;position:number;bodyMax:number;onResend:(body:string)=>void}

export default function CanceledChatItem({request,clientName,position,bodyMax,onResend}:Props){
  const [body,setBody]=useState(request.body)
  const invalid=!body.trim()||body.trim().length>bodyMax
  const label=clientName+' 취소 메시지 '+(position+1)
  const hintId='requeue-hint-'+request.clientId+'-'+request.requestId
  return <li>
    <b>{request.requeuedAs?'취소한 ID · 새 요청으로 다시 보냄':'취소됨 · 서버 전송 없음'}</b>
    <p>{request.body}</p>
    <small>이전 요청 ID</small><code data-request-role="old">{request.requestId}</code>
    {request.requeuedAs?<>
      <small>다시 보낸 내용</small><p className="chat-requeued-body">{request.requeuedBody??request.body}</p>
      <small>다시 보낸 새 ID</small><code data-request-role="new">{request.requeuedAs}</code>
      <button type="button" className="chat-text-action chat-requeue-action" aria-label={label+' 다시 보내기'} disabled>대기열에 다시 추가됨</button>
    </>:<form className="chat-requeue-editor" onSubmit={event=>{event.preventDefault();if(!invalid)onResend(body)}}>
      <label><span>다시 보낼 내용</span><textarea aria-label={label+' 다시 보낼 내용'} aria-describedby={hintId} aria-invalid={invalid||undefined} value={body} maxLength={bodyMax} rows={2} onChange={event=>setBody(event.target.value)}/></label>
      <small id={hintId}>{invalid?'메시지는 1~'+bodyMax+'자입니다.':'수정한 내용은 새 ID로 맨 뒤에 추가합니다.'} <span>{body.length.toLocaleString()} / {bodyMax.toLocaleString()}자</span></small>
      <button type="submit" className="chat-text-action chat-requeue-action" aria-label={label+' 다시 보내기'} disabled={invalid}>다시 보내기</button>
    </form>}
  </li>
}
