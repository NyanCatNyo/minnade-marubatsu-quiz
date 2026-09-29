import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { sites } from './build/sites-vite-plugin';
import { api } from './server/api';
import { localDatabase } from './server/local-db';
const localApi:Plugin={name:'quiz-local-api',configureServer(server){const DB=localDatabase();server.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/api/'))return next();try{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);const result=await api(new Request('http://'+req.headers.host+req.url,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined}),{DB,HOST_PASSWORD:process.env.HOST_PASSWORD??'1234'});res.statusCode=result.status;result.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await result.text())}catch{res.statusCode=500;res.end('Local API error')}})}};
const pages=process.env.GITHUB_ACTIONS==='true';
export default defineConfig({base:pages?'/minnade-marubatsu-quiz/':'/',plugins:pages?[svelte()]:[svelte(),sites(),localApi],build:{outDir:'dist/client',emptyOutDir:true},server:{port:5173,strictPort:true}});
