import { api, type Env } from './api';
declare const __QUIZ_ASSETS__:Record<string,string>;
export default {async fetch(request:Request,env:Env){
 const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return api(request,env);
 const path=url.pathname==='/'||url.pathname==='/host'?'/index.html':url.pathname;
 const content=__QUIZ_ASSETS__[path];if(content===undefined)return new Response('Not found',{status:404});
 const type=path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':path.endsWith('.svg')?'image/svg+xml':'text/html';
 return new Response(request.method==='HEAD'?null:content,{headers:{'Content-Type':type+'; charset=utf-8','Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}};
