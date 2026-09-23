<script lang="ts">
 import { onMount } from 'svelte';
 import QRCode from 'qrcode';
 import { request,message } from './api';
 import type { HostState,QuizEvent } from './types';
 let {id}:{id:string}=$props();
 let events=$state<QuizEvent[]>([]),title=$state('みんなで ○×クイズ'),quiz=$state<HostState|null>(null),tab=$state<'live'|'qr'>('live'),error=$state(''),notice=$state(''),busy=$state(false),qr=$state(''),confirmClose=$state(false),polling=false;
 const invite=$derived(typeof location!=='undefined'?`${location.origin}/?e=${id}`:'');
 let closeDialog=$state<HTMLDialogElement>();
 $effect(()=>{if(confirmClose)closeDialog?.showModal();else closeDialog?.close()});
 const labels:Record<string,string>={setup:'開始前',open:'回答受付中',closed:'回答締め切り',finished:'終了'};
 async function refresh(){if(polling)return;polling=true;try{if(id){quiz=await request<HostState>(`/api/events/${id}/host`);}else events=await request<QuizEvent[]>('/api/events');}catch(e){error=message(e)}finally{polling=false}}
 async function create(){busy=true;error='';try{const event=await request<{id:string}>('/api/events',{title});location.href='/host?e='+event.id}catch(e){error=message(e)}finally{busy=false}}
 async function control(command:string){if(!quiz)return;busy=true;error='';notice='';confirmClose=false;try{await request(`/api/events/${id}/control`,{command,current:quiz.event.current});await refresh();tab='live'}catch(e){error=message(e);await refresh()}finally{busy=false}}
 async function copy(){try{await navigator.clipboard.writeText(invite);notice='参加URLをコピーしました。'}catch{error='コピーできませんでした。表示されているURLを選択してコピーしてください。'}}
 onMount(()=>{void(async()=>{try{await refresh();if(id)qr=await QRCode.toDataURL(invite,{width:440,margin:2,color:{dark:'#172c48',light:'#ffffff'},errorCorrectionLevel:'M'})}catch(e){error=message(e)}})();const timer=setInterval(()=>{if(id&&!busy&&!document.hidden)void refresh()},2500);return()=>clearInterval(timer)});
