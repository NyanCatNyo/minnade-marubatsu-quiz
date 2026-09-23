export async function request<T>(path:string,data?:unknown):Promise<T>{
 const response=await fetch(path,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(12000)});
 const result=await response.json();if(!response.ok)throw new Error((result as {error?:string}).error??'通信に失敗しました。');return result as T;
}
export function message(error:unknown){return error instanceof Error?(error.name==='TimeoutError'?'通信が混み合っています。もう一度お試しください。':error.message):'通信に失敗しました。'}
