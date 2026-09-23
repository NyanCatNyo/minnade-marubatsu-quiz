<script lang="ts">
 import { onMount } from 'svelte';
 import { request,message } from './api';
 import type { State,Choice } from './types';
 let {id}:{id:string}=$props();
 let quiz=$state<State|null>(null), name=$state(''),selected=$state<Choice|null>(null),error=$state(''),busy=$state(false),syncing=false,seen=-1;
 async function refresh(){if(syncing)return;syncing=true;try{const next=await request<State>(`/api/events/${id}/state`);if(next.event.current!==seen){selected=null;seen=next.event.current}quiz=next;if(next.answer)selected=next.answer;error=''}catch(e){error=message(e)}finally{syncing=false}}
 async function join(){busy=true;error='';try{await request(`/api/events/${id}/join`,{name});await refresh()}catch(e){error=message(e)}finally{busy=false}}
 async function confirm(){if(!selected||!quiz||busy)return;busy=true;const number=quiz.event.current;try{const answer=await request<{choice:Choice}>(`/api/events/${id}/answer`,{number,choice:selected});if(quiz.event.current===number)quiz={...quiz,answer:answer.choice};error='';}catch(e){error=message(e)}finally{busy=false}}
 onMount(()=>{void refresh();const interval=setInterval(()=>{if(!document.hidden&&!busy)void refresh()},2000);return()=>clearInterval(interval)});
</script>
<main class="participant">
 {#if !quiz}<div class="card"><h1>{error?'参加できませんでした':'参加画面を読み込み中…'}</h1>{#if error}<p class="error" role="alert">{error}</p><button class="secondary" onclick={refresh}>再読み込み</button><a class="text-link" href="/">参加コードを入力する</a>{/if}</div>
 {:else}
  {#if !quiz.group}
   <section class="card registration"><h2>グループ名を教えてください</h2><p class="muted">代表者1名が登録してください。<br/>この端末でグループの回答を送信します。</p>
    {#if quiz.event.phase==='finished'}<div class="notice">このイベントは終了しました。</div>{:else}<form onsubmit={(e)=>{e.preventDefault();void join()}}><label for="group-name">グループ名</label><input id="group-name" bind:value={name} maxlength="30" placeholder="例：追手門チーム" autocomplete="organization" required disabled={busy}/><p class="note">会場で分かる名前を入力してください（30文字以内）。</p>{#if error}<p class="error" role="alert">{error}</p>{/if}<button class="primary" disabled={busy||!name.trim()}>{busy?'登録中…':'このグループで参加する'} <span>→</span></button></form>{/if}
   </section>
  {:else}
   <div class="group-banner"><span>参加グループ</span><strong>{quiz.group.name}</strong><span class="connected">自動更新</span></div>
   {#if error}<p class="error" role="alert">{error} <button class="inline-button" onclick={refresh}>再接続</button></p>{/if}
   {#if quiz.event.phase==='setup'}
    <section class="card waiting"><div class="waiting-symbol" aria-hidden="true">○ ×</div><span class="pill">登録完了</span><h2>みんなの準備を待っています</h2><p>司会者がクイズを開始すると、<br/>ここに第1問が表示されます。</p><div class="notice">この画面を開いたままお待ちください。</div></section>
   {:else if quiz.event.phase==='finished'}
    <section class="card waiting"><div class="waiting-symbol" aria-hidden="true">○ ×</div><span class="pill">10 / 10 問</span><h2>ご参加ありがとうございました！</h2><p>すべてのクイズが終了しました。<br/>最後まで、みんなで考えてくれてありがとう。</p></section>
   {:else}
    <div class="question-progress" aria-label={`全10問中${quiz.event.current}問目`}>{#each Array(10) as _,i}<span class:active={i+1===quiz.event.current} class:done={i+1<quiz.event.current}></span>{/each}</div>
    <section class="card question-card"><h2 class="question-body">第{quiz.event.current}問</h2>
     {#if quiz.answer}
      <div class="answer-confirmed" class:answer-x={quiz.answer==='x'}><div class="big-answer" aria-label={quiz.answer==='o'?'まる':'ばつ'}>{quiz.answer==='o'?'○':'×'}</div><strong>この回答で決定しました</strong><p>司会者の合図に合わせて、<br/>グループの「{quiz.answer==='o'?'○':'×'}」の札を上げてください。</p><span class="lock-note">決定済みの回答は変更できません</span></div>
     {:else if quiz.event.phase==='closed'}<div class="waiting"><span class="pill">回答締め切り</span><h2>この問題は締め切られました</h2><p>このグループの回答は未送信です。<br/>次の問題をお待ちください。</p></div>
     {:else}
      <div class="choices"><button class="choice circle" class:chosen={selected==='o'} aria-label="○を選ぶ" aria-pressed={selected==='o'} disabled={busy} onclick={()=>selected='o'}><span aria-hidden="true">○</span><small>{selected==='o'?'選択中':'まる'}</small></button><button class="choice cross" class:chosen={selected==='x'} aria-label="×を選ぶ" aria-pressed={selected==='x'} disabled={busy} onclick={()=>selected='x'}><span aria-hidden="true">×</span><small>{selected==='x'?'選択中':'ばつ'}</small></button></div>
      <button class="primary decide" onclick={confirm} disabled={!selected||busy}>{busy?'送信中…':selected?`「${selected==='o'?'○':'×'}」で決定`:'○か×を選んでください'}</button><p class="note centered">「決定」までは選び直せます。決定後は変更できません。</p>
     {/if}
    </section>{#if quiz.event.phase==='closed'}<p class="participant-help">次の問題は、司会者の操作で表示されます。</p>{/if}
   {/if}
  {/if}
 {/if}
</main>
