import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
const root = path.resolve(process.argv[2] || 'C:/workspace/study/todo');
const revision = execFileSync('git', ['rev-parse', process.env.TODO_SOURCE_REVISION || 'HEAD'], {cwd:root,encoding:'utf8'}).trim();
const files = [['add','app/todo/page.tsx','addTask'],['plan','app/todo/task-time.ts','parseTaskTimeDraft'],['schedule','app/todo/timeline.ts','layoutTimeline'],['record','app/todo/execution-idb.ts','localExecutionTransaction']];
const sources = {};
for (const [key,file,name] of files) {
  const text = execFileSync('git',['show',`${revision}:${file}`],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n');
  const ast = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  let target;
  const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === name) target = node; ts.forEachChild(node,visit); };
  visit(ast);
  if (!target) throw Error('Missing source function '+name);
  const line = ast.getLineAndCharacterOfPosition(target.getStart(ast)).line+1;
  const endLine = ast.getLineAndCharacterOfPosition(target.getEnd()).line;
  sources[key] = {file,name,line,lines:text.split('\n').slice(line-1,endLine+1),sha256:crypto.createHash('sha256').update(text).digest('hex')};
}
fs.writeFileSync('src/generated/todo-source.json',JSON.stringify({repo:'https://github.com/seonyoungyoo16/oddk-todo',appUrl:'https://seonyoungyoo16.github.io/oddk-todo/todo/',revision,sources},null,2)+'\n');
console.log('Exported 4 actual Todo functions at '+revision);
