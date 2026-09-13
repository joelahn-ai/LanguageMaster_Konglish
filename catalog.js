import * as data from './data.js';
const {items,editions,CONTENT_VERSION}=data;
import {archivedSets} from './content-history.js';
import {wordKey} from './learning.js';
export {editions};
export const releaseTitle=scope=>scope==='basic-intermediate'?'기본·중급 우선판':scope==='full'?'전체 10,000단어집':'최신 단어집';
export const scopeNote=scope=>scope==='basic-intermediate'?'기본 1,000 · 중급 3,000단어 우선판이에요. 기존 확장 6개는 중급으로 옮겼으며 문장과 진도는 이어집니다. 확장 단어집은 이번 배포에 포함되지 않아요.':'';
export const catalog=[{id:CONTENT_VERSION,title:releaseTitle(data.RELEASE_SCOPE),releaseScope:data.RELEASE_SCOPE??'legacy',items},...archivedSets.filter(s=>s.id!==CONTENT_VERSION)];
export const contentFor=id=>catalog.find(s=>s.id===id)||catalog[0];
// Multiple senses count once, at the word's earliest learning stage.
export function summarizeContent(items,previous=null){
  const words=new Map(),older=previous===null?null:new Set(previous.map(wordKey));
  for(const w of items){const key=wordKey(w);words.set(key,Math.min(words.get(key)??2,w.level));}
  const levels=[0,0,0];for(const level of words.values())levels[level]++;
  return {total:words.size,senses:items.length,levels,added:older===null?null:[...words.keys()].filter(key=>!older.has(key)).length};
}
