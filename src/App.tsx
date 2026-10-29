import { useEffect, useState } from "react";
import BoardProject from "./components/BoardProject";
import ChatProject from "./components/ChatProject";
import LoginProject from "./components/LoginProject";
import SignupProject from "./components/SignupProject";
import PaymentProject from "./components/PaymentProject";
import TodoProject, { TodoPreview } from "./components/TodoProject";
import ComponentGallery from "./components/ComponentGallery";
import todoModel from "./generated/todo-source.json";
import paymentModel from "./generated/payment-source.json";
import signupModel from "./generated/signup-source.json";
import loginModel from "./generated/login-source.json";
import chatModel from "./generated/chat-source.json";
import model from "./generated/board-model.json";
import "./project-list.css";
export default function App() {
  const [route, setRoute] = useState(location.hash);
  useEffect(() => {
    const change = () => setRoute(location.hash);
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (route === "#experience")
      document.getElementById("experience")?.scrollIntoView();
    else window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);
  return (
    <>
      <header className="header">
        <a href="#projects" className="brand">
          <span className="brand-mark">
            B<span>.</span>
          </span>
          <span>
            BACKEND / AI<small>DEVELOPER PORTFOLIO</small>
          </span>
        </a>
        <nav aria-label="메인 메뉴">
          <a href="#projects">프로젝트</a>
          <a href="#experience">개발관</a>
          <a
            href={
              route === "#components"
                ? "https://github.com/seonyoungyoo16/portfolio"
                : route === "#project/todo"
                ? todoModel.repo
                : route === "#project/payment"
                ? paymentModel.repo
                : route === "#project/signup"
                  ? signupModel.repo
                  : route === "#project/login"
                    ? loginModel.repo
                    : route === "#project/chat"
                      ? chatModel.repo
                      : model.repo
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub ↗
          </a>
        </nav>
      </header>
      {route === "#components" ? (
        <ComponentGallery />
      ) : route === "#project/board" ? (
        <BoardProject />
      ) : route === "#project/chat" ? (
        <ChatProject />
      ) : route === "#project/login" ? (
        <LoginProject />
      ) : route === "#project/signup" ? (
        <SignupProject />
      ) : route === "#project/payment" ? (
        <PaymentProject />
      ) : route === "#project/todo" ? (
        <TodoProject />
      ) : (
        <main className="portfolio-home">
          <section className="home-intro">
            <span className="eyebrow">BUILD. UNDERSTAND. CONNECT.</span>
            <h1>
              코드의 결과와,
              <br />
              <em>설계의 이유를 함께.</em>
            </h1>
            <p>
              금융 업무를 이해하는 백엔드, AI로 확장하는 개발.
              <br />
              프로젝트를 선택해 구현 내용과 중요한 데이터 흐름을 살펴보세요.
            </p>
          </section>
          <section className="home-projects">
            <div className="section-heading">
              <div>
                <span className="eyebrow">SELECTED PROJECTS</span>
                <h2>프로젝트 안으로 들어가 보세요.</h2>
              </div>
              <p>
                각 프로젝트의 소스가
                <br />
                설계 설명의 출발점이 됩니다.
              </p>
            </div>
            <div className="project-list">
              <a className="featured-project" href="#project/board">
                <div className="project-art" aria-hidden="true">
                  <div>
                    app_users<small>PK id</small>
                  </div>
                  <i>1 → N</i>
                  <div>
                    posts<small>FK author_id</small>
                  </div>
                  <div>
                    comments<small>FK post_id</small>
                  </div>
                  <i>N ← 1</i>
                  <div>
                    post_likes<small>UQ post_id, user_id</small>
                  </div>
                </div>
                <div className="featured-copy">
                  <span className="eyebrow">01 / SOURCE-BASED PROJECT</span>
                  <h3>Spring Boot Board Lab</h3>
                  <p>
                    글·이미지·댓글·좋아요를 구현한 게시판.
                    <br />
                    사용자 요청이 서버에 전달되는 과정을 보고,
                    <br />
                    동작에 따라 변하는 데이터를 확인합니다.
                  </p>
                  <div className="tags">
                    <span>Spring Boot</span>
                    <span>JPA</span>
                    <span>H2</span>
                    <span>
                      {model.tables.length} Tables / {model.relations.length}{" "}
                      FKs
                    </span>
                  </div>
                  <strong>
                    프로젝트 설계와 체험 열기 <span>↗</span>
                  </strong>
                </div>
              </a>
              <a
                className="featured-project chat-featured"
                href="#project/chat"
              >
                <div className="chat-project-art" aria-hidden="true">
                  <b>CLIENT A</b>
                  <i>↔</i>
                  <b>WebSocket</b>
                  <i>↔</i>
                  <b>CLIENT B</b>
                </div>
                <div className="featured-copy">
                  <span className="eyebrow">02 / REALTIME MESSAGE FLOW</span>
                  <h3>Spring Boot Chat Lab</h3>
                  <p>
                    연결된 두 참가자 사이로 오가는 실시간 메시지.
                    <br />
                    서버 저장과 같은 방 방송, ACK 응답을 따라가며
                    <br />
                    재접속과 중복 전송의 처리 방식을 살펴봅니다.
                  </p>
                  <div className="tags">
                    <span>WebSocket</span>
                    <span>Spring Boot</span>
                    <span>JPA · H2</span>
                    <span>Room Broadcast</span>
                  </div>
                  <strong>
                    채팅 흐름과 체험 열기 <span>↗</span>
                  </strong>
                </div>
              </a>
              <a
                className="featured-project login-featured"
                href="#project/login"
              >
                <div className="login-project-art" aria-hidden="true">
                  <b>BROWSER · A / B</b>
                  <i>↓</i>
                  <b>SPRING SECURITY</b>
                  <i>↙ ↘</i>
                  <small>REDIS SESSION / POSTGRESQL</small>
                </div>
                <div className="featured-copy">
                  <span className="eyebrow">03 / AUTHENTICATION LIFECYCLE</span>
                  <h3>Spring Boot Login Lab</h3>
                  <p>
                    로그인부터 세션 만료, 로그인 유지와 기기별 폐기까지.
                    <br />
                    서버·Redis·DB 사이의 인증 상태 변화를 따라가며
                    <br />
                    동시 복원과 장애 상황을 실제 소스와 함께 살펴봅니다.
                  </p>
                  <div className="tags">
                    <span>Spring Security</span>
                    <span>Redis Session</span>
                    <span>PostgreSQL</span>
                    <span>41 Browser Scenarios</span>
                  </div>
                  <strong>
                    로그인 흐름과 체험 열기 <span>↗</span>
                  </strong>
                </div>
              </a>
              <a
                className="featured-project signup-featured"
                href="#project/signup"
              >
                <div className="signup-project-art" aria-hidden="true">
                  <b>EMAIL OWNERSHIP</b>
                  <i>↓</i>
                  <b>ATOMIC SIGNUP</b>
                  <i>↔</i>
                  <small>POSTGRESQL / REDIS / SMTP / OIDC</small>
                </div>
                <div className="featured-copy">
                  <span className="eyebrow">
                    04 / IDENTITY &amp; ONBOARDING
                  </span>
                  <h3>Spring Boot Signup Lab</h3>
                  <p>
                    이메일 인증부터 중복 가입 방지와 외부 신원 연결까지.
                    <br />
                    메일 접수와 확인, 계정 확정의 경계를 따라가며
                    <br />
                    장애와 동시 요청의 처리 흐름을 실제 소스로 살펴봅니다.
                  </p>
                  <div className="tags">
                    <span>Spring Security</span>
                    <span>SMTP · Outbox</span>
                    <span>OIDC · PKCE</span>
                    <span>50 Browser Scenarios</span>
                  </div>
                  <strong>
                    회원가입 흐름과 체험 열기 <span>↗</span>
                  </strong>
                </div>
              </a>
              <a
                className="featured-project payment-featured"
                href="#project/payment"
              >
                <div className="payment-art" aria-hidden="true">
                  <b>MERCHANT COMMIT</b>
                  <i>⇄</i>
                  <b>INDEPENDENT PSP</b>
                  <small>IDEMPOTENCY / CANCEL / RECOVERY</small>
                </div>
                <div className="featured-copy">
                  <span className="eyebrow">05 / PAYMENT CONSISTENCY</span>
                  <h3>Spring Boot Payment Lab</h3>
                  <p>
                    중복 승인 방지부터 전액·부분 취소와 결과 불명 복구까지.
                    <br />
                    상점과 독립 PG의 서로 다른 커밋을 비교하고
                    <br />
                    실제 원장·작업·보상의 처리 흐름을 소스로 확인합니다.
                  </p>
                  <div className="tags">
                    <span>Independent PSP</span>
                    <span>PostgreSQL · Redis</span>
                    <span>Ledger · Outbox</span>
                    <span>64 Browser Scenarios</span>
                  </div>
                  <strong>
                    결제 흐름과 체험 열기 <span>↗</span>
                  </strong>
                </div>
              </a>
              <a className="featured-project todo-featured" href="#project/todo">
                <TodoPreview />
                <div className="featured-copy">
                  <span className="eyebrow">06 / REACT PRODUCTIVITY</span>
                  <h3>oddk · React Todo</h3>
                  <p>할 일 등록부터 하루 계획과 실제 시간 기록까지.<br />ALPEN으로 작업·여유를 정하고 시간표에 배치하며,<br />목록·목표·실행 기록을 하나의 흐름으로 연결합니다.</p>
                  <div className="tags"><span>React</span><span>Next.js · TypeScript</span><span>ALPEN</span><span>Time Blocking</span></div>
                  <strong>투두리스트 소개와 앱 열기 <span>↗</span></strong>
                </div>
              </a>
            </div>
            <div className="home-source">
              <span>
                GitHub 소스 게시 완료 · commit {model.revision?.slice(0, 7)}
              </span>
              <a href="#components">공통 3D 요소 예시 보기 ↗</a>
            </div>
          </section>
          <section className="section experience" id="experience">
            <div>
              <span className="eyebrow">HOW I WORK</span>
              <h2>
                업무의 맥락에서
                <br />
                개발을 시작합니다.
              </h2>
              <p className="muted">금융권 SI · 업무 시스템 개발과 유지보수</p>
            </div>
            <div className="work-philosophy">
              <p>
                기능을 만들기 전에 그 일을 누가, 언제, 어떤 순서로
                처리하는지부터 확인합니다. 같은 요청이라도 앞뒤 업무를 알아야
                필요한 데이터와 예외가 보이기 때문입니다.
              </p>
              <p>
                설계할 때는 데이터가 만들어지고 바뀌고 사라지는 과정을 따라가
                봅니다. 어떤 데이터가 함께 바뀌어야 하는지, 처리가 중간에 멈추면
                무엇을 남겨야 하는지 정리하고 구현으로 옮깁니다.
              </p>
              <p>
                나중에 코드를 읽는 사람이 이 구조를 선택한 이유까지 이해할 수
                있었으면 합니다. 변경할 곳과 지켜야 할 규칙을 찾을 수 있도록,
                판단의 근거를 코드와 설명에 남기려고 합니다.
              </p>
            </div>
          </section>
        </main>
      )}
      <footer>
        <a href="#projects">프로젝트 목록 ↑</a>
      </footer>
    </>
  );
}
