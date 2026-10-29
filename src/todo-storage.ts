import { emptyTodo, validTodoState, type TodoState } from './todo-demo.ts';
export const TODO_STORAGE_KEY = 'portfolio:todo-lab:v1';
export type TodoStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readTodoState(storage: TodoStorage): TodoState {
  const raw = storage.getItem(TODO_STORAGE_KEY);
  if (raw === null) return emptyTodo();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw Error('체험 저장 내용을 읽지 못했어요. 원본은 유지했어요. 초기화하거나 저장 설정을 확인해주세요.'); }
  if (!validTodoState(value)) throw Error('체험 저장 형식이 달라요. 원본은 유지했어요. 초기화 후 다시 체험할 수 있어요.');
  return value;
}

export function commitTodoState(storage: TodoStorage, before: TodoState, next: TodoState): void {
  if (!validTodoState(next)) throw Error('체험 데이터 검증을 통과하지 못했어요.');
  if (JSON.stringify(readTodoState(storage)) !== JSON.stringify(before)) throw Error('다른 탭에서 체험이 바뀌었어요. 새로고침해 최신 목록을 확인해주세요.');
  try { storage.setItem(TODO_STORAGE_KEY, JSON.stringify(next)); }
  catch { throw Error('브라우저에 저장하지 못했어요. 입력과 기존 목록은 유지했어요. 저장 공간·사이트 권한을 확인한 뒤 다시 시도해주세요.'); }
}

export function resetTodoState(storage: TodoStorage): TodoState {
  storage.removeItem(TODO_STORAGE_KEY);
  return emptyTodo();
}
