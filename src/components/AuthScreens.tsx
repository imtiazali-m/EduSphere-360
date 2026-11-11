import { useEffect, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, BookOpen, Building2, Bus,
  CalendarCheck, Check, CheckCircle2, ClipboardCheck, DoorOpen,
  Package, UserCheck,
  GraduationCap, Headphones, HeartHandshake, Layers3, LockKeyhole,
  Eye, EyeOff, Mail, Menu, Monitor, Server, ShieldCheck, Sparkles,
  Users, Wallet, X, Zap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { userFacingError } from '../lib/userErrors'
import { resendInstitutionOwnerVerification } from '../lib/auth'
import type { AppRole } from '../lib/types'
import '../styles/welcome-marketing.css'
import '../styles/welcome-completion.css'
import '../styles/auth-experience.css'

interface ScreenProps { navigate: (screen: 'welcome' | 'login' | 'setup', role?: AppRole) => void }

const portals: { role: AppRole; title: string; description: string; icon: typeof GraduationCap }[] = [
  { role: 'owner', title: 'Institution owner', description: 'Create and manage your institution workspace', icon: Building2 },
  { role: 'admin', title: 'Administrator', description: 'Institution-wide management and reports', icon: ShieldCheck },
  { role: 'teacher', title: 'Teacher', description: 'Classes, attendance and academic work', icon: BookOpen },
  { role: 'student', title: 'Student', description: 'Learning, exams and personal records', icon: GraduationCap },
  { role: 'parent', title: 'Parent / guardian', description: 'Attendance, progress and fee updates', icon: Users },
  { role: 'accountant', title: 'Accountant', description: 'Invoices, payments and balances', icon: Wallet },
  { role: 'exam_officer', title: 'Examination officer', description: 'Exam schedules, marks and results', icon: ClipboardCheck },
]

function Brand() {
  return <div className="es-auth-brand" aria-label="EduSphere 360">
    <span className="es-auth-brand-mark"><GraduationCap size={23} strokeWidth={2.1} /></span>
    <span className="es-auth-brand-copy"><b>EduSphere <em>360</em></b><small>EDUCATION MANAGEMENT</small></span>
  </div>
}


type ShowcaseKey = 'students' | 'teaching' | 'finance' | 'governance'

const showcaseTabs: { key: ShowcaseKey; label: string }[] = [
  { key: 'students', label: 'Student journey' },
  { key: 'teaching', label: 'Teaching & assessment' },
  { key: 'finance', label: 'Finance operations' },
  { key: 'governance', label: 'Administration' },
]

const showcasePanels: Record<ShowcaseKey, {
  eyebrow: string
  title: string
  description: string
  steps: string[]
  previewTitle: string
  previewRows: { label: string; detail: string }[]
}> = {
  students: {
    eyebrow: 'PEOPLE / STUDENT LIFECYCLE',
    title: 'From first admission to a complete learner record.',
    description: 'Keep the admission queue, student directory, class placement, guardian links, documents and student history connected around the same learner record.',
    steps: ['Review admission applications', 'Place learners in a class and session', 'Connect guardians and verified documents'],
    previewTitle: 'Student record workspace',
    previewRows: [
      { label: 'Admissions', detail: 'Applications and decisions' },
      { label: 'Class placement', detail: 'Class, section and session' },
      { label: 'Family & documents', detail: 'Guardian links and private files' },
    ],
  },
  teaching: {
    eyebrow: 'ACADEMICS / TEACHING & ASSESSMENT',
    title: 'Bring lesson work, assessment and results into one flow.',
    description: 'Organise assignments and submissions, review student work, schedule examinations and publish results through the academic records your role can access.',
    steps: ['Create and assign coursework', 'Review submissions and provide feedback', 'Schedule examinations and publish approved results'],
    previewTitle: 'Teaching and assessment',
    previewRows: [
      { label: 'Coursework', detail: 'Open work and due dates' },
      { label: 'Submission review', detail: 'Teacher feedback and marks' },
      { label: 'Examinations', detail: 'Schedules and published results' },
    ],
  },
  finance: {
    eyebrow: 'FINANCE / FEES & ACCOUNTS',
    title: 'See the fee obligation, payment history and ledger together.',
    description: 'Build fee structures, issue invoices, record receipts, follow outstanding balances and maintain double-entry journal records with database-side posting validation.',
    steps: ['Set fee schedules and discounts', 'Issue invoices and record payments', 'Reconcile receivables and post balanced journals'],
    previewTitle: 'Finance workspace',
    previewRows: [
      { label: 'Fee structures', detail: 'Classes, sessions and components' },
      { label: 'Invoices & receipts', detail: 'Balances and payment history' },
      { label: 'Accounts & journals', detail: 'Double-entry financial records' },
    ],
  },
  governance: {
    eyebrow: 'ADMINISTRATION / INSTITUTION CONTROL',
    title: 'Manage institutional settings with clear responsibility.',
    description: 'Keep institution identity, academic structure, role-based access, setting approvals and operational audit records in focused administrative workspaces.',
    steps: ['Maintain institution and academic settings', 'Provision accounts with role-specific access', 'Review approval requests and recorded changes'],
    previewTitle: 'Administration workspace',
    previewRows: [
      { label: 'Institution settings', detail: 'Tenant-scoped configuration' },
      { label: 'User access', detail: 'Accounts and role assignments' },
      { label: 'Approvals & audit', detail: 'Decisions and change history' },
    ],
  },
}

const welcomeFaqs = [
  {
    question: 'Is EduSphere 360 currently an online or offline platform?',
    answer: 'The current release is cloud-based and requires an internet connection. Offline/local operation is not available in this release.',
  },
  {
    question: 'Which people can have their own workspace?',
    answer: 'The platform has separate role access for institution owners, administrators, teachers, students, parents or guardians, accountants and examination officers. Menus and actions are shaped by each role.',
  },
  {
    question: 'What can an institution owner do after registration?',
    answer: 'The owner creates the institution workspace, manages institution-level settings and can provision administrator and other institution accounts. Administrators can then manage the day-to-day records permitted by their role.',
  },
  {
    question: 'Can EduSphere 360 process payments through an external payment gateway?',
    answer: 'The current finance workspace supports fee invoices and recording payment and receipt records. An external online payment gateway is not connected in this release, so recording a payment does not itself charge a bank card or wallet.',
  },
  {
    question: 'Is the self-hosted USV 360 Pro edition ready to install?',
    answer: 'USV 360 Pro is a planned self-hosted edition. The current available platform is the online cloud edition; self-hosted deployment is not currently offered as a released installation.',
  },
  {
    question: 'How are student and institution records protected?',
    answer: 'The cloud database uses institution-scoped access rules and role-based permissions. Users should only see and change records allowed for their active institution membership and role.',
  },
]

export function WelcomeScreen({ navigate }: ScreenProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showcaseTab, setShowcaseTab] = useState<ShowcaseKey>('students')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [legalDocument, setLegalDocument] = useState<'terms' | 'privacy' | null>(null)
  const closeMenu = () => setMobileOpen(false)
  const go = (screen: 'login' | 'setup') => { closeMenu(); navigate(screen) }

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.edm-home main > section, .edm-home .edm-footer'))
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || !('IntersectionObserver' in window)) {
      sections.forEach(section => section.classList.add('edm-scroll-reveal', 'is-visible'))
      return
    }
    sections.forEach(section => section.classList.add('edm-scroll-reveal'))
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' })
    sections.forEach(section => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="edm-home">
      <header className="edm-header">
        <a className="edm-brand" href="#top" aria-label="EduSphere 360 home" onClick={closeMenu}>
          <span className="edm-brand-symbol"><GraduationCap size={24} strokeWidth={2.1}/><i>360</i></span>
          <span className="edm-brand-copy"><b>EduSphere <em>360</em></b><small>EDUCATION MANAGEMENT</small></span>
        </a>
        <button className="edm-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen}>
          {mobileOpen ? <X size={21}/> : <Menu size={21}/>}
        </button>
        <nav className={`edm-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          <a className="edm-nav-link" href="#top" onClick={closeMenu}>Home</a>
          <a className="edm-nav-link" href="#features" onClick={closeMenu}>Features</a>
          <a className="edm-nav-link" href="#solutions" onClick={closeMenu}>Solutions</a>
          <a className="edm-nav-link" href="#about" onClick={closeMenu}>About</a>
          <a className="edm-nav-link" href="#contact" onClick={closeMenu}>Contact</a>
          <a className="edm-nav-link" href="#showcase" onClick={closeMenu}>Product tour</a>
          <a className="edm-nav-link" href="#faq" onClick={closeMenu}>FAQ</a>
        </nav>
        <div className="edm-header-actions"><button className="edm-login-link" onClick={() => go('login')}>Login</button><button className="edm-signup-button" onClick={() => go('setup')}>Get Started <ArrowUpRight size={16}/></button></div>
      </header>

      <main id="top">
        <section className="edm-hero">
          <div className="edm-hero-grid" aria-hidden="true"/><div className="edm-hero-orb edm-orb-one"/><div className="edm-hero-orb edm-orb-two"/>
          <div className="edm-hero-inner">
            <div className="edm-hero-copy">
              <div className="edm-eyebrow"><span className="edm-eyebrow-dot"/> A CONNECTED EDUCATION MANAGEMENT PLATFORM</div>
              <h1>Your institution.<br/><em>One intelligent system.</em></h1>
              <p className="edm-hero-lead">Bring admissions, student records, teaching, attendance, examinations, fees and communication together in one beautifully organised platform.</p>
              <div className="edm-hero-actions"><button className="edm-button edm-button-lime" onClick={() => go('setup')}>Create your institution <ArrowUpRight size={18}/></button><a className="edm-button edm-button-outline" href="#platform" onClick={closeMenu}>Explore the platform <ArrowRight size={17}/></a></div>
              <div className="edm-free-note"><span><Check size={14}/></span><b>Cloud-first core platform.</b> Explore the currently available workflows before onboarding.</div>
              <div className="edm-hero-trust"><span><ShieldCheck size={16}/> Role-based access</span><span><Monitor size={16}/> Desktop & mobile</span><span><Server size={16}/> Planned self-hosted edition</span></div>
            </div>
            <div className="edm-hero-art" aria-label="Illustrative EduSphere 360 product interface">
              <div className="edm-art-halo"/><div className="edm-art-orbit orbit-a"/><div className="edm-art-orbit orbit-b"/>
              <img className="edm-hero-campus-photo" src="https://images.pexels.com/photos/29326797/pexels-photo-29326797.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Modern university building surrounded by mature trees" loading="lazy" decoding="async"/>
              <div className="edm-product-card">
                <div className="edm-product-top"><div className="edm-product-brand"><span><GraduationCap size={16}/></span><b>EduSphere <i>360</i></b></div><div className="edm-window-dots"><i/><i/><i/></div></div>
                <div className="edm-product-layout">
                  <aside className="edm-product-side"><div className="edm-side-active"><Layers3 size={15}/></div><div><Users size={15}/></div><div><BookOpen size={15}/></div><div><CalendarCheck size={15}/></div><div><Wallet size={15}/></div><div><BarChart3 size={15}/></div></aside>
                  <div className="edm-product-main"><div className="edm-product-title"><div><small>INSTITUTION OVERVIEW</small><b>Everything, in one view.</b></div><span className="edm-product-chip">PRODUCT PREVIEW</span></div>
                    <div className="edm-product-stats"><div><small>LEARNERS</small><b>Admissions</b><span>Profiles & enrolment</span></div><div><small>ACADEMICS</small><b>Teaching</b><span>Classes & assessments</span></div><div><small>FINANCE</small><b>Fee ledger</b><span>Invoices & payments</span></div></div>
                    <div className="edm-product-board"><div className="edm-board-heading"><b>Institution operations</b><span>WORKFLOW</span></div><div className="edm-board-line"><i className="line-learners"><Users size={14}/></i><span><b>Student management</b><small>Admissions · Profiles · Class placement</small></span><CheckCircle2 size={16}/></div><div className="edm-board-line"><i className="line-academics"><BookOpen size={14}/></i><span><b>Academic management</b><small>Attendance · Exams · Assignments</small></span><CheckCircle2 size={16}/></div><div className="edm-board-line"><i className="line-finance"><Wallet size={14}/></i><span><b>Finance & administration</b><small>Fees · Departments · Reports</small></span><CheckCircle2 size={16}/></div></div>
                  </div>
                </div>
              </div>
              <div className="edm-float-card edm-float-role"><span><Users size={18}/></span><div><b>Every role connected</b><small>Owner · Teacher · Student · Parent</small></div></div>
              <div className="edm-float-card edm-float-free"><span><Sparkles size={18}/></span><div><b>Core tools, connected</b><small>Built around institution workflows</small></div></div>
              <div className="edm-art-caption">A clearer way to run your institution</div>
            </div>
          </div>
          <div className="edm-hero-bottom"><span>MADE FOR THE WAY INSTITUTIONS WORK</span><div><b>Schools</b><i/><b>Colleges</b><i/><b>Universities</b><i/><b>Multi-campus groups</b></div></div>
        </section>

        <section className="edm-facts-band" aria-label="EduSphere 360 platform facts">
          <div><strong>3</strong><span>Education settings<br/>School · College · University</span></div>
          <div><strong>7</strong><span>Role types<br/>Access for every stakeholder</span></div>
          <div><strong>7</strong><span>Role-specific workspaces<br/>Access shaped by responsibility</span></div>
          <div><strong>1</strong><span>Unified platform<br/>One consistent experience</span></div>
        </section>

        <section className="edm-visual-showcase" aria-label="Campus and learning environments">
          <div className="edm-visual-showcase-copy">
            <span className="edm-section-kicker">BUILT AROUND REAL CAMPUS LIFE</span>
            <h2>People, places and progress.<br/><em>Connected in one system.</em></h2>
            <p>From the learning spaces where students collaborate to the campus teams that keep an institution running, EduSphere 360 brings daily work into a clearer shared experience.</p>
          </div>
          <figure className="edm-visual-photo edm-campus-photo-card">
            <img src="https://images.pexels.com/photos/29326797/pexels-photo-29326797.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="A modern university building surrounded by mature green trees" loading="lazy" decoding="async"/>
            <figcaption><span>01 / CAMPUS</span><b>Spaces that bring education to life</b></figcaption>
          </figure>
          <figure className="edm-visual-photo edm-learning-photo-card">
            <img src="https://images.pexels.com/photos/16420473/pexels-photo-16420473/free-photo-of-a-group-of-students-sitting-in-a-library-and-studying.jpeg?auto=compress&w=1260&h=750&dpr=1" alt="Students collaborating with laptops and books in a university library" loading="lazy" decoding="async"/>
            <figcaption><span>02 / LEARNING</span><b>Collaboration, knowledge and achievement</b></figcaption>
          </figure>
        </section>

        <section className="edm-analytics-section edm-section" id="analytics">
          <div className="edm-analytics-heading">
            <div><span className="edm-section-kicker">VISUAL ANALYTICS</span><h2>See the whole picture.<br/><em>Act on what matters.</em></h2><p>Turn everyday institutional records into clear trends, comparisons and operational insight.</p></div>
            <span className="edm-analytics-disclaimer"><ShieldCheck size={16}/> Illustrative dashboard preview · Sample data</span>
          </div>
          <div className="edm-analytics-grid">
            <article className="edm-analytics-card edm-analytics-area-card">
              <div className="edm-analytics-card-head"><div><small>AREA CHART · SAMPLE</small><b>Enrollment trend</b></div><span>6-month view</span></div>
              <svg className="edm-sample-area-chart" viewBox="0 0 520 160" role="img" aria-label="Illustrative area chart showing a rising enrollment trend">
                <defs><linearGradient id="edmAreaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8fb96b" stopOpacity=".38"/><stop offset="100%" stopColor="#8fb96b" stopOpacity=".02"/></linearGradient></defs>
                <path d="M18 132 L18 112 L110 95 L202 104 L294 68 L386 76 L478 28 L478 132 Z" fill="url(#edmAreaFill)"/>
                <path d="M18 112 L110 95 L202 104 L294 68 L386 76 L478 28" fill="none" stroke="#6f9e51" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                {[18,110,202,294,386,478].map((x,i)=><circle key={x} cx={x} cy={[112,95,104,68,76,28][i]} r="4.5" fill="#6f9e51" stroke="#fff" strokeWidth="2"/>)}
                {[42,82,122].map(y=><line key={y} x1="18" y1={y} x2="478" y2={y} stroke="#e8eee5" strokeDasharray="4 6"/>)}
              </svg>
              <div className="edm-chart-axis"><span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span></div>
            </article>
            <article className="edm-analytics-card edm-analytics-gauge-card">
              <div className="edm-analytics-card-head"><div><small>GAUGE · SAMPLE</small><b>Attendance rate</b></div><span>Illustration</span></div>
              <div className="edm-sample-gauge"><div><strong>92%</strong><small>Present</small></div></div>
              <p>At-a-glance attendance health</p>
            </article>
            <article className="edm-analytics-card">
              <div className="edm-analytics-card-head"><div><small>COLUMN CHART · SAMPLE</small><b>Fee collection</b></div><span>By term</span></div>
              <div className="edm-sample-columns"><div><i style={{height:'48%'}}/><span>Term 1</span></div><div><i style={{height:'66%'}}/><span>Term 2</span></div><div><i style={{height:'83%'}}/><span>Term 3</span></div><div><i style={{height:'92%'}}/><span>Term 4</span></div></div>
              <div className="edm-sample-legend"><i/> Collected <i className="muted"/> Previous period</div>
            </article>
            <article className="edm-analytics-card">
              <div className="edm-analytics-card-head"><div><small>PIE CHART · SAMPLE</small><b>Learner distribution</b></div><span>By level</span></div>
              <div className="edm-sample-pie-wrap"><div className="edm-sample-pie"><span>100%</span></div><div className="edm-sample-pie-legend"><span><i/>Primary</span><span><i/>Middle</span><span><i/>Secondary</span></div></div>
            </article>
            <article className="edm-analytics-card edm-analytics-comparison-card">
              <div className="edm-analytics-card-head"><div><small>RESULTS COMPARISON · SAMPLE</small><b>Exam results & academic performance</b></div><span>Term comparison</span></div>
              <div className="edm-sample-comparison"><div><span>Term 1</span><div><i style={{width:'68%'}}/></div><b>68</b></div><div><span>Term 2</span><div><i style={{width:'79%'}}/></div><b>79</b></div><div><span>Term 3</span><div><i style={{width:'86%'}}/></div><b>86</b></div></div>
              <p className="edm-sample-caption">Example only — actual charts use your institution's available records.</p>
            </article>
          </div>
        </section>

        <section className="edm-intro-section edm-section" id="platform" aria-labelledby="edm-about-heading">
          <span className="edm-anchor-target" id="about" />
          <div className="edm-section-side"><span className="edm-section-index">01 / PLATFORM</span><span className="edm-side-rule"/><span className="edm-section-side-note">A single place for your whole institution</span></div>
          <div className="edm-intro-content"><div className="edm-section-kicker">MEET EDUSPHERE 360</div><h2 id="edm-about-heading">Less administration.<br/><em>More meaningful progress.</em></h2><p>EduSphere 360 is an education management platform designed to make institutional work simpler. From the first admission to daily teaching, finance and reporting, teams can manage their responsibilities through one consistent system.</p><div className="edm-intro-points"><span><CheckCircle2 size={17}/> One connected information system</span><span><CheckCircle2 size={17}/> Clear access for every user role</span><span><CheckCircle2 size={17}/> Configurable for different institution types</span></div></div>
          <div className="edm-intro-visual"><img className="edm-intro-campus-photo" src="https://images.pexels.com/photos/16420473/pexels-photo-16420473/free-photo-of-a-group-of-students-sitting-in-a-library-and-studying.jpeg?auto=compress&w=1260&h=750&dpr=1" alt="Students collaborating with laptops and books in a university library" loading="lazy" decoding="async"/><div className="edm-campus-illustration"><div className="edm-campus-sun"/><div className="edm-campus-building"><div className="edm-building-roof"/><div className="edm-building-top"><span/><span/><span/></div><div className="edm-building-columns"><i/><i/><i/><i/></div><div className="edm-building-door"/></div><div className="edm-campus-ground"/><div className="edm-campus-tree tree-left"/><div className="edm-campus-tree tree-right"/><div className="edm-campus-path"/></div><div className="edm-visual-label"><span>ONE</span><b>One institution.<br/>Every moving part.</b></div></div>
        </section>

        <section className="edm-offer-section edm-section" id="features">
          <div className="edm-section-heading"><div><span className="edm-section-kicker">WHAT WE OFFER</span><h2>Everything your institution needs.<br/><em>Nothing scattered.</em></h2></div><p>Purpose-built tools for the people, processes and priorities that keep education moving.</p></div>
          <div className="edm-feature-grid">
            <article className="edm-feature-card feature-large"><div className="edm-feature-top"><span className="edm-feature-icon"><Users size={21}/></span><small>01 / ADMINISTRATION</small></div><h3>Institution administration & access</h3><p>Manage institutional settings, user permissions, approvals and responsibility-based access for owners and administrators.</p><div className="edm-feature-visual edm-people-visual"><div className="edm-person person-one"><Users size={17}/></div><div className="edm-person person-two"><GraduationCap size={17}/></div><div className="edm-person person-three"><BookOpen size={17}/></div><div className="edm-person person-four"><Building2 size={17}/></div><div className="edm-role-lines"><i/><i/><i/><i/></div></div></article>
            <article className="edm-feature-card"><div className="edm-feature-top"><span className="edm-feature-icon"><UserCheck size={21}/></span><small>02 / ADMISSIONS</small></div><h3>Admissions & enrolment</h3><p>Manage applications, admission decisions, student intake and placement into the right class, programme and academic session.</p><div className="edm-feature-visual edm-admission-visual"><div><span>01</span><b>Application review</b><small>Applicant details & documents</small></div><div><span>02</span><b>Admission decision</b><small>Approval & enrolment status</small></div><div><span>03</span><b>Class placement</b><small>Session, class & section</small></div></div></article>
            <article className="edm-feature-card"><div className="edm-feature-top"><span className="edm-feature-icon"><GraduationCap size={21}/></span><small>03 / STUDENTS</small></div><h3>Student & guardian records</h3><p>Maintain learner profiles, admission identifiers, class placement, guardian connections, documents and student history.</p><div className="edm-feature-visual edm-learner-visual"><div><GraduationCap size={20}/><b>Student profile</b><small>Identity · Class · Status</small></div><div><Users size={19}/><b>Family links</b><small>Parent & guardian access</small></div></div></article>
            <article className="edm-feature-card"><div className="edm-feature-top"><span className="edm-feature-icon"><Users size={21}/></span><small>04 / TEACHERS</small></div><h3>Teachers, faculty & staff</h3><p>Manage employee profiles, department and subject allocations, faculty attendance, leave and approved staff workflows.</p><div className="edm-feature-visual edm-teacher-visual"><span><BookOpen size={18}/><b>Teaching assignments</b><small>Subjects & class allocation</small></span><span><CalendarCheck size={18}/><b>Faculty attendance</b><small>Daily records & leave</small></span></div></article>
            <article className="edm-feature-card"><div className="edm-feature-top"><span className="edm-feature-icon"><BookOpen size={21}/></span><small>05 / ACADEMICS</small></div><h3>Comprehensive academic management</h3><p>Organise classes, subjects, timetables, assignments, examinations and results.</p><div className="edm-feature-visual edm-calendar-visual"><div className="edm-calendar-head"><b>Academic planner</b><span>•••</span></div><div className="edm-calendar-grid">{Array.from({length:15},(_,i)=><i key={i} className={i===3||i===8||i===11?'marked':''}/>)}</div><small>Classes · Assessments · Results</small></div></article>
            <article className="edm-feature-card"><div className="edm-feature-top"><span className="edm-feature-icon"><Wallet size={21}/></span><small>06 / FINANCE</small></div><h3>Fees, payments & clear records</h3><p>Manage fee structures, invoices, receipts, balances and payment history.</p><div className="edm-feature-visual edm-finance-visual"><div className="edm-finance-bar"><span/><span/><span/><span/><span/><span/><span/></div><div className="edm-finance-caption"><b>Fee collection overview</b><small>Invoices · Payments · Balances</small></div></div></article>
            <article className="edm-feature-card"><div className="edm-feature-top"><span className="edm-feature-icon"><CalendarCheck size={21}/></span><small>07 / ATTENDANCE</small></div><h3>Attendance & daily operations</h3><p>Record student and faculty attendance and coordinate everyday institution activity.</p><div className="edm-feature-visual edm-attendance-visual"><div><i/><b>Present</b><small>Attendance register</small></div><div><i/><b>Late</b><small>Attendance register</small></div><div><i/><b>Absent</b><small>Attendance register</small></div></div></article>
            <article className="edm-feature-card"><div className="edm-feature-top"><span className="edm-feature-icon"><Headphones/></span><small>08 / COMMUNICATION</small></div><h3>Keep every stakeholder informed</h3><p>Share announcements and keep parents, students and teams connected with institution updates.</p><div className="edm-feature-visual edm-message-visual"><div className="edm-message-bubble">New announcement published<span/></div><div className="edm-message-bubble message-alt">Update shared with your class<span/></div></div></article>
            <article className="edm-feature-card"><div className="edm-feature-top"><span className="edm-feature-icon"><BarChart3 size={21}/></span><small>09 / INSIGHT</small></div><h3>Useful reports & decision support</h3><p>Bring institution records into clearer views that help teams understand what needs attention.</p><div className="edm-feature-visual edm-report-visual"><div className="edm-report-axis"><i/><i/><i/><i/></div><div className="edm-report-bars"><i/><i/><i/><i/><i/><i/><i/><i/></div></div></article>
          </div>

        </section>

        <section className="edm-showcase-section edm-section" id="showcase" aria-labelledby="edm-showcase-heading">
          <div className="edm-section-heading">
            <div><span className="edm-section-kicker">EXPLORE THE WORKFLOWS</span><h2 id="edm-showcase-heading">Connected records.<br/><em>Clearer everyday work.</em></h2></div>
            <p>Choose a workflow to see how the current platform groups related tasks into a dedicated workspace.</p>
          </div>
          <div className="edm-showcase-shell">
            <div className="edm-showcase-tabs" role="tablist" aria-label="Product workflow showcase" onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
              const keys: ShowcaseKey[] = ['students','teaching','finance','governance']
              const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
              const index = tabs.indexOf(event.target as HTMLButtonElement)
              let next = index
              if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
              else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = tabs.length - 1
              else return
              event.preventDefault()
              tabs[next]?.focus()
              setShowcaseTab(keys[next])
            }}>
              {showcaseTabs.map(tab => <button key={tab.key} id={'edm-showcase-tab-' + tab.key} type="button" role="tab" aria-selected={showcaseTab === tab.key} aria-controls="edm-showcase-panel" tabIndex={showcaseTab === tab.key ? 0 : -1} className={showcaseTab === tab.key ? 'active' : ''} onClick={() => setShowcaseTab(tab.key)}>{tab.label}</button>)}
            </div>
            <div className="edm-showcase-panel" id="edm-showcase-panel" role="tabpanel" aria-labelledby={'edm-showcase-tab-' + showcaseTab}>
              <div className="edm-showcase-copy">
                <span className="edm-showcase-eyebrow">{showcasePanels[showcaseTab].eyebrow}</span>
                <h3>{showcasePanels[showcaseTab].title}</h3>
                <p>{showcasePanels[showcaseTab].description}</p>
                <ol>{showcasePanels[showcaseTab].steps.map((step,index) => <li key={step}><span>{String(index + 1).padStart(2,'0')}</span>{step}</li>)}</ol>
                <button type="button" className="edm-showcase-cta" onClick={() => go('setup')}>Create your institution <ArrowUpRight size={16}/></button>
              </div>
              <div className="edm-showcase-preview" aria-label={showcasePanels[showcaseTab].previewTitle}>
                <div className="edm-showcase-preview-top"><span><i/><i/><i/></span><b>{showcasePanels[showcaseTab].previewTitle}</b><small>WORKSPACE PREVIEW</small></div>
                <div className="edm-showcase-preview-body">
                  <aside><span className="active"><Layers3 size={15}/></span><span><Users size={15}/></span><span><BookOpen size={15}/></span><span><CalendarCheck size={15}/></span></aside>
                  <div className="edm-showcase-preview-content">
                    <small>INSTITUTION WORKSPACE</small>
                    <strong>{showcasePanels[showcaseTab].previewTitle}</strong>
                    {showcasePanels[showcaseTab].previewRows.map((item,index) => <div className="edm-showcase-preview-row" key={item.label}><span className={'row-number row-number-' + index}>{String(index + 1).padStart(2,'0')}</span><span><b>{item.label}</b><small>{item.detail}</small></span><CheckCircle2 size={16}/></div>)}
                    <div className="edm-showcase-preview-note"><ShieldCheck size={14}/> Role-scoped workspace · Illustrative preview</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="edm-solutions-section edm-section" id="institution-types">
          <div className="edm-section-heading"><div><span className="edm-section-kicker">SOLUTIONS FOR EVERY CAMPUS</span><h2>One platform.<br/><em>Different institution needs.</em></h2></div><p>Start with the workflows that matter to your institution and build a connected operating model around them.</p></div>
          <div className="edm-solution-grid"><article className="edm-solution-card solution-school"><span className="edm-solution-number">01</span><span className="edm-solution-icon"><Building2 size={24}/></span><h3>Schools</h3><p>Admissions, classes, attendance, parent communication, fee collection and student progress.</p><a href="#get-started">Start with EduSphere 360 <ArrowUpRight size={16}/></a><div className="edm-solution-art school-art"><div/><div/><div/><i/></div></article><article className="edm-solution-card solution-college"><span className="edm-solution-number">02</span><span className="edm-solution-icon"><BookOpen size={24}/></span><h3>Colleges</h3><p>Departments, programmes, faculty, timetables, assessments, examinations and academic records.</p><a href="#get-started">Start with EduSphere 360 <ArrowUpRight size={16}/></a><div className="edm-solution-art college-art"><div/><div/><div/><i/></div></article><article className="edm-solution-card solution-university"><span className="edm-solution-number">03</span><span className="edm-solution-icon"><GraduationCap size={24}/></span><h3>Universities</h3><p>Multi-department coordination, academic sessions, student services and campus administration.</p><a href="#get-started">Start with EduSphere 360 <ArrowUpRight size={16}/></a><div className="edm-solution-art university-art"><div/><div/><div/><i/></div></article></div>
        </section>

        <section className="edm-access-section edm-section" id="solutions" aria-labelledby="edm-solutions-heading">
          <span className="edm-anchor-target" id="portals" />
          <div className="edm-section-heading"><div><span className="edm-section-kicker">ROLE-BASED SOLUTIONS</span><h2 id="edm-solutions-heading">The right workspace<br/><em>for every role.</em></h2></div><p>Owners, administrators, teachers, students and parents each receive focused access, with accountant and examination-officer workspaces available for specialist responsibilities.</p></div>
          <div className="edm-access-grid">{portals.map(({ role, title, description, icon: Icon }) => <button key={role} className="edm-access-card" onClick={() => navigate('login', role)}><span className="edm-access-icon"><Icon size={20}/></span><span className="edm-access-copy"><b>{title}</b><small>{description}</small></span><ArrowUpRight size={17}/></button>)}</div>
        </section>

        <section className="edm-marquee" aria-label="Platform features"><div className="edm-marquee-track">{['Admissions & records','Faculty management','Attendance','Examinations','Fee management','Assignments','Timetables','Announcements','Reports','Planned self-hosted edition','Admissions & records','Faculty management','Attendance','Examinations','Fee management','Assignments','Timetables','Announcements','Reports','Planned self-hosted edition'].map((item,i)=><span key={`${item}-${i}`}><i/> {item}</span>)}</div></section>

        <section className="edm-selfhost-section edm-section" id="self-hosted">
          <div className="edm-selfhost-art"><div className="edm-server-orbit orbit-one"/><div className="edm-server-orbit orbit-two"/><div className="edm-server-stack"><div><Server size={22}/><span><b>USV 360 Pro</b><small>SELF-HOSTED PLATFORM</small></span><i/></div><div><LockKeyhole size={19}/><span><b>Your infrastructure</b><small>Deployment under your control</small></span></div><div><ShieldCheck size={19}/><span><b>Your data ownership</b><small>Choose where your records reside</small></span></div></div><span className="edm-host-caption">INSTITUTION-CONTROLLED DEPLOYMENT</span></div>
          <div className="edm-selfhost-copy"><span className="edm-section-kicker">FOR INSTITUTIONS THAT WANT MORE CONTROL</span><h2>Meet <em>USV 360 Pro.</em><br/>Your platform. Your infrastructure.</h2><p>USV 360 Pro is the self-hosted edition planned for institutions that want to run EduSphere 360 on their own infrastructure. Deployment availability and requirements will be confirmed with the release.</p><ul><li><CheckCircle2 size={17}/> Self-hosted deployment option</li><li><CheckCircle2 size={17}/> Greater infrastructure and data control</li><li><CheckCircle2 size={17}/> A familiar platform for all user roles</li></ul><span className="edm-text-link edm-product-status">USV 360 Pro · Self-hosted edition</span></div>
        </section>

        <section className="edm-free-section edm-section" id="why-edusphere">
          <div className="edm-free-copy"><span className="edm-section-kicker">ACCESS BUILT AROUND YOUR INSTITUTION</span><h2>A strong core.<br/><em>Room to grow.</em></h2><p>Start with the operational workflows currently available in EduSphere 360. Additional capabilities will be introduced as their data models, permissions and end-to-end workflows are completed.</p><div className="edm-free-benefits"><div><span><Check size={16}/></span><b>Connected learner records</b><small>Keep permitted student information in one workspace.</small></div><div><span><Check size={16}/></span><b>Role-specific access</b><small>Give each user a workspace for their responsibilities.</small></div><div><span><Check size={16}/></span><b>Connected core workflows</b><small>Bring supported operations into one experience.</small></div></div><button className="edm-button edm-button-dark" onClick={() => go('setup')}>Create your institution <ArrowUpRight size={17}/></button></div>
          <div className="edm-free-visual"><div className="edm-free-stamp"><span>CORE PLATFORM</span><b>ACCESS</b><small>AVAILABLE WORKFLOWS</small></div><div className="edm-free-orbit free-orbit-a"/><div className="edm-free-orbit free-orbit-b"/><div className="edm-free-tile tile-main"><Sparkles size={22}/><b>Core workflows</b><small>Available institution management</small></div><div className="edm-free-tile tile-left"><Users size={20}/><b>Every role</b></div><div className="edm-free-tile tile-right"><Layers3 size={20}/><b>Connected workflows</b></div></div>
        </section>

        <section className="edm-why-section edm-section" id="why-choose-us">
          <div className="edm-section-heading"><div><span className="edm-section-kicker">WHY EDUSPHERE 360 STANDS OUT</span><h2>Designed for real institution work.<br/><em>Ready to grow with you.</em></h2></div><p>A clear experience for administrators and a simpler everyday experience for everyone who depends on your institution.</p></div>
          <div className="edm-why-grid"><article><span><Layers3 size={21}/></span><h3>Comprehensive by design</h3><p>Academic, administrative and financial workflows live in one connected platform.</p></article><article><span><Users size={21}/></span><h3>Multi-access, role-aware</h3><p>Owners, teams, students and parents each get a relevant view of their responsibilities.</p></article><article><span><Sparkles size={21}/></span><h3>Customisable experience</h3><p>Build an institution workflow around your organisation, not the other way around.</p></article><article><span><Zap size={21}/></span><h3>Ready to evolve</h3><p>A flexible foundation that can grow as new integrations and automation features are developed and released.</p></article><article><span><Server size={21}/></span><h3>Cloud-first today</h3><p>The current release operates online. A separate self-hosted edition is planned and is not part of this release.</p></article><article><span><HeartHandshake size={21}/></span><h3>One connected community</h3><p>Keep administration, educators, learners and families working from shared information.</p></article></div>
        </section>

        <section className="edm-workflow-section edm-section" id="workflow"><div className="edm-workflow-head"><span className="edm-section-kicker">A SINGLE-STEP VIEW OF THE BIG PICTURE</span><h2>From first enquiry<br/><em>to every achievement.</em></h2><p>Follow the connected journey across your institution with one clear system.</p></div><div className="edm-workflow-track"><article><span>01</span><i><Users size={21}/></i><b>Admit</b><small>Enquiries, admissions and student profiles</small></article><article><span>02</span><i><BookOpen size={21}/></i><b>Educate</b><small>Classes, subjects and assignments</small></article><article><span>03</span><i><CalendarCheck size={21}/></i><b>Coordinate</b><small>Attendance, schedules and communication</small></article><article><span>04</span><i><ClipboardCheck size={21}/></i><b>Evaluate</b><small>Examinations, results and progress</small></article><article><span>05</span><i><Wallet size={21}/></i><b>Manage</b><small>Fees, finance and administration</small></article></div></section>

        

        

        



        <section className="edm-campus-services-section edm-section" id="campus-services" aria-labelledby="edm-campus-services-heading">
          <div className="edm-section-heading">
            <div><span className="edm-section-kicker">CAMPUS SERVICES</span><h2 id="edm-campus-services-heading">The services around<br/><em>the learning experience.</em></h2></div>
            <p>Connect supported campus operations with the same institution records and role-based permissions. Availability depends on your institution's setup and enabled workflows.</p>
          </div>
          <div className="edm-campus-services-grid">
            <article className="edm-campus-service-card"><span className="edm-campus-service-icon service-library"><BookOpen size={22}/></span><div><small>AVAILABLE WORKSPACE</small><h3>Digital library</h3><p>Manage the book catalogue, circulation, issue and return records, fines, learning resources and reading history.</p><a href="#features">Explore academic features <ArrowUpRight size={15}/></a></div></article>
            <article className="edm-campus-service-card"><span className="edm-campus-service-icon service-transport"><Bus size={22}/></span><div><small>AVAILABLE WORKSPACE</small><h3>Transport management</h3><p>Coordinate vehicles, drivers, routes, stops, student allocations, transport attendance and maintenance records.</p><a href="#solutions">View role access <ArrowUpRight size={15}/></a></div></article>
            <article className="edm-campus-service-card"><span className="edm-campus-service-icon service-facilities"><DoorOpen size={22}/></span><div><small>AVAILABLE WORKSPACE</small><h3>Rooms & facilities</h3><p>Track classrooms, laboratories, room availability, reservations, maintenance and facility history.</p><a href="#features">Explore platform features <ArrowUpRight size={15}/></a></div></article>
            <article className="edm-campus-service-card"><span className="edm-campus-service-icon service-inventory"><Package size={22}/></span><div><small>AVAILABLE WORKSPACE</small><h3>Inventory & supplies</h3><p>Maintain item catalogues, suppliers, procurement, stock movement, allocation and inventory audit records.</p><a href="#features">Explore platform features <ArrowUpRight size={15}/></a></div></article>
            <article className="edm-campus-service-card"><span className="edm-campus-service-icon service-visitors"><UserCheck size={22}/></span><div><small>AVAILABLE WORKSPACE</small><h3>Visitor management</h3><p>Record visitor details, approvals, passes, entry and exit activity, notifications and visit history.</p><a href="#contact">Get support <ArrowUpRight size={15}/></a></div></article>
            <article className="edm-campus-service-card edm-campus-service-planned"><span className="edm-campus-service-icon service-hostel"><Building2 size={22}/></span><div><small>NOT AVAILABLE IN THIS RELEASE</small><h3>Hostel & residence</h3><p>Hostel room allocation, resident registers and accommodation billing are not currently available as a live workspace.</p><span className="edm-service-status">Future scope · Not yet enabled</span></div></article>
          </div>
        </section>

        <section className="edm-security-section edm-section" id="security" aria-labelledby="edm-security-heading">
          <div className="edm-section-heading">
            <div><span className="edm-section-kicker">SECURITY & RELIABILITY</span><h2 id="edm-security-heading">Institution records deserve<br/><em>careful boundaries.</em></h2></div>
            <p>EduSphere 360 uses role-aware access and institution-scoped data permissions. Security claims are kept to controls present in the current online release.</p>
          </div>
          <div className="edm-security-grid">
            <article><span><ShieldCheck size={21}/></span><h3>Role-based permissions</h3><p>Owner, administrator, teacher, student, parent and specialist roles receive distinct views and permitted actions.</p></article>
            <article><span><LockKeyhole size={21}/></span><h3>Institution-scoped records</h3><p>Database row-level security and active institution membership checks help keep each institution's data within its authorised workspace.</p></article>
            <article><span><Server size={21}/></span><h3>Private file storage</h3><p>Student photographs and institution files are stored in a private storage bucket, with access checked against user permissions.</p></article>
            <article><span><CheckCircle2 size={21}/></span><h3>Traceable operations</h3><p>Supported administration, approval and audit workflows keep important institutional actions reviewable by authorised users.</p></article>
          </div>
          <div className="edm-reliability-note"><span><Monitor size={18}/></span><div><b>Online-first service availability</b><p>The current release requires an internet connection and uses its configured cloud hosting and database providers. Offline mode, an uptime guarantee and independent security certifications are not claimed here. External messaging, payment gateways, device attendance feeds and backup-provider services require their own configuration before they can be treated as live integrations.</p></div></div>
        </section>

        <section className="edm-testimonials-section edm-section" id="testimonials" aria-labelledby="edm-testimonials-heading">
          <div className="edm-section-heading">
            <div><span className="edm-section-kicker">INSTITUTION VOICES</span><h2 id="edm-testimonials-heading">Trust should be earned.<br/><em>Not made up.</em></h2></div>
            <p>We publish institution feedback only when it is genuine and shared with permission.</p>
          </div>
          <div className="edm-testimonial-empty">
            <span><HeartHandshake size={27}/></span>
            <div><small>VERIFIED FEEDBACK</small><h3>Institution stories are being gathered.</h3><p>There are no verified institution testimonials published on this website yet. We will add real feedback and approved case studies here when institutions choose to share them.</p></div>
          </div>
        </section>

        <section className="edm-contact-section edm-section" id="contact" aria-labelledby="edm-contact-heading">
          <div className="edm-contact-intro">
            <span className="edm-section-kicker">CONTACT & HELP</span>
            <h2 id="edm-contact-heading">A clearer next step<br/><em>starts with a conversation.</em></h2>
            <p>Choose the route that matches your question. We do not display unverified email addresses or telephone numbers.</p>
          </div>
          <div className="edm-contact-grid">
            <article><span><Building2 size={20}/></span><small>INSTITUTION ACCOUNT</small><h3>Access & record support</h3><p>For login access, student records, fees or staff permissions, contact your institution owner or administrator.</p><button type="button" onClick={() => go('login')}>Go to Login <ArrowUpRight size={15}/></button></article>
            <article><span><GraduationCap size={20}/></span><small>NEW INSTITUTION</small><h3>Start your onboarding</h3><p>Create an owner account and register your institution to begin the setup journey.</p><button type="button" onClick={() => go('setup')}>Get Started <ArrowUpRight size={15}/></button></article>
            <article><span><Headphones size={20}/></span><small>HELP & POLICIES</small><h3>Find practical answers</h3><p>Read the common questions and review the current in-product privacy and terms notices.</p><div><a href="#faq">Visit FAQs <ArrowUpRight size={15}/></a><button type="button" onClick={() => setLegalDocument('privacy')}>Privacy notice</button><button type="button" onClick={() => setLegalDocument('terms')}>Terms</button></div></article>
          </div>
          <p className="edm-contact-channel-note">Official public support email and telephone details are not configured in the current website content. Add verified contact channels before publishing them here.</p>
        </section>

        <section className="edm-faq-section edm-section" id="faq" aria-labelledby="edm-faq-heading">
          <div className="edm-faq-layout">
            <div className="edm-faq-intro">
              <span className="edm-section-kicker">GOOD TO KNOW</span>
              <h2 id="edm-faq-heading">Questions before<br/><em>you get started?</em></h2>
              <p>Here are the practical details about the currently available cloud edition and its workflows.</p>
              <button type="button" className="edm-showcase-cta" onClick={() => go('setup')}>Create your institution <ArrowUpRight size={16}/></button>
            </div>
            <div className="edm-faq-list">
              {welcomeFaqs.map((item,index) => <article className={'edm-faq-item ' + (openFaq === index ? 'open' : '')} key={item.question}>
                <h3><button type="button" aria-expanded={openFaq === index} aria-controls={'edm-faq-answer-' + index} onClick={() => setOpenFaq(current => current === index ? null : index)}><span>{item.question}</span><i>{openFaq === index ? '−' : '+'}</i></button></h3>
                <div className="edm-faq-answer" id={'edm-faq-answer-' + index} hidden={openFaq !== index}><p>{item.answer}</p></div>
              </article>)}
            </div>
          </div>
        </section>

        <section className="edm-final-cta" id="get-started"><div className="edm-cta-glow"/><div><span className="edm-section-kicker">YOUR NEXT CHAPTER STARTS HERE</span><h2>Ready to transform<br/><em>your institution?</em></h2><p>Bring your people, processes and progress together with EduSphere 360.</p></div><div className="edm-cta-actions"><button className="edm-button edm-button-lime" onClick={() => go('setup')}>Get started today <ArrowUpRight size={18}/></button><button className="edm-cta-login" onClick={() => go('login')}>Already have an account? Login <ArrowRight size={15}/></button></div></section>
      </main>

      <footer className="edm-footer">
        <div className="edm-footer-main">
          <div className="edm-footer-brand">
            <a className="edm-brand edm-brand-footer" href="#top" aria-label="EduSphere 360 home">
              <span className="edm-brand-symbol"><GraduationCap size={24}/><i>360</i></span>
              <span className="edm-brand-copy"><b>EduSphere <em>360</em></b><small>EDUCATION MANAGEMENT</small></span>
            </a>
            <p>One intelligent system for the people, learning and operations of your institution.</p>
            <div className="edm-footer-free"><Sparkles size={15}/> Online core platform</div>
          </div>
          <div className="edm-footer-col"><b>Platform</b><a href="#about">About EduSphere</a><a href="#features">Features</a><a href="#solutions">Role-based solutions</a><a href="#institution-types">Institution types</a><a href="#campus-services">Campus services</a></div>
          <div className="edm-footer-col"><b>Explore</b><a href="#analytics">Analytics preview</a><a href="#workflow">How it works</a><a href="#security">Security & reliability</a><a href="#testimonials">Institution feedback</a><a href="#faq">FAQs & help</a></div>
          <div className="edm-footer-col"><b>Get started</b><a href="#get-started">Create an institution</a><a href="#contact">Contact & help</a><button type="button" onClick={() => go('login')}>Login to your account</button><button type="button" onClick={() => setLegalDocument('privacy')}>Privacy notice</button><button type="button" onClick={() => setLegalDocument('terms')}>Terms & conditions</button><a href="#top">Back to top</a></div>
        </div>
        <div className="edm-footer-bottom"><span>© {new Date().getFullYear()} EduSphere 360. All rights reserved.</span><span>Built for schools · colleges · universities</span><a href="#top">Back to top ↑</a></div>
      </footer>
      {legalDocument && <LegalNotice kind={legalDocument} onClose={() => setLegalDocument(null)} />}
    </div>
  )
}

function AuthVisualPanel({ variant }: { variant: 'login' | 'signup' | 'cloud' }) {
  return (
    <aside className={`es-auth-visual es-auth-visual-${variant}`}>
      <div className="es-auth-visual-head"><Brand /><span className="es-auth-visual-label">ONE PLATFORM · EVERY POSSIBILITY</span></div>
      <div className="es-auth-visual-copy">
        <span className="es-auth-kicker"><i /> {variant === 'login' ? 'WELCOME BACK' : 'YOUR INSTITUTION STARTS HERE'}</span>
        <h1>{variant === 'login' ? <>Welcome back to<br/><em>better learning.</em></> : <>Bring your campus<br/><em>together.</em></>}</h1>
        <p>{variant === 'login'
          ? 'Sign in to the people, tools and progress that keep your institution moving forward.'
          : 'A thoughtful, connected way to manage admissions, academics, people and everyday operations.'}</p>
      </div>
      <div className="es-auth-illustration" aria-label="Illustration of a connected education campus">
        <div className="es-auth-illustration-glow" />
        <div className="es-auth-orbit es-auth-orbit-one" />
        <div className="es-auth-orbit es-auth-orbit-two" />
        <div className="es-campus-illustration">
          <div className="es-campus-roof" />
          <div className="es-campus-top"><span /><span /><span /></div>
          <div className="es-campus-columns"><i /><i /><i /><i /><i /></div>
          <div className="es-campus-base"><span>EDUSPHERE 360</span></div>
          <div className="es-campus-ground" />
        </div>
        <div className="es-auth-float es-auth-float-admissions"><span><Users size={16}/></span><div><b>Admissions</b><small>Student records</small></div><CheckCircle2 size={15}/></div>
        <div className="es-auth-float es-auth-float-learning"><span><BookOpen size={16}/></span><div><b>Learning</b><small>Classes & assessments</small></div></div>
        <div className="es-auth-float es-auth-float-finance"><span><Wallet size={16}/></span><div><b>Operations</b><small>Fees & administration</small></div></div>
      </div>
      <div className="es-auth-visual-foot"><span className="es-auth-foot-symbol"><ShieldCheck size={16}/></span><span><b>Designed around your institution</b><small>One connected education experience</small></span><span className="es-auth-foot-dots"><i/><i/><i/></span></div>
    </aside>
  )
}

function AuthTopline({ navigate, mode }: { navigate: ScreenProps['navigate']; mode: 'login' | 'signup' }) {
  return (
    <div className="es-auth-topline">
      <button type="button" className="es-auth-back" onClick={() => navigate('welcome')}><ArrowLeft size={15}/> <span>Back to website</span></button>
      {mode === 'login'
        ? <p>New to EduSphere 360? <button type="button" onClick={() => navigate('setup')}>Sign up</button></p>
        : <p>Already have an account? <button type="button" onClick={() => navigate('login')}>Login</button></p>}
    </div>
  )
}

export function LoginScreen({ navigate, initialRole }: ScreenProps & { initialRole?: AppRole }) {
  const { mode, signIn, requestPasswordReset } = useAuth()
  type LoginAccountType = 'owner_admin' | 'employee' | 'student' | 'parent'
  const initialAccountType: LoginAccountType = initialRole === 'student' ? 'student' : initialRole === 'parent' ? 'parent' : initialRole === 'owner' || initialRole === 'admin' || !initialRole ? 'owner_admin' : 'employee'
  const [accountType, setAccountType] = useState<LoginAccountType>(initialAccountType)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [resendBusy, setResendBusy] = useState(false)
  const [resendNotice, setResendNotice] = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      await signIn(email.trim(), password, accountType, rememberMe)
    } catch (err) {
      setError(userFacingError(err, 'Unable to sign in. Check your details and try again.'))
    } finally { setBusy(false) }
  }

  async function resendLoginVerification() {
    if (!email.trim()) {
      setError('Enter the email address you used to register, then resend the verification email.')
      return
    }
    setResendBusy(true)
    setResendNotice('')
    try {
      await resendInstitutionOwnerVerification(email)
      setResendNotice('A new verification email has been sent. Check your inbox and spam folder.')
    } catch (err) {
      setResendNotice(userFacingError(err, 'Could not resend the verification email. Please try again shortly.'))
    } finally {
      setResendBusy(false)
    }
  }

  function showForgotPassword() {
    setResetMode(true)
    setError('')
    setNotice('')
    setResendNotice('')
  }

  async function sendPasswordReset(event: FormEvent) {
    event.preventDefault()
    if (!email.trim()) { setError('Enter your account email address first.'); return }
    setResetBusy(true); setError(''); setNotice('')
    try {
      await requestPasswordReset(email.trim())
      setNotice('If an account matches this email, a password-reset link has been sent. Check your inbox and spam folder.')
    } catch (err) {
      setError(userFacingError(err, 'The password-reset request could not be sent. Please try again.'))
    } finally { setResetBusy(false) }
  }

  return (
    <div className="es-auth-page">
      <AuthVisualPanel variant="login" />
      <main className="es-auth-main">
        <AuthTopline navigate={navigate} mode="login" />
        <div className="es-auth-form-wrap">
          <section className="es-auth-card es-login-card">
            <div className="es-auth-avatar"><span><GraduationCap size={23}/></span><i><Check size={11}/></i></div>
            <div className="es-auth-form-heading">
              <span className="es-auth-overline">YOUR LEARNING COMMUNITY</span>
              <h2>{resetMode ? 'Reset your password' : 'Welcome back'}</h2>
              <p>{resetMode ? 'Enter the email address associated with your institution account. We will send a secure reset link when an account matches.' : 'Enter your account details to continue to EduSphere 360.'}</p>
            </div>
            {!resetMode && <div className="es-account-type" role="group" aria-label="Choose account type">
              <button type="button" className={accountType === 'owner_admin' ? 'is-active' : ''} onClick={() => { setAccountType('owner_admin'); setError('') }} aria-pressed={accountType === 'owner_admin'}>
                <span><Building2 size={17}/></span><b>Owner / Admin</b>
              </button>
              <button type="button" className={accountType === 'employee' ? 'is-active' : ''} onClick={() => { setAccountType('employee'); setError('') }} aria-pressed={accountType === 'employee'}>
                <span><Users size={17}/></span><b>Employee</b>
              </button>
              <button type="button" className={accountType === 'student' ? 'is-active' : ''} onClick={() => { setAccountType('student'); setError('') }} aria-pressed={accountType === 'student'}>
                <span><GraduationCap size={18}/></span><b>Student</b>
              </button>
              <button type="button" className={accountType === 'parent' ? 'is-active' : ''} onClick={() => { setAccountType('parent'); setError('') }} aria-pressed={accountType === 'parent'}>
                <span><Users size={17}/></span><b>Parent</b>
              </button>
            </div>}
            {resetMode ? <form className="es-auth-form" onSubmit={sendPasswordReset}>
              <label className="es-auth-field"><span>Email address</span><div className="es-auth-input"><Mail size={17}/><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@institution.edu" /></div></label>
              {notice && <div className="es-auth-notice" role="status">{notice}</div>}
              {error && <div className="es-auth-error" role="alert">{error}</div>}
              <button className="es-auth-submit" type="submit" disabled={resetBusy}>{resetBusy ? 'Sending reset link…' : 'Send password-reset link'} <ArrowRight size={17}/></button>
              <button type="button" className="es-auth-text-button" onClick={() => { setResetMode(false); setError(''); setNotice('') }}>Back to login</button>
            </form> : <form className="es-auth-form" onSubmit={submit}>
              <label className="es-auth-field"><span>Email address</span><div className="es-auth-input"><Mail size={17}/><input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@institution.edu" /></div></label>
              <label className="es-auth-field"><span>Password</span><div className="es-auth-input"><LockKeyhole size={17}/><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"/><button type="button" className="es-password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
              <div className="es-auth-form-options"><label className="es-auth-check"><input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}/><span className="es-check-box"/><span>Remember me</span></label><button type="button" className="es-auth-text-button" onClick={showForgotPassword}>Forgot your password?</button></div>
              {mode === 'cloud' && <small className="es-auth-session-hint">Cloud session duration follows your institution’s security settings.</small>}
              {notice && <div className="es-auth-notice" role="status">{notice}</div>}
              {error && <div className="es-auth-error" role="alert">{error}</div>}
              {error.toLowerCase().includes('verify your email') && mode === 'cloud' && (
                <button type="button" className="es-auth-text-button es-resend-login-link" onClick={resendLoginVerification} disabled={resendBusy}>
                  {resendBusy ? 'Sending verification email…' : 'Resend verification email'}
                </button>
              )}
              {resendNotice && <div className="es-auth-notice" role="status">{resendNotice}</div>}
              <button className="es-auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Login'} <ArrowRight size={17}/></button>
            </form>}
            {!resetMode && <div className="es-auth-mobile-signup">Don't have an account? <button type="button" onClick={() => navigate('setup')}>Sign up</button></div>}
            <div className="es-auth-secure-note"><ShieldCheck size={15}/> Your account is protected with role-based access.</div>
          </section>
        </div>
        <footer className="es-auth-main-foot"><span>© {new Date().getFullYear()} EduSphere 360</span><span>Education management, thoughtfully connected.</span></footer>
      </main>
    </div>
  )
}

function LegalNotice({ kind, onClose }: { kind: 'terms' | 'privacy'; onClose: () => void }) {
  const isTerms = kind === 'terms'
  return (
    <div className="es-legal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="es-legal-dialog" role="dialog" aria-modal="true" aria-labelledby="es-legal-title" onMouseDown={event => event.stopPropagation()}>
        <button type="button" className="es-legal-close" onClick={onClose} aria-label="Close">×</button>
        <span className="es-auth-overline">EDUSPHERE 360</span>
        <h2 id="es-legal-title">{isTerms ? 'Terms and Conditions' : 'Privacy Notice'}</h2>
        {isTerms ? (
          <div className="es-legal-copy">
            <p>By creating an account, you agree to use EduSphere 360 only for lawful education and institution-management purposes.</p>
            <ul>
              <li>Public sign-up creates a new institution workspace and makes the registering account its first owner.</li>
              <li>Employees, students and parents of an existing institution receive access from that institution's authorised owner or administrator.</li>
              <li>You are responsible for protecting your password and ensuring that information entered into the workspace is accurate and lawfully provided.</li>
              <li>Do not upload information about students, families or employees unless you are authorised to do so.</li>
              <li>Feature availability, access limits and infrastructure requirements are subject to the current product scope and approved service terms.</li>
            </ul>
          </div>
        ) : (
          <div className="es-legal-copy">
            <p>EduSphere 360 uses your email address and authentication data to create and secure your account. Institution records are stored for the workspace you create and are available to its authorised users.</p>
            <ul>
              <li>Each public sign-up creates a separate institution workspace. Your account is not added to another institution.</li>
              <li>Institution records are available according to the account's role and the institution's access permissions.</li>
              <li>EduSphere 360 operates online. Institution data is processed by the configured hosting and database providers and is available only with an internet connection.</li>
              <li>Do not enter sensitive or real student information into a demonstration workspace unless your institution has approved its use.</li>
              <li>Contact your institution owner for requests about records managed inside that institution.</li>
            </ul>
          </div>
        )}
        <p className="es-legal-footnote">This is the current in-product notice. The institution operating EduSphere 360 should have its final legal terms and privacy notice reviewed and approved before public production use.</p>
        <button type="button" className="es-auth-submit" onClick={onClose}>Close <ArrowRight size={16}/></button>
      </section>
    </div>
  )
}

export function SetupScreen({ navigate }: ScreenProps) {
  const { registerAdmin } = useAuth()
  const [fullName, setFullName] = useState('')
  const [institutionName, setInstitutionName] = useState('')
  const [institutionType, setInstitutionType] = useState<'school' | 'college' | 'university' | 'multi_institution'>('school')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [legalDocument, setLegalDocument] = useState<'terms' | 'privacy' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const [resendBusy, setResendBusy] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('Enter your full name.'); return }
    if (!institutionName.trim()) { setError('Enter your institution name.'); return }
    if (password.length < 10) { setError('Use a password with at least 10 characters.'); return }
    if (password !== confirmPassword) { setError('Your passwords do not match. Please check and try again.'); return }
    if (!acceptedTerms) { setError('Please accept the Terms and Conditions and Privacy Notice to continue.'); return }
    setBusy(true)
    try {
      const result = await registerAdmin({ fullName: fullName.trim(), institutionName: institutionName.trim(), institutionType, email: email.trim().toLowerCase(), password })
      if (result.verificationRequired) {
        setVerificationEmail(result.email)
        setResendMessage('')
        setResendError('')
      }
    } catch (err) {
      setError(userFacingError(err, 'Could not create your EduSphere 360 account. Please review the details and try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function resendVerification() {
    if (!verificationEmail || resendBusy) return
    setResendBusy(true)
    setResendMessage('')
    setResendError('')
    try {
      await resendInstitutionOwnerVerification(verificationEmail)
      setResendMessage('A new verification email has been sent. Check your inbox and spam folder.')
    } catch (err) {
      setResendError(userFacingError(err, 'The verification email could not be resent. Please try again shortly.'))
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <div className="es-auth-page es-auth-page-signup">
      <AuthVisualPanel variant="signup" />
      <main className="es-auth-main es-auth-main-signup">
        <AuthTopline navigate={navigate} mode="signup" />
        <div className="es-auth-form-wrap es-signup-wrap">
          {verificationEmail ? (
          <section className="es-auth-card es-signup-card es-verification-card" aria-live="polite">
            <div className="es-auth-avatar es-verification-avatar"><span><Mail size={23}/></span><i><Check size={11}/></i></div>
            <div className="es-auth-form-heading">
              <span className="es-auth-overline">ONE LAST STEP</span>
              <h2>Check your inbox</h2>
              <p>We sent a verification link to the email address below. Confirm it to activate your EduSphere 360 Owner account.</p>
            </div>
            <div className="es-verification-email"><Mail size={17}/><strong>{verificationEmail}</strong></div>
            <div className="es-verification-explainer">
              <CheckCircle2 size={17}/>
              <span>Your institution workspace is reserved. Its dashboard and institution records stay locked until your email is verified.</span>
            </div>
            {resendMessage && <div className="es-auth-notice" role="status">{resendMessage}</div>}
            {resendError && <div className="es-auth-error" role="alert">{resendError}</div>}
            <button className="es-auth-submit" type="button" onClick={resendVerification} disabled={resendBusy}>
              {resendBusy ? 'Sending verification email…' : 'Resend verification email'} <ArrowRight size={17}/>
            </button>
            <div className="es-verification-actions">
              <button type="button" onClick={() => { setVerificationEmail(''); setError(''); setResendMessage(''); setResendError('') }}>Use a different email</button>
              <span>Already verified? <button type="button" onClick={() => navigate('login')}>Login</button></span>
            </div>
            <p className="es-verification-help">If you do not see the message, check your spam or junk folder. The link returns you to this website after confirmation.</p>
          </section>
          ) : (
          <section className="es-auth-card es-signup-card">
            <div className="es-auth-avatar"><span><Building2 size={22}/></span><i><Check size={11}/></i></div>
            <div className="es-auth-form-heading">
              <span className="es-auth-overline">START WITH EDUSPHERE 360</span>
              <h2>Create your account</h2>
              <p>Enter your details and institution information. Your account will become the first owner of this new institution after email verification.</p>
            </div>
            <form className="es-auth-form es-signup-form" onSubmit={submit}>
              <label className="es-auth-field"><span>Your full name</span><div className="es-auth-input"><Users size={17}/><input type="text" autoComplete="name" maxLength={120} required value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Enter your full name"/></div></label>
              <label className="es-auth-field"><span>Institution name</span><div className="es-auth-input"><Building2 size={17}/><input type="text" maxLength={160} required value={institutionName} onChange={event => setInstitutionName(event.target.value)} placeholder="Enter your school, college or university name"/></div></label>
              <label className="es-auth-field"><span>Institution type</span><select className="es-auth-select" required value={institutionType} onChange={event => setInstitutionType(event.target.value as typeof institutionType)}><option value="school">School</option><option value="college">College</option><option value="university">University</option><option value="multi_institution">Multi-institution group</option></select></label>
              <label className="es-auth-field"><span>Email address</span><div className="es-auth-input"><Mail size={17}/><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@institution.edu"/></div></label>
              <label className="es-auth-field"><span>Choose password</span><div className="es-auth-input"><LockKeyhole size={17}/><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={10} required value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 10 characters"/><button type="button" className="es-password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
              <label className="es-auth-field"><span>Confirm password</span><div className="es-auth-input"><LockKeyhole size={17}/><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Enter your password again"/></div></label>
              <label className="es-auth-check es-terms-check"><input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)}/><span className="es-check-box"/><span className="es-terms-copy">I agree to the <button type="button" onClick={() => setLegalDocument('terms')}>Terms and Conditions</button> and <button type="button" onClick={() => setLegalDocument('privacy')}>Privacy Notice</button>.</span></label>
              {error && <div className="es-auth-error" role="alert">{error}</div>}
              <button className="es-auth-submit" type="submit" disabled={busy}>{busy ? 'Creating your account…' : 'Sign up'} <ArrowRight size={17}/></button>
            </form>
            <p className="es-signup-account-note">This sign-up starts a <strong>new institution workspace</strong>. Existing institutions create employee and student accounts from their own administration area.</p>
            <div className="es-auth-inline-switch">Already have an account? <button type="button" onClick={() => navigate('login')}>Login</button></div>
            <div className="es-auth-secure-note"><ShieldCheck size={15}/> Your account becomes the owner of its new institution workspace after email verification.</div>
          </section>
          )}
        </div>
        <footer className="es-auth-main-foot"><span>© {new Date().getFullYear()} EduSphere 360</span><span>Education management, thoughtfully connected.</span></footer>
      </main>
      {legalDocument && <LegalNotice kind={legalDocument} onClose={() => setLegalDocument(null)}/>}
    </div>
  )
}


export function ResetPasswordScreen({ navigate }: ScreenProps) {
  const { completePasswordReset, signOut, clearRecoveryMode } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 10) { setError('Use a password with at least 10 characters.'); return }
    if (password !== confirmPassword) { setError('Your passwords do not match.'); return }
    setBusy(true)
    try {
      await completePasswordReset(password)
      setCompleted(true)
    } catch (err) {
      setError(userFacingError(err, 'Your password could not be updated. Request a new reset link and try again.'))
    } finally { setBusy(false) }
  }

  async function returnToLogin() {
    try { await signOut() } finally { clearRecoveryMode(); navigate('login') }
  }

  return <div className="es-auth-page">
    <AuthVisualPanel variant="login" />
    <main className="es-auth-main">
      <div className="es-auth-form-wrap">
        <section className="es-auth-card es-login-card" aria-live="polite">
          <div className="es-auth-avatar"><span><LockKeyhole size={22}/></span><i><Check size={11}/></i></div>
          <div className="es-auth-form-heading">
            <span className="es-auth-overline">SECURE ACCOUNT RECOVERY</span>
            <h2>{completed ? 'Password updated' : 'Choose a new password'}</h2>
            <p>{completed ? 'Your password has been changed. Sign in again with your new password.' : 'Create a new password for your EduSphere 360 account.'}</p>
          </div>
          {completed ? <button className="es-auth-submit" type="button" onClick={() => void returnToLogin()}>Return to login <ArrowRight size={17}/></button> : <form className="es-auth-form" onSubmit={submit}>
            <label className="es-auth-field"><span>New password</span><div className="es-auth-input"><LockKeyhole size={17}/><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={10} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 10 characters"/><button type="button" className="es-password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
            <label className="es-auth-field"><span>Confirm new password</span><div className="es-auth-input"><LockKeyhole size={17}/><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter your new password again"/></div></label>
            {error && <div className="es-auth-error" role="alert">{error}</div>}
            <button className="es-auth-submit" type="submit" disabled={busy}>{busy ? 'Updating password…' : 'Update password'} <ArrowRight size={17}/></button>
          </form>}
          <div className="es-auth-secure-note"><ShieldCheck size={15}/> Use a unique password of at least 10 characters.</div>
        </section>
      </div>
      <footer className="es-auth-main-foot"><span>© {new Date().getFullYear()} EduSphere 360</span><span>Secure account recovery.</span></footer>
    </main>
  </div>
}
