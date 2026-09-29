const apiOrigin=(import.meta.env.VITE_API_ORIGIN??'').replace(/\/$/,'');
const eventFrom=(path:string)=>path.match(/^\/api\/events\/([a-f0-9]{16})\//)?.[1]??null;
export const hostPasswordKey='mq-host-password';
export async function request<T>(path:string,data?:unknown):Promise<T>{
 const headers:Record<string,string>={};if(data!==undefined)headers['Content-Type']='application/json';
 const event=eventFrom(path);if(event){const group=localStorage.getItem(`mq-group-${event}`);if(group)headers['X-Quiz-Group-Token']=group}
 if(path==='/api/events'||['host','control','key','delete'].some(action=>path.endsWith('/'+action))){const password=sessionStorage.getItem(hostPasswordKey);if(password)headers['X-Quiz-Host-Password']=password}
 const response=await fetch(apiOrigin+path,{method:data===undefined?'GET':'POST',credentials:apiOrigin?'omit':'same-origin',headers,body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(12000)});
 const result=await response.json();if(!response.ok)throw new Error((result as {error?:string}).error??'通信に失敗しました。');
 if(event&&path.endsWith('/join')){const joined=result as {groupToken?:string};if(joined.groupToken)localStorage.setItem(`mq-group-${event}`,joined.groupToken)}
 return result as T;
}
export function message(error:unknown){return error instanceof Error?(error.name==='TimeoutError'?'通信が混み合っています。もう一度お試しください。':error.message):'通信に失敗しました。'}
