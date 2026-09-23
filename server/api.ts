interface Statement {bind(...values:unknown[]):Statement;first<T=Record<string,unknown>>():Promise<T|null>;all<T=Record<string,unknown>>():Promise<{results:T[]}>;run():Promise<{meta:{changes:number}}>}
export interface Database {prepare(sql:string):Statement;batch(statements:Statement[]):Promise<unknown[]>}
interface Event {id:string;owner:string;title:string;phase:string;current:number;created:number}
export interface Env {DB:Database; ASSETS?:{fetch(request:Request):Promise<Response>}}
class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
const fail=(code:number,msg:string):never=>{throw new HttpError(code,msg)};
const json=(value:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store',...headers}});
const publicEvent=({owner,...event}:Event)=>event;
const category=(n:number)=>n<=2?'狂言':n<=4?'伝統工芸':'雑学・学校';
const correctChoices=['x','x','x','x','o','o','x','x','o','x'] as const;
const hash=async(token:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
function user(req:Request){return req.headers.get('oai-authenticated-user-id') || fail(401,'司会者はログインしてください。')}
async function body(req:Request){const raw=await req.text();if(raw.length>20000)fail(413,'入力内容が長すぎます。');try{const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('Invalid body');return parsed}catch{fail(400,'入力内容を確認してください。')}}
function clean(value:unknown,min:number,max:number){if(typeof value!=='string')fail(400,'入力内容を確認してください。'); const s=(value as string).normalize('NFKC').trim();if(s.length<min||s.length>max)fail(400,`${min}〜${max}文字で入力してください。`);return s;}
async function groupFor(req:Request,db:Database,event:string){const token=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`mq_${event}=`))?.split('=')[1];if(!token)return null;return db.prepare('SELECT id, name FROM groups WHERE event_id = ? AND token_hash = ?').bind(event,await hash(token)).first<{id:string;name:string}>()}
export async function api(req:Request,env:Env):Promise<Response>{
 try {
  const url=new URL(req.url), path=url.pathname, method=req.method, db=env.DB;
  if(method!=='GET' && (req.headers.get('sec-fetch-site')==='cross-site'||(req.headers.get('origin')&&req.headers.get('origin')!==url.origin)))fail(403,'この画面からもう一度操作してください。');
  if(path==='/api/me'&&method==='GET')return json({signedIn:!!req.headers.get('oai-authenticated-user-id')});
  if(path==='/api/events'){
   const owner=user(req);
   if(method==='GET')return json((await db.prepare('SELECT id,title,phase,current,created FROM events WHERE owner = ? ORDER BY created DESC').bind(owner).all()).results);
   if(method==='POST'){
    const input=await body(req), title=clean(input.title,1,80), id=crypto.randomUUID().replaceAll('-','').slice(0,16);
    await db.batch([db.prepare('INSERT INTO events (id,owner,title,phase,current,created) VALUES (?,?,?,\'setup\',0,?)').bind(id,owner,title,Date.now()),...Array.from({length:10},(_,i)=>db.prepare('INSERT INTO questions (event_id,number,category,body) VALUES (?,?,?,?)').bind(id,i+1,category(i+1),''))]);
    return json({id},201);
   }
  }
  const match=path.match(/^\/api\/events\/([a-f0-9]{16})\/(state|join|answer|host|control)$/);
  if(!match)fail(404,'ページが見つかりません。');
  const [,id,action]=match!,event=await db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first<Event>();
  if(!event)fail(404,'参加コードを確認してください。');
  const ev=event!;
  if(['host','control'].includes(action)&&ev.owner!==user(req))fail(403,'このイベントの司会者のみ操作できます。');
  if(action==='state'&&method==='GET'){
   const group=await groupFor(req,db,id);
   const question=ev.current?await db.prepare('SELECT number,category FROM questions WHERE event_id = ? AND number = ?').bind(id,ev.current).first():null;
   const answer=group?await db.prepare('SELECT choice FROM answers WHERE group_id = ? AND number = ?').bind(group.id,ev.current).first<{choice:string}>():null;
   return json({event:publicEvent(ev),question,group,answer:answer?.choice??null});
  }
  if(action==='join'&&method==='POST'){
   const existing=await groupFor(req,db,id);if(existing)return json({group:existing});
   if(ev.phase==='finished')fail(409,'このイベントは終了しました。');
   const input=await body(req),name=clean(input.name,1,30),gid=crypto.randomUUID(),token=crypto.randomUUID()+crypto.randomUUID();
   try{await db.prepare('INSERT INTO groups (id,event_id,name,token_hash,created) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM events WHERE id = ? AND phase != \'finished\')').bind(gid,id,name,await hash(token),Date.now(),id).run()}catch(e){if(String(e).includes('UNIQUE'))fail(409,'このグループ名は登録済みです。代表の方の端末を確認するか、別の名前を入力してください。');throw e}
   const registered=await db.prepare('SELECT id,name FROM groups WHERE id = ?').bind(gid).first();if(!registered)fail(409,'このイベントは終了しました。');
   return json({group:registered},201,{'Set-Cookie':`mq_${id}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600${url.protocol==='https:'?'; Secure':''}`});
  }
  if(action==='answer'&&method==='POST'){
   const group=await groupFor(req,db,id);if(!group)fail(401,'グループを登録してください。');
   const {number,choice}=await body(req);if(!Number.isInteger(number)||number<1||number>10||!['o','x'].includes(choice))fail(400,'回答を選んでください。');
   await db.prepare('INSERT INTO answers (group_id,number,choice,created) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM events WHERE id = ? AND phase = \'open\' AND current = ?) ON CONFLICT(group_id,number) DO NOTHING').bind(group!.id,number,choice,Date.now(),id,number).run();
   const saved=await db.prepare('SELECT choice FROM answers WHERE group_id = ? AND number = ?').bind(group!.id,number).first<{choice:string}>();
   if(!saved)fail(409,'回答は締め切られました。');if(saved!.choice!==choice)fail(409,'すでに決定済みです。回答は変更できません。');return json({choice:saved!.choice});
  }
  if(action==='host'&&method==='GET'){
   const questions=(await db.prepare('SELECT number,category FROM questions WHERE event_id = ? ORDER BY number').bind(id).all()).results;
   const groups=(await db.prepare('SELECT g.id,g.name,a.choice FROM groups g LEFT JOIN answers a ON a.group_id = g.id AND a.number = ? WHERE g.event_id = ? ORDER BY g.created').bind(ev.current,id).all<{id:string;name:string;choice:string|null}>()).results;
   const scores=new Map<string,number>();
   if(ev.phase==='finished'){
    const submitted=(await db.prepare('SELECT a.group_id,a.number,a.choice FROM answers a JOIN groups g ON g.id = a.group_id WHERE g.event_id = ?').bind(id).all<{group_id:string;number:number;choice:string}>()).results;
    for(const answer of submitted)if(correctChoices[answer.number-1]===answer.choice)scores.set(answer.group_id,(scores.get(answer.group_id)??0)+1);
   }
   const scoredGroups=groups.map(group=>({...group,correctCount:ev.phase==='finished'?(scores.get(group.id)??0):null}));
   if(ev.phase==='finished')scoredGroups.sort((a,b)=>(b.correctCount??0)-(a.correctCount??0)||a.name.localeCompare(b.name,'ja'));
   return json({event:publicEvent(ev),questions,groups:scoredGroups,totals:{o:groups.filter(g=>g.choice==='o').length,x:groups.filter(g=>g.choice==='x').length,pending:groups.filter(g=>!g.choice).length}});
  }
  if(action==='control'&&method==='POST'){
   const {command,current}=await body(req);if(current!==ev.current)fail(409,'進行状況が変わりました。画面を更新してください。');
   let sql='',values:unknown[]=[];
   if(command==='start'){
    sql="UPDATE events SET phase = 'open', current = 1 WHERE id = ? AND phase = 'setup'";values=[id];
   }else if(command==='close'){sql="UPDATE events SET phase = 'closed' WHERE id = ? AND phase = 'open' AND current = ?";values=[id,current];}
   else if(command==='next'){sql="UPDATE events SET phase = 'open', current = current + 1 WHERE id = ? AND phase = 'closed' AND current = ? AND current < 10";values=[id,current];}
   else if(command==='finish'){sql="UPDATE events SET phase = 'finished' WHERE id = ? AND phase = 'closed' AND current = 10";values=[id];}
   else fail(400,'操作を確認してください。');
   const changed=await db.prepare(sql).bind(...values).run();if(!changed.meta.changes)fail(409,'進行状況が変わりました。画面を更新してください。');return json({ok:true});
  }
  return fail(405,'この操作は利用できません。');
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);console.error('Quiz API error',e);return json({error:'通信に失敗しました。入力をそのままにして、もう一度お試しください。'},500)}
}
