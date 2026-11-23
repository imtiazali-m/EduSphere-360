import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, BookPlus, Download, ExternalLink, Layers3, Plus, RefreshCw, Search, X, Pencil, Trash2, Link2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { downloadCsv } from '../lib/csv'
import '../styles/library-management.css'

type RecordType='book-registration'|'book-category'|'digital-resource'|'learning-material'|'resource-download'
type LibraryRow={
 id:string;institution_id:string;module_key:string;record_type:RecordType;title:string;
 reference_code?:string|null;description?:string|null;status:string;approval_status:string;
 visibility:'staff_only'|'student_portal'|'parent_portal'|'institution_portal';
 quantity?:number|null;amount?:number|null;payload:Record<string,any>;created_at:string;updated_at:string
}
type LoanRow={id:string;book_record_id:string;student_id?:string|null;status:string;due_at:string}
type Props={workspaceKey:string;onToast:(message:string,error?:boolean)=>void;onNavigate?:(key:string)=>void}
type FormState=Record<string,string>
const libraryPages:Record<string,{title:string;description:string;type?:RecordType}>={
 'library-dashboard':{title:'Library Dashboard',description:'One operating view of your institution catalogue, circulation capacity and learning resources.'},
 'book-catalogue':{title:'Book Catalogue',description:'Search the registered collection, check copy availability and review shelf locations.',type:'book-registration'},
 'book-categories':{title:'Book Categories',description:'Maintain the subjects, disciplines and collections used to classify books.',type:'book-category'},
 'book-management':{title:'Book Management',description:'Maintain bibliographic details, copy counts, shelf locations and circulation fine rules.',type:'book-registration'},
 'book-registration':{title:'Book Registration',description:'Register new books with an ISBN or reference, category, copy count and shelf location.',type:'book-registration'},
 'digital-library':{title:'Digital Library',description:'Publish institution-approved digital books and online reference resources.',type:'digital-resource'},
 'learning-materials':{title:'Learning Materials',description:'Organise learning resources by subject, class and intended audience.',type:'learning-material'},
 'resource-downloads':{title:'Resource Downloads',description:'Provide safe, searchable links to approved downloadable study resources.',type:'resource-download'}
}
const typeLabel:Record<RecordType,string>={
 'book-registration':'Book','book-category':'Category','digital-resource':'Digital resource','learning-material':'Learning material','resource-download':'Download'
}
const emptyForm=(type:RecordType):FormState=>({
 title:'',reference_code:'',description:'',author:'',publisher:'',edition:'',publication_year:'',
 category_id:'',format:'Print',language:'English',shelf_location:'',total_copies:'1',
 purchase_cost:'',fine_per_day:'0',cover_url:'',subject:'',class_name:'',
 resource_url:'',resource_kind:'PDF',visibility:'institution_portal',status:type==='book-category'?'active':'published',tags:''
})
const dateLabel=(value:string|undefined)=>value?new Date(value).toLocaleDateString():'—'
const clean=(value:unknown)=>String(value??'').trim()
const validWebUrl=(value:string)=>{
 if(!value)return ''
 let parsed:URL
 try{parsed=new URL(value)}catch{throw new Error('Enter a complete resource URL beginning with https:// or http://.')}
 if(!['http:','https:'].includes(parsed.protocol))throw new Error('Only secure web links (HTTPS) or HTTP links can be published.')
 return parsed.toString()
}

