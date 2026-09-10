import {items,editions,CONTENT_VERSION} from './data.js';
import {emptyState,loadState,saveState,mergeBackup,validateState,pickNext,entryFor,touchEntry,STORAGE_KEY} from './state.js';
import {renderCard,downloadBlob} from './card-image.js';

const app=document.querySelector('#app');
const $=(s,root=document)=>root.querySelector(s);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storage;
try { storage=window.localStorage; } catch { storage={getItem(){throw Error();},setItem(){throw Error();}}; }
const loaded=loadState(storage);
let state=loaded.state,storageError=loaded.error,readBlocked=Boolean(loaded.error),activeId=null,filter='all',noticeTimer,installPrompt,registration,updateRequested=false;
let offlineStatus='샘플 저장 상태를 확인하는 중이에요.';
const level=()=>state.settings.level;
const pool=()=>items.filter(i=>i.level<=level());
const current=()=>items.find(i=>i.id===activeId) || pool()[0];
function notify(text){$('#notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').textContent='',6500);}
function persist(){
  try {
    if(readBlocked) throw Error();
    saveState(storage,state);storageError=null;return true;
  }catch {storageError=readBlocked?loaded.error:'이 기기에 저장하지 못했습니다. 작성 내용은 현재 화면에만 있으니 설정에서 백업해 주세요.';return false;}
}
function saveEntry(id,patch){touchEntry(state,id,patch);const ok=persist();showStorageWarning();return ok;}
function showStorageWarning(){
  let warning=$('.storage-warning');
  if(storageError){if(!warning){warning=document.createElement('div');warning.className='storage-warning';warning.setAttribute('role','alert');app.prepend(warning);}warning.textContent=storageError;}
  else warning?.remove();
}
function applyFont(){document.documentElement.style.fontSize=({normal:16,large:19,largest:22})[state.settings.fontSize]+'px';}
function go(hash){if(location.hash===hash)render();else location.hash=hash;}
function study(id){activeId=id;go('#learn/'+encodeURIComponent(id));}
function start(index){state.settings.level=index;persist();study(pickNext(pool(),activeId).id);}
function mosaic(goal){return `<div class="mosaic" role="img" aria-label="전체 10,000단어 중 목표 ${goal.toLocaleString()}개. 학습 진도가 아닌 구성 계획입니다.">${Array.from({length:100},(_,k)=>`<i class="${k<goal/100?(k<10?'base':k<40?'middle':'advanced'):''}"></i>`).join('')}</div>`;}
function renderHome(){
  app.innerHTML=`<div class="intro"><div><div class="eyebrow">나의 영어, 한 단어씩</div><h1>작은 단어 하나로<br>일상의 말을 넓혀 보세요.</h1><p>듣고, 읽고, 내 문장으로 남기는 나만의 단어집.</p></div><span class="sample-note">먼저 만나 보는 36개의 단어</span></div>
  <div class="collections">${editions.map((e,i)=>`<section class="collection" style="--accent:${e.color}"><div class="eyebrow">0${i+1} / ${e.label} 단어집</div><div class="number">${e.goal.toLocaleString('en-US')}</div><div class="muted">단어 · 누적 목표</div><h2>${e.title}</h2><p class="description">${e.subtitle}</p>${mosaic(e.goal)}<div class="hint">한 칸 100단어 · 구성 계획</div><div class="composition">${i===0?'기본 1,000개':i===1?'기본 1,000 + 중급 3,000개':'기본 1,000 + 중급 3,000 + 확장 6,000개'}<br><strong>지금은 샘플 ${items.filter(w=>w.level<=i).length}개를 학습할 수 있어요.</strong></div><button data-start="${i}">${e.label} 단어 만나기 <span aria-hidden="true">↗</span></button></section>`).join('')}</div>
  <div class="home-bottom"><p><strong>한 단어를 나의 말로 만드는 다섯 걸음</strong><br>단어 보기 → 발음 듣기 → 예문 읽기 → 내 문장 쓰기 → 카드로 남기기</p><a class="text-link" href="#saved">내 카드 모아 보기 →</a></div><p class="draft-note">36개 단어와 예문은 학습 흐름을 확인하기 위한 자체 작성 초안입니다. 정식 언어 검수와 전체 단어집 제작은 이후에 진행해요.</p>`;
  app.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>start(Number(b.dataset.start)));
}
const speaker='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4L5 9H2v6h3l6 5zM15 8a6 6 0 010 8M18 4a11 11 0 010 16"/></svg>';
function renderLearn(){
  const w=current(),e=editions[w.level],record=entryFor(state,w.id);
  if(record.status==='new')saveEntry(w.id,{status:'seen'});
  app.innerHTML=`<div class="study-layout" style="--accent:${e.color}"><aside class="study-aside"><a class="text-link" href="#home">← 단어집 선택</a><div class="eyebrow" style="margin-top:20px">0${level()+1} / ${editions[level()].label} 단어집</div><h1>${editions[level()].title}</h1><p class="muted">${editions[level()].subtitle}</p><div class="number">${editions[level()].goal.toLocaleString('en-US')}</div><div class="muted aside-extra">단어 · 누적 목표</div><ol class="steps"><li><span>01</span>단어와 소리 만나기</li><li><span>02</span>예문으로 쓰임 익히기</li><li><span>03</span>내 문장으로 남기기</li></ol><div class="progress-label">현재 학습 범위: 샘플 ${pool().length}개<br>이 범위에서 만나 본 단어 ${pool().filter(i=>entryFor(state,i.id).status!=='new').length}개</div></aside>
  <article class="study-card" aria-label="${esc(w.text)} 학습 카드"><div class="card-top"><span>${e.label} · ${w.category}</span><button class="favorite" id="favorite" aria-pressed="${record.favorite}">${record.favorite?'★ 즐겨찾는 단어':'☆ 즐겨찾기'}</button></div><h2 class="word" lang="en">${esc(w.text)}</h2><div class="phonetic">미국식 <span lang="en">${w.pronunciation.ipa}</span> · ${w.word.pos}</div><p class="meaning">${w.meaning}</p><button class="listen" id="listen">${speaker} 미국식 발음 듣기</button><div class="hint" id="voice-note"></div>
  <dl class="relations"><div><dt>가까운 말</dt><dd>${w.word.relations.syn}</dd></div><div><dt>반대말</dt><dd>${w.word.relations.ant || '이 뜻에 자연스럽게 대응하는 반대말은 없어요.'}</dd></div></dl>
  <h3 class="section-title">이렇게 써 보세요</h3><ol class="examples">${w.examples.map((ex,i)=>`<li><span class="example-number">0${i+1}</span><div><div class="en" lang="en">${esc(ex.en)}</div><div class="ko">${esc(ex.ko)}</div></div></li>`).join('')}</ol>
  <div class="write-section"><div class="label-row"><label for="sentence">내 문장</label><span class="save-state" id="save-state">${record.sentence?'이 기기에 저장된 문장':'입력하면 자동으로 저장돼요'}</span></div><textarea id="sentence" lang="en" maxlength="1200" placeholder="${esc(w.prompt)}" aria-describedby="sentence-help">${esc(record.sentence)}</textarea><div class="writing-tools"><button id="use-prompt">문장 시작 힌트 넣기</button><span id="char-count" class="hint">${record.sentence.length} / 1,200</span></div><p id="sentence-help" class="hint">오늘의 일상과 연결해 자유롭게 써 보세요. 자동 교정은 제공하지 않아요.</p><label class="check"><input id="include-sentence" type="checkbox" ${state.settings.includeSentence?'checked':''}>이미지에 내 문장 담기</label></div>
  <div class="card-actions"><button id="make-image">카드 공유</button><button id="make-download">이미지 저장</button><button class="primary" id="next">새 단어 보기 <span aria-hidden="true">↗</span></button></div><p class="draft-note">학습용 샘플 · 언어 검수 전. 작성한 문장은 이 기기에만 저장돼요.</p></article></div>`;
  $('#favorite').onclick=()=>{const next=!entryFor(state,w.id).favorite;saveEntry(w.id,{favorite:next});$('#favorite').setAttribute('aria-pressed',next);$('#favorite').textContent=next?'★ 즐겨찾는 단어':'☆ 즐겨찾기';};
  $('#listen').onclick=()=>speak(w.text);
  const input=$('#sentence');
  function saveDraft(){const ok=saveEntry(w.id,{sentence:input.value,status:input.value.trim()?'practiced':'seen'});$('#save-state').textContent=ok?'이 기기에 저장했어요':'저장하지 못했어요 · 백업이 필요해요';$('#char-count').textContent=`${input.value.length} / 1,200`;}
  input.oninput=saveDraft;
  $('#use-prompt').onclick=()=>{if(input.value.trim()){notify('작성 중인 문장이 있어요. 힌트: '+w.prompt);input.focus();return;}input.value=w.prompt.replace(/…/g,'');saveDraft();input.focus();};
  $('#include-sentence').onchange=ev=>{state.settings.includeSentence=ev.target.checked;persist();showStorageWarning();};
  $('#next').onclick=()=>{window.speechSynthesis?.cancel();study(pickNext(pool(),w.id).id);};
  $('#make-image').onclick=()=>prepareImage(w);
  $('#make-download').onclick=()=>prepareImage(w);
  showVoiceStatus();
}
function voices(){return window.speechSynthesis?.getVoices().filter(v=>/^en[-_]US$/i.test(v.lang)) || [];}
function preferredVoice(){return voices().find(v=>v.localService) || voices()[0];}
function showVoiceStatus(){
  const v=preferredVoice();
  const text=!('speechSynthesis' in window)?'이 브라우저는 음성 읽기를 지원하지 않아요.':v?`기기 음성: ${v.name} · ${v.localService?'기기 내 음성으로 표시됨. 오프라인 재생은 휴대폰에서 확인해 주세요.':'인터넷이 필요할 수 있어요.'}`:'미국 영어 음성을 찾는 중이에요. 계속 표시되면 기기의 음성 출력 설정에서 영어(미국)를 준비해 주세요.';
  if($('#voice-note'))$('#voice-note').textContent=text;
  if($('#voice-setting'))$('#voice-setting').textContent=text;
}
let speechTimeout;
function speak(text){
  const voice=preferredVoice();showVoiceStatus();
  if(!voice){notify('미국 영어 음성이 준비되지 않았어요. 기기의 음성 출력 설정에서 영어(미국)를 설치한 뒤 다시 눌러 주세요.');return;}
  window.speechSynthesis.cancel();clearTimeout(speechTimeout);
  const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.voice=voice;utterance.rate=.85;
  utterance.onstart=()=>{clearTimeout(speechTimeout);notify('미국식 발음을 재생하고 있어요.');};
  utterance.onerror=ev=>{clearTimeout(speechTimeout);if(!['canceled','interrupted'].includes(ev.error))notify('발음을 재생하지 못했어요. 음량, 인터넷 연결, 영어(미국) 음성 설정을 확인해 주세요.');};
  speechTimeout=setTimeout(()=>notify('음성이 들리지 않으면 기기의 음량과 영어(미국) 음성 설정을 확인해 주세요.'),6000);
  window.speechSynthesis.speak(utterance);
}
window.speechSynthesis?.addEventListener('voiceschanged',showVoiceStatus);
async function prepareImage(w){
  const buttons=[$('#make-image'),$('#make-download')];buttons.forEach(b=>b.disabled=true);
  let blob;
  try {blob=await renderCard(w,editions[w.level],state.settings.includeSentence?entryFor(state,w.id).sentence:'');}
  catch {notify('이미지를 만들지 못했어요. 이 페이지를 다시 열고 시도해 주세요.');return;}
  finally{buttons.forEach(b=>b.disabled=false);}
  if(current().id!==w.id || !location.hash.startsWith('#learn'))return;
  const file=new File([blob],`word-magician-${w.text}.png`,{type:'image/png'}), url=URL.createObjectURL(blob);
  const dialog=document.createElement('dialog');dialog.className='image-dialog';dialog.setAttribute('aria-labelledby','image-title');
  dialog.innerHTML=`<div class="dialog-head"><h2 id="image-title">나의 단어 카드</h2><button id="close-image" aria-label="미리보기 닫기">닫기</button></div><img src="${url}" alt="${esc(w.text)} 단어와 예문이 담긴 카드 이미지"><div class="dialog-buttons"><button class="primary" id="share-file">카드 공유</button><button id="download-file">PNG 다운로드</button></div><p id="share-status" role="status">이미지를 확인한 뒤 공유하거나 다운로드해 주세요. 개인 문장을 포함했는지도 확인해 주세요.</p>`;
  document.body.append(dialog);dialog.showModal();
  let supported=false;try{supported=Boolean(navigator.canShare?.({files:[file]})&&navigator.share);}catch{}
  if(!supported){$('#share-file',dialog).hidden=true;$('#share-status',dialog).textContent='이 브라우저는 이미지 파일 공유를 지원하지 않아요. PNG 다운로드를 이용해 주세요.';}
  $('#close-image',dialog).onclick=()=>dialog.close();
  dialog.onclose=()=>{URL.revokeObjectURL(url);dialog.remove();};
  $('#download-file',dialog).onclick=()=>{downloadBlob(blob,file.name);$('#share-status',dialog).textContent='다운로드를 요청했어요. 브라우저의 다운로드 목록에서 파일을 열어 확인해 주세요.';};
  $('#share-file',dialog).onclick=async()=>{
    const button=$('#share-file',dialog);button.disabled=true;
    try{await navigator.share({files:[file],title:`언어의 마술사 · ${w.text}`});$('#share-status',dialog).textContent='공유 대상으로 카드를 전달했어요. 저장 여부는 선택한 앱에서 확인해 주세요.';}
    catch(err){$('#share-status',dialog).textContent=err.name==='AbortError'?'공유를 취소했어요. 카드는 그대로 있어요.':'공유를 시작하지 못했어요. PNG 다운로드를 이용해 주세요.';}
    finally{button.disabled=false;}
  };
}
function renderSaved(){
  const saved=items.filter(i=>{const r=entryFor(state,i.id);return filter==='favorites'?r.favorite:filter==='written'?Boolean(r.sentence.trim()):r.favorite||r.sentence.trim();}).sort((a,b)=>entryFor(state,b.id).updatedAt-entryFor(state,a.id).updatedAt);
  app.innerHTML=`<div class="page-heading"><div class="eyebrow">나의 말이 된 단어들</div><h1>내 카드</h1><p class="muted">즐겨찾는 단어와 직접 쓴 문장을 다시 만나 보세요.</p></div><div class="toolbar" aria-label="내 카드 필터">${[['all','전체'],['favorites','즐겨찾기'],['written','문장 있는 카드']].map(([id,label])=>`<button data-filter="${id}" aria-pressed="${filter===id}">${label}</button>`).join('')}</div><p class="muted">${saved.length}개의 카드</p><div class="saved-list">${saved.map(w=>{const r=entryFor(state,w.id);return `<article class="saved-item"><div><h2 lang="en">${w.text}${r.favorite?' <span aria-label="즐겨찾기">☆</span>':''}</h2><p>${w.meaning}</p>${r.sentence?`<p class="saved-sentence" lang="en">${esc(r.sentence)}</p>`:''}</div><button data-open="${w.id}">문장 수정 · 공유</button></article>`;}).join('') || '<div class="empty">아직 모아 둔 카드가 없어요.<br>단어에 별을 누르거나 내 문장을 써 보세요.<br><a class="text-link" href="#learn">단어 만나러 가기 →</a></div>'}</div>`;
  app.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;renderSaved();showStorageWarning();});
  app.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{const w=items.find(i=>i.id===b.dataset.open);state.settings.level=Math.max(level(),w.level);persist();study(w.id);});
}
function renderSettings(){
  app.innerHTML=`<div class="page-heading"><div class="eyebrow">나에게 맞게, 편안하게</div><h1>설정</h1><p class="muted">보기 편한 글자 크기와 이 기기의 저장 상태를 확인하세요.</p></div><div class="settings-grid">
  <section class="settings-panel"><h2>글자 크기</h2><label for="font-size" class="hint">카드와 앱 화면의 글자</label><select id="font-size"><option value="normal">기본</option><option value="large">크게</option><option value="largest">더 크게</option></select><p>휴대폰에서 글자를 확대해도 편하게 읽을 수 있도록 조절해 보세요.</p></section>
  <section class="settings-panel"><h2>콘텐츠와 오프라인</h2><p id="offline-status">${esc(offlineStatus)}</p><p>단어 36개 · 예문 108개<br>버전 ${CONTENT_VERSION}<br>저장 완료 후 단어 보기, 문장 작성, 카드 이미지 만들기를 오프라인으로 이용할 수 있어요.</p><p>기기 저장 공간 정리로 앱 데이터가 삭제될 수 있어요. 중요한 문장은 백업해 주세요.</p></section>
  <section class="settings-panel"><h2>미국식 발음</h2><p id="voice-setting"></p><button id="test-voice">발음 시험 듣기</button><p>별도 음성 파일: 미준비 · 다운로드한 음성 0개.<br>현재는 기기의 미국 영어 음성을 사용해요. 오프라인 재생 가능 여부는 음성 설정과 기기에 따라 달라요.</p></section>
  <section class="settings-panel"><h2>홈 화면에 설치</h2><p id="install-status">${matchMedia('(display-mode: standalone)').matches?'독립된 앱 창에서 실행 중이에요.':'안드로이드 Chrome 메뉴의 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 이용해 주세요.'}</p><button id="install" ${installPrompt?'':'hidden'}>앱 설치</button><p>휴대폰에서 설치·오프라인·파일 공유를 확인할 때는 HTTPS 주소가 필요해요. PC의 localhost는 개발용으로 사용할 수 있어요.</p><button id="update" ${registration?.waiting?'':'hidden'}>새 버전 적용</button></section>
  <section class="settings-panel"><h2>내 기록 백업</h2><p>문장, 즐겨찾기, 학습 상태와 설정을 JSON 파일로 보관해요. 기기 사이의 기록은 자동으로 동기화되지 않아요.</p><button id="backup">백업 파일 다운로드</button>${readBlocked?'<button id="raw-backup">읽지 못한 원본도 내보내기</button>':''}<p>백업 파일에는 직접 쓴 문장이 들어 있어요. 본인이 보관할 위치를 선택해 주세요.</p></section>
  <section class="settings-panel"><h2>백업 복원</h2><p>기존 기록과 합치고, 같은 단어는 더 최근에 수정한 기록을 남겨요. 설정은 백업의 값으로 바뀌어요.</p><label class="hint" for="restore">이 앱에서 내려받은 JSON 백업 선택</label><input class="file-input" id="restore" type="file" accept=".json,application/json"><div id="restore-preview"></div></section></div>`;
  $('#font-size').value=state.settings.fontSize;$('#font-size').onchange=ev=>{state.settings.fontSize=ev.target.value;applyFont();persist();showStorageWarning();};
  $('#test-voice').onclick=()=>speak('Ready');showVoiceStatus();
  $('#backup').onclick=()=>{downloadBlob(new Blob([JSON.stringify({...state,app:'word-magician',exportedAt:new Date().toISOString(),contentVersion:CONTENT_VERSION},null,2)],{type:'application/json'}),`word-magician-backup-${new Date().toISOString().slice(0,10)}.json`);notify('백업 다운로드를 요청했어요. 다운로드 목록을 확인해 주세요.');};
  if($('#raw-backup'))$('#raw-backup').onclick=()=>{try{const raw=storage.getItem(STORAGE_KEY);if(!raw)throw Error();downloadBlob(new Blob([raw],{type:'application/json'}),'word-magician-recovery.json');}catch{notify('저장소 원본에 접근할 수 없어요.');}};
  $('#restore').onchange=async ev=>{
    const file=ev.target.files[0];if(!file)return;
    const target=$('#restore-preview');target.replaceChildren();
    try{
      if(file.size>6*1024*1024)throw new Error('6MB 이하의 백업 파일을 선택해 주세요.');
      const parsed=validateState(JSON.parse(await file.text()));
      if(!target.isConnected)return;
      target.className='restore-preview';target.innerHTML=`<p>백업에서 ${Object.keys(parsed.entries).length}개 기록을 확인했어요. 같은 단어의 기록을 비교해 합칠 준비가 됐어요.</p><button class="secondary" id="apply-restore">이 백업으로 기록 합치기</button>`;
      $('#apply-restore').onclick=()=>{try{const merged=mergeBackup(state,parsed);saveState(storage,merged);state=merged;readBlocked=false;storageError=null;applyFont();render();notify('백업을 복원했어요. 내 카드에서 문장을 확인해 주세요.');}catch{notify('기록을 저장하지 못해 복원하지 않았어요. 기기 저장 공간을 확인해 주세요.');}};
    }catch(err){target.textContent=err instanceof SyntaxError?'JSON 형식의 백업 파일이 아니에요.':err.message;target.setAttribute('role','alert');}
  };
  $('#install').onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;$('#install').hidden=true;};
  $('#update').onclick=()=>{if(registration?.waiting){updateRequested=true;registration.waiting.postMessage({type:'ACTIVATE'});}};
}
function render(){
  applyFont();const hash=location.hash || '#home';let route=hash.split('/')[0];
  if(!['#home','#learn','#saved','#settings'].includes(route))route='#home';
  if(route==='#learn'){
    let id;try{id=decodeURIComponent(hash.split('/')[1]||'');}catch{}
    const requested=items.find(i=>i.id===id);
    if(requested){activeId=requested.id;if(requested.level>level()){state.settings.level=requested.level;persist();}}
    if(!pool().some(i=>i.id===activeId))activeId=pool()[0].id;
  }
  document.querySelectorAll('.main-nav a').forEach(a=>{if(a.hash===route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  ({'#home':renderHome,'#learn':renderLearn,'#saved':renderSaved,'#settings':renderSettings})[route]();showStorageWarning();
}
window.addEventListener('hashchange',()=>{document.querySelector('dialog')?.close();render();window.scrollTo({top:0,behavior:'instant'});app.focus({preventScroll:true});});
window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();installPrompt=ev;if($('#install'))$('#install').hidden=false;});
window.addEventListener('appinstalled',()=>{installPrompt=null;if($('#install-status'))$('#install-status').textContent='설치 요청이 완료됐어요. 홈 화면에서 앱을 열어 보세요.';if($('#install'))$('#install').hidden=true;});
window.addEventListener('storage',ev=>{
  if(ev.key!==STORAGE_KEY)return;
  if(document.activeElement?.id==='sentence'){notify('다른 창의 기록이 바뀌었어요. 현재 문장을 저장한 뒤 다시 열어 주세요.');return;}
  const next=loadState(storage);if(!next.error){state=next.state;render();}
});
render();
async function checkOffline(){
  try{
    if(!isSecureContext||!('serviceWorker'in navigator)){offlineStatus='이 주소에서는 오프라인 저장을 사용할 수 없어요. HTTPS 또는 PC의 localhost에서 열어 주세요.';}
    else {
      const channel=new MessageChannel();
      const reply=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error()),5000);channel.port1.onmessage=ev=>{clearTimeout(timer);channel.port1.close();resolve(ev.data);};});
      const ready=await navigator.serviceWorker.ready;
      ready.active.postMessage({type:'STATUS'},[channel.port2]);
      const data=await reply;offlineStatus=data.ready?'샘플 저장 완료 · 단어와 예문을 오프라인으로 볼 수 있어요.':'샘플 저장이 끝나지 않았어요. 인터넷에 연결한 채 다시 열어 주세요.';
    }
  }catch{offlineStatus='오프라인 저장 상태를 확인하지 못했어요. 인터넷에 연결한 채 다시 열어 주세요.';}
  if($('#offline-status'))$('#offline-status').textContent=offlineStatus;
}
if('serviceWorker'in navigator && isSecureContext){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested)location.reload();else checkOffline();});
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    registration=reg;
    function waiting(){if(reg.waiting && navigator.serviceWorker.controller){notify('새 버전이 준비됐어요. 설정에서 적용해 주세요.');if($('#update'))$('#update').hidden=false;}}
    waiting();reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){waiting();checkOffline();}});});
    checkOffline();
  }).catch(()=>{offlineStatus='샘플을 오프라인으로 저장하지 못했어요. 연결 상태를 확인하고 다시 열어 주세요.';if($('#offline-status'))$('#offline-status').textContent=offlineStatus;});
}else checkOffline();
