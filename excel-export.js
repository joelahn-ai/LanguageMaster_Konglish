// Minimal XLSX writer for printable text cards. All cells are inline strings, never formulas.
const encoder=new TextEncoder();
const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(data){let crc=0xffffffff;for(const b of data)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function header(size,fields){const bytes=new Uint8Array(size),view=new DataView(bytes.buffer);for(const [offset,value,width]of fields)width===2?view.setUint16(offset,value,true):view.setUint32(offset,value,true);return bytes;}
export function zipFiles(files){
  const parts=[],central=[];let offset=0,centralLength=0;
  for(const [path,source] of Object.entries(files)){
    const name=encoder.encode(path),data=encoder.encode(source),crc=crc32(data);
    const local=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[12,33,2],[14,crc,4],[18,data.length,4],[22,data.length,4],[26,name.length,2]]);
    const directory=header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[14,33,2],[16,crc,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[42,offset,4]]);
    parts.push(local,name,data);central.push(directory,name);offset+=local.length+name.length+data.length;centralLength+=directory.length+name.length;
  }
  const count=Object.keys(files).length;
  return new Blob([...parts,...central,header(22,[[0,0x06054b50,4],[8,count,2],[10,count,2],[12,centralLength,4],[16,offset,4]])],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function workbookFiles(items,state,version){
  const widths=[26,28,65,43];
  function segments(value,width){
    const parts=[];let part='',line=1,units=0;
    for(const c of String(value)){
      const size=/[^\x00-\x7F]/.test(c)?1.8:1;
      if(c==='\n'||units+size>width-2){line++;units=0;}
      if(line>24){parts.push(part);part='';line=1;units=0;}
      part+=c;if(c!=='\n')units+=size;
    }
    parts.push(part);return parts;
  }
  const rows=[['단어 · 품사','한국어 뜻','활용 예문 · 한국어 풀이','내 문장']];
  for(const w of items){
    const values=[`${w.text}\n${w.word.pos} · ${w.pronunciation.ipa}`,w.meaning,w.examples.map((e,i)=>`${i+1}. ${e.en}\n${e.ko}`).join('\n\n'),state.entries[w.id]?.sentence||''];
    const parts=values.map((v,i)=>segments(v,widths[i]));
    for(let r=0;r<Math.max(...parts.map(p=>p.length));r++)rows.push(parts.map((p,c)=>p[r]??(c===0?`${w.text} (계속)`:'')));
  }
  const height=row=>Math.min(409,Math.max(38,...row.map((value,i)=>String(value).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil([...line].reduce((s,c)=>s+(/[^\x00-\x7F]/.test(c)?1.8:1),0)/(widths[i]-2))),0)*15+12)));
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:D${rows.length}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((row,r)=>`<row r="${r+1}" ht="${r===0?28:height(row)}" customHeight="1">${row.map((v,c)=>`<c r="${String.fromCharCode(65+c)}${r+1}" s="${r===0?1:r%2?2:3}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:D${rows.length}"/><printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddHeader>${xml('&C언어의 마술사 · '+version)}</oddHeader><oddFooter>${xml('&L내 문장 포함 · 개인 보관용&R&P / &N')}</oddFooter></headerFooter></worksheet>`;
  return {
    '[Content_Types].xml':`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<?xml version="1.0"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="학습 카드" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">'학습 카드'!$1:$1</definedName><definedName name="_xlnm.Print_Area" localSheetId="0">'학습 카드'!$A$1:$D$${rows.length}</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':sheet,
    'xl/styles.xml':`<?xml version="1.0"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF32735A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F6F3"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  };
}
export const exportWorkbook=(items,state,version)=>zipFiles(workbookFiles(items,state,version));
