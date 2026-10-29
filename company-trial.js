/* Company trials use the existing membership RLS; never join a default company. */
(function(){
 const trial=new URLSearchParams(location.search).get('trial')==='1';
 const card=document.createElement('section');card.className='card';card.id='companyTrial';
 if(!trial){
  const a=document.createElement('a');a.href='?trial=1';a.textContent='会社・店舗ごとの利用はこちら';a.className='tip';
  card.append(a);document.querySelector('main').append(card);return;
 }
 document.title='お弁当注文カレンダー｜会社・店舗別';
 $('chappyImport')?.classList.add('hidden');
 $('salesHeading').textContent='お弁当売上集計';
 document.querySelector('.hero h1').textContent='お弁当注文カレンダー';
 document.querySelector('.hero p').textContent='会社・店舗ごとに注文を管理できます。';
 card.innerHTML='<h2 class="section-title">お店の利用を始める</h2><p class="tip">初めての会社は、会社・店舗名を入力して開始してください。すでにご利用中の会社のスタッフは、その会社の参加コードで参加してください。</p><div id="trialSetup"><div class="field"><label for="trialName">会社・店舗名</label><input id="trialName" maxlength="100" placeholder="例：〇〇弁当"></div><div class="controls"><button id="trialCreate" type="button">自分の会社用に始める</button></div><details style="margin-top:16px"><summary>会社の参加コードを持っている方</summary><div class="field"><label for="trialCode">自分の会社の参加コード</label><input id="trialCode" autocomplete="off" maxlength="128"></div><div class="controls"><button id="trialJoin" type="button">自分の会社に参加する</button></div></details></div><div id="trialCompany" class="hidden"><strong id="trialCompanyName"></strong><p class="tip">同じ会社のスタッフには下の参加コードを伝えてください。参加コードを知っている方は、この会社の注文を閲覧・変更できます。</p><p id="trialCompanyCode" style="overflow-wrap:anywhere;font-weight:700"></p></div><p id="trialStatus" role="status" aria-live="polite"></p><p class="tip">ブラウザーや端末を変えるときも、自分の会社の参加コードを使います。コードを控えてください。チャッピーの契約は不要です。</p>';
 document.querySelector('.hero').insertAdjacentElement('afterend',card);
 $('connectionSetup').closest('section').style.display='none';
 // Keep the logout/reload controls available without exposing technical setup.
 card.append($('logout'),document.createTextNode(' '),$('reloadOrders'));
 let busy=false;
 function render(){
  const joined=!!currentGroup;
  $('trialSetup').classList.toggle('hidden',joined);
  $('trialCompany').classList.toggle('hidden',!joined);
  if(joined){$('trialCompanyName').textContent='利用中：'+currentGroup.name;$('trialCompanyCode').textContent='参加コード：'+currentGroup.invite_code;}
  $('trialCreate').disabled=busy||!db;$('trialJoin').disabled=busy||!db;
  if(!busy&&!db)$('trialStatus').textContent='接続の準備中です。しばらくしても進まない場合は再読み込みしてください。';
 }
 async function ensureIdentity(){
  if(!db)throw Error('接続の準備中です。再読み込みしてください。');
  if(!sessionUser){
   const {data,error}=await db.auth.signInAnonymously();if(error)throw error;
   if(sessionUser?.id!==data.user.id)resetSession(data.user);
  }
  if(currentGroup)throw Error('このブラウザーはすでに会社に参加しています。別会社の登録は別の端末・ブラウザーで行ってください。');
 }
 async function run(action){
  if(busy)return;busy=true;render();$('trialStatus').textContent='準備しています…';
  try{await ensureIdentity();await action();$('trialStatus').textContent='準備できました。下の「＋ 新規」から注文書を入れてください。';}
  catch(error){$('trialStatus').textContent='開始できませんでした：'+error.message;}
  finally{busy=false;render();}
 }
 $('trialCreate').onclick=()=>{
  const name=$('trialName').value.trim();if(!name){$('trialStatus').textContent='会社・店舗名を入力してください。';$('trialName').focus();return;}
  run(async()=>{
   const {data,error}=await db.rpc('create_order_group',{p_name:name});if(error)throw error;
   const group=Array.isArray(data)?data[0]?.group_id:data?.group_id;
   if(!group)throw Error('会社の作成結果を確認できませんでした。重ねて作らず、再読み込みしてください。');
   writeCloudSetting('obento-group:'+db.supabaseUrl,group);await refreshGroup();
   if(!currentGroup||currentGroup.id!==group)throw Error('会社への接続を確認できませんでした。再読み込みしてください。');
  });
 };
 $('trialJoin').onclick=()=>{
  const code=$('trialCode').value.trim();if(!code){$('trialStatus').textContent='自分の会社の参加コードを入力してください。';return;}
  run(async()=>{const {data,error}=await db.rpc('join_order_group',{p_invite_code:code});if(error)throw error;writeCloudSetting('obento-group:'+db.supabaseUrl,data);await refreshGroup();if(!currentGroup||currentGroup.id!==data)throw Error('参加を確認できませんでした。再読み込みしてください。');$('trialCode').value='';});
 };
 // Observe asynchronous login and group loading without changing their behavior.
 const observer=new MutationObserver(render);
 observer.observe($('groupInfo'),{childList:true,subtree:true,characterData:true});
 observer.observe($('cloudStatus'),{childList:true,subtree:true,characterData:true});
 render();setTimeout(render,1500);
})();