</script>
<main class="host-main">
 <div class="host-breadcrumb"><a href="/host">司会者画面</a>{#if id}<span>/</span><span>イベント管理</span>{/if}<span class="private-badge">司会者のみ</span></div>
 {#if error}<p class="error" role="alert">{error} <button class="inline-button" onclick={()=>{error='';void refresh()}}>再読み込み</button></p>{/if}
 {#if notice}<p class="success" role="status">{notice}</p>{/if}
 {#if !id}
  <div class="page-heading"><div><div class="eyebrow">HOST CONSOLE</div><h1>クイズの準備をはじめましょう</h1><p class="muted">イベントを作成して、参加用のQRコードを配布できます。</p></div></div>
  <div class="host-home-grid"><section class="card"><div class="section-kicker">新しいイベント</div><h2>イベントを作成する</h2><form onsubmit={(e)=>{e.preventDefault();void create()}}><label for="event-title">イベント名</label><input id="event-title" bind:value={title} maxlength="80" required/><button class="primary" disabled={busy||!title.trim()}>{busy?'作成中…':'イベントを作成'} <span>→</span></button></form><p class="notice">司会者の権限は、このブラウザに1年間保存されます。イベント終了まで同じ端末とブラウザを使用してください。</p><div class="category-list"><div><b>01—02</b><span>狂言</span><small>2問</small></div><div><b>03—04</b><span>伝統工芸</span><small>2問</small></div><div><b>05—10</b><span>雑学・学校</span><small>6問</small></div></div></section>
  <section class="card"><div class="section-kicker">作成済みのイベント</div><h2>イベントを開く</h2>{#if events.length===0}<div class="empty-state">まだイベントはありません。<br/>左のフォームから作成してください。</div>{:else}<div class="event-list">{#each events as event}<a href={'/host?e='+event.id}><strong>{event.title}</strong><span>{labels[event.phase]}　→</span></a>{/each}</div>{/if}</section></div>
 {:else if quiz}
  <div class="page-heading"><div><div class="eyebrow">HOST CONSOLE</div><h1>{quiz.event.title}</h1></div><span class="pill phase" class:is-open={quiz.event.phase==='open'}>{labels[quiz.event.phase]}</span></div>
  <nav class="tabs" aria-label="イベント管理"><button class:active={tab==='live'} onclick={()=>tab='live'}>進行と集計</button><button class:active={tab==='qr'} onclick={()=>tab='qr'}>参加用QRコード</button></nav>
  {#if tab==='qr'}
   <section class="card qr-card"><div><div class="section-kicker">参加者へのご案内</div><h2>代表者1名が読み取ってください</h2><p class="muted">グループごとに1台の端末で参加します。<br/>このQRコードを会場の画面に表示するか、印刷して配布してください。</p><label for="invite-url">参加URL</label><input id="invite-url" value={invite} readonly onclick={(e)=>e.currentTarget.select()}/><div class="button-row"><button class="secondary" onclick={copy}>URLをコピー</button>{#if qr}<a class="secondary" href={qr} download="quiz-qr.png">QR画像を保存</a>{/if}</div><div class="note">参加コード：<code>{id}</code></div>{#if location.hostname==='127.0.0.1'||location.hostname==='localhost'}<div class="notice">このQRコードは開発用です。会場では公開先のURLで表示したQRコードを使用してください。</div>{/if}</div><div class="qr-frame">{#if qr}<img src={qr} alt="グループ登録画面への参加用QRコード" width="280" height="280"/>{:else}<p>QRコードを準備中…</p>{/if}<strong>みんなで ○×クイズ</strong><span>グループの代表者が読み取り</span></div></section>
  {:else}
   <div class="host-dashboard"><div class="host-primary"><section class="card control-card"><div class="question-meta"><span class="section-kicker">いまの問題</span><span class="pill">{quiz.event.current} / 10 問</span></div>
    {#if quiz.event.phase==='setup'}<h2>参加者がそろったら、スタート</h2><p class="muted">参加用QRコードを配布し、グループ登録を確認してください。問題は司会者が会場で出題します。</p><button class="primary" disabled={busy} onclick={()=>control('start')}>第1問を開始する <span>→</span></button>
    {:else if quiz.event.phase==='finished'}<div class="completed-heading"><div class="eyebrow">ALL QUESTIONS COMPLETED</div><h2>全10問、終了しました</h2><p class="muted">チームごとの最終正解数を表示しています。</p></div>
    {:else}<div class="host-question"><h2>第{quiz.event.current}問</h2></div>
      {#if quiz.event.phase==='open'}<button class="danger" disabled={busy} onclick={()=>confirmClose=true}>回答を締め切る</button><p class="note">締め切ると、未回答のグループも送信できなくなります。</p>
      {:else}<div class="notice">回答を締め切りました。グループに○×の札を上げてもらいましょう。</div><button class="primary" disabled={busy} onclick={()=>control(quiz!.event.current===10?'finish':'next')}>{quiz.event.current===10?'クイズを終了する':`第${quiz.event.current+1}問を開始する`} <span>→</span></button>{/if}
    {/if}</section>
    {#if quiz.event.phase==='finished'}<section class="card results-card final-summary"><div class="result-title"><h2>最終結果</h2><span class="section-kicker">司会者だけに表示</span></div><div class="answer-key"><span>正解</span><strong>× × × × ○ ○ × × ○ ×</strong></div><p class="note">正解数の多い順にチームを表示しています。同点の場合は同じ正解数になります。</p></section>{:else}<section class="card results-card"><div class="result-title"><h2>回答の集計</h2><span class="section-kicker">司会者だけに表示 · 自動更新</span></div><div class="stat-grid"><div class="stat stat-o"><span>○ を選択</span><strong>{quiz.totals.o}<small>グループ</small></strong></div><div class="stat stat-x"><span>× を選択</span><strong>{quiz.totals.x}<small>グループ</small></strong></div><div class="stat"><span>未回答</span><strong>{quiz.totals.pending}<small>グループ</small></strong></div></div><div class="answer-bar" aria-label={`○ ${quiz.totals.o}、× ${quiz.totals.x}、未回答 ${quiz.totals.pending}`}><span class="bar-o" style:width={(quiz.totals.o/(quiz.groups.length||1)*100)+'%'}></span><span class="bar-x" style:width={(quiz.totals.x/(quiz.groups.length||1)*100)+'%'}></span></div><p class="note">決定済み {quiz.totals.o+quiz.totals.x} / {quiz.groups.length} グループ</p></section>{/if}</div>
    <aside class="card groups-card"><div class="result-title"><h2>{quiz.event.phase==='finished'?'チーム別正解数':'参加グループ'}</h2><span class="count">{quiz.groups.length}</span></div>{#if quiz.groups.length===0}<div class="empty-state">参加グループを待っています。<br/>QRコードを配布してください。</div><button class="secondary full" onclick={()=>tab='qr'}>参加用QRコードを開く</button>{:else}<ul class="group-list">{#each quiz.groups as group,i}<li class:score-row={quiz.event.phase==='finished'}>{#if quiz.event.phase==='finished'}<span class="rank">{i+1}</span>{/if}<span>{group.name}</span><strong class:score={quiz.event.phase==='finished'} class:group-o={quiz.event.phase!=='finished'&&group.choice==='o'} class:group-x={quiz.event.phase!=='finished'&&group.choice==='x'}>{quiz.event.phase==='finished'?`${group.correctCount ?? 0} / 10問`:group.choice==='o'?'○':group.choice==='x'?'×':quiz.event.phase==='setup'?'登録済み':'未回答'}</strong></li>{/each}</ul>{/if}</aside>
   </div>
  {/if}
 {/if}
</main>
<dialog bind:this={closeDialog} class="modal card" aria-labelledby="close-heading" oncancel={()=>confirmClose=false}>{#if quiz}<h2 id="close-heading">回答を締め切りますか？</h2><p>未回答のグループは <strong>{quiz.totals.pending}組</strong> です。<br/>締め切り後は回答を受け付けません。</p><div class="button-row"><button class="secondary" onclick={()=>confirmClose=false}>戻る</button><button class="danger" onclick={()=>control('close')}>締め切る</button></div>{/if}</dialog>
