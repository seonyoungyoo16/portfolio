# Banking Systems · Developer Portfolio

기존 Agentic Factory와 별도 폴더·별도 Sites ID로 만든 금융·인증 3D 포트폴리오입니다.

## 실행
```sh
npm install
npm run dev
npm run build
```
개발 주소: http://127.0.0.1:5188

## 편집
- 장비와 소개 자료: `src/data.ts`
- 페이지와 경력: `src/App.tsx`
- 3D 모델: `src/components/ui/banking-scene.tsx`
- 스타일: `src/index.css`
- React / TypeScript / Tailwind 4 / Three.js, shadcn 별칭과 디렉터리 구성

PC, 인터넷뱅킹 단말, 인증서 카드, 인증 서버, 뱅킹 서버를 코드로 생성합니다. 장비 클릭 및 동일한 HTML 프로젝트 목록으로 경력을 탐색할 수 있습니다. 전체 구조, 내부 보기, 장비별 보기, 요청 따라가기와 카메라 전환·일시 정지를 지원합니다.

VIEW: Overview(전체), Side(측면), Top(상단), Station(장비 근접 및 이전/다음 선택), Flight(자동 선회). 일시 정지하면 Flight 선회도 정지합니다. 움직임 줄이기 환경에서는 자동 선회하지 않습니다.

내용은 기존 portfolio 폴더의 `experience.json`, `projects.json`, `CAREER-WORKSHEET.md`를 참고했습니다. 미확인 기간·성과·개별 프로젝트 기술·개인 연락처는 만들지 않았습니다. 이름·연락처·검증된 성과와 프로젝트 증적은 추후 추가할 수 있습니다.

3D 구조와 흐름은 설명을 위한 개념도이며 실제 금융 시스템 내부 구조나 인증 프로토콜을 표현하지 않습니다. 금융 거래, 로그인, 인증서 발급을 실제로 실행하지 않습니다.
