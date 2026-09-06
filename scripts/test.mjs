import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=new URL('../tests/',import.meta.url);
const files=readdirSync(directory).filter(name=>name.endsWith('.test.mjs')).sort();
if(!files.length)throw new Error('No regression suites found.');
let failed=0;
for(const file of files){
  console.log('\n'+file);
  const result=spawnSync(process.execPath,[fileURLToPath(new URL(file,directory))],{cwd:root,stdio:'inherit'});
  if(result.error){console.error(result.error);failed++;}
  else if(result.status!==0)failed++;
}
console.log(`\n${files.length-failed}/${files.length} suites passed.`);
process.exitCode=failed?1:0;
