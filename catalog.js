import {items,editions,CONTENT_VERSION} from './data.js';
import {archivedSets} from './content-history.js';
export {editions};
export const catalog=[{id:CONTENT_VERSION,title:'최신 단어집',items},...archivedSets.filter(s=>s.id!==CONTENT_VERSION)];
export const contentFor=id=>catalog.find(s=>s.id===id)||catalog[0];
