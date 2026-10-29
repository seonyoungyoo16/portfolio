import { prepareTodoAction, todoTimeline, type TodoAction, type TodoState } from './todo-demo.ts';
import { commitTodoState, type TodoStorage } from './todo-storage.ts';
export type TodoNode = 'input' | 'react' | 'storage' | 'view';
export type TodoFrame = { title: string; detail: string; path: TodoNode[]; source: string; original: 'add' | 'plan' | 'schedule' | 'save' | 'complete' | 'editor'; state: TodoState; failed?: boolean };
export type TodoRun = { frames: TodoFrame[]; after: TodoState; ok: boolean; message: string; action: string };

export function performTodoAction(before: TodoState, action: TodoAction, storage: TodoStorage): TodoRun {
  const original = action.kind === 'add' ? 'add' : action.kind === 'schedule' ? 'editor' : 'complete';
  const target = before.tasks.find(t => t.id === action.id);
  const label = action.kind === 'add' ? '할 일 추가' : action.kind === 'schedule' ? `「${target?.title || '선택한 할 일'}」 시간표에 배치` : `「${target?.title || '선택한 할 일'}」 ${target?.done ? '완료 취소' : '완료하기'}`;
  const actionLabel = action.kind === 'add' ? `「${action.title.trim() || '빈 제목'}」 할 일 추가` : label;
  const frames: TodoFrame[] = [{ title: '사용자 행동 접수', detail: '이 페이지의 React 이벤트가 입력을 받았습니다. 서버 요청은 보내지 않습니다.', path: ['input','react'], source: 'render', original, state: before }];
  let after = before;
  let phase: 'validate' | 'save' = 'validate';
  try {
    const candidate = prepareTodoAction(before, action);
    frames.push({ title: '입력 검증과 다음 상태 계산', detail: action.kind === 'schedule' ? '작업·여유 합계와 당일 종료를 검증했습니다. 아직 저장 전입니다.' : '대상과 중복 규칙을 검증했습니다. 아직 저장 전입니다.', path: ['react'], source: 'prepare', original, state: before });
    phase = 'save';
    commitTodoState(storage, before, candidate);
    after = candidate;
    frames.push({ title: '브라우저 저장 완료', detail: '최신 내용 비교 후 전용 localStorage 키에 저장했습니다. oddk 본 앱의 데이터는 바꾸지 않습니다.', path: ['react','storage','react'], source: 'commit', original: 'save', state: after });
    const layout = todoTimeline(after);
    frames.push({ title: '목록·시간표 계산', detail: `진행 중인 시간 블록 ${layout.items.length}개. 겹침은 원본 layoutTimeline 함수로 계산합니다.`, path: ['react','view'], source: 'timeline', original: 'schedule', state: after });
    frames.push({ title: '화면에 결과 반영', detail: '같은 ID의 할 일과 완료 상태를 목록·시간표에 반영합니다. 이 단계 다시보기는 저장을 반복하지 않습니다.', path: ['view'], source: 'render', original, state: after });
    return { frames, after, ok: true, message: action.kind === 'add' ? '할 일을 추가했어요. 아래에서 시간을 정해보세요.' : action.kind === 'schedule' ? '시간표에 배치했어요. 목록의 체크박스로 완료해보세요.' : '완료 상태를 바꿨어요. 목록과 진행 중인 시간표를 함께 확인하세요.', action: actionLabel };
  } catch (error) {
    const message = error instanceof Error ? error.message : '처리하지 못했어요. 입력과 저장 설정을 확인해주세요.';
    frames.push({ title: phase === 'save' ? '저장 실패 · 화면 변경 보류' : '입력 검증에서 중단', detail: message, path: phase === 'save' ? ['react','storage'] : ['react'], source: phase === 'save' ? 'commit' : 'prepare', original: phase === 'save' ? 'save' : original, state: before, failed: true });
    return { frames, after, ok: false, message, action: actionLabel };
  }
}
