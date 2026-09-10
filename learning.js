import {entryFor} from './state.js';
export const wordKey=w=>w.text.normalize('NFKC').trim().toLocaleLowerCase('en-US');
export function wordGroups(items){
  const groups=new Map();
  for(const item of items){const key=wordKey(item);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);}
  return [...groups.values()];
}
export function wordSeen(group,state){return group.some(w=>entryFor(state,w.id).status!=='new');}
export function unseenWords(scope,all,state){
  const byKey=new Map(wordGroups(all).map(g=>[wordKey(g[0]),g]));
  return wordGroups(scope).filter(g=>!wordSeen(byKey.get(wordKey(g[0])),state)).map(g=>g[0]);
}
export function progress(scope,all,state){
  const total=wordGroups(scope).length,remaining=unseenWords(scope,all,state).length;
  return {total,seen:total-remaining,remaining,percent:total?Math.floor((total-remaining)/total*100):0};
}
export function inPeriod(timestamp,period,now=new Date()){
  if(period==='all')return true;
  if(!timestamp)return false;
  const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(period==='week')start.setDate(start.getDate()-(start.getDay()+6)%7);
  else if(period==='month')start.setDate(1);
  const end=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
  return timestamp>=start.getTime()&&timestamp<end.getTime();
}
export function savedItems(items,state,filter='all',period='all',now=new Date()){
  return items.filter(w=>{
    const r=entryFor(state,w.id),eligible=filter==='seen'?r.status!=='new':filter==='favorites'?r.favorite:filter==='written'?Boolean(r.sentence.trim()):r.favorite||r.sentence.trim();
    return eligible&&inPeriod(r.updatedAt,period,now);
  }).sort((a,b)=>entryFor(state,b.id).updatedAt-entryFor(state,a.id).updatedAt);
}
function shuffled(list,random){const result=[...list];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function makeQuiz(source,direction,random=Math.random){
  const answer=w=>direction==='en-ko'?w.meaning:w.text;
  const questions=[];
  if(new Set(source.map(wordKey)).size<4||new Set(source.map(answer)).size<4)return questions;
  for(const target of shuffled(source,random)){
    const seen=new Set([answer(target)]);
    // Other senses of the same word are ambiguous distractors in either direction.
    const distractors=shuffled(source,random).filter(w=>{if(wordKey(w)===wordKey(target)||seen.has(answer(w)))return false;seen.add(answer(w));return true;}).slice(0,3);
    if(distractors.length!==3)continue;
    const options=shuffled([target,...distractors],random).map(w=>({id:w.id,label:answer(w)}));
    questions.push({id:target.id,prompt:direction==='en-ko'?target.text:target.meaning,pos:target.word.pos,options,answer:target.id,answerText:answer(target)});
    if(questions.length===10)break;
  }
  return questions;
}
