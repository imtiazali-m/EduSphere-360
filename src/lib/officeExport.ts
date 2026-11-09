export interface OfficeColumn { key:string; label:string }

const xmlEscape=(value:unknown)=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
const htmlEscape=(value:unknown)=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

function downloadBlob(filename:string,content:string,mime:string){
 const blob=new Blob([content],{type:mime})
 const url=URL.createObjectURL(blob)
 const link=document.createElement('a')
 link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove()
 window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}

const encoder = new TextEncoder()

function crc32(bytes:Uint8Array){
 let crc=0xffffffff
 for(const byte of bytes){
  crc^=byte
  for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)
 }
 return (crc^0xffffffff)>>>0
}

function write16(view:DataView,offset:number,value:number){view.setUint16(offset,value,true)}
function write32(view:DataView,offset:number,value:number){view.setUint32(offset,value>>>0,true)}

function zipStore(files:{name:string;content:string}[]){
 const localParts:Uint8Array[]=[]
 const centralParts:Uint8Array[]=[]
 let offset=0
 let centralSize=0
 const now=new Date()
 const dosTime=(now.getHours()<<11)|(now.getMinutes()<<5)|Math.floor(now.getSeconds()/2)
 const dosDate=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate()
 for(const file of files){
  const name=encoder.encode(file.name)
  const data=encoder.encode(file.content)
  const checksum=crc32(data)
  const local=new Uint8Array(30+name.length)
  const lv=new DataView(local.buffer)
  write32(lv,0,0x04034b50);write16(lv,4,20);write16(lv,6,0x0800);write16(lv,8,0)
  write16(lv,10,dosTime);write16(lv,12,dosDate);write32(lv,14,checksum)
  write32(lv,18,data.length);write32(lv,22,data.length);write16(lv,26,name.length);write16(lv,28,0)
  local.set(name,30)
  localParts.push(local,data)

  const central=new Uint8Array(46+name.length)
  const cv=new DataView(central.buffer)
  write32(cv,0,0x02014b50);write16(cv,4,20);write16(cv,6,20);write16(cv,8,0x0800);write16(cv,10,0)
  write16(cv,12,dosTime);write16(cv,14,dosDate);write32(cv,16,checksum)
  write32(cv,20,data.length);write32(cv,24,data.length);write16(cv,28,name.length)
  write16(cv,30,0);write16(cv,32,0);write16(cv,34,0);write16(cv,36,0);write32(cv,38,0);write32(cv,42,offset)
  central.set(name,46)
  centralParts.push(central)
  centralSize+=central.length
  offset+=local.length+data.length
 }
 const centralOffset=offset
 const end=new Uint8Array(22)
 const ev=new DataView(end.buffer)
 write32(ev,0,0x06054b50);write16(ev,4,0);write16(ev,6,0);write16(ev,8,files.length);write16(ev,10,files.length)
 write32(ev,12,centralSize);write32(ev,16,centralOffset);write16(ev,20,0)
 const output=new Uint8Array(offset+centralSize+end.length)
 let cursor=0
 for(const part of localParts){output.set(part,cursor);cursor+=part.length}
 for(const part of centralParts){output.set(part,cursor);cursor+=part.length}
 output.set(end,cursor)
 return new Blob([output],{type:'application/zip'})
}

function downloadOfficePackage(filename:string,blob:Blob){
 const url=URL.createObjectURL(blob)
 const link=document.createElement('a')
 link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove()
 window.setTimeout(()=>URL.revokeObjectURL(url),1500)
}

function columnName(index:number){
 let result='';let value=index+1
 while(value>0){const rem=(value-1)%26;result=String.fromCharCode(65+rem)+result;value=Math.floor((value-1)/26)}
 return result
}

