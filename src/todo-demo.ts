import { clockMinutes, layoutTimeline } from './generated/todo-timeline.ts';

export type TodoTask = { id: string; title: string; startTime: string | null; minutes: number | null; bufferMinutes: number | null; done: boolean };
export type TodoState = { schemaVersion: 1; revision: number; tasks: TodoTask[] };
export type TodoAction = { kind: 'add'; title: string; id: string } | { kind: 'schedule'; id: string; start: string; work: string; buffer: string } | { kind: 'complete'; id: string };
export const emptyTodo = (): TodoState => ({ schemaVersion: 1, revision: 0, tasks: [] });
const titleKey = (title: string) => title.trim().normalize('NFC').toLocaleLowerCase();
const clockValid = (clock: unknown): clock is string => typeof clock === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(clock);

export function validTodoState(value: unknown): value is TodoState {
  if (!value || typeof value !== 'object') return false;
  const v = value as TodoState;
  if (v.schemaVersion !== 1 || !Number.isSafeInteger(v.revision) || v.revision < 0 || !Array.isArray(v.tasks) || v.tasks.length > 40) return false;
  if (new Set(v.tasks.map(t => t?.id)).size !== v.tasks.length) return false;
  return v.tasks.every(t => t && typeof t.id === 'string' && t.id.length > 0 && t.id.length <= 80 && typeof t.title === 'string' && t.title.trim().length > 0 && t.title.length <= 120 && typeof t.done === 'boolean' &&
    ((t.startTime === null && t.minutes === null && t.bufferMinutes === null) || (clockValid(t.startTime) && Number.isInteger(t.minutes) && t.minutes! >= 2 && t.minutes! <= 240 && Number.isInteger(t.bufferMinutes) && t.bufferMinutes! >= 1 && t.bufferMinutes! < t.minutes! && clockMinutes(t.startTime) + t.minutes! <= 1440)));
}

export function prepareTodoAction(state: TodoState, action: TodoAction): TodoState {
  if (!validTodoState(state) || state.revision >= Number.MAX_SAFE_INTEGER) throw Error('체험 데이터가 바뀌었어요. 새로고침 후 확인해주세요.');
  let tasks: TodoTask[];
  if (action.kind === 'add') {
    const title = action.title.trim();
    if (!title || title.length > 120) throw Error('할 일을 1~120자로 입력해주세요.');
    if (state.tasks.length >= 40) throw Error('체험은 40개까지 보관합니다. 처음부터 체험하거나 oddk 앱을 열어주세요.');
    if (!action.id || state.tasks.some(t => t.id === action.id)) throw Error('같은 등록 요청은 한 번만 처리할 수 있어요.');
    if (state.tasks.some(t => !t.done && t.startTime === null && titleKey(t.title) === titleKey(title))) throw Error('이미 시간 미설정 목록에 있는 할 일이에요. 기존 항목을 선택해주세요.');
    tasks = [...state.tasks, { id: action.id, title, startTime: null, minutes: null, bufferMinutes: null, done: false }];
  } else {
    const current = state.tasks.find(t => t.id === action.id);
    if (!current) throw Error('목록에서 할 일을 먼저 선택해주세요.');
    let next: TodoTask;
    if (action.kind === 'schedule') {
      if (current.done) throw Error('완료를 취소한 다음 시간을 배치해주세요.');
      const work = Number(action.work), buffer = Number(action.buffer), minutes = work + buffer;
      if (!action.work.trim() || !action.buffer.trim() || !Number.isInteger(work) || work < 1 || !Number.isInteger(buffer) || buffer < 1 || minutes > 240) throw Error('작업·여유를 각각 1분 이상, 합계 240분 이하의 정수로 입력해주세요.');
      if (!clockValid(action.start)) throw Error('시작 시각을 올바르게 입력해주세요.');
      if (clockMinutes(action.start) + minutes > 1440) throw Error('이 체험은 당일 시간표입니다. 자정 이전에 끝나도록 배치해주세요.');
      next = { ...current, startTime: action.start, minutes, bufferMinutes: buffer };
    } else next = { ...current, done: !current.done };
    if (!next.done && state.tasks.some(t => t.id !== current.id && !t.done && t.startTime === next.startTime && titleKey(t.title) === titleKey(next.title))) throw Error('같은 제목과 시작 시각의 진행 중인 일이 있어요. 먼저 기존 항목을 확인해주세요.');
    tasks = state.tasks.map(t => t.id === current.id ? next : t);
  }
  const next: TodoState = { schemaVersion: 1, revision: state.revision + 1, tasks };
  if (!validTodoState(next)) throw Error('저장할 할 일과 시간 설정을 확인해주세요.');
  return next;
}

export function todoTimeline(state: TodoState) {
  const tasks = state.tasks.filter(t => !t.done && t.startTime !== null && t.minutes !== null);
  return layoutTimeline(tasks.map(t => ({ id: t.id, title: t.title, start: clockMinutes(t.startTime!), end: clockMinutes(t.startTime!) + t.minutes!, bufferMinutes: t.bufferMinutes! })), { start: 540, end: 720, maxEnd: 1440 });
}
