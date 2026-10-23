import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const definitions={
 login:{file:'src/login-demo.ts', conditions:{advance:'action.kind === "advance"',redis:'action.kind === "redis" || action.kind === "db"',db:'action.kind === "redis" || action.kind === "db"',close:'action.kind === "close"',stale:'action.kind === "stale"'}},
 signup:{file:'src/signup-demo.ts',conditions:{switch:'action === "switch"',wait:'action === "wait"',redis:'["redis", "db", "smtp"].includes(action)',db:'["redis", "db", "smtp"].includes(action)',smtp:'["redis", "db", "smtp"].includes(action)',smtpLoss:'action === "smtpLoss"',trust:'action === "trust"',open:'action === "open"'}}
};
const normalize=s=>s.replace(/\s/g,'');
const sources={};
for(const [project,definition] of Object.entries(definitions)) {
 const text=execFileSync('git',['show',`${revision}:${definition.file}`],{encoding:'utf8'}).replaceAll('\r\n','\n');
 const local=fs.readFileSync(definition.file,'utf8').replaceAll('\r\n','\n');
 if(local!==text)throw Error('Commit stable implementation before extracting '+definition.file);
 const source=ts.createSourceFile(definition.file,text,ts.ScriptTarget.Latest,true);
 for(const [action,condition] of Object.entries(definition.conditions)) {
  let match;
  function find(node){if(ts.isIfStatement(node)&&normalize(node.expression.getText(source))===normalize(condition))match??=node;ts.forEachChild(node,find);}
  find(source);
  if(!match)throw Error('Missing browser action '+project+'.'+action);
  const line=source.getLineAndCharacterOfPosition(match.getStart(source)).line+1;
  const end=source.getLineAndCharacterOfPosition(match.getEnd()).line+1;
  sources[project+'.'+action]={file:definition.file,line,lines:text.split('\n').slice(line-1,end),sha256:crypto.createHash('sha256').update(text).digest('hex')};
 }
}
fs.writeFileSync('src/generated/interaction-source.json',JSON.stringify({repo:'https://github.com/seonyoungyoo16/portfolio',revision,sources},null,2)+'\n');
console.log(`Extracted ${Object.keys(sources).length} exact browser action branches at ${revision}`);
