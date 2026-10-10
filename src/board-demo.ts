export type Rules = { titleMax: number; bodyMax: number; commentMax: number }
export type PostRow = { id: number; authorId: number; title: string; body: string; version: number; createdAt: string }
export type CommentRow = { id: number; postId: number; authorId: number; body: string; createdAt: string }
export type LikeRow = { id: number; postId: number; userId: number }
export type BoardState = { users: {id:number;displayName:string}[]; posts: PostRow[]; comments: CommentRow[]; likes: LikeRow[]; nextPost:number; nextComment:number; nextLike:number }
export type BoardAction =
  | {type:'create';title:string;body:string}
  | {type:'update';id:number;title:string;body:string;version:number}
  | {type:'delete';id:number}
  | {type:'comment';id:number;body:string}
  | {type:'commentUpdate';id:number;commentId:number;body:string}
  | {type:'commentDelete';id:number;commentId:number}
  | {type:'like'|'unlike';id:number}
export class BoardError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status} }
export function emptyBoard():BoardState{return {users:[{id:1,displayName:'데모 작성자'},{id:2,displayName:'데모 방문자'}],posts:[],comments:[],likes:[],nextPost:1,nextComment:1,nextLike:1}}
export function databaseRows(s:BoardState){return {
  app_users:s.users.map(u=>({id:u.id,display_name:u.displayName})),
  posts:s.posts.map(p=>({id:p.id,author_id:p.authorId,title:p.title,body:p.body,created_at:p.createdAt,version:p.version})),
  comments:s.comments.map(c=>({id:c.id,post_id:c.postId,author_id:c.authorId,body:c.body,created_at:c.createdAt})),
  post_likes:s.likes.map(l=>({id:l.id,post_id:l.postId,user_id:l.userId})),
}}
export function applyAction(state:BoardState,action:BoardAction,actor:number,rules:Rules):BoardState{
  const s=structuredClone(state)
  const missing=()=>{throw new BoardError(404,'대상을 찾을 수 없습니다.')}
  if(!s.users.some(u=>u.id===actor))missing()
  const valid=(value:string,max:number)=>{if(!value.trim()||value.length>max)throw new BoardError(400,`빈 값은 입력할 수 없으며 ${max}자까지 입력할 수 있습니다.`);return value.trim()}
  const owner=(id:number)=>{if(id!==actor)throw new BoardError(403,'작성자만 변경할 수 있습니다.')}
  if(action.type==='create'){s.posts.unshift({id:s.nextPost++,authorId:actor,title:valid(action.title,rules.titleMax),body:valid(action.body,rules.bodyMax),version:0,createdAt:new Date().toISOString()});return s}
  const p=s.posts.find(p=>p.id===action.id);if(!p)return missing()
  switch(action.type){
    case 'update':owner(p.authorId);if(p.version!==action.version)throw new BoardError(409,'글이 변경되었습니다. 다시 조회해 주세요.');p.title=valid(action.title,rules.titleMax);p.body=valid(action.body,rules.bodyMax);p.version++;break
    case 'delete':owner(p.authorId);s.comments=s.comments.filter(c=>c.postId!==p.id);s.likes=s.likes.filter(l=>l.postId!==p.id);s.posts=s.posts.filter(row=>row.id!==p.id);break
    case 'comment':s.comments.push({id:s.nextComment++,postId:p.id,authorId:actor,body:valid(action.body,rules.commentMax),createdAt:new Date().toISOString()});break
    case 'commentUpdate':case 'commentDelete':{const c=s.comments.find(c=>c.id===action.commentId&&c.postId===p.id);if(!c)return missing();owner(c.authorId);if(action.type==='commentUpdate')c.body=valid(action.body,rules.commentMax);else s.comments=s.comments.filter(row=>row.id!==c.id);break}
    case 'like':if(!s.likes.some(l=>l.postId===p.id&&l.userId===actor))s.likes.push({id:s.nextLike++,postId:p.id,userId:actor});break
    case 'unlike':s.likes=s.likes.filter(l=>!(l.postId===p.id&&l.userId===actor));break
  }
  return s
}
