import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Download, Plus, RefreshCw, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { listRecords, createRecord, recordFeePayment } from '../lib/data'
import { userFacingError } from '../lib/userErrors'
import { netInvoiceAmount, outstandingInvoiceBalance } from '../lib/finance'
import { downloadCsv } from '../lib/csv'
import type { RecordRow } from '../lib/types'
import '../styles/finance-workspace.css'

type Section = 'overview'|'invoices'|'payments'|'structures'|'discounts'|'refunds'|'receivables'|'receipts'|'accounts'|'journals'|'reconciliation'
type Props = { workspaceKey:string; initialWindow?:string; onToast:(message:string,error?:boolean)=>void }
type FinanceRow = RecordRow & { id:string; [key:string]:unknown }
type JournalLineDraft = { account_id:string; description:string; debit:string; credit:string }

const today=()=>new Date().toLocaleDateString('en-CA')
const money=(value:number)=>new Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR',maximumFractionDigits:2}).format(Number(value)||0)
const label=(value:unknown)=>String(value??'').replaceAll('_',' ').replace(/\b\w/g,char=>char.toUpperCase())
const dateLabel=(value:unknown)=>value?new Date(String(value).slice(0,10)+'T00:00:00').toLocaleDateString():'—'
const number=(value:unknown)=>Number(value??0)

const sectionFor=(group:string,item:string):Section=>{
  if(group==='accounts-finance') return ['chart-of-accounts'].includes(item)?'accounts':'journals'
  if(group==='receivables') return 'receivables'
  if(group==='payments') return ['refund-processing'].includes(item)?'refunds':['payment-history','online-payment-records','cash-payments','bank-payments','partial-payments'].includes(item)?'payments':'reconciliation'
  if(group==='receipts') return 'receipts'
  if(group==='reconciliation') return ['audit-logs','administrative-audit','user-activity-logs','access-history','change-history','audit-reports'].includes(item)?'reconciliation':'reconciliation'
  if(group==='fees') return ({
    'fee-structure':'structures','fee-categories':'structures','student-fee-assignment':'structures',
    'payment-collection':'payments','online-payments':'payments','partial-payments':'receivables',
    'discounts':'discounts','scholarships':'discounts','outstanding-dues':'receivables',
    'fee-refunds':'refunds','fee-receipts':'receipts',
  } as Record<string,Section>)[item]??'invoices'
  return 'overview'
}

const sectionLabels:Record<Section,string>={
  overview:'Finance overview',invoices:'Invoice register',payments:'Payment collections',structures:'Fee structures',
  discounts:'Discounts and applications',refunds:'Refunds',receivables:'Receivables and ageing',
  receipts:'Receipt register',accounts:'Chart of accounts',journals:'Journal entries',reconciliation:'Reconciliation and audit'
}