export function LibraryManagementWorkspace({workspaceKey,onToast,onNavigate}:Props){
 const {user}=useAuth()
 const page=workspaceKey.split(':').slice(-1)[0]||'library-dashboard'
 const pageConfig=libraryPages[page]??libraryPages['library-dashboard']
 const canManage=Boolean(user&&['owner','admin'].includes(user.role))
 const canReadLoans=Boolean(user&&['owner','admin','teacher'].includes(user.role))
 const [records,setRecords]=useState<LibraryRow[]>([])
 const [loans,setLoans]=useState<LoanRow[]>([])
 const [loading,setLoading]=useState(true)
 const [saving,setSaving]=useState(false)
 const [loadError,setLoadError]=useState('')
 const [search,setSearch]=useState('')
 const [formOpen,setFormOpen]=useState(false)
 const [editing,setEditing]=useState<LibraryRow|null>(null)
 const [form,setForm]=useState<FormState>(()=>emptyForm(pageConfig.type??'book-registration'))

 const load=useCallback(async()=>{
  if(!supabase||!user){setLoading(false);return}
  setLoading(true);setLoadError('')
  try{
   const recordsRequest=supabase.from('institutional_records')
    .select('id,institution_id,module_key,record_type,title,reference_code,description,status,approval_status,visibility,quantity,amount,payload,created_at,updated_at')
    .eq('institution_id',user.institutionId).eq('module_key','library')
    .in('record_type',['book-registration','book-category','digital-resource','learning-material','resource-download'])
    .order('title',{ascending:true}).limit(2000)
   const loanRequest=canReadLoans
    ?supabase.from('library_loans').select('id,book_record_id,student_id,status,due_at')
      .eq('institution_id',user.institutionId).order('issued_at',{ascending:false}).limit(5000)
    :Promise.resolve({data:[],error:null} as any)
   const [recordResult,loanResult]=await Promise.all([recordsRequest,loanRequest])
   if(recordResult.error)throw recordResult.error
   if(loanResult.error)throw loanResult.error
   setRecords((recordResult.data??[]) as LibraryRow[])
   setLoans((loanResult.data??[]) as LoanRow[])
  }catch(error){
   setLoadError(error instanceof Error?error.message:'Library information could not be loaded.')
  }finally{setLoading(false)}
 },[user?.id,user?.institutionId,canReadLoans])

 useEffect(()=>{void load()},[load])
 useEffect(()=>{
  if(!formOpen)return
  const previousOverflow=document.body.style.overflow
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&!saving){setFormOpen(false);setEditing(null)}
  }
  document.body.style.overflow='hidden'
  window.addEventListener('keydown',onKeyDown)
  return ()=>{
   document.body.style.overflow=previousOverflow
   window.removeEventListener('keydown',onKeyDown)
  }
 },[formOpen,saving])

 const books=useMemo(()=>records.filter(row=>row.record_type==='book-registration'&&row.status!=='archived'),[records])
 const categories=useMemo(()=>records.filter(row=>row.record_type==='book-category'&&row.status!=='archived'),[records])
 const resources=useMemo(()=>records.filter(row=>row.record_type!=='book-registration'&&row.record_type!=='book-category'&&row.status!=='archived'),[records])
 const activeLoans=useMemo(()=>loans.filter(row=>row.status==='issued'),[loans])
 const issuedByBook=useMemo(()=>{
  const counts=new Map<string,number>()
  for(const row of activeLoans)counts.set(row.book_record_id,(counts.get(row.book_record_id)??0)+1)
  return counts
 },[activeLoans])
 const issuedCount=activeLoans.length
 const overdueCount=activeLoans.filter(row=>row.due_at<new Date().toISOString().slice(0,10)).length
 const totalCopies=books.reduce((sum,row)=>sum+Math.max(0,Number(row.quantity??row.payload?.total_copies??0)),0)
 const availableCopies=books.reduce((sum,row)=>sum+Math.max(0,Number(row.quantity??row.payload?.total_copies??0)-(issuedByBook.get(row.id)??0)),0)

 const visibleRows=useMemo(()=>{
  let source:LibraryRow[]
  if(pageConfig.type==='book-registration')source=books
  else if(pageConfig.type==='book-category')source=categories
  else if(pageConfig.type)source=resources.filter(row=>row.record_type===pageConfig.type)
  else source=records
  const q=search.toLowerCase().trim()
  if(!q)return source
  return source.filter(row=>[
   row.title,row.reference_code,row.description,row.record_type,row.status,
   row.payload?.author,row.payload?.publisher,row.payload?.subject,row.payload?.shelf_location,
   row.payload?.category_name,row.payload?.class_name,row.payload?.resource_url,row.payload?.resource_kind
  ].some(value=>String(value??'').toLowerCase().includes(q)))
 },[pageConfig.type,books,categories,resources,records,search])

 const beginCreate=()=>{
  if(!canManage){onToast('Only the institution owner or administrator can change the library catalogue.',true);return}
  const type=pageConfig.type??'book-registration'
  setEditing(null);setForm(emptyForm(type));setFormOpen(true)
 }
 const beginEdit=(row:LibraryRow)=>{
  if(!canManage)return
  const type=row.record_type
  setEditing(row)
  setForm({
   ...emptyForm(type),
   title:row.title??'',reference_code:row.reference_code??'',description:row.description??'',
   author:clean(row.payload?.author),publisher:clean(row.payload?.publisher),edition:clean(row.payload?.edition),
   publication_year:clean(row.payload?.publication_year),category_id:clean(row.payload?.category_id),
   format:clean(row.payload?.format)||'Print',language:clean(row.payload?.language)||'English',
   shelf_location:clean(row.payload?.shelf_location),total_copies:String(row.quantity??row.payload?.total_copies??1),
   purchase_cost:String(row.amount??row.payload?.purchase_cost??''),fine_per_day:String(row.payload?.fine_per_day??0),
   cover_url:clean(row.payload?.cover_url),subject:clean(row.payload?.subject),class_name:clean(row.payload?.class_name),
   resource_url:clean(row.payload?.resource_url),resource_kind:clean(row.payload?.resource_kind)||'PDF',
   visibility:row.visibility,status:row.status||'published',tags:Array.isArray(row.payload?.tags)?row.payload.tags.join(', '):clean(row.payload?.tags)
  })
  setFormOpen(true)
 }
 function updateForm(key:string,value:string){setForm(current=>({...current,[key]:value}))}

 async function saveRecord(event:FormEvent){
  event.preventDefault()
  if(!supabase||!user||!canManage)return
  const type=editing?.record_type??pageConfig.type
  if(!type){onToast('Choose a supported library record type.',true);return}
  const title=clean(form.title)
  if(title.length<2){onToast('Enter a title with at least two characters.',true);return}
  let quantity:number|null=null,amount:number|null=null,resourceUrl=''
  if(type==='book-registration'){
   quantity=Number(form.total_copies)
   amount=form.purchase_cost.trim()===''?null:Number(form.purchase_cost)
   const fine=Number(form.fine_per_day)
   if(!Number.isInteger(quantity)||quantity<1){onToast('Total copies must be a whole number of at least one.',true);return}
   if(amount!==null&&(!Number.isFinite(amount)||amount<0)){onToast('Purchase cost must be a non-negative amount.',true);return}
   if(!Number.isFinite(fine)||fine<0){onToast('Fine per overdue day must be zero or greater.',true);return}
   const duplicate=books.find(row=>row.id!==editing?.id&&clean(row.reference_code).toLowerCase()&&clean(row.reference_code).toLowerCase()===clean(form.reference_code).toLowerCase())
   if(duplicate){onToast('That ISBN or book reference is already registered in this institution.',true);return}
  }else if(type==='digital-resource'||type==='learning-material'||type==='resource-download'){
   try{resourceUrl=validWebUrl(clean(form.resource_url))}catch(error){onToast(error instanceof Error?error.message:'Check the resource link.',true);return}
   if(form.visibility!=='staff_only'&&form.status!=='published'){
    onToast('Publish the resource before making it visible in student or parent portals.',true);return
   }
  }
  const category=categories.find(row=>row.id===form.category_id)
  const payload:Record<string,unknown>=type==='book-registration'?{
   author:clean(form.author)||null,publisher:clean(form.publisher)||null,edition:clean(form.edition)||null,
   publication_year:form.publication_year.trim()?Number(form.publication_year):null,
   category_id:category?.id??null,category_name:category?.title??null,format:form.format||'Print',
   language:clean(form.language)||'English',shelf_location:clean(form.shelf_location)||null,
   total_copies:quantity,fine_per_day:Number(form.fine_per_day||0),
   purchase_cost:amount,cover_url:clean(form.cover_url)||null,
   tags:clean(form.tags)?clean(form.tags).split(',').map(value=>value.trim()).filter(Boolean):[]
  }:type==='book-category'?{
   subject:clean(form.subject)||null,shelf_location:clean(form.shelf_location)||null,
   parent_category_id:category?.id??null,tags:clean(form.tags)?clean(form.tags).split(',').map(value=>value.trim()).filter(Boolean):[]
  }:{
   resource_url:resourceUrl,resource_kind:form.resource_kind||'PDF',subject:clean(form.subject)||null,
   class_name:clean(form.class_name)||null,category_id:category?.id??null,category_name:category?.title??null,
   author:clean(form.author)||null,publisher:clean(form.publisher)||null,language:clean(form.language)||'English',
   tags:clean(form.tags)?clean(form.tags).split(',').map(value=>value.trim()).filter(Boolean):[]
  }
  const values={
   institution_id:user.institutionId,module_key:'library',record_type:type,title,
   reference_code:clean(form.reference_code)||null,description:clean(form.description)||null,
   status:form.status||'active',approval_status:'not_required',
   visibility:type==='book-registration'||type==='book-category'?'staff_only':form.visibility,
   quantity,amount,payload
  }
  setSaving(true)
  try{
   const request=editing
    ?await supabase.from('institutional_records').update({...values,updated_by:user.id}).eq('id',editing.id).eq('institution_id',user.institutionId).eq('module_key','library')
    :await supabase.from('institutional_records').insert({...values,created_by:user.id})
   if(request.error)throw request.error
   onToast(editing?'Library record updated.':'Library record registered.')
   setFormOpen(false);setEditing(null);await load()
  }catch(error){
   onToast(error instanceof Error?error.message:'The library record could not be saved.',true)
  }finally{setSaving(false)}
 }

 async function deleteRecord(row:LibraryRow){
  if(!supabase||!user||!canManage)return
  if(row.record_type==='book-registration'&&loans.some(loan=>loan.book_record_id===row.id)){
   onToast('This book has circulation history. Keep its record so previous issue and return entries remain linked.',true);return
  }
  if(row.record_type==='book-category'&&books.some(book=>book.payload?.category_id===row.id)){
   onToast('This category is still assigned to registered books. Reassign those books before deleting it.',true);return
  }
  if(!window.confirm('Delete '+row.title+' from the institutional library? This cannot be undone.'))return
  setSaving(true)
  try{
   const {error}=await supabase.from('institutional_records').delete().eq('id',row.id).eq('institution_id',user.institutionId).eq('module_key','library')
   if(error)throw error
   onToast('Library record deleted.');await load()
  }catch(error){onToast(error instanceof Error?error.message:'The library record could not be deleted.',true)}
  finally{setSaving(false)}
 }

 const exportRows=()=>{
  const rows=visibleRows.map(row=>({
   title:row.title,record_type:typeLabel[row.record_type],reference:row.reference_code??'',
   author:row.payload?.author??'',category:row.payload?.category_name??'',
   shelf:row.payload?.shelf_location??'',copies:row.quantity??'',status:row.status,
   visibility:row.visibility,resource_url:row.payload?.resource_url??'',description:row.description??''
  }))
  downloadCsv('edusphere-library-'+page+'.csv',rows,[
   {key:'title',label:'Title'},{key:'record_type',label:'Record type'},{key:'reference',label:'Reference'},
   {key:'author',label:'Author'},{key:'category',label:'Category'},{key:'shelf',label:'Shelf'},
   {key:'copies',label:'Copies'},{key:'status',label:'Status'},{key:'visibility',label:'Visibility'},
   {key:'resource_url',label:'Resource URL'},{key:'description',label:'Description'}
  ])
 }

 const resourcePage=pageConfig.type==='digital-resource'||pageConfig.type==='learning-material'||pageConfig.type==='resource-download'
 const formType=editing?.record_type??pageConfig.type??'book-registration'
 const showFormAction=canManage&&(pageConfig.type!==undefined)

 if(!user)return null
 return <main className="page-content ed360-module-page ed360-library-admin">
  <header className="ed360-workspace-hero ed360-library-admin-hero"><div className="ed360-workspace-hero-copy"><span>{(user?.institutionName?.trim()||'GOVERNMENT ISLAMIA DEGREE COLLEGE').toUpperCase()} / LIBRARY / {pageConfig.title.toUpperCase()}</span><h1>{pageConfig.title}</h1></div><div className="ed360-workspace-hero-tools"><button type="button" className="button button-primary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/>{loading?'Refreshing…':'Refresh'}</button>{showFormAction&&<button className="button button-outline" type="button" onClick={beginCreate}><Plus size={15}/> Add {typeLabel[pageConfig.type!]}</button>}</div></header>

  {loading&&<div className="ed360-workspace-empty">Loading institution library…</div>}
  {loadError&&<section className="ed360-library-error"><strong>Library data could not be loaded</strong><span>{loadError}</span><button className="button button-outline" type="button" onClick={()=>void load()}>Retry</button></section>}

  {page==='library-dashboard'&&<>
   <section className="ed360-library-metrics">
    <article><span>Registered titles</span><strong>{books.length}</strong><small>Distinct book records</small></article>
    <article><span>Total copies</span><strong>{totalCopies.toLocaleString()}</strong><small>Copies in the catalogue</small></article>
    <article><span>Available copies</span><strong>{canReadLoans?availableCopies:'—'}</strong><small>{canReadLoans?'After active circulation':'Staff circulation view'}</small></article>
    <article><span>Currently issued</span><strong>{canReadLoans?issuedCount:'—'}</strong><small>{canReadLoans?overdueCount+' overdue':'Not available for this role'}</small></article>
    <article><span>Categories</span><strong>{categories.length}</strong><small>Collection groups</small></article>
    <article><span>Digital resources</span><strong>{resources.length}</strong><small>Learning and download links</small></article>
   </section>
   <section className="ed360-library-overview-grid">
    <article className="ed360-library-overview-card"><span className="ed360-library-overview-icon"><BookOpen size={18}/></span><h2>Book collection</h2><p>Manage titles, authors, categories, editions, shelf positions and copy counts.</p><button className="button button-outline" type="button" onClick={()=>onNavigate?.('institutional:library:book-catalogue')}>Open catalogue</button></article>
    <article className="ed360-library-overview-card"><span className="ed360-library-overview-icon"><Layers3 size={18}/></span><h2>Categories</h2><p>Keep the collection organised by subject and category.</p><button className="button button-outline" type="button" onClick={()=>onNavigate?.('institutional:library:book-categories')}>Manage categories</button></article>
    <article className="ed360-library-overview-card"><span className="ed360-library-overview-icon"><Link2 size={18}/></span><h2>Digital resources</h2><p>Publish approved online reading, learning materials and downloads.</p><button className="button button-outline" type="button" onClick={()=>onNavigate?.('institutional:library:digital-library')}>Open resources</button></article>
   </section>
  </>}

  {page!=='library-dashboard'&&<>
   {page==='book-catalogue'&&<section className="ed360-library-note"><BookOpen size={18}/><span>Available copies are calculated from the registered whole-copy count and current active library loans. The issue action remains transaction-locked by the database.</span></section>}
   {page==='book-registration'&&<section className="ed360-library-note"><BookPlus size={18}/><span>Book registrations are stored in the same institution-scoped catalogue that the secure issue/return workflow uses.</span></section>}
   <section className="ed360-library-list-card">
    <div className="ed360-library-list-toolbar">
     <label className="ed360-library-search"><Search size={16}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search title, reference, author, category or shelf…" aria-label="Search library records"/></label>
     <div className="ed360-library-toolbar-actions"><span>{visibleRows.length} record(s)</span><button type="button" className="button button-outline" onClick={exportRows} disabled={!visibleRows.length}><Download size={14}/> Export CSV</button></div>
    </div>
    {visibleRows.length===0?<div className="ed360-workspace-empty"><strong>No {typeLabel[pageConfig.type??'book-registration'].toLowerCase()} records found</strong><span>{search?'Try a different search term.':'Register the first record to start building this part of the library.'}</span>{showFormAction&&<button className="button button-primary" type="button" onClick={beginCreate}><Plus size={15}/> Add first record</button>}</div>:
     <div className="table-scroll"><table><thead><tr>
      <th>Title / name</th><th>Reference / subject</th><th>Details</th><th>Copies / audience</th><th>Status</th><th>Updated</th>{canManage&&<th>Actions</th>}
     </tr></thead><tbody>{visibleRows.map(row=>{
      const isBook=row.record_type==='book-registration'
      const issued=issuedByBook.get(row.id)??0
      const copies=Math.max(0,Number(row.quantity??row.payload?.total_copies??0))
      const available=Math.max(0,copies-issued)
      return <tr key={row.id}>
       <td><strong>{row.title}</strong><small>{row.reference_code||typeLabel[row.record_type]}</small></td>
       <td>{isBook?(row.payload?.category_name??'Uncategorised'):(row.payload?.subject??row.payload?.resource_kind??'—')}</td>
       <td>{isBook?<><span>{row.payload?.author??'Author not recorded'}</span><small>{row.payload?.publisher??''} {row.payload?.publication_year??''}</small><small>Shelf: {row.payload?.shelf_location??'Not assigned'}</small></>:<><span>{row.description??'—'}</span>{row.payload?.resource_url&&<a className="ed360-library-open-link" href={row.payload.resource_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/> Open resource</a>}</>}</td>
       <td>{isBook?<><strong>{canReadLoans?available:'—'} / {copies}</strong><small>{canReadLoans?issued+' currently issued':'Copies registered'}</small></>:<><span>{row.visibility.replaceAll('_',' ')}</span><small>{row.payload?.class_name??'All relevant classes'}</small></>}</td>
       <td><span className={'ed360-library-status '+(row.status==='published'||row.status==='active'?'is-active':'')}>{row.status.replaceAll('_',' ')}</span></td>
       <td>{dateLabel(row.updated_at||row.created_at)}</td>
       {canManage&&<td><div className="ed360-library-actions"><button type="button" title="Edit record" aria-label={'Edit '+row.title} onClick={()=>beginEdit(row)}><Pencil size={14}/></button><button type="button" title="Delete record" aria-label={'Delete '+row.title} onClick={()=>void deleteRecord(row)} disabled={saving}><Trash2 size={14}/></button></div></td>}
      </tr>
     })}</tbody></table></div>}
   </section>
  </>}

  {formOpen&&<div className="ed360-library-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setFormOpen(false)}}>
   <section className="ed360-library-modal" role="dialog" aria-modal="true" aria-labelledby="ed360-library-form-title">
    <header><div><span>INSTITUTION LIBRARY</span><h2 id="ed360-library-form-title">{editing?'Edit '+typeLabel[formType]:pageConfig.title}</h2><p>{formType==='book-registration'?'Maintain the bibliographic details and copy count used by circulation.':formType==='book-category'?'Create a reusable category for the institutional collection.':'Add an approved resource link for the appropriate portal audience.'}</p></div><button type="button" aria-label="Close form" onClick={()=>setFormOpen(false)}><X size={18}/></button></header>
    <form onSubmit={saveRecord}>
     <div className="ed360-library-form-grid">
      <label className="ed360-library-span-two">Title / name *<input required minLength={2} maxLength={180} value={form.title} onChange={e=>updateForm('title',e.target.value)} placeholder={formType==='book-registration'?'Book title':formType==='book-category'?'Category name':'Resource title'}/></label>
      <label>ISBN / reference<input maxLength={120} value={form.reference_code} onChange={e=>updateForm('reference_code',e.target.value)} placeholder="ISBN or internal reference"/></label>
      {formType==='book-registration'&&<>
       <label>Author<input value={form.author} onChange={e=>updateForm('author',e.target.value)}/></label>
       <label>Publisher<input value={form.publisher} onChange={e=>updateForm('publisher',e.target.value)}/></label>
       <label>Edition<input value={form.edition} onChange={e=>updateForm('edition',e.target.value)}/></label>
       <label>Publication year<input type="number" min="1450" max={new Date().getFullYear()+2} value={form.publication_year} onChange={e=>updateForm('publication_year',e.target.value)}/></label>
       <label>Category<select value={form.category_id} onChange={e=>updateForm('category_id',e.target.value)}><option value="">No category</option>{categories.map(row=><option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
       <label>Format<select value={form.format} onChange={e=>updateForm('format',e.target.value)}><option>Print</option><option>Reference</option><option>Magazine</option><option>Journal</option><option>Thesis</option><option>Other</option></select></label>
       <label>Language<input value={form.language} onChange={e=>updateForm('language',e.target.value)}/></label>
       <label>Shelf / location<input value={form.shelf_location} onChange={e=>updateForm('shelf_location',e.target.value)} placeholder="e.g. A-03 / Science"/></label>
       <label>Total copies *<input required type="number" min="1" step="1" value={form.total_copies} onChange={e=>updateForm('total_copies',e.target.value)}/></label>
       <label>Fine per overdue day<input type="number" min="0" step="0.01" value={form.fine_per_day} onChange={e=>updateForm('fine_per_day',e.target.value)}/></label>
       <label>Purchase cost<input type="number" min="0" step="0.01" value={form.purchase_cost} onChange={e=>updateForm('purchase_cost',e.target.value)}/></label>
       <label>Cover image URL<input type="url" value={form.cover_url} onChange={e=>updateForm('cover_url',e.target.value)} placeholder="https://…"/></label>
      </>}
      {formType==='book-category'&&<>
       <label>Subject / discipline<input value={form.subject} onChange={e=>updateForm('subject',e.target.value)} placeholder="Science, History, Literature…"/></label>
       <label>Shelf / collection<input value={form.shelf_location} onChange={e=>updateForm('shelf_location',e.target.value)}/></label>
      </>}
      {resourcePage&&<>
       <label className="ed360-library-span-two">Resource URL *<input required type="url" value={form.resource_url} onChange={e=>updateForm('resource_url',e.target.value)} placeholder="https://example.edu/resource.pdf"/></label>
       <label>Resource type<select value={form.resource_kind} onChange={e=>updateForm('resource_kind',e.target.value)}><option>PDF</option><option>eBook</option><option>Video</option><option>Audio</option><option>Website</option><option>Presentation</option><option>Document</option><option>Other</option></select></label>
       <label>Subject<input value={form.subject} onChange={e=>updateForm('subject',e.target.value)}/></label>
       <label>Class / programme<input value={form.class_name} onChange={e=>updateForm('class_name',e.target.value)} placeholder="Optional class restriction"/></label>
       <label>Category<select value={form.category_id} onChange={e=>updateForm('category_id',e.target.value)}><option value="">No category</option>{categories.map(row=><option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
       <label>Author / creator<input value={form.author} onChange={e=>updateForm('author',e.target.value)}/></label>
       <label>Language<input value={form.language} onChange={e=>updateForm('language',e.target.value)}/></label>
       <label>Portal audience<select value={form.visibility} onChange={e=>updateForm('visibility',e.target.value)}><option value="institution_portal">Student and parent portal</option><option value="student_portal">Student portal</option><option value="parent_portal">Parent portal</option><option value="staff_only">Staff only</option></select></label>
       <label>Publication state<select value={form.status} onChange={e=>updateForm('status',e.target.value)}><option value="published">Published</option><option value="draft">Draft</option></select></label>
      </>}
      <label className="ed360-library-span-two">Description / notes<textarea rows={3} maxLength={4000} value={form.description} onChange={e=>updateForm('description',e.target.value)} placeholder="Add useful details for staff and learners…"/></label>
      <label className="ed360-library-span-two">Tags<input value={form.tags} onChange={e=>updateForm('tags',e.target.value)} placeholder="Separate tags with commas"/></label>
     </div>
     <footer><span>Saved to this institution only</span><div><button className="button button-outline" type="button" onClick={()=>setFormOpen(false)}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving?'Saving…':editing?'Save changes':'Save library record'}</button></div></footer>
    </form>
   </section>
  </div>}
 </main>
}
