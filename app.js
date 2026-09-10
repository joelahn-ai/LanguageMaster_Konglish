import {catalog,contentFor,editions} from './catalog.js';
import {unseenWords,wordGroups,wordKey,progress} from './learning.js';
import {createViews} from './views.js';
import {studyPool,loadState,saveState,mergeBackup,validateState,entryFor,touchEntry,STORAGE_KEY} from './state.js';
import {renderCard,downloadBlob} from './card-image.js';

const app=document.querySelector('#app');
const $=(s,root=document)=>root.querySelector(s);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storage;
try { storage=window.localStorage; } catch { storage={getItem(){throw Error();},setItem(){throw Error();}}; }
const loaded=loadState(storage);
let state=loaded.state,storageError=loaded.error,readBlocked=Boolean(loaded.error),activeId=null,noticeTimer,installPrompt,registration,updateRequested=false;
let items=[],CONTENT_VERSION='',trail=[],trailIndex=-1,goingBack=false;
function syncContent(){const selected=contentFor(state.settings.contentVersion);items=selected.items;CONTENT_VERSION=selected.id;}
syncContent();
if(!state.settings.contentVersion){state.settings.contentVersion=CONTENT_VERSION;persist();}
let offlineStatus='단어집 저장 상태를 확인하는 중이에요.';
const level=()=>state.settings.level;
const pool=()=>studyPool(items,state.settings);
const reviewLabel=w=>w.review.status==='draft'?'학습용 초안 · 언어 검수 전':/AI/.test(w.review.note)?'AI 편집 검토 완료 · 원어민 독립 검수 전':'콘텐츠 편집 검토 완료';
const scopeLabel=()=>state.settings.studyMode==='stage'?'현재 단계만 학습':'이전 단계까지 복습';
const scopeControl=()=>`<div class="scope-control"><label for="study-mode">학습 범위</label><select id="study-mode"><option value="stage">현재 단계만 학습</option><option value="cumulative">이전 단계까지 복습</option></select><p class="hint">‘현재 단계만’은 선택한 단계의 단어만, ‘이전 단계까지’는 기본부터 선택한 단계까지 함께 보여 줘요.</p></div>`;
function bindScope(){const select=$('#study-mode');select.value=state.settings.studyMode;select.onchange=()=>{state.settings.studyMode=select.value;persist();render();};}
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
function study(id){go('#learn/'+encodeURIComponent(id));}
function previousWord(){if(trailIndex<0)return;const index=activeId===null?trailIndex:trailIndex-1;if(index<0)return;trailIndex=index;goingBack=true;study(trail[index]);}
function nextWord(){window.speechSynthesis?.cancel();const choices=unseenWords(pool(),items,state);const next=choices[Math.floor(Math.random()*choices.length)];if(next)study(next.id);else go('#learn/done');}
function start(index){state.settings.level=index;persist();nextWord();}
function renderHome(){views.home();}
const speaker='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4L5 9H2v6h3l6 5zM15 8a6 6 0 010 8M18 4a11 11 0 010 16"/></svg>';
function renderLearn(){
  if(!activeId){app.innerHTML='<section class="empty completion"><h1>이 범위의 단어를 모두 봤어요.</h1><p>새 단어 학습에서는 이미 본 단어가 다시 나오지 않아요.</p><button id="previous">← 이전 단어</button><a class="text-link" href="#quiz">시험으로 복습하기 →</a><a class="text-link" href="#home">단어집 선택</a></section>';$('#previous').disabled=trailIndex<0;$('#previous').onclick=previousWord;return;}
  const w=current(),e=editions[w.level],record=entryFor(state,w.id);
  const forms=items.filter(i=>wordKey(i)===wordKey(w));
  if(record.status==='new')saveEntry(w.id,{status:'seen'});
  const p=progress(pool(),items,state);
  app.innerHTML=`<div class="study-layout" style="--accent:${e.color}"><aside class="study-aside"><a class="text-link" href="#home">← 단어집 선택</a><div class="eyebrow" style="margin-top:20px">0${level()+1} / ${editions[level()].label} 단어집</div><h1>${editions[level()].title}</h1><p class="muted">${editions[level()].subtitle}</p><div class="number">${editions[level()].goal.toLocaleString('en-US')}</div><div class="muted aside-extra">단어 · 누적 목표</div><ol class="steps"><li><span>01</span>단어와 소리 만나기</li><li><span>02</span>예문으로 쓰임 익히기</li><li><span>03</span>내 문장으로 남기기</li></ol><div class="progress-label">${scopeLabel()}: ${p.total}개<br>본 단어 ${p.seen}개 · 남은 단어 ${p.remaining}개</div></aside>
  <article class="study-card" aria-label="${esc(w.text)} 학습 카드"><div class="top-navigation"><button id="previous" ${trailIndex>0?'':'disabled'}>← 이전</button><button class="primary" id="next" aria-label="다음 단어">다음 →</button></div><div class="card-top"><span>${e.label} · ${esc(w.category)}</span><button class="favorite" id="favorite" aria-pressed="${record.favorite}">${record.favorite?'★ 즐겨찾는 단어':'☆ 즐겨찾기'}</button></div><h2 class="word" lang="en">${esc(w.text)}${forms.length>1?'<a class="form-star" href="#word-forms" aria-label="다른 품사와 뜻 보기">*</a>':''}</h2>${forms.length>1?`<div id="word-forms" class="toolbar" role="group" aria-label="품사와 뜻 선택">${forms.map((f,i)=>`<button data-form="${esc(f.id)}" aria-pressed="${f.id===w.id}">${esc(f.word.pos)}${forms.filter(other=>other.word.pos===f.word.pos).length>1?` · ${esc(f.meaning)}`:''}${i===0?' · 기본':''}</button>`).join('')}</div>`:''}<div class="phonetic">미국식 <span lang="en">${esc(w.pronunciation.ipa)}</span> · ${esc(w.word.pos)}</div><p class="meaning">${esc(w.meaning)}</p><button class="listen" id="listen">${speaker} 미국식 발음 듣기</button><div class="hint" id="voice-note"></div>
  <dl class="relations"><div><dt>가까운 말</dt><dd>${esc(w.word.relations.syn || '이 뜻을 자연스럽게 바꿔 쓸 가까운 말은 없어요.')}</dd></div><div><dt>반대말</dt><dd>${esc(w.word.relations.ant || '이 뜻에 자연스럽게 대응하는 반대말은 없어요.')}</dd></div></dl>
  <h3 class="section-title">이렇게 써 보세요</h3><ol class="examples">${w.examples.map((ex,i)=>`<li><span class="example-number">0${i+1}</span><div><div class="en" lang="en">${esc(ex.en)}</div><div class="ko">${esc(ex.ko)}</div></div></li>`).join('')}</ol>
  <div class="write-section"><div class="label-row"><label for="sentence">내 문장</label><span class="save-state" id="save-state">${record.sentence?'이 기기에 저장된 문장':'입력하면 자동으로 저장돼요'}</span></div><textarea id="sentence" lang="en" maxlength="1200" placeholder="${esc(w.prompt)}" aria-describedby="sentence-help">${esc(record.sentence)}</textarea><div class="writing-tools"><button id="use-prompt">문장 시작 힌트 넣기</button><span id="char-count" class="hint">${record.sentence.length} / 1,200</span></div><p id="sentence-help" class="hint">오늘의 일상과 연결해 자유롭게 써 보세요. 자동 교정은 제공하지 않아요.</p><label class="check"><input id="include-sentence" type="checkbox" ${state.settings.includeSentence?'checked':''}>이미지에 내 문장 담기</label></div>
  <div class="card-actions"><button id="make-download">이미지 저장</button><button id="export-card">이 카드 엑셀 저장</button></div><p class="draft-note">${reviewLabel(w)}. 작성한 문장은 이 기기에만 저장돼요.</p><details class="draft-note"><summary>콘텐츠 검토 정보</summary><p>${esc(w.review.note)}</p></details></article></div>`;
  $('#favorite').onclick=()=>{const next=!entryFor(state,w.id).favorite;saveEntry(w.id,{favorite:next});$('#favorite').setAttribute('aria-pressed',next);$('#favorite').textContent=next?'★ 즐겨찾는 단어':'☆ 즐겨찾기';};
  $('#listen').onclick=()=>speak(w.text);
  const input=$('#sentence');
  function saveDraft(){const ok=saveEntry(w.id,{sentence:input.value,status:input.value.trim()?'practiced':'seen'});$('#save-state').textContent=ok?'이 기기에 저장했어요':'저장하지 못했어요 · 백업이 필요해요';$('#char-count').textContent=`${input.value.length} / 1,200`;}
  input.oninput=saveDraft;
  $('#use-prompt').onclick=()=>{if(input.value.trim()){notify('작성 중인 문장이 있어요. 힌트: '+w.prompt);input.focus();return;}input.value=w.prompt.replace(/…/g,'');saveDraft();input.focus();};
  $('#include-sentence').onchange=ev=>{state.settings.includeSentence=ev.target.checked;persist();showStorageWarning();};
  $('#next').onclick=nextWord;$('#previous').onclick=previousWord;
  app.querySelectorAll('[data-form]').forEach(b=>b.onclick=()=>study(b.dataset.form));
  const star=$('.form-star');if(star)star.onclick=ev=>{ev.preventDefault();$('#word-forms').scrollIntoView({block:'nearest'});$('#word-forms button').focus();};
  $('#export-card').onclick=()=>views.exportList([w]);
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
  const buttons=[$('#make-download')];buttons.forEach(b=>b.disabled=true);
  let blob;
  try {blob=await renderCard(w,editions[w.level],state.settings.includeSentence?entryFor(state,w.id).sentence:'');}
  catch {notify('이미지를 만들지 못했어요. 이 페이지를 다시 열고 시도해 주세요.');return;}
  finally{buttons.forEach(b=>b.disabled=false);}
  if(current().id!==w.id || !location.hash.startsWith('#learn'))return;
  const file=new File([blob],`word-magician-${w.text}.png`,{type:'image/png'}), url=URL.createObjectURL(blob);
  const dialog=document.createElement('dialog');dialog.className='image-dialog';dialog.setAttribute('aria-labelledby','image-title');
  dialog.innerHTML=`<div class="dialog-head"><h2 id="image-title">나의 단어 카드</h2><button id="close-image" aria-label="미리보기 닫기">닫기</button></div><img src="${url}" alt="${esc(w.text)} 단어와 예문이 담긴 카드 이미지"><div class="dialog-buttons"><button id="download-file">PNG 다운로드</button></div><p id="share-status" role="status">이미지를 확인한 뒤 다운로드해 주세요. 개인 문장을 포함했는지도 확인해 주세요.</p>`;
  document.body.append(dialog);dialog.showModal();
  $('#close-image',dialog).onclick=()=>dialog.close();
  dialog.onclose=()=>{URL.revokeObjectURL(url);dialog.remove();};
  $('#download-file',dialog).onclick=()=>{downloadBlob(blob,file.name);$('#share-status',dialog).textContent='다운로드를 요청했어요. 브라우저의 다운로드 목록에서 파일을 열어 확인해 주세요.';};
}

