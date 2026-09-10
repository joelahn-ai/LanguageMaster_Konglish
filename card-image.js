// 화면 버튼과 입력창을 제외한 독립적인 이미지 레이아웃. 긴 문장은 높이를 늘립니다.
export function wrapText(context,text,maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    // 공백을 유지하며 우선 단어 단위로 감싸고, 긴 단어는 글자 단위로 나눕니다.
    for (const token of paragraph.match(/\S+\s*|\s+/gu) || ['']) {
      if (line && context.measureText(line+token).width > maxWidth) { lines.push(line.trimEnd()); line=''; }
      for (const char of token) {
        if (line && context.measureText(line+char).width > maxWidth) { lines.push(line.trimEnd()); line=''; }
        line += char;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
export async function renderCard(item,edition,sentence) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서 이미지를 만들 수 없습니다.');
  const width=720, padding=52, maxWidth=width-padding*2;
  const sans='Arial, "Malgun Gothic", "Noto Sans KR", sans-serif';
  const blocks=[];
  let y=48;
  function add(text,size=24,color='#25332e',gap=16,serif=false) {
    const font=`${size}px ${serif?'Georgia, "Times New Roman", serif':sans}`;
    ctx.font=font;
    const lines=wrapText(ctx,text,maxWidth);
    const lineHeight=Math.ceil(size*1.55);
    blocks.push({lines,font,color,y,lineHeight});
    y+=lines.length*lineHeight+gap;
  }
  add('언어의 마술사',21,edition.color,12);
  add(`${edition.label} · ${item.category} · 학습용 샘플`,18,'#657068',28);
  add(item.text,58,'#25332e',4,true);
  add(`미국식 ${item.pronunciation.ipa} · ${item.word?.pos || '표현'}`,21,'#657068',16);
  add(item.meaning,29,'#25332e',26);
  if (item.word) {
    add(`가까운 말  ${item.word.relations.syn}`,21,'#657068',10);
    add(`반대말  ${item.word.relations.ant || '이 뜻에 자연스럽게 대응하는 반대말은 없어요.'}`,21,'#657068',28);
  }
  item.examples.forEach((e,i)=> { add(`0${i+1}  ${e.en}`,25,'#25332e',4); add(e.ko,22,'#657068',24); });
  if (sentence.trim()) { add('내 문장',20,edition.color,8); add(sentence,25,'#25332e',26); }
  add('하나의 단어를, 나의 말로.',19,edition.color,0);
  const height=y+44;
  // 긴 작문도 Android의 캔버스 크기 한도 내에 머물도록 배율만 조정합니다.
  const scale=Math.min(2,8000/height);
  canvas.width=Math.ceil(width*scale); canvas.height=Math.ceil(height*scale);
  ctx.scale(scale,scale);
  ctx.fillStyle='#faf9f5';ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#ffffff';ctx.beginPath();ctx.roundRect(22,22,width-44,height-44,24);ctx.fill();
  ctx.strokeStyle='#dce1d9';ctx.lineWidth=1;ctx.stroke();
  ctx.textBaseline='top';
  for(const b of blocks) {
    ctx.font=b.font;ctx.fillStyle=b.color;
    b.lines.forEach((line,i)=>ctx.fillText(line,padding,b.y+i*b.lineHeight));
  }
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob) throw new Error('이미지를 만들지 못했습니다. 다시 시도해 주세요.');
  return blob;
}
export function downloadBlob(blob,name) {
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
