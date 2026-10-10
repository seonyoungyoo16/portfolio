# Source-based Developer Portfolio

메인은 프로젝트 목록이고, Spring Boot Board Lab을 클릭하면 해당 프로젝트의 실제 GitHub 소스에 맞는 DB 관계와 동작 체험이 열립니다. 기존 Agentic Factory 사이트는 별도 사이트로 유지합니다.

## 실행
```sh
npm install
npm run dev
npm run build
node --experimental-strip-types scripts/test-board-demo.ts
```
개발 주소: http://127.0.0.1:5188 / 상세: /#project/board

## 소스와 분석
저장소: https://github.com/seonyoungyoo16/springboot-board-lab

GitHub에 게시한 뒤 별도 디렉터리로 clone한 소스를 읽고, `scripts/export-model.mjs`로 모델을 추출했습니다. `src/generated/board-model.json`은 고정된 Git commit, 실제 SQL 테이블/컬럼/FK/유일 제약, JPA 매핑, API endpoint, service 흐름과 해당 소스 줄 번호 및 SHA-256을 포함합니다.

갱신할 때 최신 GitHub 소스를 별도 checkout한 후 다음을 실행합니다.
```sh
node <board-checkout>/scripts/export-model.mjs <board-checkout> src/generated/board-model.json
```

- `src/App.tsx`: 목록 → 프로젝트 상세 이동
- `src/components/BoardProject.tsx`: 관계, 소스 근거, 게시판 체험
- `src/components/ui/schema-scene.tsx`: 실제 테이블 4개/FK 5개 3D 모델, 카메라 5종
- `src/board-demo.ts`: 소스 규칙에 맞춘 브라우저 시뮬레이션
- `src/project.css`: 프로젝트 상세와 모바일 레이아웃
- `docs/archive/App-before-board.tsx`: 이전 전체 메인 구성 보관

## 실행 범위
포트폴리오는 브라우저 저장 기반 시뮬레이션입니다. 글 CRUD, 댓글 CRUD, 사용자별 좋아요 등록·취소, 작성자 검사, 입력 제한, 버전 비교와 연관 삭제를 실제 소스 규칙에 맞춰 구현했습니다. 테이블 데이터 화면은 실제 SQL 컬럼명을 사용합니다. source revision별로 브라우저 저장 키를 분리합니다.

실제 Spring Boot API와 H2 파일 DB는 GitHub 저장소의 Java 앱으로 별도 실행합니다. GitHub에는 실행 가능한 소스, Dockerfile, 테스트와 CI 템플릿을 게시했습니다. 현재 연결의 workflow 권한이 없어 CI는 활성화되지 않았습니다.

## 검증
Java API 통합 테스트 5개 통과. 브라우저 시뮬레이션은 CRUD/권한/버전/댓글/멱등 좋아요/연관 삭제 및 추출 모델 제약을 검증합니다. 실제 API UI와 포트폴리오 UI는 별도로 브라우저 확인합니다.
