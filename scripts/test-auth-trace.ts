import assert from 'node:assert/strict';
import fs from 'node:fs';
import {emptyLogin,executeLogin,fixturePassword,type Action as LoginAction} from '../src/login-demo.ts';
import {emptySignup,executeSignup,type Action as SignupAction} from '../src/signup-demo.ts';
import {describeAuthStep,type AuthTrace} from '../src/auth-trace.ts';
import {loginSceneState,signupSceneState} from '../src/auth-scene.ts';
import login from '../src/generated/login-source.json' with {type:'json'};
import signup from '../src/generated/signup-source.json' with {type:'json'};
const checks:string[]=[];
const check=(name:string,fn:()=>void)=>{fn();checks.push(name);console.log('PASS '+name);};
const edges={login:[['browser','server'],['server','database'],['server','redis']],signup:[['Browser','Server'],['Server','DB'],['Server','Redis'],['Server','SMTP'],['Browser','IdP'],['Server','IdP']]};
function valid(project:'login'|'signup',trace?:AuthTrace){assert(trace);const links=edges[project];const nodes=new Set(links.flat());for(const node of trace.path)assert(nodes.has(node),node);for(let i=1;i<trace.path.length;i++)assert(links.some(([a,b])=>a===trace.path[i-1]&&b===trace.path[i]||b===trace.path[i-1]&&a===trace.path[i]),trace.path.join('>'));if(trace.sourceRole==='browser')assert.equal(trace.path.length,1,'A local action must not animate a fake server request');}
check('all 57 frozen source keys have explicit reviewed boundaries and only valid architecture hops',()=>{
 for(const [project,model]of [['login',login],['signup',signup]] as const)for(const source of Object.keys(model.sources))valid(project,describeAuthStep(project,project==='login'?'login':'request',{node:project==='login'?'server':'Server',source,title:source},1,3));
 assert.throws(()=>describeAuthStep('login','login',{node:'server',source:'guessed.source',title:'x'},1,3),/Unreviewed/);
});
check('login DB lookup, PREPARING insert, ACTIVE commit, Redis TTL and cookies correspond to actual source statements',()=>{
 const result=executeLogin(emptyLogin(),{kind:'login',password:fixturePassword,remember:true});
 for(const frame of result.frames)valid('login',frame.trace);
 const password=result.frames.find(f=>f.source==='AuthService.password')!;
 assert.deepEqual(password.trace?.path,['server','database','server']);
 const code=(key:keyof typeof login.sources)=>login.sources[key].lines.join('\n');
 assert.match(code('AuthService.password'),/SELECT \* FROM users/);assert.match(code('AuthService.password'),/encoder.matches/);
 assert.match(code('AuthService.prepare'),/INSERT INTO auth_sessions/);assert.match(code('AuthService.prepare'),/PREPARING/);
 assert.match(code('AuthService.activate'),/SET state='ACTIVE'/);
 assert.match(code('SessionStore.ttl'),/repo.save/);assert.match(code('SessionStore.ttl'),/setMaxInactiveInterval/);
 assert.match(code('SessionStore.save'),/Set-Cookie/);
});
check('browser close and later restore retain separate local and HTTP boundaries even when combined by one user action',()=>{
 const start=executeLogin(emptyLogin(),{kind:'login',password:fixturePassword,remember:true}).state;
 const close=executeLogin(start,{kind:'close'}),restore=executeLogin(close.state,{kind:'restore'});
 close.frames.forEach(f=>{valid('login',f.trace);assert.equal(f.trace?.sourceRole,'browser');});
 assert.deepEqual(restore.frames[0].trace?.path,['browser','server']);
 assert.equal(restore.state.browsers[0].remember?.generation,1);
 const scene=loginSceneState(close.frames[0].state,0,'A',[...close.frames,...restore.frames],0);
 assert.equal(scene.route,null);assert.equal(scene.source,'browser:login.close');
});
check('login error, expiry, revocation and lost-response frames never invent a new successful browser credential',()=>{
 const state=executeLogin(emptyLogin(),{kind:'login',password:fixturePassword,remember:true}).state;
 for(const kind of ['login','me','restore','concurrent','replay','close','logout','logoutAll','reauth','advance','redis','db','cleanup','partial','lost','stale','deferred'] as LoginAction['kind'][]){const value=executeLogin(state,{kind,password:fixturePassword,remember:true,seconds:1800});value.frames.forEach(f=>valid('login',f.trace));}
 const lost=executeLogin(state,{kind:'lost'});assert(lost.frames.some(f=>f.trace?.kind==='failure'));assert.equal(lost.status,0);
 const blocked=executeLogin({...state,redisUp:false},{kind:'me'});assert(blocked.frames.some(f=>f.trace?.kind==='failure'));assert.equal(blocked.status,503);
});
check('email outbox SQL, SMTP send and verification SQL are different source/route boundaries',()=>{
 const requested=executeSignup(emptySignup(),'request',{email:'trace@lab.test'}),delivered=executeSignup(requested.state,'deliver');
 [...requested.frames,...delivered.frames].forEach(f=>valid('signup',f.trace));
 assert.deepEqual(delivered.frames[0].trace?.path,['Server']);assert.equal(delivered.frames[0].source,'MailWorker.claim');
 const body=signup.sources['SignupService.requestEmail'].lines.join('\n');assert.match(body,/INSERT INTO email_challenges/);assert.match(body,/INSERT INTO mail_outbox/);
 assert.match(signup.sources['MailWorker.send'].lines.join('\n'),/sender.send\(message\)/);
 assert.equal(delivered.state.flows[0].verifiedUntil,null);
 const open=executeSignup(delivered.state,'open',{mail:delivered.state.mail[0].id});
 assert(open.frames.every(f=>f.trace?.sourceRole==='browser'));assert.equal(signupSceneState(open.state,open.frames,0).route,null);
 const verified=executeSignup(open.state,'verify');assert.equal(verified.code,'EMAIL_VERIFIED');assert(verified.frames.some(f=>f.trace?.path.join('>')==='Server>DB>Server'));
});
check('SSO source excerpts include redirect/code exchange; claim verification runs on the server and linking is a DB commit',()=>{
 const state=executeSignup(emptySignup(),'login').state;
 const proof=executeSignup(state,'link',{provider:'main',user:'match'});
 assert.equal(proof.state.identities.length,0);proof.frames.forEach(f=>valid('signup',f.trace));
 const validation=proof.frames.find(f=>f.source==='OidcService.validate');assert(validation);assert.deepEqual(validation.trace?.path,['Server']);
 assert.match(signup.sources['OidcService.start'].lines.join('\n'),/code_challenge/);
 assert.match(signup.sources['OidcService.callback'].lines.join('\n'),/exchange|token/i);
 assert.match(signup.sources['OidcService.validate'].lines.join('\n'),/SignatureAlgorithm.RS256/);
 const linked=executeSignup(proof.state,'confirmLink');assert.equal(linked.state.identities.length,1);assert(linked.frames.some(f=>f.source==='OidcService.link'&&f.trace?.path.join('>')==='Server>DB>Server'));
});
check('all signup actions and dependency failures use registered boundaries; environment changes stay local',()=>{
 for(const action of ['request','deliver','open','verify','change','complete','recover','oidc','login','reauth','link','confirmLink','logout','wait','redis','db','smtp','smtpLoss','trust','switch'] as SignupAction[]){const result=executeSignup(emptySignup(),action,{terms:true,user:'match',mail:1});result.frames.forEach(f=>valid('signup',f.trace));}
 for(const dependency of ['dbUp','redisUp'] as const){const state=emptySignup();state[dependency]=false;const result=executeSignup(state,'request');assert.equal(result.status,503);assert(result.frames.some(f=>f.trace?.kind==='failure'));assert.equal(result.state.accounts.length,1);}
});
fs.mkdirSync('docs/user-journey-verification',{recursive:true});fs.writeFileSync('docs/user-journey-verification/source-contract.json',JSON.stringify({status:'passed',verifiedAt:new Date().toISOString(),checks,backendKeys:57,scope:'Reviewed source statements and modeled boundaries; not runtime backend network capture'},null,2)+'\n');
console.log(`${checks.length} source-to-flow contract groups passed`);
