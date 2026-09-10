import {items,editions,CONTENT_VERSION} from './data.js';
import {archivedSets} from './content-history.js';
import {wordKey} from './learning.js';
export {editions};
export const catalog=[{id:CONTENT_VERSION,title:'최신 단어집',items},...archivedSets.filter(s=>s.id!==CONTENT_VERSION)];
export const contentFor=id=>catalog.find(s=>s.id===id)||catalog[0];
// Multiple senses count once, at the word's earliest learning stage.
export function summarizeContent(items,previous=null){
  const words=new Map(),older=previous===null?null:new Set(previous.map(wordKey));
  for(const w of items){const key=wordKey(w);words.set(key,Math.min(words.get(key)??2,w.level));}
  const levels=[0,0,0];for(const level of words.values())levels[level]++;
  return {total:words.size,senses:items.length,levels,added:older===null?null:[...words.keys()].filter(key=>!older.has(key)).length};
}