function renderSaved(){views.saved();}
function renderSettings(){
  app.innerHTML=`<div class="page-heading"><div class="eyebrow">나에게 맞게, 편안하게</div><h1>설정</h1><p class="muted">보기 편한 글자 크기와 이 기기의 저장 상태를 확인하세요.</p></div><div class="settings-grid">${views.versionsPanel()}
  <section class="settings-panel backup-panel"><h2>내 기록 옮기기 · 백업</h2><p>문장과 즐겨찾기는 <strong>이 기기에만 저장</strong>돼요. PC와 휴대폰 사이에서 자동으로 동기화되지 않아요.</p><div class="backup-actions"><button id="backup">백업 내보내기</button><button class="primary" id="choose-backup">백업 가져오기</button></div><input id="restore" type="file" accept=".json,application/json" hidden aria-label="가져올 JSON 백업 파일">
  <ol class="transfer-steps"><li><strong>PC:</strong> 문장을 작성했던 브라우저와 주소에서 ‘백업 내보내기’를 누르세요.</li><li>내려받은 <strong>.json 파일</strong>을 본인의 휴대폰으로 보내고 다운로드하세요.</li><li><strong>휴대폰:</strong> 설정 → ‘백업 가져오기’ → 파일 선택 → ‘이 백업으로 기록 합치기’를 누르세요.</li></ol><p class="hint">PC에서 localhost로 작성한 문장은 localhost에서 백업해야 해요. 앱의 공개 주소와 기록 저장 공간이 달라요. 파일 선택 창에서는 ‘다운로드’ 폴더를 확인하세요.</p><p class="hint">같은 단어는 더 최근에 수정한 기록을 남겨요. 설정은 백업의 값으로 바뀌어요. 파일에는 직접 쓴 문장이 포함돼요.</p>${readBlocked?'<button id="raw-backup">읽지 못한 원본도 내보내기</button>':''}<div id="restore-preview" aria-live="polite"></div></section>
  <section class="settings-panel"><h2>학습할 단어 범위</h2>${scopeControl()}</section>
  <section class="settings-panel"><h2>글자 크기</h2><label for="font-size" class="hint">카드와 앱 화면의 글자</label><select id="font-size"><option value="normal">기본</option><option value="large">크게</option><option value="largest">더 크게</option></select><p>휴대폰에서 글자를 확대해도 편하게 읽을 수 있도록 조절해 보세요.</p></section>
  <section class="settings-panel"><h2>콘텐츠와 오프라인</h2><p id="offline-status">${esc(offlineStatus)}</p><p>단어 ${wordGroups(items).length}개 · 뜻 ${items.length}개 · 예문 ${items.reduce((n,w)=>n+w.examples.length,0)}개<br>버전 ${esc(CONTENT_VERSION)}<br>저장 완료 후 단어 보기, 문장 작성, 카드 이미지 만들기를 오프라인으로 이용할 수 있어요.</p><p>기기 저장 공간 정리로 앱 데이터가 삭제될 수 있어요. 중요한 문장은 백업해 주세요.</p></section>
  <section class="settings-panel"><h2>미국식 발음</h2><p id="voice-setting"></p><button id="test-voice">발음 시험 듣기</button><p>별도 음성 파일: 미준비 · 다운로드한 음성 0개.<br>현재는 기기의 미국 영어 음성을 사용해요. 오프라인 재생 가능 여부는 음성 설정과 기기에 따라 달라요.</p></section>
  <section class="settings-panel"><h2>홈 화면에 설치</h2><p id="install-status">${matchMedia('(display-mode: standalone)').matches?'독립된 앱 창에서 실행 중이에요.':'안드로이드 Chrome 메뉴의 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 이용해 주세요.'}</p><button id="install" ${installPrompt?'':'hidden'}>앱 설치</button><p>휴대폰에서 설치·오프라인·파일 공유를 확인할 때는 HTTPS 주소가 필요해요. PC의 localhost는 개발용으로 사용할 수 있어요.</p><button id="update" ${registration?.waiting?'':'hidden'}>새 버전 적용</button></section>
</div>`;
  views.bindVersions();bindScope();$('#choose-backup').onclick=()=>{$('#restore').value='';$('#restore-preview').replaceChildren();$('#restore').click();};
  $('#font-size').value=state.settings.fontSize;$('#font-size').onchange=ev=>{state.settings.fontSize=ev.target.value;applyFont();persist();showStorageWarning();};
  $('#test-voice').onclick=()=>speak('Ready');showVoiceStatus();
  $('#backup').onclick=()=>{downloadBlob(new Blob([JSON.stringify({...state,app:'word-magician',exportedAt:new Date().toISOString(),contentVersion:CONTENT_VERSION},null,2)],{type:'application/json'}),`word-magician-backup-${new Date().toISOString().slice(0,10)}.json`);notify('백업 다운로드를 요청했어요. 다운로드 목록을 확인해 주세요.');};
  if($('#raw-backup'))$('#raw-backup').onclick=()=>{try{const raw=storage.getItem(STORAGE_KEY);if(!raw)throw Error();downloadBlob(new Blob([raw],{type:'application/json'}),'word-magician-recovery.json');}catch{notify('저장소 원본에 접근할 수 없어요.');}};
  $('#restore').onchange=async ev=>{
    const file=ev.target.files[0];if(!file)return;
    const target=$('#restore-preview');target.replaceChildren();target.removeAttribute('role');
    try{
      if(file.size>6*1024*1024)throw new Error('6MB 이하의 백업 파일을 선택해 주세요.');
      const parsed=validateState(JSON.parse(await file.text()));
      if(!target.isConnected || $('#restore').files[0]!==file)return;
      target.className='restore-preview';target.innerHTML=`<p>${esc(file.name)}에서 ${Object.keys(parsed.entries).length}개 기록을 확인했어요. 같은 단어의 기록을 비교해 합칠 준비가 됐어요.</p><button class="secondary" id="apply-restore">이 백업으로 기록 합치기</button>`;
      $('#apply-restore').onclick=()=>{try{const merged=mergeBackup(state,parsed);saveState(storage,merged);state=merged;readBlocked=false;storageError=null;applyFont();render();notify('백업을 복원했어요. 내 카드에서 문장을 확인해 주세요.');}catch{notify('기록을 저장하지 못해 복원하지 않았어요. 기기 저장 공간을 확인해 주세요.');}};
    }catch(err){target.textContent=err instanceof SyntaxError?'JSON 형식의 백업 파일이 아니에요.':err.message;target.setAttribute('role','alert');}
  };
  $('#install').onclick=async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;$('#install').hidden=true;};
  $('#update').onclick=()=>{if(registration?.waiting){updateRequested=true;registration.waiting.postMessage({type:'ACTIVATE'});}};
}
function render(){
  syncContent();$('#content-summary').textContent=`학습 단어집 · ${wordGroups(items).length}개`;applyFont();const hash=location.hash || '#home';let route=hash.split('/')[0];
  if(!['#home','#learn','#saved','#quiz','#settings'].includes(route))route='#home';
  if(route==='#learn'){
    let id;try{id=decodeURIComponent(hash.split('/')[1]||'');}catch{}
    const requested=items.find(i=>i.id===id);
    if(requested){activeId=requested.id;if(requested.level>level() || (state.settings.studyMode==='stage' && requested.level!==level())){state.settings.level=requested.level;persist();}}
    if(hash==='#learn/done')activeId=null;
    else if(!requested){const choices=unseenWords(pool(),items,state);activeId=choices[Math.floor(Math.random()*choices.length)]?.id??null;}
    if(activeId){if(!goingBack && trail[trailIndex]!==activeId){trail=trail.slice(0,trailIndex+1);trail.push(activeId);trailIndex=trail.length-1;}goingBack=false;}
  }
  document.querySelectorAll('.main-nav a').forEach(a=>{if(a.hash===route)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  ({'#home':renderHome,'#learn':renderLearn,'#saved':renderSaved,'#quiz':views.quiz,'#settings':renderSettings})[route]();showStorageWarning();
}
window.addEventListener('hashchange',()=>{document.querySelector('dialog')?.close();render();window.scrollTo({top:0,behavior:'instant'});app.focus({preventScroll:true});});
window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();installPrompt=ev;if($('#install'))$('#install').hidden=false;});
window.addEventListener('appinstalled',()=>{installPrompt=null;if($('#install-status'))$('#install-status').textContent='설치 요청이 완료됐어요. 홈 화면에서 앱을 열어 보세요.';if($('#install'))$('#install').hidden=true;});
window.addEventListener('storage',ev=>{
  if(ev.key!==STORAGE_KEY)return;
  if(document.activeElement?.id==='sentence'){notify('다른 창의 기록이 바뀌었어요. 현재 문장을 저장한 뒤 다시 열어 주세요.');return;}
  const next=loadState(storage);if(!next.error){state=next.state;render();}
});
const views=createViews({app,$,esc,editions,catalog,scopeControl,bindScope,start,study,notify,
  context:()=>({items,state,version:CONTENT_VERSION}),
  selectVersion(id){if(!catalog.some(s=>s.id===id))return;state.settings.contentVersion=id;persist();syncContent();activeId=null;trail=[];trailIndex=-1;render();notify('단어집 버전을 바꿨어요. 기존 기록은 그대로예요.');},
  async checkUpdates(){try{if(!registration){notify('앱 업데이트를 준비 중이에요. 잠시 뒤 다시 눌러 주세요.');return;}await registration.update();notify(registration.waiting?'새 버전이 준비됐어요. 아래의 새 버전 적용을 눌러 주세요.':'새 배포를 확인했어요. 업데이트가 준비되면 적용 버튼이 나타나요.');if(registration.waiting && $('#update'))$('#update').hidden=false;}catch{notify('새 배포를 확인하지 못했어요. 인터넷 연결을 확인해 주세요.');}}
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
      const data=await reply;offlineStatus=data.ready?'단어집 저장 완료 · 단어와 예문을 오프라인으로 볼 수 있어요.':'단어집 저장이 끝나지 않았어요. 인터넷에 연결한 채 다시 열어 주세요.';
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
  }).catch(()=>{offlineStatus='단어집을 오프라인으로 저장하지 못했어요. 연결 상태를 확인하고 다시 열어 주세요.';if($('#offline-status'))$('#offline-status').textContent=offlineStatus;});
}else checkOffline();
