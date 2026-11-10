import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Download, Plus, RefreshCw, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { listRecords } from '../lib/data'
import { userFacingError } from '../lib/userErrors'
import { downloadCsv } from '../lib/csv'
import type { RecordRow } from '../lib/types'
import '../styles/payroll-workspace.css'

type Tab='overview'|'salary'|'runs'|'payslips'
type Employee=RecordRow & {id:string;full_name?:string;employee_no?:string;employment_status?:string;email?:string}
type SalaryProfile=RecordRow & {id:string;teacher_id:string;base_salary:number;monthly_allowances:number;monthly_deductions:number;effective_from:string;effective_to?:string|null;status:string}
type PayrollRun=RecordRow & {id:string;period_start:string;period_end:string;pay_date?:string|null;status:string}
type PayrollItem=RecordRow & {id:string;payroll_run_id:string;teacher_id:string;base_salary:number;allowances:number;deductions:number;advance_recovery:number;gross_pay:number;net_pay:number;payment_status:string}
type Props={initialWindow?:string;onToast:(message:string,error?:boolean)=>void}

const today=()=>new Date().toLocaleDateString('en-CA')
const fmtDate=(value:unknown)=>value?new Date(String(value).slice(0,10)+'T00:00:00').toLocaleDateString():'—'
const cash=(value:unknown)=>new Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR',maximumFractionDigits:2}).format(Number(value??0))
const moneyValue=(value:unknown)=>Number(value??0)
const statusLabel=(value:unknown)=>String(value??'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase())

function PayrollBadge({value}:{value:string}){return <span className={'payroll-status '+value}>{statusLabel(value)}</span>}

export function PayrollWorkspace({initialWindow,onToast}:Props){
  const {user}=useAuth()
  const financeRole=['owner','admin','accountant'].includes(user!.role)
  const canApprove=['owner','admin'].includes(user!.role)
  const [tab,setTab]=useState<Tab>(()=>['overview','salary','runs','payslips'].includes(initialWindow??'')?initialWindow as Tab:'overview')
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [employees,setEmployees]=useState<Employee[]>([])
  const [profiles,setProfiles]=useState<SalaryProfile[]>([])
  const [runs,setRuns]=useState<PayrollRun[]>([])
  const [items,setItems]=useState<PayrollItem[]>([])
  const [selectedRun,setSelectedRun]=useState('')
  const [search,setSearch]=useState('')
  const [salarySearch,setSalarySearch]=useState('')
  const [salarySortKey,setSalarySortKey]=useState('employee')
  const [salarySortDirection,setSalarySortDirection]=useState<'asc'|'desc'>('asc')
  const [salaryPage,setSalaryPage]=useState(1)
  const [payslipSortKey,setPayslipSortKey]=useState('period')
  const [payslipSortDirection,setPayslipSortDirection]=useState<'asc'|'desc'>('desc')
  const [payslipPage,setPayslipPage]=useState(1)
  const payrollPageSize=10
  const [salaryForm,setSalaryForm]=useState(false)
  const [employeeId,setEmployeeId]=useState('')
  const [baseSalary,setBaseSalary]=useState('')
  const [allowances,setAllowances]=useState('0')
  const [deductions,setDeductions]=useState('0')
  const [effectiveFrom,setEffectiveFrom]=useState(today())
  const [effectiveTo,setEffectiveTo]=useState('')
  const [salaryNotes,setSalaryNotes]=useState('')
  const [runForm,setRunForm]=useState(false)
  const [periodStart,setPeriodStart]=useState(()=>today().slice(0,7)+'-01')
  const [periodEnd,setPeriodEnd]=useState(today())
  const [payDate,setPayDate]=useState(today())
  const [runNotes,setRunNotes]=useState('')

  const ownEmployee=employees.find(row=>row.user_id===user!.id)??employees[0]??null
  const selectedRunRow=runs.find(row=>row.id===selectedRun)??null
  const selectedItems=items.filter(item=>item.payroll_run_id===selectedRun)
  const activeProfiles=profiles.filter(profile=>profile.status==='active')
  const activeEmployeeIds=new Set(employees.filter(employee=>employee.employment_status==='active'||!employee.employment_status).map(employee=>employee.id))
  const missingSalaryProfiles=employees.filter(employee=>activeEmployeeIds.has(employee.id)&&!activeProfiles.some(profile=>profile.teacher_id===employee.id))
  const totalPayroll=selectedItems.reduce((sum,item)=>sum+moneyValue(item.net_pay),0)
  const unpaidSelected=selectedItems.filter(item=>item.payment_status!=='paid').length

  async function load(silent=false){
    if(!supabase||!user){setLoading(false);return}
    if(!silent){setLoading(true);setError('')}
    try{
      const employeeRows=await listRecords('cloud',user,'teachers') as Employee[]
      const [profileResult,runResult,itemResult]=await Promise.all([
        supabase.from('employee_salary_profiles').select('*').eq('institution_id',user.institutionId).order('effective_from',{ascending:false}).limit(1000),
        supabase.from('payroll_runs').select('*').eq('institution_id',user.institutionId).order('period_start',{ascending:false}).limit(250),
        supabase.from('payroll_items').select('*').eq('institution_id',user.institutionId).order('created_at',{ascending:false}).limit(2000),
      ])
      for(const result of [profileResult,runResult,itemResult])if(result.error)throw result.error
      setEmployees(employeeRows)
      setProfiles((profileResult.data??[]) as SalaryProfile[])
      setRuns((runResult.data??[]) as PayrollRun[])
      setItems((itemResult.data??[]) as PayrollItem[])
      if(!selectedRun&&runResult.data?.length)setSelectedRun(runResult.data[0].id)
      if(!employeeId&&employeeRows.length)setEmployeeId(employeeRows[0].id)
    }catch(err){
      const message=userFacingError(err,'Payroll information could not be loaded. Check the institution permissions and refresh.')
      setError(message)
      if(!silent)onToast(message,true)
    }finally{setLoading(false)}
  }

  useEffect(()=>{void load()},[user?.id,user?.institutionId,user?.role])
 
  const filteredItems=useMemo(()=>items.filter(item=>{
    const employee=employees.find(row=>row.id===item.teacher_id)
    const run=runs.find(row=>row.id===item.payroll_run_id)
    const text=[employee?.full_name,employee?.employee_no,item.payslip_reference,run?.period_start,run?.period_end,item.payment_status].map(value=>String(value??'')).join(' ').toLowerCase()
    return text.includes(search.trim().toLowerCase())
  }),[items,employees,runs,search])

  const filteredProfiles=useMemo(()=>profiles.filter(profile=>{
    const employee=employees.find(row=>row.id===profile.teacher_id)
    return [employee?.full_name,employee?.employee_no,profile.status].some(value=>String(value??'').toLowerCase().includes(salarySearch.trim().toLowerCase()))
  }),[profiles,employees,salarySearch])
  const orderedProfiles=useMemo(()=>[...filteredProfiles].sort((a,b)=>{
    const value=(profile:SalaryProfile):string|number=>{
      const employee=employees.find(row=>row.id===profile.teacher_id)
      if(salarySortKey==='employee')return employee?.full_name??''
      if(salarySortKey==='employee_no')return employee?.employee_no??''
      if(salarySortKey==='net_month')return moneyValue(profile.base_salary)+moneyValue(profile.monthly_allowances)-moneyValue(profile.monthly_deductions)
      return profile[salarySortKey] as string|number??''
    }
    const left=value(a),right=value(b)
    const comparison=typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right),undefined,{numeric:true,sensitivity:'base'})
    return salarySortDirection==='asc'?comparison:-comparison
  }),[filteredProfiles,employees,salarySortKey,salarySortDirection])
  const orderedPayslips=useMemo(()=>[...filteredItems].sort((a,b)=>{
    const value=(item:PayrollItem):string|number=>{
      const employee=employees.find(row=>row.id===item.teacher_id)
      const run=runs.find(row=>row.id===item.payroll_run_id)
      if(payslipSortKey==='employee')return employee?.full_name??''
      if(payslipSortKey==='period')return run?.period_start??''
      return item[payslipSortKey] as string|number??''
    }
    const left=value(a),right=value(b)
    const comparison=typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right),undefined,{numeric:true,sensitivity:'base'})
    return payslipSortDirection==='asc'?comparison:-comparison
  }),[filteredItems,employees,runs,payslipSortKey,payslipSortDirection])
  const salaryPageCount=Math.max(1,Math.ceil(orderedProfiles.length/payrollPageSize))
  const salaryCurrentPage=Math.min(salaryPage,salaryPageCount)
  const salaryPageRows=orderedProfiles.slice((salaryCurrentPage-1)*payrollPageSize,salaryCurrentPage*payrollPageSize)
  const payslipPageCount=Math.max(1,Math.ceil(orderedPayslips.length/payrollPageSize))
  const payslipCurrentPage=Math.min(payslipPage,payslipPageCount)
  const payslipPageRows=orderedPayslips.slice((payslipCurrentPage-1)*payrollPageSize,payslipCurrentPage*payrollPageSize)

  function toggleSalarySort(key:string){
    if(salarySortKey===key)setSalarySortDirection(direction=>direction==='asc'?'desc':'asc')
    else{setSalarySortKey(key);setSalarySortDirection('asc')}
    setSalaryPage(1)
  }
  function togglePayslipSort(key:string){
    if(payslipSortKey===key)setPayslipSortDirection(direction=>direction==='asc'?'desc':'asc')
    else{setPayslipSortKey(key);setPayslipSortDirection('asc')}
    setPayslipPage(1)
  }
  function payrollSortHeader(label:string,key:string,current:string,direction:'asc'|'desc',onSort:()=>void){
    return <th aria-sort={current===key?(direction==='asc'?'ascending':'descending'):'none'}><button type="button" className="payroll-sort-header" onClick={onSort}>{label}<span aria-hidden="true">{current===key?(direction==='asc'?'↑':'↓'):'↕'}</span></button></th>
  }
  function payrollPageControls(total:number,page:number,pageCount:number,setPage:(page:number)=>void){
    return total>payrollPageSize?<div className="payroll-table-pagination"><span>Showing <b>{(page-1)*payrollPageSize+1}–{Math.min(page*payrollPageSize,total)}</b> of <b>{total}</b></span><div><button type="button" className="payroll-button" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" className="payroll-button" disabled={page>=pageCount} onClick={()=>setPage(page+1)}>Next</button></div></div>:null
  }

  function openSalary(employee?:Employee){
    const chosen=employee??employees.find(row=>row.id===employeeId)??employees[0]
    setEmployeeId(chosen?.id??'')
    setBaseSalary('')
    setAllowances('0')
    setDeductions('0')
    setEffectiveFrom(today())
    setEffectiveTo('')
    setSalaryNotes('')
    setSalaryForm(true)
  }

  async function saveSalary(event:FormEvent){
    event.preventDefault()
    if(!supabase||!financeRole)return
    const base=Number(baseSalary),extra=Number(allowances),deduct=Number(deductions)
    if(!employeeId||!Number.isFinite(base)||base<0||!Number.isFinite(extra)||extra<0||!Number.isFinite(deduct)||deduct<0||base+extra<deduct){onToast('Select an employee and enter valid salary amounts. Net pay cannot be negative.',true);return}
    if(effectiveTo&&effectiveTo<effectiveFrom){onToast('The salary end date cannot precede the effective start date.',true);return}
    setSaving(true)
    const {error:saveError}=await supabase.rpc('save_employee_salary_profile',{
      p_institution_id:user!.institutionId,p_teacher_id:employeeId,p_base_salary:base,
      p_monthly_allowances:extra,p_monthly_deductions:deduct,p_effective_from:effectiveFrom,
      p_effective_to:effectiveTo||null,p_notes:salaryNotes.trim()||null,p_profile_id:null,
    })
    if(saveError){onToast(userFacingError(saveError,'Salary profile could not be saved.'),true);setSaving(false);return}
    setSalaryForm(false);onToast('New salary profile saved. The previous active profile was closed atomically.')
    setSaving(false);await load(true)
  }

  async function generateRun(event:FormEvent){
    event.preventDefault();if(!supabase||!financeRole)return
    if(!periodStart||!periodEnd||periodEnd<periodStart||!payDate){onToast('Enter a valid payroll period and pay date.',true);return}
    setSaving(true)
    const {data,error:runError}=await supabase.rpc('generate_payroll_run',{
      p_institution_id:user!.institutionId,p_period_start:periodStart,p_period_end:periodEnd,
      p_pay_date:payDate,p_notes:runNotes.trim()||null,
    })
    if(runError){onToast(userFacingError(runError,'Payroll run could not be generated.'),true);setSaving(false);return}
    const runId=String(data)
    setRunForm(false);setRunNotes('');setSelectedRun(runId);setTab('runs')
    onToast('Draft payroll generated from effective active salary profiles.')
    setSaving(false);await load(true)
  }

  async function approveRun(){
    if(!supabase||!canApprove||!selectedRunRow)return
    setSaving(true)
    const {error:approveError}=await supabase.rpc('approve_payroll_run',{
      p_institution_id:user!.institutionId,p_payroll_run_id:selectedRunRow.id,
    })
    if(approveError)onToast(userFacingError(approveError,'Payroll run could not be approved.'),true)
    else{onToast('Payroll run approved. Employee payments can now be marked as paid.');await load(true)}
    setSaving(false)
  }

  async function markItemPaid(item:PayrollItem){
    if(!supabase||!financeRole||selectedRunRow?.status!=='approved')return
    setSaving(true)
    const employee=employees.find(row=>row.id===item.teacher_id)
    const payslip='PAY-'+selectedRunRow.period_start.slice(0,7).replace('-','')+'-'+String(employee?.employee_no??item.teacher_id.slice(0,8)).replace(/[^A-Za-z0-9]/g,'').toUpperCase()
    const {error:payError}=await supabase.from('payroll_items').update({payment_status:'paid',payslip_reference:payslip}).eq('institution_id',user!.institutionId).eq('id',item.id)
    if(payError){onToast(userFacingError(payError,'Employee payment status could not be updated.'),true);setSaving(false);return}
    const {data:remaining,error:remainingError}=await supabase.from('payroll_items').select('payment_status').eq('institution_id',user!.institutionId).eq('payroll_run_id',selectedRunRow.id)
    if(remainingError){onToast('Employee marked paid. The payroll closing status could not be checked; refresh and verify the run.',true);setSaving(false);await load(true);return}
    if((remaining??[]).every(row=>row.payment_status==='paid')){
      const {error:closeError}=await supabase.rpc('mark_payroll_run_paid',{p_institution_id:user!.institutionId,p_payroll_run_id:selectedRunRow.id})
      if(closeError)onToast('All employee payments are marked paid, but payroll could not be closed. '+userFacingError(closeError,'Review the run.'),true)
      else onToast('Employee payment saved and payroll run closed as paid.')
    }else onToast('Employee payment marked paid.')
    setSaving(false);await load(true)
  }

  function exportItems(rows:PayrollItem[]){
    if(!rows.length){onToast('There are no payslip rows to export.',true);return}
    const data=rows.map(item=>({employee:employees.find(row=>row.id===item.teacher_id)?.full_name??'Employee',employee_no:employees.find(row=>row.id===item.teacher_id)?.employee_no??'',period:runs.find(run=>run.id===item.payroll_run_id)?.period_start??'',base_salary:item.base_salary,allowances:item.allowances,deductions:item.deductions,advance_recovery:item.advance_recovery,gross_pay:item.gross_pay,net_pay:item.net_pay,payment_status:item.payment_status,payslip_reference:item.payslip_reference??''}))
    downloadCsv('edusphere-payslips-'+today()+'.csv',data,[
      {key:'employee',label:'Employee'},{key:'employee_no',label:'Employee ID'},{key:'period',label:'Period'},
      {key:'base_salary',label:'Base salary (PKR)'},{key:'allowances',label:'Allowances (PKR)'},{key:'deductions',label:'Deductions (PKR)'},
      {key:'advance_recovery',label:'Advance recovery (PKR)'},{key:'gross_pay',label:'Gross pay (PKR)'},{key:'net_pay',label:'Net pay (PKR)'},
      {key:'payment_status',label:'Payment status'},{key:'payslip_reference',label:'Payslip reference'},
    ])
  }

  const tabs:Tab[]=financeRole?['overview','salary','runs','payslips']:['overview','payslips']
  const activeSalaryTotal=activeProfiles.reduce((sum,p)=>sum+moneyValue(p.base_salary)+moneyValue(p.monthly_allowances)-moneyValue(p.monthly_deductions),0)
  const pendingApproval=runs.filter(run=>['draft','review'].includes(run.status)).length

  function renderContent(){
    if(tab==='overview')return <div className="payroll-metric-grid">
      <article><small>Active employees</small><strong>{financeRole?employees.filter(e=>e.employment_status==='active'||!e.employment_status).length:ownEmployee?1:0}</strong><span>Employee records visible to your role</span></article>
      <article><small>Active salary profiles</small><strong>{financeRole?activeProfiles.length:profiles.filter(p=>p.status==='active').length}</strong><span>Effective compensation records</span></article>
      <article><small>Payroll runs</small><strong>{financeRole?runs.length:new Set(items.map(i=>i.payroll_run_id)).size}</strong><span>{pendingApproval} awaiting owner/admin approval</span></article>
      <article><small>Estimated monthly net</small><strong>{cash(financeRole?activeSalaryTotal:profiles.filter(p=>p.status==='active').reduce((s,p)=>s+moneyValue(p.base_salary)+moneyValue(p.monthly_allowances)-moneyValue(p.monthly_deductions),0))}</strong><span>From saved salary profiles</span></article>
      <section className="payroll-panel"><header><div><h2>Payroll control cycle</h2><p>Salary profiles → draft run → owner/admin approval → recorded payment → paid run.</p></div></header><ol className="payroll-flow"><li>Set effective salary profiles</li><li>Generate a draft monthly run</li><li>Owner or administrator approves it</li><li>Finance records each payment</li><li>Close the run when all items are paid</li></ol></section>
      {financeRole&&missingSalaryProfiles.length>0&&<section className="payroll-warning"><b>{missingSalaryProfiles.length} active employees have no active salary profile.</b><span>These employees will not be included in the next payroll run.</span><button className="payroll-button" onClick={()=>setTab('salary')}>Review salary profiles</button></section>}
    </div>
    if(tab==='salary')return <section className="payroll-panel">
      <header><div><h2>Employee salary profiles</h2><p>Versioned compensation records with effective dates. New records close older active profiles for the employee.</p></div>{financeRole&&<button className="payroll-button primary" onClick={()=>openSalary()}><Plus size={14}/> Add salary profile</button>}</header>
      {financeRole&&missingSalaryProfiles.length>0&&<div className="payroll-warning compact">{missingSalaryProfiles.length} active employees need an effective salary profile.</div>}
      <label className="payroll-search">Search employees<input value={salarySearch} onChange={e=>{setSalarySearch(e.target.value);setSalaryPage(1)}} placeholder="Name, employee ID or status…"/></label>
      {orderedProfiles.length?<><div className="payroll-table-wrap"><table><thead><tr>
        {payrollSortHeader('Employee','employee',salarySortKey,salarySortDirection,()=>toggleSalarySort('employee'))}
        {payrollSortHeader('Employee ID','employee_no',salarySortKey,salarySortDirection,()=>toggleSalarySort('employee_no'))}
        {payrollSortHeader('Base','base_salary',salarySortKey,salarySortDirection,()=>toggleSalarySort('base_salary'))}
        {payrollSortHeader('Allowances','monthly_allowances',salarySortKey,salarySortDirection,()=>toggleSalarySort('monthly_allowances'))}
        {payrollSortHeader('Deductions','monthly_deductions',salarySortKey,salarySortDirection,()=>toggleSalarySort('monthly_deductions'))}
        {payrollSortHeader('Net / month','net_month',salarySortKey,salarySortDirection,()=>toggleSalarySort('net_month'))}
        {payrollSortHeader('Effective','effective_from',salarySortKey,salarySortDirection,()=>toggleSalarySort('effective_from'))}
        {payrollSortHeader('Status','status',salarySortKey,salarySortDirection,()=>toggleSalarySort('status'))}
        {financeRole&&<th>Action</th>}
      </tr></thead><tbody>{salaryPageRows.map(profile=>{const employee=employees.find(e=>e.id===profile.teacher_id);return <tr key={profile.id}>
        <td><b>{String(employee?.full_name??'Employee')}</b></td><td>{String(employee?.employee_no??'—')}</td>
        <td>{cash(profile.base_salary)}</td><td>{cash(profile.monthly_allowances)}</td><td>{cash(profile.monthly_deductions)}</td>
        <td><strong>{cash(moneyValue(profile.base_salary)+moneyValue(profile.monthly_allowances)-moneyValue(profile.monthly_deductions))}</strong></td>
        <td>{fmtDate(profile.effective_from)}{profile.effective_to?' – '+fmtDate(profile.effective_to):''}</td><td><PayrollBadge value={profile.status}/></td>
        {financeRole&&<td>{profile.status==='active'&&<button className="payroll-button" onClick={()=>openSalary(employee)}>New version</button>}</td>}
      </tr>})}</tbody></table></div>{payrollPageControls(orderedProfiles.length,salaryCurrentPage,salaryPageCount,setSalaryPage)}</>:<div className="payroll-empty">{salarySearch?'No salary profiles match this search.':'No salary profiles have been configured yet.'}</div>}
    </section>
    if(tab==='runs')return <div className="payroll-split"><section className="payroll-panel"><header><div><h2>Payroll runs</h2><p>Period-based payroll snapshots. A generated run never silently changes when a salary profile is edited later.</p></div>{financeRole&&<button className="payroll-button primary" onClick={()=>setRunForm(true)}><Plus size={14}/> Generate run</button>}</header>{runs.length?<div className="payroll-runs-list">{runs.map(run=><button type="button" key={run.id} className={'payroll-run-card '+(selectedRun===run.id?'selected':'')} onClick={()=>setSelectedRun(run.id)}><span><b>{fmtDate(run.period_start)} – {fmtDate(run.period_end)}</b><small>Pay date: {fmtDate(run.pay_date)}</small></span><PayrollBadge value={run.status}/></button>)}</div>:<div className="payroll-empty">No payroll runs yet. Add salary profiles, then generate the first period.</div>}</section><section className="payroll-panel"><header><div><h2>Run detail</h2><p>{selectedRunRow?fmtDate(selectedRunRow.period_start)+' – '+fmtDate(selectedRunRow.period_end):'Select a payroll run'}</p></div>{selectedRunRow&&<div className="payroll-header-total"><small>Net payroll</small><strong>{cash(totalPayroll)}</strong></div>}</header>{selectedRunRow?<><div className="payroll-run-summary"><PayrollBadge value={selectedRunRow.status}/><span>{selectedItems.length} employee entries</span><span>{unpaidSelected} unpaid / held</span></div>{canApprove&&['draft','review'].includes(selectedRunRow.status)&&<button className="payroll-button primary" onClick={()=>void approveRun()} disabled={saving}>Approve payroll run</button>}<div className="payroll-table-wrap"><table><thead><tr><th>Employee</th><th>Base</th><th>Gross</th><th>Net</th><th>Status</th>{financeRole&&<th>Action</th>}</tr></thead><tbody>{selectedItems.map(item=>{const employee=employees.find(e=>e.id===item.teacher_id);return <tr key={item.id}><td><b>{String(employee?.full_name??'Employee')}</b><small>{String(employee?.employee_no??'')}</small></td><td>{cash(item.base_salary)}</td><td>{cash(item.gross_pay)}</td><td><strong>{cash(item.net_pay)}</strong></td><td><PayrollBadge value={item.payment_status}/></td>{financeRole&&<td>{selectedRunRow.status==='approved'&&item.payment_status!=='paid'&&<button className="payroll-button" onClick={()=>void markItemPaid(item)} disabled={saving}>Mark paid</button>}</td>}</tr>})}</tbody></table></div>{selectedItems.length===0&&<div className="payroll-empty">This payroll run has no employee entries.</div>}</>:<div className="payroll-empty">Choose a payroll run to inspect its employees, amounts and payment states.</div>}</section></div>
    if(tab==='payslips')return <section className="payroll-panel">
      <header><div><h2>{financeRole?'Employee payslip register':'My payslips'}</h2><p>{financeRole?'Search payroll item snapshots and export the current visible records.':'Only payroll entries linked to your signed-in employee profile are shown.'}</p></div><button className="payroll-button" onClick={()=>exportItems(orderedPayslips)}><Download size={14}/> Export CSV</button></header>
      <label className="payroll-search">Search payslips<input value={search} onChange={e=>{setSearch(e.target.value);setPayslipPage(1)}} placeholder="Employee, ID, period or payslip reference…"/></label>
      {orderedPayslips.length?<><div className="payroll-table-wrap"><table><thead><tr>
        {payrollSortHeader('Employee','employee',payslipSortKey,payslipSortDirection,()=>togglePayslipSort('employee'))}
        {payrollSortHeader('Period','period',payslipSortKey,payslipSortDirection,()=>togglePayslipSort('period'))}
        {payrollSortHeader('Base salary','base_salary',payslipSortKey,payslipSortDirection,()=>togglePayslipSort('base_salary'))}
        {payrollSortHeader('Gross','gross_pay',payslipSortKey,payslipSortDirection,()=>togglePayslipSort('gross_pay'))}
        {payrollSortHeader('Net','net_pay',payslipSortKey,payslipSortDirection,()=>togglePayslipSort('net_pay'))}
        {payrollSortHeader('Payment','payment_status',payslipSortKey,payslipSortDirection,()=>togglePayslipSort('payment_status'))}
        {payrollSortHeader('Payslip reference','payslip_reference',payslipSortKey,payslipSortDirection,()=>togglePayslipSort('payslip_reference'))}
      </tr></thead><tbody>{payslipPageRows.map(item=>{const employee=employees.find(e=>e.id===item.teacher_id);const run=runs.find(r=>r.id===item.payroll_run_id);return <tr key={item.id}>
        <td><b>{String(employee?.full_name??(financeRole?'Employee':'My record'))}</b></td>
        <td>{run?fmtDate(run.period_start)+' – '+fmtDate(run.period_end):String(item.payroll_run_id).slice(0,8)}</td>
        <td>{cash(item.base_salary)}</td><td>{cash(item.gross_pay)}</td><td><strong>{cash(item.net_pay)}</strong></td>
        <td><PayrollBadge value={item.payment_status}/></td><td>{String(item.payslip_reference??'—')}</td>
      </tr>})}</tbody></table></div>{payrollPageControls(orderedPayslips.length,payslipCurrentPage,payslipPageCount,setPayslipPage)}</>:<div className="payroll-empty">No payslip rows are available for this account or search.</div>}
    </section>
    return null
  }

  return <main className="payroll-stage page-content ed360-module-page">
    <header className="payroll-heading"><div><span>HUMAN RESOURCES / COMPENSATION CONTROL</span><h1>Salary and Payroll</h1><p>Manage effective compensation, monthly payroll snapshots, approval and paid-status reconciliation.</p></div><span className="payroll-cloud"><i/>Institution cloud records</span></header>
    <nav className="payroll-nav" aria-label="Payroll workspace windows">{tabs.map(key=><button type="button" key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{({overview:'Payroll overview',salary:'Salary profiles',runs:'Payroll runs',payslips:'Payslips'})[key]}</button>)}</nav>
    <section className="payroll-context"><div><small>ACTIVE PAYROLL WINDOW</small><h2>{({overview:'Compensation and payment control',salary:'Effective employee compensation',runs:'Period payroll register',payslips:financeRole?'Payslip register':'My payslips'})[tab]}</h2><p>Payroll is generated from saved employee profiles. Approvals and payment-status transitions are enforced by the database.</p></div><div><strong>{financeRole?runs.length:new Set(items.map(i=>i.payroll_run_id)).size}</strong><small>Visible payroll runs</small></div></section>
    {error&&<div className="payroll-error" role="alert">{error}</div>}
    {loading?<div className="payroll-loading"><RefreshCw size={18}/> Loading payroll records…</div>:renderContent()}
    <footer className="payroll-footer"><span><ShieldCheck size={14}/> Salary visibility follows employee self-access and finance role permissions.</span><button className="payroll-button" onClick={()=>void load()}><RefreshCw size={14}/> Refresh</button></footer>
    {salaryForm&&<div className="modal-backdrop"><section className="modal-card payroll-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">EMPLOYEE COMPENSATION</div><h2>Create salary profile</h2><p>This saves a new effective version. The prior active profile is closed in the same database transaction.</p></div><button className="icon-button" onClick={()=>setSalaryForm(false)}><X size={18}/></button></div><form onSubmit={saveSalary} className="payroll-form"><label>Employee *<select required value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Select employee</option>{employees.filter(e=>e.employment_status==='active'||!e.employment_status).map(e=><option key={e.id} value={e.id}>{String(e.full_name)} · {String(e.employee_no??'')}</option>)}</select></label><label>Base salary (PKR / month) *<input required min="0" step="0.01" type="number" value={baseSalary} onChange={e=>setBaseSalary(e.target.value)}/></label><div className="payroll-form-row"><label>Monthly allowances<input min="0" step="0.01" type="number" value={allowances} onChange={e=>setAllowances(e.target.value)}/></label><label>Monthly deductions<input min="0" step="0.01" type="number" value={deductions} onChange={e=>setDeductions(e.target.value)}/></label></div><div className="payroll-form-row"><label>Effective from *<input required type="date" value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)}/></label><label>Effective to<input type="date" min={effectiveFrom} value={effectiveTo} onChange={e=>setEffectiveTo(e.target.value)}/></label></div><label>Notes<textarea rows={2} value={salaryNotes} onChange={e=>setSalaryNotes(e.target.value)}/></label><div className="payroll-form-net"><span>Estimated monthly net</span><strong>{cash(moneyValue(baseSalary)+moneyValue(allowances)-moneyValue(deductions))}</strong></div><div className="modal-actions"><button type="button" className="payroll-button" onClick={()=>setSalaryForm(false)}>Cancel</button><button className="payroll-button primary" disabled={saving}>{saving?'Saving…':'Save salary profile'}</button></div></form></section></div>}
    {runForm&&<div className="modal-backdrop"><section className="modal-card payroll-modal" role="dialog" aria-modal="true"><div className="modal-heading"><div><div className="eyebrow">MONTHLY PAYROLL</div><h2>Generate payroll run</h2><p>Creates a draft snapshot using salary profiles effective during the chosen period.</p></div><button className="icon-button" onClick={()=>setRunForm(false)}><X size={18}/></button></div><form onSubmit={generateRun} className="payroll-form"><div className="payroll-form-row"><label>Period start *<input required type="date" value={periodStart} onChange={e=>setPeriodStart(e.target.value)}/></label><label>Period end *<input required type="date" min={periodStart} value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)}/></label></div><label>Pay date *<input required type="date" value={payDate} onChange={e=>setPayDate(e.target.value)}/></label><label>Notes<textarea rows={2} value={runNotes} onChange={e=>setRunNotes(e.target.value)}/></label><div className="payroll-note">Only active employees with salary profiles effective during this period are included. Existing payroll periods cannot be generated twice.</div><div className="modal-actions"><button type="button" className="payroll-button" onClick={()=>setRunForm(false)}>Cancel</button><button className="payroll-button primary" disabled={saving}>{saving?'Generating…':'Generate draft run'}</button></div></form></section></div>}
  </main>
}
