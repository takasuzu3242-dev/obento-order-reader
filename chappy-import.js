/* ChatGPT draft import: fills review fields only; never writes orders. */
(function(){
'use strict';
const fields=['date','time','count','amount','store','product','rice','tea','packing','bags','trash','allergy','remarks'];
const docs=['deliveryDocument','invoiceRequired','receiptRequired'];
function validateDraft(raw){
 if(!raw||raw.version!==1||!raw.fields||typeof raw.fields!=='object'||Array.isArray(raw.fields))throw Error('取り込みデータの形式が違います。');
 const out={};
 for(const key of fields){const v=raw.fields[key];if(v!==undefined&&typeof v!=='string')throw Error('入力内容の形式が違います。');out[key]=v||'';if(out[key].length>(key==='remarks'?5000:1000))throw Error('入力内容が長すぎます。');}
 if(!parseDeliveryDate(out.date)||!parseDeliveryTime(out.time))throw Error('お届け日・時間を確認してください。');
 if(!/^[1-9]\d*(?:個)?$/.test(out.count)||!Number.isSafeInteger(Number(out.count.replace('個',''))))throw Error('個数を確認してください。');
 if(out.amount!==''&&normalizeSalesValue(out.amount)===null)throw Error('金額を確認してください。');
 for(const key of docs){out[key]=raw.fields[key]||'要確認';if(!['要確認','必要','不要'].includes(out[key]))throw Error('書類の指定を確認してください。');}
 return out;
}
const card=document.createElement('section');card.className='card';card.id='chappyImport';
card.innerHTML='<h2 class="section-title">チャッピーの読み取りを取り込む</h2><p class="tip">チャットでもらった「確認画面を開く」リンクで、読み取り結果が入力されます。保存はご自身で押してください。PDF自体は添付されません。</p><details><summary>取り込みデータを貼り付ける</summary><div class="field"><label for="chappyData">チャッピーから受け取った取り込みデータ</label><textarea id="chappyData" rows="4" maxlength="16000"></textarea></div><button type="button" id="chappyApply">確認画面に入れる（保存しない）</button></details><p id="chappyStatus" role="status" aria-live="polite"></p>';
$('calendarView').insertAdjacentElement('afterend',card);
function apply(raw){
 const data=validateDraft(raw);
 if(orderReadingBusy||orderSaveBusy)throw Error('読み取り・保存の完了後に取り込んでください。');
 const hasDraft=!$('results').classList.contains('hidden')&&(selected||fields.some(k=>$(k).value.trim()));
 if(hasDraft&&!window.confirm('入力中の内容をチャッピーの読み取り結果に置き換えますか？保存済みの注文は変わりません。'))return false;
 selected=null;for(const input of fileInputs)input.value='';
 pendingOrderSave=null;manuallyEditedDocuments.clear();
 $('preview').removeAttribute('src');$('preview').style.display='none';$('pdfPreview').style.display='none';$('selectedFile').classList.add('hidden');
 $('read').disabled=true;$('saveWithoutFile').classList.add('hidden');
 for(const key of [...fields,...docs])$(key).value=data[key];
 $('newOrderPanel').classList.remove('hidden');$('results').classList.remove('hidden');
 $('parseWarnings').textContent='チャッピーの読み取り結果です。未保存です。日付・個数・金額と、同じ注文が登録済みでないかをご確認ください。元のPDFは添付されません。';
 $('parseWarnings').classList.remove('hidden');
 $('status').textContent='チャッピーから入力しました（未保存・PDF添付なし）';
 $('copied').textContent='内容を確認して「共有カレンダーに登録」を押すと保存されます。';
 $('chappyStatus').textContent='確認画面に入力しました。まだ保存していません。';
 $('chappyData').value='';
 $('results').scrollIntoView({behavior:'smooth',block:'start'});return true;
}
$('chappyApply').onclick=()=>{try{apply(JSON.parse($('chappyData').value));}catch(e){$('chappyStatus').textContent='取り込めませんでした：'+e.message;}};
function importHash(){
 if(!location.hash.startsWith('#chappy='))return;
 const encoded=location.hash.slice(8);
 // The fragment is local to the browser. Clear it before any cloud work.
 history.replaceState(null,'',location.pathname+location.search);
 try{
  if(encoded.length>22000||!/^[A-Za-z0-9_-]+$/.test(encoded))throw Error('取り込みリンクの形式が違います。');
  const bytes=Uint8Array.from(atob(encoded.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  apply(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
 }catch(e){$('chappyStatus').textContent='取り込めませんでした：'+e.message;card.scrollIntoView({block:'start'});}
}
window.addEventListener('hashchange',importHash);importHash();
})();
