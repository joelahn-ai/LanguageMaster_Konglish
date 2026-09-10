export const STORAGE_KEY = 'word-magician.personal.v1';
export const emptyState = () => ({schemaVersion:1,entries:{},settings:{level:0,fontSize:'normal',includeSentence:true}});
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export function validateState(value) {
  if (!plain(value) || value.schemaVersion !== 1 || !plain(value.entries) || !plain(value.settings)) throw new Error('이 앱의 백업 파일(버전 1)이 아닙니다.');
  const result = emptyState();
  if (Object.keys(value.entries).length > 20000) throw new Error('백업 항목이 너무 많습니다.');
  for (const [id,e] of Object.entries(value.entries)) {
    if (!/^(word|expression):[a-z0-9-]+:[a-z0-9-]+$/i.test(id) || !plain(e) || typeof e.sentence !== 'string' || e.sentence.length > 1200 || typeof e.favorite !== 'boolean' || !['new','seen','practiced'].includes(e.status) || !Number.isSafeInteger(e.updatedAt) || e.updatedAt < 0 || e.updatedAt > Date.now() + 86400000) throw new Error('백업에 올바르지 않은 학습 기록이 있습니다.');
    result.entries[id] = {sentence:e.sentence,favorite:e.favorite,status:e.status,updatedAt:e.updatedAt};
  }
  const s = value.settings;
  if (![0,1,2].includes(s.level) || !['normal','large','largest'].includes(s.fontSize) || typeof s.includeSentence !== 'boolean') throw new Error('백업의 설정 형식이 올바르지 않습니다.');
  result.settings = {level:s.level,fontSize:s.fontSize,includeSentence:s.includeSentence};
  return result;
}
export function loadState(storage) {
  try { const raw = storage.getItem(STORAGE_KEY); return {state: raw ? validateState(JSON.parse(raw)) : emptyState(),error:null}; }
  catch { return {state:emptyState(),error:'기존 기록을 읽지 못했습니다. 원본은 덮어쓰지 않았습니다. 백업을 내보내거나 정상 백업을 복원해 주세요.'}; }
}
export function saveState(storage,state) { storage.setItem(STORAGE_KEY,JSON.stringify(state)); }
export function mergeBackup(current,incoming) {
  const checked = validateState(incoming);
  const result = validateState(current);
  for (const [id,entry] of Object.entries(checked.entries)) {
    if (!result.entries[id] || entry.updatedAt > result.entries[id].updatedAt) result.entries[id] = entry;
  }
  result.settings = checked.settings;
  return result;
}
export function pickNext(pool,previous,random = Math.random) {
  const choices = pool.filter(item=>item.id !== previous);
  return choices.length ? choices[Math.min(choices.length-1,Math.floor(random()*choices.length))] : pool[0];
}
export function entryFor(state,id) { return state.entries[id] || {sentence:'',favorite:false,status:'new',updatedAt:0}; }
export function touchEntry(state,id,patch) {
  state.entries[id] = {...entryFor(state,id),...patch,updatedAt:Date.now()};
}
