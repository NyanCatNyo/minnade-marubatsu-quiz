import { build } from 'esbuild';
import { readdir,readFile } from 'node:fs/promises';
const assets={};
async function collect(path,prefix=''){for(const file of await readdir(path,{withFileTypes:true})){const name=prefix+'/'+file.name;if(file.isDirectory())await collect(path+'/'+file.name,name);else assets[name]=await readFile(path+'/'+file.name,'utf8')}}
await collect('dist/client');
await build({entryPoints:['server/worker.ts'],bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js',define:{__QUIZ_ASSETS__:JSON.stringify(assets)}});
