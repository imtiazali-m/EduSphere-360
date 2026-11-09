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
