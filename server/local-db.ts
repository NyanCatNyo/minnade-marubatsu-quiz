import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import type { Database as D1, Env } from './api';
export function localDatabase(memory=false):D1 {
 if(!memory)mkdirSync('.local',{recursive:true});
 const db=new Database(memory?':memory:':'.local/quiz.sqlite');db.pragma('foreign_keys = ON');db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){if(!db.prepare('SELECT name FROM local_migrations WHERE name = ?').get(file))db.transaction(()=>{db.exec(readFileSync('drizzle/'+file,'utf8'));db.prepare('INSERT INTO local_migrations VALUES (?)').run(file)})();}
 const wrap=(sql:string,values:unknown[]=[])=>({bind:(...v:unknown[])=>wrap(sql,v),first:async()=>db.prepare(sql).get(...values)??null,all:async()=>({results:db.prepare(sql).all(...values)}),run:async()=>({meta:{changes:db.prepare(sql).run(...values).changes}}),_sql:sql,_values:values});
 return {prepare:wrap,batch:async(statements:any[])=>db.transaction(()=>statements.map(s=>db.prepare(s._sql).run(...s._values)))()} as D1;
}
