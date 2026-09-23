<script lang="ts">
 import Participant from "./Participant.svelte";
 import Host from "./Host.svelte";
 import { onMount } from "svelte";
 const eventId=new URLSearchParams(location.search).get("e")??"";
 const isHost=location.pathname==="/host";
 onMount(()=>{const context=(document as any).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();try{Promise.resolve(context.registerTool({name:"read_quiz_state",description:"Read the same quiz state available to the current participant or event host. Does not submit an answer.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},async execute(input:unknown){if(!input||typeof input!=="object"||Object.keys(input).length)throw new Error("Expected an empty object");if(!eventId)return {screen:isHost?"host-home":"join"};const response=await fetch(`/api/events/${eventId}/${isHost?"host":"state"}`);if(!response.ok)throw new Error("Quiz state unavailable");return response.json()}},{signal:lifecycle.signal})).catch(()=>{})}catch{}return()=>lifecycle.abort()});
 let code='';let error='';
 function enter(){const value=code.trim();let id=value;try{id=new URL(value).searchParams.get('e')??value}catch{}if(!/^[a-f0-9]{16}$/.test(id)){error='QRコードに添えられた参加コードを入力してください。';return}location.href='/?e='+id}
</script>
<svelte:head><title>みんなで ○×クイズ</title></svelte:head>
<header class="topbar"><a class="brand" href="/"><span class="brand-mark">○×</span> みんなで<span class="brand-end">○×クイズ</span></a><a class="host-link" href="/host">司会者はこちら <span>↗</span></a></header>
{#if isHost}<Host id={eventId}/>{:else if eventId}<Participant id={eventId}/>{:else}<main class="welcome">
 <div class="eyebrow">TEAM QUIZ · 全10問</div>
 <h1>相談して、選んで、<br/>みんなで札を上げよう。</h1>
 <p class="intro">グループの代表者1名が登録してください。<br/>答えはみんなで相談して決めましょう。</p>
 <div class="entry-grid"><section class="card entry"><div class="section-kicker">グループで参加</div><h2>クイズに参加する</h2><p>会場のQRコードを読み取るか、参加コードを入力してください。</p><form onsubmit={(e)=>{e.preventDefault();enter()}}><label for="code">参加コード</label><input id="code" bind:value={code} placeholder="参加コードを入力" autocomplete="off" required/>{#if error}<p class="error" role="alert">{error}</p>{/if}<button class="primary" type="submit">参加画面へ <span>→</span></button></form><div class="note">1グループにつき、登録は1台の端末で。</div></section><aside class="rules"><div class="symbol-pair" aria-hidden="true"><span>○</span><span>×</span></div><h2>参加の3ステップ</h2><ol><li><b>01</b><div><strong>グループを登録</strong><small>代表者がグループ名を入力します。</small></div></li><li><b>02</b><div><strong>相談して○か×を選ぶ</strong><small>「決定」までは変更できます。</small></div></li><li><b>03</b><div><strong>決定したら、札を上げる</strong><small>決定後の回答は変更できません。</small></div></li></ol></aside></div>
 <section class="lineup"><span>本日のクイズ</span><div><b>01—02</b> 狂言</div><div><b>03—04</b> 伝統工芸</div><div><b>05—10</b> 雑学・学校</div></section>
</main>{/if}<footer>みんなで ○×クイズ <span>集計結果は司会者だけに表示されます。</span></footer>