export function exportXlsx(filename:string,title:string,rows:Record<string,unknown>[],columns:OfficeColumn[]){
 const titleRow='<row r="1"><c r="A1" t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(title)+'</t></is></c></row>'
 const generatedRow='<row r="2"><c r="A2" t="inlineStr"><is><t xml:space="preserve">Generated '+xmlEscape(new Date().toLocaleString())+' · '+rows.length+' records</t></is></c></row>'
 const header='<row r="3">'+columns.map((column,index)=>'<c r="'+columnName(index)+'3" s="1" t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(column.label)+'</t></is></c>').join('')+'</row>'
 const body=rows.map((row,rowIndex)=>{
  const rowNumber=rowIndex+4
  const cells=columns.map((column,columnIndex)=>{
   const value=row[column.key]
   const ref=columnName(columnIndex)+rowNumber
   if(typeof value==='number'&&Number.isFinite(value))return '<c r="'+ref+'"><v>'+String(value)+'</v></c>'
   if(typeof value==='boolean')return '<c r="'+ref+'" t="b"><v>'+(value?'1':'0')+'</v></c>'
   return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(value)+'</t></is></c>'
  }).join('')
  return '<row r="'+rowNumber+'">'+cells+'</row>'
 }).join('')
 const lastRow=rows.length+3
 const lastCol=columnName(Math.max(0,columns.length-1))
 const worksheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:'+lastCol+lastRow+'"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><sheetData>'+titleRow+generatedRow+header+body+'</sheetData><autoFilter ref="A3:'+lastCol+lastRow+'"/></worksheet>'
 const workbook='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Records" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles">Records!$1:$1</definedName></definedNames></workbook>'
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF244B73"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
 const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'
 const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
 const workbookRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
 const blob=zipStore([
  {name:'[Content_Types].xml',content:contentTypes},{name:'_rels/.rels',content:rootRels},
  {name:'xl/workbook.xml',content:workbook},{name:'xl/_rels/workbook.xml.rels',content:workbookRels},
  {name:'xl/worksheets/sheet1.xml',content:worksheet},{name:'xl/styles.xml',content:styles}
 ])
 downloadOfficePackage(filename.replace(/\.[^.]+$/,'')+'.xlsx',blob)
}

export function exportDocx(filename:string,title:string,rows:Record<string,unknown>[],columns:OfficeColumn[]){
 const cell=(value:unknown,bold=false)=>'<w:tc><w:tcPr><w:tcW w:w="2200" w:type="dxa"/></w:tcPr><w:p><w:r>'+(bold?'<w:rPr><w:b/></w:rPr>':'')+'<w:t xml:space="preserve">'+xmlEscape(value)+'</w:t></w:r></w:p></w:tc>'
 const borders='<w:tblBorders><w:top w:val="single" w:sz="6" w:color="B7C7D8"/><w:left w:val="single" w:sz="6" w:color="B7C7D8"/><w:bottom w:val="single" w:sz="6" w:color="B7C7D8"/><w:right w:val="single" w:sz="6" w:color="B7C7D8"/><w:insideH w:val="single" w:sz="4" w:color="D6E0EA"/><w:insideV w:val="single" w:sz="4" w:color="D6E0EA"/></w:tblBorders>'
 const header='<w:tr><w:trPr><w:tblHeader/></w:trPr>'+columns.map(column=>cell(column.label,true)).join('')+'</w:tr>'
 const body=rows.map(row=>'<w:tr>'+columns.map(column=>cell(row[column.key])).join('')+'</w:tr>').join('')
 const documentXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+
 '<w:p><w:pPr><w:keepNext/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="244B73"/></w:rPr><w:t>'+xmlEscape(title)+'</w:t></w:r></w:p>'+
 '<w:p><w:r><w:rPr><w:color w:val="647A91"/><w:sz w:val="18"/></w:rPr><w:t>Generated '+xmlEscape(new Date().toLocaleString())+' · '+rows.length+' records</w:t></w:r></w:p>'+
 '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>'+borders+'<w:tblLayout w:type="autofit"/></w:tblPr>'+header+body+'</w:tbl>'+
 '<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>'+
 '</w:body></w:document>'
 const contentTypes='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
 const rootRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
 const blob=zipStore([{name:'[Content_Types].xml',content:contentTypes},{name:'_rels/.rels',content:rootRels},{name:'word/document.xml',content:documentXml}])
 downloadOfficePackage(filename.replace(/\.[^.]+$/,'')+'.docx',blob)
}

export function exportExcelXml(filename:string,title:string,rows:Record<string,unknown>[],columns:OfficeColumn[]){
 const header='<Row>'+columns.map(c=>'<Cell ss:StyleID="Header"><Data ss:Type="String">'+xmlEscape(c.label)+'</Data></Cell>').join('')+'</Row>'
 const body=rows.map(row=>'<Row>'+columns.map(c=>{
  const v=row[c.key]
  const numeric=typeof v==='number'&&Number.isFinite(v)
  return '<Cell><Data ss:Type="'+(numeric?'Number':'String')+'">'+xmlEscape(v)+'</Data></Cell>'
 }).join('')+'</Row>').join('')
 const xml='<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>'+
 '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+
 '<Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#23466D" ss:Pattern="Solid"/></Style></Styles>'+
 '<Worksheet ss:Name="Records"><Table><Row><Cell ss:MergeAcross="'+Math.max(0,columns.length-1)+'"><Data ss:Type="String">'+xmlEscape(title)+'</Data></Cell></Row>'+
 header+body+'</Table></Worksheet></Workbook>'
 downloadBlob(filename.replace(/\.[^.]+$/,'')+'.xls',xml,'application/vnd.ms-excel;charset=utf-8')
}

export function exportWordXml(filename:string,title:string,rows:Record<string,unknown>[],columns:OfficeColumn[]){
 const table='<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="6"/><w:left w:val="single" w:sz="6"/><w:bottom w:val="single" w:sz="6"/><w:right w:val="single" w:sz="6"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>'+
 '<w:tr>'+columns.map(c=>'<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>'+xmlEscape(c.label)+'</w:t></w:r></w:p></w:tc>').join('')+'</w:tr>'+
 rows.map(row=>'<w:tr>'+columns.map(c=>'<w:tc><w:p><w:r><w:t>'+xmlEscape(row[c.key])+'</w:t></w:r></w:p></w:tc>').join('')+'</w:tr>').join('')+'</w:tbl>'
 const xml='<?xml version="1.0"?><?mso-application progid="Word.Document"?>'+
 '<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml"><w:body>'+
 '<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>'+xmlEscape(title)+'</w:t></w:r></w:p>'+
 '<w:p><w:r><w:t>Generated '+xmlEscape(new Date().toLocaleString())+'</w:t></w:r></w:p>'+table+
 '<w:sectPr/></w:body></w:wordDocument>'
 downloadBlob(filename.replace(/\.[^.]+$/,'')+'.doc',xml,'application/msword;charset=utf-8')
}

export function printOfficeReport(title:string,rows:Record<string,unknown>[],columns:OfficeColumn[],institutionName:string){
 const tableHead=columns.map(c=>'<th>'+htmlEscape(c.label)+'</th>').join('')
 const tableRows=rows.map(row=>'<tr>'+columns.map(c=>'<td>'+htmlEscape(row[c.key])+'</td>').join('')+'</tr>').join('')
 const html='<!doctype html><html><head><meta charset="utf-8"><title>'+htmlEscape(title)+'</title><style>'+
 'body{font:12px Arial,sans-serif;color:#18324d;padding:28px}h1{font-size:22px;margin:0 0 5px}p{color:#60748a;margin:4px 0 18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd6e2;padding:8px;text-align:left}th{background:#eaf1f8;color:#23466d}tr:nth-child(even){background:#f8fafc}@media print{body{padding:0}button{display:none}}</style></head><body>'+
 '<h1>'+htmlEscape(title)+'</h1><p>'+htmlEscape(institutionName)+' · Generated '+htmlEscape(new Date().toLocaleString())+' · '+rows.length+' records</p>'+
 '<table><thead><tr>'+tableHead+'</tr></thead><tbody>'+tableRows+'</tbody></table>'+
 '<script>window.addEventListener("load",()=>window.print())<\/script></body></html>'
 const blob=new Blob([html],{type:'text/html'})
 const url=URL.createObjectURL(blob)
 const win=window.open(url,'_blank')
 if(!win){URL.revokeObjectURL(url);throw new Error('Allow pop-ups to open the print-ready report.')}
 window.setTimeout(()=>URL.revokeObjectURL(url),10000)
}
