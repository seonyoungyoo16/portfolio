# 역할별 3D 요소 컴포넌트 예시

2026-10-30. 요청: 서버·DB처럼 장비로 인식하는 대상은 입체 모델로 표현하고, 공통 로직 요소의 예시 컴포넌트를 비교한다.

기존 여섯 프로젝트의 장면과 기능을 유지하며 별도 `#components` 예시 페이지와 홈의 진입 링크를 추가했다. 전체 프로젝트에 새 조형을 일괄 적용하는 작업은 이번 범위가 아니다.

## 조형과 재사용

`src/three/hardware-models.ts`가 실제 `THREE.Group`을 생성한다. 공통 받침대·재질·시점·표시등 규칙을 따르고, 상태 변경은 표시등과 활성 링에만 적용한다.

| 컴포넌트 | 대상 |
|---|---|
| DesktopModel | 화면·키보드·본체를 갖춘 사용자 PC |
| MobileModel | 화면·프레임을 갖춘 모바일 장비 |
| ServerModel | 서랍·통풍구·표시등을 갖춘 서버 랙 |
| DatabaseModel | 원통 스택으로 표현하는 영속 저장소 |
| CacheModel | 메모리 모듈로 표현하는 빠른 공유 저장소 |
| FileStoreModel | 드라이브 베이로 표현하는 파일·오브젝트 저장소 |
| BrokerModel | 메시지 전달 호스트와 네트워크 포트 |
| ExternalModel | 별도 외부 영역에 배치하는 서비스 호스트 |

Redis·브로커·외부 서비스는 소프트웨어/서비스 역할도 포함하므로 실제 역할·TTL·영속 정책·실행 영역을 별도 설명한다. 장비의 조형만으로 내부 처리나 저장 정책을 단정하지 않는다.

논리 표시는 ProcessOverlay, DecisionGate, FlowPath/DataPacket, DataSnapshot, StatusBadge, SourceAnchor, ExecutionBoundary, MessageQueue, WorkerBadge, LockOverlay, ReservationRing, TransactionBoundary, ExpiryBadge, RecoveryPath의 14종이다. 게이트·잠금·커밋·만료·복구·패킷의 표시 상태를 조작할 수 있다. 소스 예시 링크는 실제 서버 모델 생성 코드로 연결한다.

## 조합과 경계

PC→서버→DB 예시는 같은 모델 팩터리를 재사용한다. 서버 내부 검증에서는 패킷을 없애고 서버만 강조한다. 저장소는 왕복 경로, 응답은 반대 방향, COMMIT은 별도 배지로 표현한다. 모든 처리·상태·데이터는 시각 표현 예시이며 실제 백엔드 요청·저장·결제·인증을 실행하지 않는다.

하드웨어 갤러리는 단일 WebGL 렌더러의 viewport/scissor로8개 모델을 표시한다. 정지 장면은 반복 렌더링하지 않는다. 조합 장면도 경로 도착 뒤 렌더 반복을 멈추며 동작 줄이기를 따른다. 탭/라우트 해제 때 모델 geometry/material·렌더러를 정리한다. WebGL 실패·유실 시 이름·역할·논리 조작을 유지하고 복구 시 하나의 캔버스로 돌아온다.

## 검증

- [모델4그룹](component-gallery-verification/model.json):8개 실제 부피·유한 geometry·상태 표시등, 장비 표면 보존, 인스턴스 리소스 격리, dispose 이벤트.
- [로컬 브라우저8그룹](component-gallery-verification/local/browser.json):8종의 서로 다른 실제 렌더링 픽셀, 회전 픽셀 변화, 상태 변경, 논리14종, 조합 경로,320/390/768/1440/1800px, WebGL 유실/복구·미지원, 기존6개 프로젝트 진입.
- [장비8종](component-gallery-verification/local/models-1440.png), [조합](component-gallery-verification/local/composition-1440.png), [모바일](component-gallery-verification/local/gallery-390.png).

모바일 검증은 Chromium 뷰포트 기준이다. 실제 장비·실제 백엔드 검증 수치와 구분한다. 공개 배포 결과는 확인 후 보완한다.
