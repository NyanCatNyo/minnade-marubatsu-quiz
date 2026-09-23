<script lang="ts">
 import { onMount } from 'svelte';
 import QRCode from 'qrcode';
 import { request,message } from './api';
 import type { HostState,QuizEvent } from './types';
 let {id}:{id:string}=$props();
 let signedIn=$state<boolean|null>(null),events=$state<QuizEvent[]>([]),title=$state('みんなで ○×クイズ'),quiz=$state<HostState|null>(null),tab=$state<'live'|'questions'|'qr'>('live'),draft=$state<string[]>([]),dirty=$state(false),error=$state(''),notice=$state(''),busy=$state(false),qr=$state(''),confirmClose=$state(false),loaded=false,polling=false;
 const invite=$derived(typeof location!=='undefined'?`${location.origin}/?e=${id}`:'');
 let closeDialog=$state<HTMLDialogElement>();
 $effect(()=>{if(confirmClose)closeDialog?.showModal();else closeDialog?.close()});
 const labels:Record<string,string>={setup:'開始前',open:'回答受付中',closed:'回答締め切り',finished:'終了'};
 async function refresh(){if(polling)return;polling=true;try{if(id){quiz=await request<HostState>(`/api/events/${id}/host`);if(!loaded){draft=quiz.questions.map(q=>q.body);loaded=true;if(quiz.event.phase==='setup')tab='questions'}}else events=await request<QuizEvent[]>('/api/events');}catch(e){error=message(e)}finally{polling=false}}
 async function create(){busy=true;error='';try{const event=await request<{id:string}>('/api/events',{title});location.href='/host?e='+event.id}catch(e){error=message(e)}finally{busy=false}}
 async function save(){busy=true;error='';notice='';try{await request(`/api/events/${id}/questions`,{questions:draft.map(body=>({body}))});dirty=false;notice='10問の問題文を保存しました。';await refresh()}catch(e){error=message(e)}finally{busy=false}}
 async function control(command:string){if(!quiz)return;busy=true;error='';notice='';confirmClose=false;try{await request(`/api/events/${id}/control`,{command,current:quiz.event.current});await refresh();tab='live'}catch(e){error=message(e);await refresh()}finally{busy=false}}
 async function copy(){try{await navigator.clipboard.writeText(invite);notice='参加URLをコピーしました。'}catch{error='コピーできませんでした。表示されているURLを選択してコピーしてください。'}}
 onMount(()=>{void(async()=>{try{const me=await request<{signedIn:boolean}>('/api/me');signedIn=me.signedIn;if(signedIn)await refresh();if(id)qr=await QRCode.toDataURL(invite,{width:440,margin:2,color:{dark:'#172c48',light:'#ffffff'},errorCorrectionLevel:'M'})}catch(e){error=message(e)}})();const timer=setInterval(()=>{if(id&&signedIn&&!busy&&!document.hidden)void refresh()},2500);return()=>clearInterval(timer)});
