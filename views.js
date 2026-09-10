import {studyPool,entryFor} from './state.js';
import {wordGroups,progress,savedItems,makeQuiz} from './learning.js';
import {exportWorkbook} from './excel-export.js';
import {downloadBlob} from './card-image.js';
import {summarizeContent} from './catalog.js';
export function createViews(env){
  const {app,esc,$,editions}=env;
  let filter='all',period='all',quizSource='seen',direction='en-ko',quiz=null,savedPage=0;
  const buttonGroup=(options,selected,attr)=>options.map(([value,label])=>`<button ${attr}="${value}" aria-pressed="${value===selected}">${label}</button>`).join('');
  function home(){
    const {items,state}=env.context();
    app.innerHTML=`<div class="intro"><div><div class="eyebrow">나의 영어, 한 단어씩</div><h1>작은 단어 하나로<br>일상의 말을 넓혀 보세요.</h1><p>듣고, 읽고, 내 문장으로 남기는 나만의 단어집.</p></div><span class="sample-note">${wordGroups(items).length}개 단어 · ${items.length}개 뜻</span></div>${env.scopeControl()}<div class="collections">${editions.map((e,i)=>{
      const p=progress(studyPool(items,{...state.settings,level:i}),items,state);
      return `<section class="collection" style="--accent:${e.color}"><div class="eyebrow">0${i+1} / ${e.label} 단어집</div><div class="number">${p.percent}<span class="percent-sign">%</span></div><div class="muted">현재 학습 범위 달성률</div><h2>${e.title}</h2><p class="description">${e.subtitle}</p><div class="mosaic" role="img" aria-label="${e.label} 달성률 ${p.percent}%, ${p.total}개 중 ${p.seen}개 봄">${Array.from({length:100},(_,k)=>`<i class="${k<p.percent?'lit':''}"></i>`).join('')}</div><div class="hint">한 칸 1% · ${p.seen} / ${p.total}개 확인</div><div class="composition">${state.settings.studyMode==='stage'?'현재 단계만':'이전 단계 포함'} · 남은 단어 ${p.remaining}개<br><span class="hint">단어집 구성 목표: 신규 ${e.newCount.toLocaleString()}개</span></div><button data-start="${i}">${p.remaining?'새 단어 학습':'학습 완료 확인'} <span aria-hidden="true">↗</span></button></section>`;
    }).join('')}</div><div class="home-bottom"><p><strong>한 번 본 단어는 새 단어 학습에서 다시 나오지 않아요.</strong><br>이전 버튼, 내 카드, 시험에서는 다시 볼 수 있어요.</p><a class="text-link" href="#quiz">시험으로 복습하기 →</a></div>`;
    env.bindScope();app.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>env.start(Number(b.dataset.start)));
  }
  function saved(){
    const {items,state}=env.context(),list=savedItems(items,state,filter,period);
    const pageSize=50,pages=Math.max(1,Math.ceil(list.length/pageSize));savedPage=Math.min(savedPage,pages-1);
    const visible=list.slice(savedPage*pageSize,(savedPage+1)*pageSize);
    app.innerHTML=`<div class="page-heading"><div class="eyebrow">나의 말이 된 단어들</div><h1>내 카드</h1><p class="muted">즐겨찾기와 내 문장, 이미 본 단어를 다시 만나 보세요.</p></div><div class="toolbar" aria-label="내 카드 종류">${buttonGroup([['all','내 카드 전체'],['favorites','즐겨찾기'],['written','문장 있는 카드'],['seen','이미 본 단어']],filter,'data-filter')}</div><div class="toolbar" aria-label="기간 필터">${buttonGroup([['all','전체 기간'],['day','오늘'],['week','이번 주'],['month','이번 달']],period,'data-period')}</div><p class="hint">마지막 학습 기록·문장·즐겨찾기 수정일 기준 · 이번 주는 월요일부터예요.</p><div class="export-bar"><p>${list.length}개 뜻 · ${wordGroups(list).length}개 단어</p><button id="export-saved" ${list.length?'':'disabled'}>이 목록 엑셀 저장</button></div><p class="hint">필터에 보이는 카드와 내 문장을 .xlsx로 저장해요. A4 가로 인쇄 설정이 포함돼요.</p><div class="saved-list">${visible.map(w=>{
      const r=entryFor(state,w.id);return `<article class="saved-item"><div><h2 lang="en">${esc(w.text)}${r.favorite?' ☆':''}</h2><p>${esc(w.word.pos)} · ${esc(w.meaning)}</p>${r.sentence?`<p class="saved-sentence">${esc(r.sentence)}</p>`:''}<p class="hint">${new Date(r.updatedAt).toLocaleDateString('ko-KR')}</p></div><button data-open="${esc(w.id)}">카드 열기</button></article>`;
    }).join('')||'<div class="empty">이 조건에 맞는 카드가 없어요.<br>다른 기간을 선택하거나 단어를 학습해 보세요.</div>'}</div>`;
    if(pages>1){
      $('.saved-list').insertAdjacentHTML('beforebegin',`<nav class="toolbar saved-pages" aria-label="카드 목록 페이지"><button id="cards-prev" ${savedPage?'':'disabled'}>← 이전 목록</button><span aria-live="polite">${savedPage+1} / ${pages}쪽</span><button id="cards-next" ${savedPage+1<pages?'':'disabled'}>다음 목록 →</button></nav><p class="hint">${savedPage*pageSize+1}–${Math.min((savedPage+1)*pageSize,list.length)}번째 카드 · 엑셀에는 전체 ${list.length.toLocaleString()}개가 들어가요.</p>`);
      $('#cards-prev').onclick=()=>{savedPage--;saved();};$('#cards-next').onclick=()=>{savedPage++;saved();};
    }
    app.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;savedPage=0;saved();});
    app.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=b.dataset.period;savedPage=0;saved();});
    app.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>env.study(b.dataset.open));
    $('#export-saved').onclick=()=>exportList(list);
  }
  function exportList(list){
    if(!list.length)return;
    const {state,version}=env.context();
    try{downloadBlob(exportWorkbook(list,state,version),`word-magician-${new Date().toISOString().slice(0,10)}.xlsx`);env.notify('엑셀 다운로드를 요청했어요. 내 문장이 포함되어 있으니 본인용으로 보관해 주세요.');}
    catch{env.notify('엑셀 파일을 만들지 못했어요. 앱을 다시 열고 시도해 주세요.');}
  }
  function quizPool(){const {items,state}=env.context();return items.filter(w=>{const r=entryFor(state,w.id);return quizSource==='saved'?r.favorite||r.sentence.trim():r.status!=='new';});}
  function renderQuiz(){
    const source=quizPool();
    app.innerHTML=`<div class="page-heading"><div class="eyebrow">떠올리는 만큼 나의 말로</div><h1>시험</h1><p class="muted">사지선다로 뜻을 떠올려 보세요. 시험은 처음 본 단어 진도를 바꾸지 않아요.</p></div><div class="quiz-controls"><div><p>문제 범위</p><div class="toolbar">${buttonGroup([['seen','이미 본 단어'],['saved','내 카드']],quizSource,'data-quiz-source')}</div></div><div><p>출제 방향</p><div class="toolbar">${buttonGroup([['en-ko','ENG → KOR'],['ko-en','KOR → ENG']],direction,'data-direction')}</div></div></div><p class="hint">${wordGroups(source).length}개 단어 · 한 번에 최대 10문항. 선택을 바꾸면 새 시험으로 시작해요.</p><section class="quiz-card" id="quiz-stage"></section>`;
    app.querySelectorAll('[data-quiz-source]').forEach(b=>b.onclick=()=>{quizSource=b.dataset.quizSource;quiz=null;renderQuiz();});
    app.querySelectorAll('[data-direction]').forEach(b=>b.onclick=()=>{direction=b.dataset.direction;quiz=null;renderQuiz();});
    const stage=$('#quiz-stage');
    if(!quiz){
      const candidates=makeQuiz(source,direction);
      stage.innerHTML=candidates.length?'<h2>준비되셨나요?</h2><p>맞힌 문제 수를 시험이 끝난 뒤 확인할 수 있어요.</p><button class="primary" id="start-quiz">시험 시작</button>':'<h2>복습할 단어를 조금 더 모아 주세요.</h2><p>사지선다를 만들려면 선택한 범위에 서로 다른 답을 가진 단어가 최소 4개 필요해요.</p><a class="text-link" href="#learn">새 단어 학습하기 →</a>';
      if($('#start-quiz'))$('#start-quiz').onclick=()=>{quiz={questions:candidates.slice(0,10),index:0,correct:0,selected:null,missed:[]};renderQuiz();};return;
    }
    if(quiz.index>=quiz.questions.length){
      stage.innerHTML=`<h2>시험을 마쳤어요.</h2><div class="number">${quiz.correct} / ${quiz.questions.length}</div><p>정답률 ${Math.round(quiz.correct/quiz.questions.length*100)}%</p>${quiz.missed.length?`<h3>다시 볼 단어</h3><ul>${quiz.missed.map(q=>`<li>${esc(q.prompt)} → ${esc(q.answerText)}</li>`).join('')}</ul>`:'<p>모두 맞혔어요.</p>'}<button class="primary" id="retry-quiz">새 시험</button>`;
      $('#retry-quiz').onclick=()=>{quiz=null;renderQuiz();};return;
    }
    const q=quiz.questions[quiz.index],answered=quiz.selected!==null;
    stage.innerHTML=`<p class="eyebrow">${quiz.index+1} / ${quiz.questions.length} 문항</p><h2 class="quiz-prompt" lang="${direction==='en-ko'?'en':'ko'}">${esc(q.prompt)}</h2><p class="hint">${esc(q.pos)}</p><div class="quiz-options">${q.options.map((o,i)=>`<button data-answer="${esc(o.id)}" ${answered?'disabled':''} class="${answered&&o.id===q.answer?'correct':answered&&o.id===quiz.selected?'incorrect':''}"><span>${i+1}</span>${esc(o.label)}</button>`).join('')}</div><div id="quiz-feedback" role="status">${answered?quiz.selected===q.answer?'정답이에요.':`정답은 ‘${esc(q.answerText)}’예요.`:''}</div>${answered?'<button class="primary" id="quiz-next">다음 문제 →</button>':''}`;
    app.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{if(quiz.selected!==null)return;quiz.selected=b.dataset.answer;if(quiz.selected===q.answer)quiz.correct++;else quiz.missed.push(q);renderQuiz();});
    if($('#quiz-next'))$('#quiz-next').onclick=()=>{quiz.index++;quiz.selected=null;renderQuiz();};
  }
  function versionsPanel(){
    const {version}=env.context();
    const summaries=env.catalog.map((s,i)=>summarizeContent(s.items,env.catalog[i+1]?.items??null));
    return `<section class="settings-panel backup-panel"><h2>단어집 버전 선택</h2><p>원하는 버전을 한 번 눌러 바꿀 수 있어요. 같은 ID의 내 문장과 진도는 버전 사이에 이어집니다.</p><div class="version-list">${env.catalog.map((s,i)=>`<button data-version="${esc(s.id)}" aria-pressed="${s.id===version}"><strong>${esc(s.title)}</strong><span>${esc(s.id)}</span><span>${summaries[i].total.toLocaleString()}개 단어${s.id===version?' · 사용 중':''}</span><span>기본 ${summaries[i].levels[0].toLocaleString()} · 중급 ${summaries[i].levels[1].toLocaleString()} · 확장 ${summaries[i].levels[2].toLocaleString()}</span><span>${summaries[i].added===null?'가장 오래된 보관 버전':summaries[i].added?'이전 버전보다 '+summaries[i].added.toLocaleString()+'개 새 단어 추가':'새 단어 추가 없음 · 뜻·예문·단계 등 편집 변경'}</span></button>`).join('')}</div><button id="check-updates">새 배포 확인</button><p class="hint">새 단어집이 배포되면 앱 새 버전 적용 후 여기에 나타나요. 현재 선택은 자동으로 바뀌지 않아요.</p></section>`;
  }
  function bindVersions(){app.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>{quiz=null;env.selectVersion(b.dataset.version);});$('#check-updates').onclick=env.checkUpdates;}
  return {home,saved,quiz:renderQuiz,versionsPanel,bindVersions,resetQuiz(){quiz=null;},exportList};
}
