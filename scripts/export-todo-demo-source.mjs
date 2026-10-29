import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const revision=execFileSync('git',['rev-parse',process.argv[2]||'HEAD'],{encoding:'utf8'}).trim();
const entries=[['prepare','src/todo-demo.ts','prepareTodoAction'],['commit','src/todo-storage.ts','commitTodoState'],['read','src/todo-storage.ts','readTodoState'],['reset','src/todo-storage.ts','resetTodoState'],['perform','src/todo-trace.ts','performTodoAction'],['render','src/components/TodoWorkbench.tsx','runAction']];
const sources={};
for(const [key,file,name] of entries){
  const text=execFileSync('git',['show',`${revision}:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n');
  const current=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
  if(text!==current)throw Error('Commit the stable implementation before extracting '+file);
  const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);let target;
  const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text===name)target=node;ts.forEachChild(node,visit)};visit(ast);
  if(!target)throw Error('Missing actual function '+name);
  const line=ast.getLineAndCharacterOfPosition(target.getStart(ast)).line+1,end=ast.getLineAndCharacterOfPosition(target.getEnd()).line+1;
  sources[key]={file,name,line,lines:text.split('\n').slice(line-1,end),sha256:crypto.createHash('sha256').update(text).digest('hex')};
}
fs.writeFileSync('src/generated/todo-demo-source.json',JSON.stringify({repo:'https://github.com/seonyoungyoo16/portfolio',revision,sources},null,2)+'\n');
console.log(`Exported ${entries.length} executed Todo functions at ${revision}`);