export function FinanceWorkspace({workspaceKey,initialWindow,onToast}:Props){
  const {user,mode}=useAuth()
  const [groupKey]=workspaceKey.split(':')
  const initialItem=initialWindow??''
  const [section,setSection]=useState<Section>(() => (['overview','invoices','payments','structures','discounts','refunds','receivables','receipts','accounts','journals','reconciliation'].includes(initialItem) ? initialItem as Section : sectionFor(groupKey,initialItem)))
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [query,setQuery]=useState('')
  const [invoiceSortKey,setInvoiceSortKey]=useState('due_date')
  const [invoiceSortDirection,setInvoiceSortDirection]=useState<'asc'|'desc'>('asc')
  const [invoicePage,setInvoicePage]=useState(1)
  const [paymentSortKey,setPaymentSortKey]=useState('payment_date')
  const [paymentSortDirection,setPaymentSortDirection]=useState<'asc'|'desc'>('desc')
  const [paymentPage,setPaymentPage]=useState(1)
  const financePageSize=10
  const [invoices,setInvoices]=useState<FinanceRow[]>([])
  const [payments,setPayments]=useState<FinanceRow[]>([])
  const [students,setStudents]=useState<FinanceRow[]>([])
  const [structures,setStructures]=useState<FinanceRow[]>([])
  const [structureItems,setStructureItems]=useState<FinanceRow[]>([])
  const [discounts,setDiscounts]=useState<FinanceRow[]>([])
  const [discountApplications,setDiscountApplications]=useState<FinanceRow[]>([])
  const [refunds,setRefunds]=useState<FinanceRow[]>([])
  const [feeAudit,setFeeAudit]=useState<FinanceRow[]>([])
  const [accounts,setAccounts]=useState<FinanceRow[]>([])
  const [journals,setJournals]=useState<FinanceRow[]>([])
  const [journalLines,setJournalLines]=useState<FinanceRow[]>([])
  const [invoiceForm,setInvoiceForm]=useState(false)
  const [paymentTarget,setPaymentTarget]=useState<FinanceRow|null>(null)
  const [structureForm,setStructureForm]=useState(false)
  const [discountForm,setDiscountForm]=useState(false)
  const [refundForm,setRefundForm]=useState(false)
  const [accountForm,setAccountForm]=useState(false)
  const [journalForm,setJournalForm]=useState(false)
  const [selectedJournal,setSelectedJournal]=useState('')
  const [invoiceStudent,setInvoiceStudent]=useState('')
  const [invoiceTitle,setInvoiceTitle]=useState('Tuition Fee')
  const [invoiceCategory,setInvoiceCategory]=useState('tuition')
  const [invoiceAmount,setInvoiceAmount]=useState('')
  const [invoiceDiscount,setInvoiceDiscount]=useState('0')
  const [invoiceDue,setInvoiceDue]=useState('')
  const [invoiceNotes,setInvoiceNotes]=useState('')
  const [paymentAmount,setPaymentAmount]=useState('')
  const [paymentMethod,setPaymentMethod]=useState('cash')
  const [paymentReference,setPaymentReference]=useState('')
  const [paymentDate,setPaymentDate]=useState(today())
  const [paymentNotes,setPaymentNotes]=useState('')
  const [structureName,setStructureName]=useState('')
  const [structureClass,setStructureClass]=useState('')
  const [structureSession,setStructureSession]=useState('')
  const [structureFrequency,setStructureFrequency]=useState('monthly')
  const [structureStart,setStructureStart]=useState(today())
  const [structureEnd,setStructureEnd]=useState('')
  const [structureLateFee,setStructureLateFee]=useState('0')
  const [structureLateType,setStructureLateType]=useState('fixed')
  const [structureItemCategory,setStructureItemCategory]=useState('tuition')
  const [structureItemDescription,setStructureItemDescription]=useState('')
  const [structureItemAmount,setStructureItemAmount]=useState('')
  const [selectedStructure,setSelectedStructure]=useState('')
  const [discountName,setDiscountName]=useState('')
  const [discountType,setDiscountType]=useState('fixed')
  const [discountValue,setDiscountValue]=useState('')
  const [discountCategory,setDiscountCategory]=useState('all')
  const [discountStart,setDiscountStart]=useState(today())
  const [discountEnd,setDiscountEnd]=useState('')
  const [refundPayment,setRefundPayment]=useState('')
  const [refundAmount,setRefundAmount]=useState('')
  const [refundReason,setRefundReason]=useState('')
  const [discountApplicationForm,setDiscountApplicationForm]=useState(false)
  const [applicationInvoice,setApplicationInvoice]=useState('')
  const [applicationDiscount,setApplicationDiscount]=useState('')
  const [applicationAmount,setApplicationAmount]=useState('')
  const [applicationRemarks,setApplicationRemarks]=useState('')
  const [accountCode,setAccountCode]=useState('')
  const [accountName,setAccountName]=useState('')
  const [accountType,setAccountType]=useState('asset')
  const [accountNormal,setAccountNormal]=useState('debit')
  const [accountParent,setAccountParent]=useState('')
  const [journalNo,setJournalNo]=useState('')
  const [journalDate,setJournalDate]=useState(today())
  const [journalDescription,setJournalDescription]=useState('')
  const [journalReference,setJournalReference]=useState('')
  const [lineDrafts,setLineDrafts]=useState<JournalLineDraft[]>([
    {account_id:'',description:'',debit:'',credit:''},
    {account_id:'',description:'',debit:'',credit:''},
  ])
  const financeRole=['owner','admin','accountant'].includes(user!.role)
  const ownerOrAdmin=['owner','admin'].includes(user!.role)
  const selectedInvoice=invoices.find(row=>row.id===paymentTarget?.id)??paymentTarget

  async function load(silent=false){
    if(!silent){setLoading(true);setError('')}
    try{
      const invoiceRows=await listRecords(mode,user!,'fee_invoices') as FinanceRow[]
      setInvoices(invoiceRows)
      if(!supabase)throw new Error('The cloud database is not configured.')
      const paymentRows=await listRecords(mode,user!,'fee_payments') as FinanceRow[]
      setPayments(paymentRows)
      if(financeRole){
        const [studentRows,structureRows,structureItemRows,discountRows,applicationRows,refundRows,auditRows]=await Promise.all([
          listRecords(mode,user!,'students') as Promise<FinanceRow[]>,
          listRecords(mode,user!,'fee_structures') as Promise<FinanceRow[]>,
          listRecords(mode,user!,'fee_structure_items') as Promise<FinanceRow[]>,
          listRecords(mode,user!,'fee_discounts') as Promise<FinanceRow[]>,
          listRecords(mode,user!,'fee_discount_applications') as Promise<FinanceRow[]>,
          listRecords(mode,user!,'fee_refunds') as Promise<FinanceRow[]>,
          listRecords(mode,user!,'fee_audit_logs') as Promise<FinanceRow[]>,
        ])
        setStudents(studentRows)
        setStructures(structureRows)
        setStructureItems(structureItemRows)
        setDiscounts(discountRows)
        setDiscountApplications(applicationRows)
        setRefunds(refundRows)
        setFeeAudit(auditRows)
      }
      if(['accounts-finance','reconciliation'].includes(groupKey)){
        const [accountRows,journalRows,journalLineRows]=await Promise.all([
          listRecords(mode,user!,'finance_accounts') as Promise<FinanceRow[]>,
          listRecords(mode,user!,'finance_journals') as Promise<FinanceRow[]>,
          listRecords(mode,user!,'finance_journal_lines') as Promise<FinanceRow[]>,
        ])
        setAccounts(accountRows)
        setJournals(journalRows)
        setJournalLines(journalLineRows)
      }
    }catch(err){
      const message=userFacingError(err,'Finance records could not be loaded. Check institution access and refresh.')
      setError(message)
      if(!silent)onToast(message,true)
    }finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[mode,user?.id,user?.institutionId,groupKey])

  const totalInvoiced=invoices.reduce((sum,row)=>sum+netInvoiceAmount(row),0)
  const totalReceived=invoices.reduce((sum,row)=>sum+number(row.paid_amount),0)
  const totalOutstanding=invoices.reduce((sum,row)=>sum+outstandingInvoiceBalance(row),0)
  const overdueInvoices=invoices.filter(row=>outstandingInvoiceBalance(row)>0&&String(row.due_date??'')<today())
  const visibleInvoices=useMemo(()=>invoices.filter(row=>{
    const text=[row.invoice_no,row.invoice_number,row.student_name,row.fee_title,row.fee_category,row.status].map(value=>String(value??'')).join(' ').toLowerCase()
    return text.includes(query.trim().toLowerCase())
  }),[invoices,query])
  const visiblePayments=useMemo(()=>payments.filter(row=>{
    const invoice=invoices.find(item=>item.id===row.invoice_id)
    return [row.receipt_no,row.receipt_number,row.payment_method,row.payment_reference,row.transaction_reference,invoice?.student_name,invoice?.invoice_no].map(value=>String(value??'')).join(' ').toLowerCase().includes(query.trim().toLowerCase())
  }),[payments,invoices,query])
  const lineDebit=lineDrafts.reduce((sum,line)=>sum+number(line.debit),0)
  const lineCredit=lineDrafts.reduce((sum,line)=>sum+number(line.credit),0)
  const journalMap=new Map(journals.map(row=>[row.id,row]))
  const accountMap=new Map(accounts.map(row=>[row.id,row]))
  const activeTabs:Section[]=groupKey==='accounts-finance'?['overview','accounts','journals','reconciliation']
    :groupKey==='receivables'?['overview','receivables','invoices','payments']
    :groupKey==='payments'?['overview','payments','refunds','reconciliation']
    :groupKey==='receipts'?['overview','receipts','payments']
    :groupKey==='reconciliation'?['overview','reconciliation','journals','receivables']
    :['overview','structures','invoices','payments','receivables','discounts','refunds','receipts']

  async function saveInvoice(event:FormEvent){
    event.preventDefault()
    if(!financeRole)return
    const student=students.find(row=>row.id===invoiceStudent)
    const amount=Number(invoiceAmount),discount=Number(invoiceDiscount)
    if(!student||!invoiceTitle.trim()||!(amount>0)||discount<0||discount>amount||!invoiceDue){onToast('Select a student and provide a valid invoice amount, discount and due date.',true);return}
    setSaving(true)
    try{
      await createRecord(mode,user!,'fee_invoices',{
        student_id:student.id,student_name:student.full_name,admission_no:student.admission_no??null,class_name:student.class_name??null,
        fee_title:invoiceTitle.trim(),fee_category:invoiceCategory,amount,discount_amount:discount,fine_amount:0,
        paid_amount:0,status:'unpaid',invoice_no:'INV-'+new Date().getFullYear()+'-'+crypto.randomUUID().replaceAll('-','').slice(0,10).toUpperCase(),
        invoice_date:today(),due_date:invoiceDue,academic_session:structureSession||null,notes:invoiceNotes.trim()||null
      })
      setInvoiceForm(false);setInvoiceStudent('');setInvoiceTitle('Tuition Fee');setInvoiceAmount('');setInvoiceDiscount('0');setInvoiceDue('');setInvoiceNotes('')
      onToast('Fee invoice created.');await load(true)
    }catch(err){onToast(userFacingError(err,'Fee invoice could not be saved.'),true)}finally{setSaving(false)}
  }

  async function savePayment(event:FormEvent){
    event.preventDefault()
    if(!selectedInvoice||!financeRole)return
    const amount=Number(paymentAmount)
    if(!(amount>0)||amount>outstandingInvoiceBalance(selectedInvoice)){onToast('Enter a positive payment not exceeding the outstanding invoice balance.',true);return}
    setSaving(true)
    try{
      const result=await recordFeePayment(mode,user!,{invoiceId:selectedInvoice.id,amount,paymentMethod,paymentReference,paymentDate,notes:paymentNotes})
      setPaymentTarget(null);setPaymentAmount('');setPaymentReference('');setPaymentNotes('')
      onToast('Payment recorded. Receipt '+result.receipt_no+'.');await load(true)
    }catch(err){onToast(userFacingError(err,'Payment could not be recorded.'),true)}finally{setSaving(false)}
  }

  async function saveStructure(event:FormEvent){
    event.preventDefault();if(!financeRole||!supabase)return
    if(!structureName.trim()||!structureClass.trim()||!structureStart){onToast('Enter the structure name, class and effective date.',true);return}
    setSaving(true)
    const {data,error:saveError}=await supabase.from('fee_structures').insert({
      institution_id:user!.institutionId,created_by:user!.id,name:structureName.trim(),class_name:structureClass.trim(),
      academic_session:structureSession||null,frequency:structureFrequency,effective_date:structureStart,expiry_date:structureEnd||null,
      late_fee:Number(structureLateFee)||0,late_fee_type:structureLateType,status:'active'
    }).select('*').single()
    if(saveError){onToast(userFacingError(saveError,'Fee structure could not be created.'),true);setSaving(false);return}
    setSelectedStructure(data.id);setStructureForm(false);setStructureName('');setStructureClass('');setStructureEnd('');setStructureLateFee('0')
    onToast('Fee structure created. Add the component amounts to complete its schedule.');setSaving(false);await load(true)
  }

  async function addStructureItem(event:FormEvent){
    event.preventDefault();if(!supabase||!financeRole||!selectedStructure)return
    const amount=Number(structureItemAmount)
    if(!structureItemDescription.trim()||!(amount>0)){onToast('Enter a component description and a positive amount.',true);return}
    setSaving(true)
    const {error:saveError}=await supabase.from('fee_structure_items').insert({
      institution_id:user!.institutionId,structure_id:selectedStructure,category:structureItemCategory,
      description:structureItemDescription.trim(),amount
    })
    if(saveError)onToast(userFacingError(saveError,'Fee structure component could not be added.'),true)
    else{setStructureItemDescription('');setStructureItemAmount('');onToast('Fee structure component added.');await load(true)}
    setSaving(false)
  }

  async function saveDiscount(event:FormEvent){
    event.preventDefault();if(!supabase||!financeRole)return
    const amount=Number(discountValue)
    if(!discountName.trim()||!(amount>0)||(discountType==='percentage'&&amount>100)){onToast('Enter a name and a valid discount value.',true);return}
    setSaving(true)
    const {error:saveError}=await supabase.from('fee_discounts').insert({
      institution_id:user!.institutionId,created_by:user!.id,name:discountName.trim(),discount_type:discountType,
      discount_value:amount,fee_category:discountCategory==='all'?null:discountCategory,start_date:discountStart,
      end_date:discountEnd||null,status:'active'
    })
    if(saveError)onToast(userFacingError(saveError,'Discount could not be saved.'),true)
    else{setDiscountForm(false);setDiscountName('');setDiscountValue('');setDiscountEnd('');onToast('Discount scheme created.');await load(true)}
    setSaving(false)
  }

  async function saveRefund(event:FormEvent){
    event.preventDefault();if(!supabase||!financeRole)return
    const payment=payments.find(row=>row.id===refundPayment)
    const amount=Number(refundAmount)
    const alreadyRefunded=refunds.filter(row=>row.payment_id===refundPayment&&row.status!=='rejected').reduce((sum,row)=>sum+number(row.amount),0)
    if(!payment||!(amount>0)||amount>Math.max(0,number(payment.amount)-alreadyRefunded)||!refundReason.trim()){onToast('Select a payment and enter a refund amount within the original payment less any existing pending or approved refunds.',true);return}
    setSaving(true)
    const {error:saveError}=await supabase.from('fee_refunds').insert({
      institution_id:user!.institutionId,payment_id:payment.id,invoice_id:payment.invoice_id,amount,
      refund_date:today(),reason:refundReason.trim(),status:'pending',processed_by:null
    })
    if(saveError)onToast(userFacingError(saveError,'Refund request could not be recorded.'),true)
    else{setRefundForm(false);setRefundPayment('');setRefundAmount('');setRefundReason('');onToast('Refund request recorded for manual processing.');await load(true)}
    setSaving(false)
  }

  async function submitDiscountApplication(event:FormEvent){
    event.preventDefault()
    if(!supabase||!financeRole)return
    const invoice=invoices.find(row=>row.id===applicationInvoice)
    const discount=discounts.find(row=>row.id===applicationDiscount)
    const amount=Number(applicationAmount)
    if(!invoice||!discount||!(amount>0)||amount>outstandingInvoiceBalance(invoice)){
      onToast('Select an outstanding invoice and active discount scheme, then enter a positive amount within the balance.',true);return
    }
    const base=Math.max(0,number(invoice.amount)+number(invoice.fine_amount)-number(invoice.discount_amount))
    const cap=discount.discount_type==='percentage'?base*number(discount.discount_value)/100:number(discount.discount_value)
    if(amount>cap+0.005){onToast('The requested amount exceeds the discount scheme limit ('+money(cap)+').',true);return}
    setSaving(true)
    const {error:saveError}=await supabase.from('fee_discount_applications').insert({
      institution_id:user!.institutionId,discount_id:discount.id,invoice_id:invoice.id,
      student_id:invoice.student_id??null,amount,approval_status:'pending',remarks:applicationRemarks.trim()||null
    })
    if(saveError)onToast(userFacingError(saveError,'Discount application could not be submitted.'),true)
    else{
      setDiscountApplicationForm(false);setApplicationInvoice('');setApplicationDiscount('')
      setApplicationAmount('');setApplicationRemarks('')
      onToast('Discount application submitted for approval. The invoice balance has not changed yet.')
      await load(true)
    }
    setSaving(false)
  }

  async function decideDiscount(row:FinanceRow,decision:'approve'|'reject'){
    if(!supabase||!financeRole||row.approval_status!=='pending')return
    setSaving(true)
    const {error:decisionError}=await supabase.rpc('process_fee_discount_application',{
      p_institution_id:user!.institutionId,p_application_id:row.id,p_decision:decision,p_remarks:null
    })
    if(decisionError)onToast(userFacingError(decisionError,'Discount decision could not be completed.'),true)
    else{onToast(decision==='approve'?'Discount approved and the invoice balance updated.':'Discount application rejected.');await load(true)}
    setSaving(false)
  }

  async function decideRefund(row:FinanceRow,decision:'complete'|'reject'){
    if(!supabase||!financeRole||row.status!=='pending')return
    setSaving(true)
    const {error:saveError}=await supabase.rpc('process_fee_refund',{
      p_institution_id:user!.institutionId,p_refund_id:row.id,p_decision:decision,p_remarks:null
    })
    if(saveError)onToast(userFacingError(saveError,'Refund processing could not be completed.'),true)
    else{
      onToast(decision==='complete'?'Refund completed and the invoice paid balance reduced.':'Refund request rejected.')
      await load(true)
    }
    setSaving(false)
  }

  async function saveAccount(event:FormEvent){
    event.preventDefault();if(!supabase||!ownerOrAdmin)return
    if(!accountCode.trim()||!accountName.trim()){onToast('Account code and name are required.',true);return}
    setSaving(true)
    const {error:saveError}=await supabase.from('finance_accounts').insert({
      institution_id:user!.institutionId,account_code:accountCode.trim(),name:accountName.trim(),
      account_type:accountType,normal_balance:accountNormal,parent_account_id:accountParent||null,
      created_by:user!.id
    })
    if(saveError)onToast(userFacingError(saveError,'Account could not be saved.'),true)
    else{setAccountForm(false);setAccountCode('');setAccountName('');setAccountParent('');onToast('Chart-of-accounts entry created.');await load(true)}
    setSaving(false)
  }

  async function createJournal(event:FormEvent){
    event.preventDefault();if(!supabase||!financeRole)return
    if(!journalNo.trim()||!journalDescription.trim()||lineDrafts.length<2||lineDrafts.some(line=>!line.account_id)){
      onToast('Enter a journal number, description and at least two account lines.',true);return
    }
    if(Math.round(lineDebit*100)!==Math.round(lineCredit*100)||lineDebit<=0){
      onToast('Journal lines must balance: total debits must equal total credits.',true);return
    }
    if(lineDrafts.some(line=>(number(line.debit)>0&&number(line.credit)>0)||(number(line.debit)<=0&&number(line.credit)<=0))){
      onToast('Each journal line must contain either a debit or a credit, not both.',true);return
    }
    setSaving(true)
    const {data:journalId,error:createError}=await supabase.rpc('create_finance_journal',{
      p_institution_id:user!.institutionId,
      p_journal_no:journalNo.trim(),
      p_journal_date:journalDate,
      p_description:journalDescription.trim(),
      p_reference:journalReference.trim()||null,
      p_lines:lineDrafts.map(line=>({
        account_id:line.account_id,
        description:line.description.trim()||null,
        debit:Number(line.debit)||0,
        credit:Number(line.credit)||0,
      })),
    })
    if(createError){
      onToast(userFacingError(createError,'The balanced journal could not be saved.'),true)
    }else{
      setJournalForm(false);setJournalNo('');setJournalDescription('');setJournalReference('')
      setLineDrafts([{account_id:'',description:'',debit:'',credit:''},{account_id:'',description:'',debit:'',credit:''}])
      setSelectedJournal(String(journalId))
      onToast('Balanced journal draft and all line items saved atomically. Post it after review.')
    }
    setSaving(false);await load(true)
  }

  async function postJournal(id:string){
    if(!supabase||!financeRole)return
    setSaving(true)
    const {error:postError}=await supabase.rpc('post_finance_journal',{p_institution_id:user!.institutionId,p_journal_id:id})
    if(postError)onToast(userFacingError(postError,'Journal could not be posted.'),true)
    else{onToast('Journal posted and locked.');await load(true)}
    setSaving(false)
  }

  function exportInvoices(){
    if(!invoices.length){onToast('There are no invoices to export.',true);return}
    downloadCsv('edusphere-fee-invoices-'+today()+'.csv',invoices as Record<string,unknown>[],[
      {key:'invoice_no',label:'Invoice number'},{key:'student_name',label:'Student'},{key:'fee_title',label:'Fee description'},
      {key:'amount',label:'Invoice amount'},{key:'paid_amount',label:'Paid amount'},{key:'due_date',label:'Due date'},{key:'status',label:'Status'}
    ])
  }

  function sortedFinanceRows(rows:FinanceRow[],key:string,direction:'asc'|'desc'){
    return [...rows].sort((left,right)=>{
      const value=(row:FinanceRow):unknown => key==='balance'?outstandingInvoiceBalance(row):key==='net_amount'?netInvoiceAmount(row):key==='invoice'?`${String(invoices.find(item=>item.id===row.invoice_id)?.invoice_no??'')} ${String(invoices.find(item=>item.id===row.invoice_id)?.student_name??'')}`:row[key]
      const a=value(left),b=value(right)
      const aEmpty=a===null||a===undefined||a===''
      const bEmpty=b===null||b===undefined||b===''
      if(aEmpty||bEmpty)return aEmpty===bEmpty?0:aEmpty?1:-1
      const an=Number(a),bn=Number(b)
      const numeric=String(a).trim()!==''&&String(b).trim()!==''&&Number.isFinite(an)&&Number.isFinite(bn)
      const comparison=numeric?an-bn:String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'})
      return direction==='asc'?comparison:-comparison
    })
  }

  function financeSortHeader(labelText:string,key:string,currentKey:string,direction:'asc'|'desc',onSort:()=>void){
    return <th aria-sort={currentKey===key?(direction==='asc'?'ascending':'descending'):'none'}>
      <button type="button" className="fin-sort-header" onClick={onSort}>{labelText}<span aria-hidden="true">{currentKey===key?(direction==='asc'?'↑':'↓'):'↕'}</span></button>
    </th>
  }

  function sortInvoices(key:string){
    if(invoiceSortKey===key)setInvoiceSortDirection(value=>value==='asc'?'desc':'asc')
    else{setInvoiceSortKey(key);setInvoiceSortDirection('asc')}
    setInvoicePage(1)
  }

  function sortPayments(key:string){
    if(paymentSortKey===key)setPaymentSortDirection(value=>value==='asc'?'desc':'asc')
    else{setPaymentSortKey(key);setPaymentSortDirection('asc')}
    setPaymentPage(1)
  }

  function pageControls(total:number,page:number,setPage:(page:number)=>void){
    const pageCount=Math.max(1,Math.ceil(total/financePageSize))
    const current=Math.min(page,pageCount)
    return total>financePageSize?<div className="fin-table-pagination">
      <span>Showing <b>{(current-1)*financePageSize+1}–{Math.min(current*financePageSize,total)}</b> of <b>{total}</b></span>
      <div><button type="button" className="fin-button" disabled={current<=1} onClick={()=>setPage(current-1)}>Previous</button><span>Page {current} of {pageCount}</span><button type="button" className="fin-button" disabled={current>=pageCount} onClick={()=>setPage(current+1)}>Next</button></div>
    </div>:null
  }

  const invoiceTable=(rows:FinanceRow[])=>{
    if(!rows.length)return <div className="fin-empty">No invoices are available in this view yet.</div>
    const ordered=sortedFinanceRows(rows,invoiceSortKey,invoiceSortDirection)
    const pageCount=Math.max(1,Math.ceil(ordered.length/financePageSize))
    const currentPage=Math.min(invoicePage,pageCount)
    const pageRows=ordered.slice((currentPage-1)*financePageSize,currentPage*financePageSize)
    return <>
      <div className="table-scroll"><table><thead><tr>
        {financeSortHeader('Invoice','invoice_no',invoiceSortKey,invoiceSortDirection,()=>sortInvoices('invoice_no'))}
        {financeSortHeader('Student','student_name',invoiceSortKey,invoiceSortDirection,()=>sortInvoices('student_name'))}
        {financeSortHeader('Fee','fee_title',invoiceSortKey,invoiceSortDirection,()=>sortInvoices('fee_title'))}
        {financeSortHeader('Amount','net_amount',invoiceSortKey,invoiceSortDirection,()=>sortInvoices('net_amount'))}
        {financeSortHeader('Received','paid_amount',invoiceSortKey,invoiceSortDirection,()=>sortInvoices('paid_amount'))}
        {financeSortHeader('Balance','balance',invoiceSortKey,invoiceSortDirection,()=>sortInvoices('balance'))}
        {financeSortHeader('Due','due_date',invoiceSortKey,invoiceSortDirection,()=>sortInvoices('due_date'))}
        {financeSortHeader('Status','status',invoiceSortKey,invoiceSortDirection,()=>sortInvoices('status'))}
        {financeRole&&<th>Actions</th>}
      </tr></thead><tbody>{pageRows.map(row=><tr key={row.id}>
        <td><b>{String(row.invoice_no??row.invoice_number??'—')}</b></td>
        <td>{String(row.student_name??'—')}<small>{String(row.admission_no??'')}</small></td>
        <td>{String(row.fee_title??'—')}</td>
        <td>{money(netInvoiceAmount(row))}</td>
        <td>{money(number(row.paid_amount))}</td>
        <td><b>{money(outstandingInvoiceBalance(row))}</b></td>
        <td>{dateLabel(row.due_date)}</td>
        <td><span className={'fin-status '+String(row.status??'unpaid')}>{label(row.status)}</span></td>
        {financeRole&&<td>{outstandingInvoiceBalance(row)>0&&<button className="fin-button primary" onClick={()=>{setPaymentTarget(row);setPaymentAmount(String(outstandingInvoiceBalance(row)));setPaymentDate(today())}}>Collect</button>}</td>}
      </tr>)}</tbody></table></div>
      {pageControls(ordered.length,currentPage,setInvoicePage)}
    </>
  }

  const paymentTable=(rows:FinanceRow[])=>{
    if(!rows.length)return <div className="fin-empty">No payments are recorded for this institution yet.</div>
    const ordered=sortedFinanceRows(rows,paymentSortKey,paymentSortDirection)
    const pageCount=Math.max(1,Math.ceil(ordered.length/financePageSize))
    const currentPage=Math.min(paymentPage,pageCount)
    const pageRows=ordered.slice((currentPage-1)*financePageSize,currentPage*financePageSize)
    return <>
      <div className="table-scroll"><table><thead><tr>
        {financeSortHeader('Receipt','receipt_no',paymentSortKey,paymentSortDirection,()=>sortPayments('receipt_no'))}
        {financeSortHeader('Invoice','invoice',paymentSortKey,paymentSortDirection,()=>sortPayments('invoice'))}
        {financeSortHeader('Payment date','payment_date',paymentSortKey,paymentSortDirection,()=>sortPayments('payment_date'))}
        {financeSortHeader('Method','payment_method',paymentSortKey,paymentSortDirection,()=>sortPayments('payment_method'))}
        {financeSortHeader('Reference','payment_reference',paymentSortKey,paymentSortDirection,()=>sortPayments('payment_reference'))}
        {financeSortHeader('Amount','amount',paymentSortKey,paymentSortDirection,()=>sortPayments('amount'))}
        {financeSortHeader('Status','status',paymentSortKey,paymentSortDirection,()=>sortPayments('status'))}
      </tr></thead><tbody>{pageRows.map(row=>{
        const invoice=invoices.find(item=>item.id===row.invoice_id)
        return <tr key={row.id}>
          <td><b>{String(row.receipt_no??row.receipt_number??'—')}</b></td>
          <td>{String(invoice?.invoice_no??'Invoice')}<small>{String(invoice?.student_name??'')}</small></td>
          <td>{dateLabel(row.payment_date)}</td>
          <td>{label(row.payment_method)}</td>
          <td>{String(row.payment_reference??row.transaction_reference??row.cheque_number??'—')}</td>
          <td>{money(number(row.amount))}</td>
          <td><span className="fin-status paid">{label(row.status??'completed')}</span></td>
        </tr>
      })}</tbody></table></div>
      {pageControls(ordered.length,currentPage,setPaymentPage)}
    </>
  }

  function renderSection(){
    if(section==='overview')return <div className="fin-overview">
      <div className="fin-metric-grid">
        <article><small>Total invoiced</small><strong>{money(totalInvoiced)}</strong><span>Net fee invoices</span></article>
        <article><small>Collected</small><strong>{money(totalReceived)}</strong><span>Recorded payments</span></article>
        <article><small>Outstanding</small><strong>{money(totalOutstanding)}</strong><span>Remaining balances</span></article>
        <article><small>Overdue invoices</small><strong>{overdueInvoices.length}</strong><span>Past due with balances</span></article>
      </div>
      <div className="fin-two-column">
        <section className="fin-panel"><header><div><h2>Collection performance</h2><p>Collected against billed amount from live invoice records.</p></div></header><div className="fin-progress"><span style={{width:(totalInvoiced>0?Math.min(100,totalReceived/totalInvoiced*100):0)+'%'}}/></div><div className="fin-inline-stats"><span>Collected <b>{money(totalReceived)}</b></span><span>Remaining <b>{money(totalOutstanding)}</b></span></div></section>
        <section className="fin-panel"><header><div><h2>Follow-up required</h2><p>Oldest overdue invoices that still have a balance.</p></div></header>{overdueInvoices.slice(0,5).map(row=><div className="fin-followup" key={row.id}><span><b>{String(row.student_name??'Student')}</b><small>{String(row.invoice_no??'Invoice')} · {dateLabel(row.due_date)}</small></span><strong>{money(outstandingInvoiceBalance(row))}</strong></div>)}{overdueInvoices.length===0&&<p className="fin-empty compact">No overdue invoices are currently visible.</p>}</section>
      </div>
    </div>
    if(section==='invoices')return <section className="fin-panel"><header><div><h2>Invoice register</h2><p>Search, review outstanding balances and open fee collection.</p></div>{financeRole&&<div className="fin-header-actions"><button className="fin-button" onClick={exportInvoices}><Download size={14}/> Export</button><button className="fin-button primary" onClick={()=>setInvoiceForm(true)}><Plus size={14}/> Create invoice</button></div>}</header><label className="fin-search">Search invoices<input value={query} onChange={event=>{setQuery(event.target.value);setInvoicePage(1);setPaymentPage(1)}} placeholder="Invoice, student, category or status…"/></label>{invoiceTable(visibleInvoices)}</section>
    if(section==='payments'||section==='receipts')return <section className="fin-panel"><header><div><h2>{sectionLabels[section]}</h2><p>Payment receipts returned by the institution's atomic payment record operation.</p></div></header><label className="fin-search">Search payments<input value={query} onChange={event=>{setQuery(event.target.value);setInvoicePage(1);setPaymentPage(1)}} placeholder="Receipt, student, method or reference…"/></label>{paymentTable(visiblePayments)}</section>
    if(section==='receivables')return <section className="fin-panel"><header><div><h2>Receivables and ageing</h2><p>Current unpaid, part-paid and overdue invoice balances.</p></div></header><div className="fin-metric-grid slim"><article><small>Current</small><strong>{money(invoices.filter(row=>outstandingInvoiceBalance(row)>0&&String(row.due_date??'')>=today()).reduce((s,row)=>s+outstandingInvoiceBalance(row),0))}</strong></article><article><small>Overdue</small><strong>{money(overdueInvoices.reduce((s,row)=>s+outstandingInvoiceBalance(row),0))}</strong></article><article><small>Part-paid</small><strong>{invoices.filter(row=>number(row.paid_amount)>0&&outstandingInvoiceBalance(row)>0).length}</strong></article><article><small>Unpaid</small><strong>{invoices.filter(row=>number(row.paid_amount)<=0&&outstandingInvoiceBalance(row)>0).length}</strong></article></div>{invoiceTable(visibleInvoices.filter(row=>outstandingInvoiceBalance(row)>0))}</section>
    if(section==='structures')return <div className="fin-two-column"><section className="fin-panel"><header><div><h2>Fee structures</h2><p>Define recurring schedules by class, session and frequency.</p></div>{financeRole&&<button className="fin-button primary" onClick={()=>setStructureForm(true)}><Plus size={14}/> Add structure</button>}</header>{structures.length?<div className="fin-card-list">{structures.map(row=><button type="button" key={row.id} className={'fin-select-card '+(selectedStructure===row.id?'selected':'')} onClick={()=>setSelectedStructure(row.id)}><b>{String(row.name)}</b><span>{String(row.class_name)} · {label(row.frequency)} · {label(row.status)}</span><small>{dateLabel(row.effective_date)}{row.expiry_date?' – '+dateLabel(row.expiry_date):''}</small></button>)}</div>:<div className="fin-empty">No fee structures have been defined. Add one to start.</div>}</section><section className="fin-panel"><header><div><h2>Selected fee components</h2><p>Amounts belonging to the selected structure.</p></div></header>{selectedStructure&&financeRole&&<form className="fin-inline-form" onSubmit={addStructureItem}><label>Category<select value={structureItemCategory} onChange={e=>setStructureItemCategory(e.target.value)}><option value="tuition">Tuition</option><option value="admission">Admission</option><option value="examination">Examination</option><option value="transport">Transport</option><option value="library">Library</option><option value="other">Other</option></select></label><label>Description<input value={structureItemDescription} onChange={e=>setStructureItemDescription(e.target.value)} required/></label><label>Amount (PKR)<input type="number" min="0.01" step="0.01" value={structureItemAmount} onChange={e=>setStructureItemAmount(e.target.value)} required/></label><button className="fin-button primary" disabled={saving}>Add component</button></form>}{(structureItems.filter(row=>row.structure_id===selectedStructure)).length?<div className="table-scroll"><table><thead><tr><th>Category</th><th>Description</th><th>Amount</th></tr></thead><tbody>{structureItems.filter(row=>row.structure_id===selectedStructure).map(row=><tr key={row.id}><td>{label(row.category)}</td><td>{String(row.description)}</td><td>{money(number(row.amount))}</td></tr>)}</tbody></table></div>:<div className="fin-empty">{selectedStructure?'No components added to this structure yet.':'Select a fee structure to manage its components.'}</div>}</section></div>
    if(section==='discounts')return <section className="fin-panel"><header><div><h2>Discounts and scholarships</h2><p>Define schemes, submit applications and process approvals. The invoice only changes after successful approval.</p></div>{financeRole&&<div className="fin-header-actions"><button className="fin-button" onClick={()=>setDiscountApplicationForm(true)}><Plus size={14}/> Apply discount</button><button className="fin-button primary" onClick={()=>setDiscountForm(true)}><Plus size={14}/> New discount</button></div>}</header><div className="fin-two-column"><div><h3>Active discount schemes</h3>{discounts.map(row=><div className="fin-list-row" key={row.id}><span><b>{String(row.name)}</b><small>{label(row.fee_category??'all categories')} · {dateLabel(row.start_date)}{row.end_date?' – '+dateLabel(row.end_date):''}</small></span><strong>{row.discount_type==='percentage'?String(row.discount_value)+'%':money(number(row.discount_value))}</strong></div>)}{!discounts.length&&<div className="fin-empty">No discount schemes defined.</div>}</div><div><h3>Applications and approvals</h3>{discountApplications.map(row=><div className="fin-list-row" key={row.id}><span><b>{String(discounts.find(x=>x.id===row.discount_id)?.name??'Discount')}</b><small>{String(invoices.find(x=>x.id===row.invoice_id)?.student_name??'Student')} · {money(number(row.amount))} · {dateLabel(row.created_at)}</small></span><span className={'fin-status '+String(row.approval_status??'pending')}>{label(row.approval_status)}</span>{financeRole&&row.approval_status==='pending'&&<div className="fin-row-actions"><button type="button" className="fin-button primary" disabled={saving} onClick={()=>void decideDiscount(row,'approve')}>Approve</button><button type="button" className="fin-button danger" disabled={saving} onClick={()=>void decideDiscount(row,'reject')}>Reject</button></div>}</div>)}{!discountApplications.length&&<div className="fin-empty">No discount applications have been submitted.</div>}</div></div></section>
    if(section==='refunds')return <section className="fin-panel"><header><div><h2>Fee refunds</h2><p>Record a refund request, then approve or reject it after manual verification.</p></div>{financeRole&&<button className="fin-button primary" onClick={()=>setRefundForm(true)}><Plus size={14}/> Record refund</button>}</header>{refunds.length?<div className="table-scroll"><table><thead><tr><th>Date</th><th>Receipt</th><th>Invoice</th><th>Reason</th><th>Amount</th><th>Status</th><th>Decision</th></tr></thead><tbody>{refunds.map(row=><tr key={row.id}><td>{dateLabel(row.refund_date)}</td><td>{String(payments.find(p=>p.id===row.payment_id)?.receipt_no??'—')}</td><td>{String(invoices.find(i=>i.id===row.invoice_id)?.invoice_no??'—')}</td><td>{String(row.reason??'—')}</td><td>{money(number(row.amount))}</td><td><span className={'fin-status '+String(row.status)}>{label(row.status)}</span></td><td>{ownerOrAdmin&&row.status==='pending'&&<div className="fin-row-actions"><button className="fin-button" disabled={saving} onClick={()=>void decideRefund(row,'complete')}>Approve</button><button className="fin-button danger" disabled={saving} onClick={()=>void decideRefund(row,'reject')}>Reject</button></div>}</td></tr>)}</tbody></table></div>:<div className="fin-empty">No refund requests have been recorded.</div>}<p className="fin-note"><AlertTriangle size={14}/> Completing a refund reverses the invoice paid balance and records an audit event. It does not initiate a bank or payment-provider transfer.</p></section>
    if(section==='accounts')return <div className="fin-two-column"><section className="fin-panel"><header><div><h2>Chart of accounts</h2><p>Institution-specific ledger accounts with account type and normal balance.</p></div>{ownerOrAdmin&&<button className="fin-button primary" onClick={()=>setAccountForm(true)}><Plus size={14}/> Add account</button>}</header>{accounts.length?<div className="table-scroll"><table><thead><tr><th>Code</th><th>Account</th><th>Type</th><th>Normal balance</th><th>Status</th></tr></thead><tbody>{accounts.map(row=><tr key={row.id}><td><b>{String(row.account_code)}</b></td><td>{String(row.name)}</td><td>{label(row.account_type)}</td><td>{label(row.normal_balance)}</td><td>{row.is_active===false?'Inactive':'Active'}</td></tr>)}</tbody></table></div>:<div className="fin-empty">No chart of accounts has been configured. Create the institution's accounts before posting journals.</div>}</section><section className="fin-panel"><header><div><h2>Ledger integrity</h2><p>Posted journals are immutable through the normal workspace.</p></div></header><div className="fin-metric-grid slim"><article><small>Accounts</small><strong>{accounts.length}</strong></article><article><small>Draft journals</small><strong>{journals.filter(row=>row.status==='draft').length}</strong></article><article><small>Posted journals</small><strong>{journals.filter(row=>row.status==='posted').length}</strong></article><article><small>Unposted lines</small><strong>{journalLines.filter(line=>journalMap.get(String(line.journal_id))?.status==='draft').length}</strong></article></div></section></div>
    if(section==='journals')return <div className="fin-two-column"><section className="fin-panel"><header><div><h2>Journal register</h2><p>Balanced double-entry records. Posting is validated by the database.</p></div>{financeRole&&accounts.length>=2&&<button className="fin-button primary" onClick={()=>setJournalForm(true)}><Plus size={14}/> New journal</button>}</header>{journals.length?<div className="fin-card-list">{journals.map(row=><button type="button" className={'fin-select-card '+(selectedJournal===row.id?'selected':'')} key={row.id} onClick={()=>setSelectedJournal(row.id)}><b>{String(row.journal_no)}</b><span>{String(row.description)} · {dateLabel(row.journal_date)}</span><small><span className={'fin-status '+String(row.status)}>{label(row.status)}</span></small></button>)}</div>:<div className="fin-empty">No journal entries exist yet.</div>}</section><section className="fin-panel"><header><div><h2>Journal detail</h2><p>Review the line items and post only when totals balance.</p></div></header>{selectedJournal&&<><div className="fin-row-actions"><strong>{String(journalMap.get(selectedJournal)?.journal_no??'Journal')}</strong>{journalMap.get(selectedJournal)?.status==='draft'&&<button className="fin-button primary" onClick={()=>void postJournal(selectedJournal)} disabled={saving}>Validate and post</button>}</div>{journalLines.filter(line=>line.journal_id===selectedJournal).length?<div className="table-scroll"><table><thead><tr><th>Account</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead><tbody>{journalLines.filter(line=>line.journal_id===selectedJournal).map(line=><tr key={line.id}><td>{String(accountMap.get(String(line.account_id))?.account_code??'')} {String(accountMap.get(String(line.account_id))?.name??'Account')}</td><td>{String(line.description??'—')}</td><td>{money(number(line.debit))}</td><td>{money(number(line.credit))}</td></tr>)}</tbody></table></div>:<div className="fin-empty">No journal lines were saved for this draft.</div>}</>}{!selectedJournal&&<div className="fin-empty">Select a journal to inspect its debit and credit lines.</div>}</section></div>
    if(section==='reconciliation')return <div className="fin-two-column"><section className="fin-panel"><header><div><h2>Collection reconciliation</h2><p>Compare invoice totals, recorded receipts and remaining balances.</p></div></header><div className="fin-metric-grid slim"><article><small>Invoices</small><strong>{invoices.length}</strong></article><article><small>Receipts</small><strong>{payments.length}</strong></article><article><small>Invoice received</small><strong>{money(totalReceived)}</strong></article><article><small>Payment ledger</small><strong>{money(payments.reduce((s,p)=>s+number(p.amount),0))}</strong></article></div><div className="fin-note">Any mismatch between invoice paid totals and payment records should be investigated before closing a financial period.</div></section><section className="fin-panel"><header><div><h2>Fee audit events</h2><p>Recent audited finance changes available to this role.</p></div></header>{feeAudit.slice(0,40).map(row=><div className="fin-list-row" key={row.id}><span><b>{label(row.action)} · {label(row.record_type)}</b><small>{dateLabel(row.created_at)} · {String(row.performed_by??'Institution user')}</small></span><small>{String(row.record_id??'')}</small></div>)}{!feeAudit.length&&<div className="fin-empty">No fee audit entries are available.</div>}</section></div>
    return null
  }

  return <main className="fin-stage page-content ed360-module-page">
    <header className="fin-page-heading"><div><span>FINANCE &amp; PAYMENTS / {label(groupKey).toUpperCase()}</span><h1>{groupKey==='accounts-finance'?'Accounts and Finance':groupKey==='receivables'?'Accounts Receivable':groupKey==='payments'?'Payments and Collections':groupKey==='receipts'?'Receipts':groupKey==='reconciliation'?'Financial Reconciliation':'Fee Management'}</h1><p>Institution-scoped billing, collections and audit records. Balances are calculated from saved invoices and payment allocations.</p></div><span className="fin-cloud-state"><i/> Live institutional records</span></header>
    <nav className="fin-window-nav" aria-label="Finance workspace">{activeTabs.map(key=><button type="button" key={key} className={section===key?'active':''} aria-current={section===key?'page':undefined} onClick={()=>setSection(key)}>{sectionLabels[key]}</button>)}</nav>
    <section className="fin-context"><div><small>CURRENT FINANCE WINDOW</small><h2>{sectionLabels[section]}</h2><p>{section==='overview'?'Live financial position from fee invoices and posted receipts.':section==='journals'?'General ledger adjustments use balanced debit and credit journal entries.':section==='accounts'?'Manage the institution chart of accounts before creating journals.':section==='structures'?'Build reusable class/session fee schedules and component amounts.':section==='receivables'?'Review balances and identify accounts requiring follow-up.':'Manage saved records for this finance operation.'}</p></div><div><strong>{section==='accounts'?accounts.length:section==='journals'?journals.length:section==='payments'||section==='receipts'?payments.length:section==='structures'?structures.length:invoices.length}</strong><small>records in this window</small></div></section>
    {error&&<div className="fin-error" role="alert">{error}</div>}
    {loading?<div className="fin-loading"><RefreshCw className="spin" size={20}/> Loading finance records…</div>:renderSection()}
    <div className="fin-bottom-bar"><span><ShieldCheckIcon/> Actions are restricted by institutional finance permissions and database policies.</span><button className="fin-button" type="button" onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button></div>
    {invoiceForm&&<div className="modal-backdrop"><section className="modal-card fin-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">FEE MANAGEMENT</div><h2>Create fee invoice</h2><p>Invoice will be attached to an existing student in this institution.</p></div><button className="icon-button" onClick={()=>setInvoiceForm(false)}><X size={18}/></button></div><form onSubmit={saveInvoice} className="fin-form-grid"><label>Student *<select required value={invoiceStudent} onChange={e=>setInvoiceStudent(e.target.value)}><option value="">Select student</option>{students.map(s=><option key={s.id} value={s.id}>{String(s.full_name)} · {String(s.admission_no??'')}</option>)}</select></label><label>Fee title *<input required value={invoiceTitle} onChange={e=>setInvoiceTitle(e.target.value)}/></label><label>Category<select value={invoiceCategory} onChange={e=>setInvoiceCategory(e.target.value)}><option value="tuition">Tuition</option><option value="admission">Admission</option><option value="examination">Examination</option><option value="transport">Transport</option><option value="library">Library</option><option value="other">Other</option></select></label><div className="fin-form-row"><label>Amount (PKR) *<input required type="number" min="0.01" step="0.01" value={invoiceAmount} onChange={e=>setInvoiceAmount(e.target.value)}/></label><label>Discount (PKR)<input type="number" min="0" step="0.01" value={invoiceDiscount} onChange={e=>setInvoiceDiscount(e.target.value)}/></label></div><label>Due date *<input type="date" min={today()} required value={invoiceDue} onChange={e=>setInvoiceDue(e.target.value)}/></label><label>Notes<textarea rows={2} value={invoiceNotes} onChange={e=>setInvoiceNotes(e.target.value)}/></label><div className="modal-actions"><button type="button" className="fin-button" onClick={()=>setInvoiceForm(false)}>Cancel</button><button className="fin-button primary" disabled={saving}>{saving?'Saving…':'Create invoice'}</button></div></form></section></div>}
    {paymentTarget&&<div className="modal-backdrop"><section className="modal-card fin-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">PAYMENT COLLECTION</div><h2>Collect fee payment</h2><p>{String(selectedInvoice?.student_name??'Student')} · {String(selectedInvoice?.invoice_no??'Invoice')} · Balance {money(outstandingInvoiceBalance(selectedInvoice??{}))}</p></div><button className="icon-button" onClick={()=>setPaymentTarget(null)}><X size={18}/></button></div><form onSubmit={savePayment} className="fin-form-grid"><label>Amount (PKR) *<input required type="number" min="0.01" max={outstandingInvoiceBalance(selectedInvoice??{})} step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label><label>Payment method<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="online">Online</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label><label>Payment date *<input required type="date" max={today()} value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/></label><label>Reference<input value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} placeholder="Bank, cheque or transaction reference"/></label><label>Notes<textarea rows={2} value={paymentNotes} onChange={e=>setPaymentNotes(e.target.value)}/></label><div className="modal-actions"><button type="button" className="fin-button" onClick={()=>setPaymentTarget(null)}>Cancel</button><button className="fin-button primary" disabled={saving}>{saving?'Recording…':'Record payment'}</button></div></form></section></div>}
    {structureForm&&<div className="modal-backdrop"><section className="modal-card fin-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">FEE STRUCTURE</div><h2>Create fee schedule</h2><p>Define the class and session applicability first, then add fee components.</p></div><button className="icon-button" onClick={()=>setStructureForm(false)}><X size={18}/></button></div><form onSubmit={saveStructure} className="fin-form-grid"><label>Structure name *<input required value={structureName} onChange={e=>setStructureName(e.target.value)}/></label><label>Class / programme *<input required value={structureClass} onChange={e=>setStructureClass(e.target.value)}/></label><label>Academic session<input value={structureSession} onChange={e=>setStructureSession(e.target.value)}/></label><label>Frequency<select value={structureFrequency} onChange={e=>setStructureFrequency(e.target.value)}><option value="monthly">Monthly</option><option value="term">Term</option><option value="annual">Annual</option><option value="one_time">One time</option></select></label><div className="fin-form-row"><label>Effective from *<input type="date" required value={structureStart} onChange={e=>setStructureStart(e.target.value)}/></label><label>Expires<input type="date" min={structureStart} value={structureEnd} onChange={e=>setStructureEnd(e.target.value)}/></label></div><div className="fin-form-row"><label>Late fee (PKR)<input type="number" min="0" step="0.01" value={structureLateFee} onChange={e=>setStructureLateFee(e.target.value)}/></label><label>Late fee type<select value={structureLateType} onChange={e=>setStructureLateType(e.target.value)}><option value="fixed">Fixed</option><option value="percentage">Percentage</option></select></label></div><div className="modal-actions"><button type="button" className="fin-button" onClick={()=>setStructureForm(false)}>Cancel</button><button className="fin-button primary" disabled={saving}>Save fee structure</button></div></form></section></div>}
    {discountForm&&<div className="modal-backdrop"><section className="modal-card fin-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">DISCOUNTS / SCHOLARSHIPS</div><h2>Create discount scheme</h2><p>The scheme is recorded here; invoice application is a separate approval step.</p></div><button className="icon-button" onClick={()=>setDiscountForm(false)}><X size={18}/></button></div><form onSubmit={saveDiscount} className="fin-form-grid"><label>Scheme name *<input required value={discountName} onChange={e=>setDiscountName(e.target.value)}/></label><label>Discount type<select value={discountType} onChange={e=>setDiscountType(e.target.value)}><option value="fixed">Fixed amount</option><option value="percentage">Percentage</option></select></label><label>{discountType==='percentage'?'Percentage (0–100)':'Amount (PKR)'} *<input required type="number" min="0.01" max={discountType==='percentage'?100:undefined} step="0.01" value={discountValue} onChange={e=>setDiscountValue(e.target.value)}/></label><label>Fee category<select value={discountCategory} onChange={e=>setDiscountCategory(e.target.value)}><option value="all">All categories</option><option value="tuition">Tuition</option><option value="admission">Admission</option><option value="examination">Examination</option><option value="transport">Transport</option><option value="other">Other</option></select></label><div className="fin-form-row"><label>Starts *<input type="date" value={discountStart} onChange={e=>setDiscountStart(e.target.value)}/></label><label>Ends<input type="date" min={discountStart} value={discountEnd} onChange={e=>setDiscountEnd(e.target.value)}/></label></div><div className="modal-actions"><button type="button" className="fin-button" onClick={()=>setDiscountForm(false)}>Cancel</button><button className="fin-button primary" disabled={saving}>Create scheme</button></div></form></section></div>}
    {discountApplicationForm&&<div className="modal-backdrop"><section className="modal-card fin-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">DISCOUNTS / SCHOLARSHIPS</div><h2>Apply a discount to an invoice</h2><p>The requested amount is checked against the scheme and current outstanding balance. Approval is required before the invoice changes.</p></div><button type="button" className="icon-button" onClick={()=>setDiscountApplicationForm(false)} aria-label="Close discount application"><X size={18}/></button></div><form onSubmit={submitDiscountApplication} className="fin-form-grid"><label>Invoice *<select required value={applicationInvoice} onChange={event=>{setApplicationInvoice(event.target.value);setApplicationAmount('')}}><option value="">Select outstanding invoice</option>{invoices.filter(row=>outstandingInvoiceBalance(row)>0).map(row=><option key={row.id} value={row.id}>{String(row.invoice_no??'Invoice')} · {String(row.student_name??'Student')} · {money(outstandingInvoiceBalance(row))}</option>)}</select></label><label>Discount scheme *<select required value={applicationDiscount} onChange={event=>{const next=event.target.value;setApplicationDiscount(next);const scheme=discounts.find(row=>row.id===next);const invoice=invoices.find(row=>row.id===applicationInvoice);if(scheme&&invoice){const base=Math.max(0,number(invoice.amount)+number(invoice.fine_amount)-number(invoice.discount_amount));const cap=scheme.discount_type==='percentage'?base*number(scheme.discount_value)/100:number(scheme.discount_value);setApplicationAmount(String(Math.min(cap,outstandingInvoiceBalance(invoice)).toFixed(2)))}}}><option value="">Select active scheme</option>{discounts.filter(row=>row.status==='active').map(row=><option key={row.id} value={row.id}>{String(row.name)} · {row.discount_type==='percentage'?String(row.discount_value)+'%':money(number(row.discount_value))}</option>)}</select></label><label>Requested discount (PKR) *<input type="number" required min="0.01" step="0.01" value={applicationAmount} onChange={event=>setApplicationAmount(event.target.value)}/></label><label>Reason / approval notes<textarea rows={3} value={applicationRemarks} onChange={event=>setApplicationRemarks(event.target.value)}/></label><div className="modal-actions"><button type="button" className="fin-button" onClick={()=>setDiscountApplicationForm(false)}>Cancel</button><button className="fin-button primary" disabled={saving}>{saving?'Submitting…':'Submit application'}</button></div></form></section></div>}
    {refundForm&&<div className="modal-backdrop"><section className="modal-card fin-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">REFUND PROCESSING</div><h2>Record refund request</h2><p>This records the workflow decision, not an external transfer.</p></div><button className="icon-button" onClick={()=>setRefundForm(false)}><X size={18}/></button></div><form onSubmit={saveRefund} className="fin-form-grid"><label>Original payment *<select required value={refundPayment} onChange={e=>{setRefundPayment(e.target.value);setRefundAmount(String(number(payments.find(p=>p.id===e.target.value)?.amount)||''))}}><option value="">Select payment</option>{payments.map(row=><option key={row.id} value={row.id}>{String(row.receipt_no??row.id.slice(0,8))} · {money(number(row.amount))}</option>)}</select></label><label>Refund amount (PKR) *<input type="number" min="0.01" step="0.01" value={refundAmount} onChange={e=>setRefundAmount(e.target.value)} required/></label><label>Reason *<textarea rows={3} value={refundReason} onChange={e=>setRefundReason(e.target.value)} required/></label><div className="modal-actions"><button type="button" className="fin-button" onClick={()=>setRefundForm(false)}>Cancel</button><button className="fin-button primary" disabled={saving}>Record request</button></div></form></section></div>}
    {accountForm&&<div className="modal-backdrop"><section className="modal-card fin-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">GENERAL LEDGER</div><h2>Add account</h2><p>Account codes must be unique within this institution.</p></div><button className="icon-button" onClick={()=>setAccountForm(false)}><X size={18}/></button></div><form onSubmit={saveAccount} className="fin-form-grid"><div className="fin-form-row"><label>Account code *<input required value={accountCode} onChange={e=>setAccountCode(e.target.value)}/></label><label>Account name *<input required value={accountName} onChange={e=>setAccountName(e.target.value)}/></label></div><label>Account type<select value={accountType} onChange={e=>{setAccountType(e.target.value);setAccountNormal(['asset','expense'].includes(e.target.value)?'debit':'credit')}}><option value="asset">Asset</option><option value="liability">Liability</option><option value="equity">Equity</option><option value="income">Income</option><option value="expense">Expense</option></select></label><label>Normal balance<select value={accountNormal} onChange={e=>setAccountNormal(e.target.value)}><option value="debit">Debit</option><option value="credit">Credit</option></select></label><label>Parent account<select value={accountParent} onChange={e=>setAccountParent(e.target.value)}><option value="">Top level</option>{accounts.map(row=><option value={row.id} key={row.id}>{String(row.account_code)} · {String(row.name)}</option>)}</select></label><div className="modal-actions"><button type="button" className="fin-button" onClick={()=>setAccountForm(false)}>Cancel</button><button className="fin-button primary" disabled={saving}>Save account</button></div></form></section></div>}
    {journalForm&&<div className="modal-backdrop"><section className="modal-card fin-modal wide" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">GENERAL LEDGER</div><h2>Create journal entry</h2><p>Enter balanced debit and credit lines. The database checks the balance again before posting.</p></div><button className="icon-button" onClick={()=>setJournalForm(false)}><X size={18}/></button></div><form onSubmit={createJournal} className="fin-form-grid"><div className="fin-form-row"><label>Journal number *<input required value={journalNo} onChange={e=>setJournalNo(e.target.value)} placeholder="JV-2026-001"/></label><label>Journal date *<input required type="date" max={today()} value={journalDate} onChange={e=>setJournalDate(e.target.value)}/></label></div><label>Description *<input required value={journalDescription} onChange={e=>setJournalDescription(e.target.value)}/></label><label>Reference<input value={journalReference} onChange={e=>setJournalReference(e.target.value)}/></label><div className="fin-journal-lines"><div className="fin-lines-heading"><b>Journal lines</b><button type="button" className="fin-button" onClick={()=>setLineDrafts(lines=>[...lines,{account_id:'',description:'',debit:'',credit:''}])}>Add line</button></div>{lineDrafts.map((line,index)=><div className="fin-line-edit" key={index}><label>Account<select required value={line.account_id} onChange={e=>setLineDrafts(lines=>lines.map((x,i)=>i===index?{...x,account_id:e.target.value}:x))}><option value="">Select account</option>{accounts.filter(a=>a.is_active!==false).map(a=><option value={a.id} key={a.id}>{String(a.account_code)} · {String(a.name)}</option>)}</select></label><label>Debit<input type="number" min="0" step="0.01" value={line.debit} onChange={e=>setLineDrafts(lines=>lines.map((x,i)=>i===index?{...x,debit:e.target.value,credit:e.target.value?'0':x.credit}:x))}/></label><label>Credit<input type="number" min="0" step="0.01" value={line.credit} onChange={e=>setLineDrafts(lines=>lines.map((x,i)=>i===index?{...x,credit:e.target.value,debit:e.target.value?'0':x.debit}:x))}/></label><button type="button" className="fin-icon-button" disabled={lineDrafts.length<=2} onClick={()=>setLineDrafts(lines=>lines.filter((_,i)=>i!==index))} aria-label="Remove journal line"><X size={15}/></button></div>)}</div><div className="fin-balance-check"><span>Debits <b>{money(lineDebit)}</b></span><span>Credits <b>{money(lineCredit)}</b></span><strong className={Math.round(lineDebit*100)===Math.round(lineCredit*100)&&lineDebit>0?'balanced':'unbalanced'}>{Math.round(lineDebit*100)===Math.round(lineCredit*100)&&lineDebit>0?'Balanced':'Not balanced'}</strong></div><div className="modal-actions"><button type="button" className="fin-button" onClick={()=>setJournalForm(false)}>Cancel</button><button className="fin-button primary" disabled={saving||Math.round(lineDebit*100)!==Math.round(lineCredit*100)||lineDebit<=0}>Save draft</button></div></form></section></div>}
  </main>
}

function ShieldCheckIcon(){return <CheckCircle2 size={14}/>}
