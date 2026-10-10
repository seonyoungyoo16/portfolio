export const stations = [
  { id: 'pc', name: '사용자 PC', en: 'CLIENT', category: '화면과 사용자 경험', title: '업무의 시작은 사용자의 화면에서.', summary: '업무 흐름을 화면으로 연결하는 개발 경험입니다.', projects: ['KISA 대외 포탈 테스트 페이지 개발', 'RA 관리자 포탈 대응 업무'], tags: ['HTML', 'JavaScript', 'JSP'], note: '프로젝트별 사용 기술은 추가 확인이 필요합니다.' },
  { id: 'banking', name: '인터넷뱅킹', en: 'BANKING', category: '금융 서비스', title: '금융 업무를 서비스로 연결합니다.', summary: '비대면 계좌개설 과정의 전자금융 가입 기능을 구현했습니다.', projects: ['대구은행 비대면 계좌개설 · 전자금융 가입 기능 구현'], tags: ['금융 업무', '가입 흐름', '서비스 개발'], note: '담당 기능을 기준으로 소개합니다.' },
  { id: 'certificate', name: '인증서', en: 'CERTIFICATE', category: '인증과 시스템 연동', title: '인증의 흐름을 이해하고 연결합니다.', summary: '재외국민 인증서 발급과 간편인증 프로젝트에 참여했습니다.', projects: ['IBK기업은행 재외국민 인증서 발급 · BPR 연계 업무', 'IBK기업은행 KISA 간편인증 · 공유이력 조회 기능'], tags: ['인증서 발급', '간편인증', '시스템 연동'], note: '3D 흐름은 포트폴리오용 개념도입니다.' },
  { id: 'auth', name: '인증 서버', en: 'AUTH SERVER', category: '관리와 운영', title: '운영자가 이해할 수 있는 시스템.', summary: '인증 관련 관리자 포탈에서 조회와 통계 기능을 개발했습니다.', projects: ['RA 관리자 포탈 통계 개발', '공유이력 조회 기능 개발', 'RA 관리자 포탈 대응 업무'], tags: ['관리자 포탈', '조회', '통계'], note: '실제 인증 프로토콜이나 내부망 구조를 나타내지 않습니다.' },
  { id: 'server', name: '뱅킹 서버', en: 'CORE SERVER', category: '백엔드와 AI 확장', title: '백엔드 경험을 AI 서비스로 확장합니다.', summary: '금융권 SI 경험과 함께 개인 지식베이스, 서재 챗봇, 로컬 LLM 프로젝트를 이어가고 있습니다.', projects: ['금융권 SI · 백엔드와 시스템 연동', '개인 지식베이스', '서재 챗봇 · Qwen 로컬 LLM'], tags: ['Spring', 'Spring Boot', 'Oracle', 'AI'], note: '기술은 전체 경험 범위이며 개별 프로젝트 적용 범위는 확인 중입니다.' },
] as const
export type StationId = typeof stations[number]['id']
export type Mode = 'overview' | 'inside' | 'stations' | 'flow'
export type View = 'overview' | 'side' | 'top' | 'station' | 'flight'
export const steps = ['사용자 요청', '뱅킹 접속', '인증서 확인', '인증 처리', '업무 처리']