</script>
<main class="host-main">
 <div class="host-breadcrumb"><a href="/host">司会者画面</a>{#if id}<span>/</span><span>イベント管理</span>{/if}<span class="private-badge">司会者のみ</span></div>
 {#if error}<p class="error" role="alert">{error} <button class="inline-button" onclick={()=>{error='';void refresh()}}>再読み込み</button></p>{/if}
 {#if notice}<p class="success" role="status">{notice}</p>{/if}
 {#if signedIn===null}<div class="loading">読み込み中…</div>
 {:else if !signedIn}<section class="card login-card"><span class="section-kicker">司会者専用</span><h1>クイズを準備する</h1><p class="muted">ログインした司会者だけが、イベントの進行と<br/>グループの回答・集計を確認できます。</p><a class="primary" href={'/signin-with-chatgpt?return_to='+encodeURIComponent('/host'+(id?'?e='+id:''))} target="_top">ChatGPTでログイン</a></section>
 {:else if !id}
  <div class="page-heading"><div><div class="eyebrow">HOST CONSOLE</div><h1>クイズの準備をはじめましょう</h1><p class="muted">10問を登録して、参加用のQRコードを配布できます。</p></div></div>
  <div class="host-home-grid"><section class="card"><div class="section-kicker">新しいイベント</div><h2>イベントを作成する</h2><form onsubmit={(e)=>{e.preventDefault();void create()}}><label for="event-title">イベント名</label><input id="event-title" bind:value={title} maxlength="80" required/><button class="primary" disabled={busy||!title.trim()}>{busy?'作成中…':'イベントを作成'} <span>→</span></button></form><div class="category-list"><div><b>01—02</b><span>狂言</span><small>2問</small></div><div><b>03—04</b><span>伝統工芸</span><small>2問</small></div><div><b>05—10</b><span>雑学・学校</span><small>6問</small></div></div></section>
  <section class="card"><div class="section-kicker">作成済みのイベント</div><h2>イベントを開く</h2>{#if events.length===0}<div class="empty-state">まだイベントはありません。<br/>左のフォームから作成してください。</div>{:else}<div class="event-list">{#each events as event}<a href={'/host?e='+event.id}><strong>{event.title}</strong><span>{labels[event.phase]}　→</span></a>{/each}</div>{/if}</section></div>
 {:else if quiz}
  <div class="page-heading"><div><div class="eyebrow">HOST CONSOLE</div><h1>{quiz.event.title}</h1></div><span class="pill phase" class:is-open={quiz.event.phase==='open'}>{labels[quiz.event.phase]}</span></div>
  <nav class="tabs" aria-label="イベント管理"><button class:active={tab==='live'} onclick={()=>tab='live'}>進行と集計</button><button class:active={tab==='questions'} onclick={()=>tab='questions'}>問題の準備 <span>10</span></button><button class:active={tab==='qr'} onclick={()=>tab='qr'}>参加用QRコード</button></nav>
  {#if tab==='questions'}
   <section class="card question-editor"><div class="editor-heading"><div><h2>10問の問題を準備</h2><p class="muted">{quiz.event.phase==='setup'?'○か×で答えられる問題を入力してください。開始後は編集できません。':'クイズ開始後のため、問題文は変更できません。'}</p></div><span class="pill">{draft.filter(x=>x.trim()).length} / 10 入力済み</span></div>
    <form onsubmit={(e)=>{e.preventDefault();void save()}}>{#each draft as text,i}<div class="editor-row"><div class="editor-number">{String(i+1).padStart(2,'0')}</div><div class="editor-content"><label for={'question-'+i}>{i<2?'狂言':i<4?'伝統工芸':'雑学・学校'} <span>第{i+1}問</span></label><textarea id={'question-'+i} value={text} oninput={(e)=>{draft[i]=e.currentTarget.value;dirty=true;notice=''}} maxlength="500" rows="2" placeholder="問題文を入力してください" disabled={quiz.event.phase!=='setup'||busy}></textarea></div></div>{/each}
     {#if quiz.event.phase==='setup'}<div class="save-bar"><span>{dirty?'未保存の変更があります':'保存した問題文で出題します'}</span><button class="primary" disabled={busy}>{busy?'保存中…':'問題文を保存する'}</button></div>{/if}
    </form>
   </section>
  {:else if tab==='qr'}
   <section class="card qr-card"><div><div class="section-kicker">参加者へのご案内</div><h2>代表者1名が読み取ってください</h2><p class="muted">グループごとに1台の端末で参加します。<br/>このQRコードを会場の画面に表示するか、印刷して配布してください。</p><label for="invite-url">参加URL</label><input id="invite-url" value={invite} readonly onclick={(e)=>e.currentTarget.select()}/><div class="button-row"><button class="secondary" onclick={copy}>URLをコピー</button>{#if qr}<a class="secondary" href={qr} download="quiz-qr.png">QR画像を保存</a>{/if}</div><div class="note">参加コード：<code>{id}</code></div>{#if location.hostname==='127.0.0.1'||location.hostname==='localhost'}<div class="notice">このQRコードは開発用です。会場では公開先のURLで表示したQRコードを使用してください。</div>{/if}</div><div class="qr-frame">{#if qr}<img src={qr} alt="グループ登録画面への参加用QRコード" width="280" height="280"/>{:else}<p>QRコードを準備中…</p>{/if}<strong>みんなで ○×クイズ</strong><span>グループの代表者が読み取り</span></div></section>
  {:else}
   <div class="host-dashboard"><div class="host-primary"><section class="card control-card"><div class="question-meta"><span class="section-kicker">いまの問題</span><span class="pill">{quiz.event.current} / 10 問</span></div>
    {#if quiz.event.phase==='setup'}<h2>参加者がそろったら、スタート</h2><p class="muted">10問の問題文を保存し、参加用QRコードを配布してください。</p><div class="setup-check"><span class:ready={quiz.questions.every(q=>q.body.trim())}>01　問題文を準備</span><span>02　グループ登録を確認</span></div><button class="primary" disabled={busy||dirty||!quiz.questions.every(q=>q.body.trim())} onclick={()=>control('start')}>第1問を開始する <span>→</span></button>{#if dirty}<p class="note">先に「問題の準備」で変更を保存してください。</p>{/if}
    {:else if quiz.event.phase==='finished'}<div class="completed-heading"><div class="eyebrow">ALL QUESTIONS COMPLETED</div><h2>全10問、終了しました</h2><p class="muted">参加グループの皆さん、お疲れさまでした。<br/>下には第10問の最終集計を表示しています。</p></div>
    {:else}<div class="host-question"><span class="section-kicker">{quiz.questions[quiz.event.current-1]?.category}</span><h2><span class="question-prefix">Q{String(quiz.event.current).padStart(2,'0')}.</span> {quiz.questions[quiz.event.current-1]?.body}</h2></div>
      {#if quiz.event.phase==='open'}<button class="danger" disabled={busy} onclick={()=>confirmClose=true}>回答を締め切る</button><p class="note">締め切ると、未回答のグループも送信できなくなります。</p>
      {:else}<div class="notice">回答を締め切りました。グループに○×の札を上げてもらいましょう。</div><button class="primary" disabled={busy} onclick={()=>control(quiz!.event.current===10?'finish':'next')}>{quiz.event.current===10?'クイズを終了する':`第${quiz.event.current+1}問を開始する`} <span>→</span></button>{/if}
    {/if}</section>
    <section class="card results-card"><div class="result-title"><h2>回答の集計</h2><span class="section-kicker">司会者だけに表示 · 自動更新</span></div><div class="stat-grid"><div class="stat stat-o"><span>○ を選択</span><strong>{quiz.totals.o}<small>グループ</small></strong></div><div class="stat stat-x"><span>× を選択</span><strong>{quiz.totals.x}<small>グループ</small></strong></div><div class="stat"><span>未回答</span><strong>{quiz.totals.pending}<small>グループ</small></strong></div></div><div class="answer-bar" aria-label={`○ ${quiz.totals.o}、× ${quiz.totals.x}、未回答 ${quiz.totals.pending}`}><span class="bar-o" style:width={(quiz.totals.o/(quiz.groups.length||1)*100)+'%'}></span><span class="bar-x" style:width={(quiz.totals.x/(quiz.groups.length||1)*100)+'%'}></span></div><p class="note">決定済み {quiz.totals.o+quiz.totals.x} / {quiz.groups.length} グループ</p></section></div>
    <aside class="card groups-card"><div class="result-title"><h2>参加グループ</h2><span class="count">{quiz.groups.length}</span></div>{#if quiz.groups.length===0}<div class="empty-state">参加グループを待っています。<br/>QRコードを配布してください。</div><button class="secondary full" onclick={()=>tab='qr'}>参加用QRコードを開く</button>{:else}<ul class="group-list">{#each quiz.groups as group}<li><span>{group.name}</span><strong class:group-o={group.choice==='o'} class:group-x={group.choice==='x'}>{group.choice==='o'?'○':group.choice==='x'?'×':quiz.event.phase==='setup'?'登録済み':'未回答'}</strong></li>{/each}</ul>{/if}</aside>
   </div>
  {/if}
 {/if}
</main>
<dialog bind:this={closeDialog} class="modal card" aria-labelledby="close-heading" oncancel={()=>confirmClose=false}>{#if quiz}<h2 id="close-heading">回答を締め切りますか？</h2><p>未回答のグループは <strong>{quiz.totals.pending}組</strong> です。<br/>締め切り後は回答を受け付けません。</p><div class="button-row"><button class="secondary" onclick={()=>confirmClose=false}>戻る</button><button class="danger" onclick={()=>control('close')}>締め切る</button></div>{/if}</dialog>
