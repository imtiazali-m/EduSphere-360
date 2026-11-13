import { useState } from 'react'
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, Bell, BookOpen, Building2,
  CalendarDays, Check, CheckCircle2, ChevronRight, ClipboardCheck,
  GraduationCap, Layers3, LockKeyhole, Menu, ShieldCheck,
  Users, Wallet, X, Zap,
} from 'lucide-react'
import type { AppRole } from '../lib/types'
import '../styles/new-landing-page.css'

interface LandingProps {
  navigate: (screen: 'welcome' | 'login' | 'setup', role?: AppRole) => void
}

const capabilityCards = [
  {
    number: '01',
    icon: Users,
    title: 'Admissions & student records',
    description: 'Connect applications, enrolment, learner profiles, class placement and guardian relationships around each student.',
    link: 'Student lifecycle',
  },
  {
    number: '02',
    icon: BookOpen,
    title: 'Teaching & academics',
    description: 'Coordinate classes, subjects, teaching assignments, timetables, coursework and examination activity.',
    link: 'Academic workflows',
  },
  {
    number: '03',
    icon: CalendarDays,
    title: 'Attendance & daily operations',
    description: 'Keep student and faculty attendance visible alongside the everyday work that keeps a campus moving.',
    link: 'Daily coordination',
  },
  {
    number: '04',
    icon: Wallet,
    title: 'Fees & finance',
    description: 'Organise fee structures, invoices, recorded payments, receipts, balances and financial records.',
    link: 'Finance workspace',
  },
  {
    number: '05',
    icon: ShieldCheck,
    title: 'People & permissions',
    description: 'Give owners, administrators, educators, learners, families and specialist teams role-appropriate access.',
    link: 'Role-based access',
  },
  {
    number: '06',
    icon: BarChart3,
    title: 'Reports & communication',
    description: 'Bring announcements and available institutional records into clearer views for better day-to-day decisions.',
    link: 'Institution insight',
  },
]

const roleCards = [
  { icon: Building2, title: 'Institution owner', description: 'Own the institution workspace and its core settings.' },
  { icon: ShieldCheck, title: 'Administrator', description: 'Coordinate permitted institution-wide operations.' },
  { icon: BookOpen, title: 'Teacher & faculty', description: 'Focus on classes, attendance and academic work.' },
  { icon: GraduationCap, title: 'Student', description: 'Access learning, assessments and personal records.' },
  { icon: Users, title: 'Parent & guardian', description: 'Stay connected to learner progress and updates.' },
  { icon: Wallet, title: 'Accountant', description: 'Work with invoices, recorded payments and balances.' },
  { icon: ClipboardCheck, title: 'Examination officer', description: 'Coordinate examination schedules, marks and results.' },
]

const workflowSteps = [
  { number: '01', title: 'Admit', description: 'Applications, enrolment and learner profiles' },
  { number: '02', title: 'Teach', description: 'Classes, subjects and assignments' },
  { number: '03', title: 'Coordinate', description: 'Attendance, schedules and communication' },
  { number: '04', title: 'Evaluate', description: 'Examinations, marks and results' },
  { number: '05', title: 'Manage', description: 'Fees, finance and administration' },
]


const tourPanels = [
  {
    id: 'people', label: 'People', icon: Users, eyebrow: 'PEOPLE / STUDENT LIFECYCLE',
    title: 'Follow each learner from application to ongoing record.',
    description: 'Connect admissions, class placement, student profiles, family relationships and staff responsibilities around the institution.',
    rows: [{title:'Admissions',detail:'Applications, review and enrolment'},{title:'Student records',detail:'Profiles, classes and learner history'},{title:'Faculty & staff',detail:'Employee details and teaching allocations'}],
    note: 'Sample workspace layout · Institution-specific records are not shown',
  },
  {
    id: 'academics', label: 'Academics', icon: BookOpen, eyebrow: 'ACADEMICS / TEACHING & ASSESSMENT',
    title: 'Bring the academic day into one organised flow.',
    description: 'Coordinate class structures, subjects, timetables, assignments, attendance, examinations and published results.',
    rows: [{title:'Classes & subjects',detail:'Academic sessions, sections and allocations'},{title:'Timetable & attendance',detail:'Schedules, registers and daily records'},{title:'Exams & assignments',detail:'Coursework, marks and results'}],
    note: 'Sample workspace layout · Availability depends on assigned role',
  },
  {
    id: 'finance', label: 'Finance', icon: Wallet, eyebrow: 'FINANCE / FEES & ACCOUNTS',
    title: 'Keep obligations, receipts and records connected.',
    description: 'Manage fee structures, invoices, recorded payments, receipts, balances and the institution ledger in focused finance workspaces.',
    rows: [{title:'Fee structures',detail:'Fee heads, schedules and billing rules'},{title:'Invoices & receipts',detail:'Payments recorded against student accounts'},{title:'Accounts ledger',detail:'Financial records and transaction history'}],
    note: 'Payment recording is available; external payment-gateway processing is not connected',
  },
  {
    id: 'operations', label: 'Operations', icon: Building2, eyebrow: 'OPERATIONS / CAMPUS SERVICES',
    title: 'Make the work around the classroom easier to coordinate.',
    description: 'Explore the campus-service areas connected to the wider institutional model, with availability and setup status made clear.',
    rows: [{title:'Digital library',detail:'Catalogue and circulation workflows'},{title:'Transport & facilities',detail:'Routes, rooms and resource coordination'},{title:'Inventory & visitors',detail:'Supplies, entries and campus activity'}],
    note: 'Campus-service capabilities may require institution setup',
  },
  {
    id: 'insights', label: 'Insights', icon: BarChart3, eyebrow: 'INSIGHTS / INSTITUTIONAL OVERVIEW',
    title: 'Turn saved institution records into useful operational views.',
    description: 'Review available student, attendance, examination and finance information through role-aware reports and dashboard summaries.',
    rows: [{title:'Institution overview',detail:'Role-specific summary and key records'},{title:'Academic progress',detail:'Attendance, assessment and result context'},{title:'Finance reporting',detail:'Recorded invoices, receipts and balances'}],
    note: 'Illustrative preview · Charts use sample data, not a live institution',
  },
]

const moduleGroups = [
  {
    title: 'People & administration',
    description: 'The records behind the institution and the people who keep it running.',
    items: ['Institution settings & access', 'Admissions & enrolment', 'Student & guardian records', 'Faculty & employee management'],
    status: 'CORE WORKFLOWS',
    href: '/#/public/features',
  },
  {
    title: 'Teaching & academic delivery',
    description: 'Plan classes, support daily teaching and track academic progress.',
    items: ['Classes, sections & subjects', 'Timetable management', 'Assignments & homework', 'Student & faculty attendance', 'Examinations, marks & results'],
    status: 'CORE WORKFLOWS',
    href: '/#/public/features',
  },
  {
    title: 'Finance & institutional insight',
    description: 'Bring billing, recorded payments and reports into a clearer operating view.',
    items: ['Fee structures & billing rules', 'Invoices, payments & receipts', 'Accounts & financial records', 'Reports & institutional insights'],
    status: 'CORE WORKFLOWS',
    href: '/#/public/features',
  },
  {
    title: 'Campus & student services',
    description: 'Explore the operational areas around learning, facilities and campus life.',
    items: ['Digital library', 'Transport management', 'Rooms & facilities', 'Inventory & supplies', 'Visitor management'],
    status: 'CAMPUS SERVICE OVERVIEW',
    href: '/#/public/campus-services',
  },
]

const homeFaqs = [
  { question: 'Is EduSphere 360 online or offline?', answer: 'The current release is a cloud-based online platform and requires an internet connection. Offline/local operation is not available in this release. USV 360 Pro is a planned self-hosted edition, not a currently released installation.' },
  { question: 'Which types of institutions can use EduSphere 360?', answer: 'The product is designed for schools, colleges and universities. Academic structure and enabled workflows should be configured to match the institution.' },
  { question: 'Which user roles have dedicated workspaces?', answer: 'The current role model includes institution owner, administrator, teacher, student, parent or guardian, accountant and examination officer. Menus and actions depend on the active role and institution permissions.' },
  { question: 'Can parents and students use mobile devices?', answer: 'The current product is responsive for mobile browsers. A dedicated native Android or iOS app is not claimed as part of this release.' },
  { question: 'Can families pay fees through a connected payment gateway?', answer: 'The finance workspace supports fee invoices and recording payment and receipt records. An external card, bank or wallet payment gateway is not connected in this release.' },
  { question: 'Are SMS, WhatsApp and other integrations ready?', answer: 'External messaging and payment services require provider configuration. The integrations page distinguishes current platform workflows from services that still need separate setup.' },
  { question: 'How do I know whether a feature is available?', answer: 'The feature catalogue labels core workflows, campus-service overviews, setup-dependent items, planned capabilities and items not advertised as live. Actual access also depends on institution configuration and your role.' },
]

export function NewLandingPage({ navigate }: LandingProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeTour, setActiveTour] = useState('people')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const currentTour = tourPanels.find(item => item.id === activeTour) ?? tourPanels[0]
  const TourIcon = currentTour.icon
  const closeMenu = () => setMenuOpen(false)
  const go = (screen: 'login' | 'setup') => {
    closeMenu()
    navigate(screen)
  }

  return (
    <div className="nl-page" id="top">
      <header className="nl-header">
        <a className="nl-brand" href="#top" aria-label="EduSphere 360 home" onClick={closeMenu}>
          <span className="nl-brand-mark"><GraduationCap size={25} strokeWidth={2.15}/><i>360</i></span>
          <span className="nl-brand-type"><b>EduSphere <em>360</em></b><small>EDUCATION MANAGEMENT</small></span>
        </a>

        <button className="nl-mobile-toggle" type="button" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
          {menuOpen ? <X size={21}/> : <Menu size={21}/>}
        </button>

        <nav className={menuOpen ? 'nl-nav nl-open' : 'nl-nav'} aria-label="Main navigation">
          <a href="#platform" onClick={closeMenu}>Platform</a>
          <a href="#product-tour" onClick={closeMenu}>Product tour</a>
          <a href="#features" onClick={closeMenu}>Features</a>
          <a href="#solutions" onClick={closeMenu}>Roles</a>
          <a href="#campus" onClick={closeMenu}>Campus</a>
          <a href="#faq" onClick={closeMenu}>FAQs</a>
        </nav>

        <div className="nl-header-actions">
          <button className="nl-signin" type="button" onClick={() => go('login')}>Sign in</button>
          <button className="nl-header-cta" type="button" onClick={() => go('setup')}>Create institution <ArrowUpRight size={16}/></button>
        </div>
      </header>

      <main>
        <section className="nl-hero" aria-labelledby="nl-hero-title">
          <div className="nl-hero-backdrop" aria-hidden="true"><span/><span/><span/></div>
          <div className="nl-hero-content">
            <div className="nl-eyebrow"><span className="nl-live-dot"/> THE CONNECTED EDUCATION WORKSPACE</div>
            <h1 id="nl-hero-title">Bring your whole institution <em>into focus.</em></h1>
            <p className="nl-hero-lead">One thoughtful system for the people, learning and operations behind a thriving school, college or university.</p>
            <div className="nl-hero-actions">
              <button type="button" className="nl-button nl-button-primary" onClick={() => go('setup')}>Create your institution <ArrowUpRight size={18}/></button>
              <a href="/#/public/product-tour" className="nl-button nl-button-quiet">Explore the platform <ArrowRight size={17}/></a>
            </div>
            <div className="nl-hero-proof">
              <span><CheckCircle2 size={16}/> Seven role-specific workspaces</span>
              <span><CheckCircle2 size={16}/> Built for school to university</span>
            </div>
            <div className="nl-hero-audience">
              <span>MADE FOR</span><b>Schools</b><i/><b>Colleges</b><i/><b>Universities</b>
            </div>
          </div>

          <div className="nl-hero-visual">
            <div className="nl-visual-glow" aria-hidden="true"/>
            <div className="nl-dashboard-window">
              <div className="nl-window-top">
                <div className="nl-window-brand"><span><GraduationCap size={15}/></span><b>EduSphere <i>360</i></b></div>
                <div className="nl-window-controls"><i/><i/><i/></div>
              </div>
              <div className="nl-dashboard-body">
                <aside className="nl-sidebar" aria-label="Illustrative workspace menu">
                  <span className="nl-sidebar-active"><Layers3 size={16}/></span>
                  <span><Users size={16}/></span>
                  <span><BookOpen size={16}/></span>
                  <span><CalendarDays size={16}/></span>
                  <span><Wallet size={16}/></span>
                  <span><BarChart3 size={16}/></span>
                </aside>
                <div className="nl-dashboard-content">
                  <div className="nl-dashboard-heading">
                    <div><small>INSTITUTION WORKSPACE</small><b>Everything in its place.</b></div>
                    <span className="nl-preview-chip"><i/> SAMPLE VIEW</span>
                  </div>
                  <div className="nl-summary-grid">
                    <article><span className="nl-summary-icon nl-blue"><Users size={16}/></span><small>PEOPLE</small><b>Student records</b><em>Admissions & profiles</em></article>
                    <article><span className="nl-summary-icon nl-mint"><BookOpen size={16}/></span><small>ACADEMICS</small><b>Teaching</b><em>Classes & assessments</em></article>
                    <article><span className="nl-summary-icon nl-gold"><Wallet size={16}/></span><small>FINANCE</small><b>Fee records</b><em>Invoices & payments</em></article>
                  </div>
                  <div className="nl-dashboard-lower">
                    <section className="nl-activity-panel">
                      <div className="nl-panel-head"><b>Connected activity</b><span>OVERVIEW</span></div>
                      <div className="nl-chart">
                        <div className="nl-chart-y"><i/><i/><i/><i/></div>
                        <div className="nl-chart-bars" aria-label="Illustrative activity chart">
                          <i style={{height:'34%'}}/><i style={{height:'52%'}}/><i style={{height:'43%'}}/><i style={{height:'69%'}}/><i style={{height:'57%'}}/><i style={{height:'84%'}}/><i style={{height:'73%'}}/><i style={{height:'94%'}}/>
                        </div>
                      </div>
                      <div className="nl-chart-labels"><span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span></div>
                    </section>
                    <section className="nl-tasks-panel">
                      <div className="nl-panel-head"><b>Daily workflows</b><span>IN VIEW</span></div>
                      <div><i className="nl-task-check"><Check size={11}/></i><span><b>Admissions</b><small>Applications & review</small></span></div>
                      <div><i className="nl-task-check"><Check size={11}/></i><span><b>Attendance</b><small>Student & faculty records</small></span></div>
                      <div><i className="nl-task-check"><Check size={11}/></i><span><b>Fee management</b><small>Invoices & receipts</small></span></div>
                    </section>
                  </div>
                  <div className="nl-dashboard-foot"><span><LockKeyhole size={12}/> Role-aware workspace</span><span>Illustrative interface · Sample data</span></div>
                </div>
              </div>
            </div>
            <div className="nl-float-note nl-float-top"><span><Activity size={17}/></span><div><b>One connected view</b><small>From admission to achievement</small></div></div>
            <div className="nl-float-note nl-float-bottom"><span><ShieldCheck size={17}/></span><div><b>Access by responsibility</b><small>Seven dedicated role types</small></div></div>
            <div className="nl-visual-caption"><span/> A clearer way to run your institution</div>
          </div>
          <div className="nl-hero-index" aria-hidden="true">EDUSPHERE / 360</div>
        </section>

        <section className="nl-proof-strip" aria-label="Platform overview">
          <div className="nl-proof-intro"><span>ONE PLATFORM</span><b>Built around the way institutions work.</b></div>
          <div className="nl-proof-stat"><strong>3</strong><span>institution types</span></div>
          <div className="nl-proof-stat"><strong>7</strong><span>role-specific workspaces</span></div>
          <div className="nl-proof-stat"><strong>1</strong><span>connected experience</span></div>
        </section>

        <section className="nl-platform-section" id="platform">
          <div className="nl-section-kicker">A BETTER WAY TO CONNECT THE DOTS <span>01 / THE PLATFORM</span></div>
          <div className="nl-platform-intro">
            <h2>Less switching.<br/><em>More clarity.</em></h2>
            <div><p>Institutional work touches many teams. EduSphere 360 brings the core records and day-to-day workflows into one organised environment, so each person can focus on the work that matters to their role.</p><a href="/#/public/features">Explore all platform capabilities <ArrowUpRight size={15}/></a></div>
          </div>
          <div className="nl-platform-panels">
            <article className="nl-platform-panel nl-panel-dark">
              <span className="nl-panel-number">01</span><span className="nl-panel-symbol"><Layers3 size={20}/></span>
              <div><small>ONE CONNECTED FOUNDATION</small><h3>Shared institutional records.</h3><p>Keep permitted people, classes, academic activity and financial records organised around your institution.</p></div>
              <span className="nl-panel-orbit" aria-hidden="true"/>
            </article>
            <article className="nl-platform-panel nl-panel-light">
              <span className="nl-panel-number">02</span><span className="nl-panel-symbol"><Users size={20}/></span>
              <div><small>THE RIGHT VIEW FOR EVERYONE</small><h3>Workspaces shaped by role.</h3><p>Give owners, administrators, teachers, students, families and specialist teams access that reflects their responsibilities.</p></div>
              <div className="nl-mini-roles"><i>O</i><i>A</i><i>T</i><i>S</i><i>P</i><i>+</i></div>
            </article>
          </div>
        </section>


        <section className="nl-product-tour-section" id="product-tour">
          <div className="nl-section-heading">
            <div><div className="nl-section-kicker">A CLOSER LOOK AT THE WORKSPACE <span>02 / PRODUCT TOUR</span></div><h2>See the work.<br/><em>Not just the promise.</em></h2></div>
            <p>Explore how the platform organises the core records and responsibilities behind everyday school, college and university operations. These are illustrative previews, not live institution data.</p>
          </div>
          <div className="nl-tour-shell">
            <div className="nl-tour-tabs" role="tablist" aria-label="Choose a workspace preview">
              {tourPanels.map(item => {
                const Icon = item.icon
                return <button className={activeTour === item.id ? 'nl-tour-tab is-active' : 'nl-tour-tab'} type="button" role="tab" aria-selected={activeTour === item.id} aria-controls="nl-tour-preview" key={item.id} onClick={() => setActiveTour(item.id)}>
                  <Icon size={16}/><span>{item.label}</span><ChevronRight size={14}/>
                </button>
              })}
            </div>
            <div className="nl-tour-preview" id="nl-tour-preview" role="tabpanel">
              <div className="nl-tour-preview-head">
                <span className="nl-tour-feature-icon"><TourIcon size={20}/></span>
                <div><small>{currentTour.eyebrow}</small><h3>{currentTour.title}</h3></div>
                <span className="nl-tour-preview-chip">ILLUSTRATIVE VIEW</span>
              </div>
              <p className="nl-tour-description">{currentTour.description}</p>
              <div className="nl-tour-rows">
                {currentTour.rows.map((item, index) => <div className="nl-tour-row" key={item.title}>
                  <span className="nl-tour-row-index">0{index + 1}</span>
                  <span><b>{item.title}</b><small>{item.detail}</small></span>
                  <CheckCircle2 size={17}/>
                </div>)}
              </div>
              <p className="nl-tour-note"><LockKeyhole size={13}/>{currentTour.note}</p>
            </div>
          </div>
          <div className="nl-tour-footer"><span>Want to inspect a specific module?</span><a href="/#/public/features">Open the complete 30-capability catalogue <ArrowUpRight size={15}/></a></div>
        </section>

        <section className="nl-features-section" id="features">
          <div className="nl-section-heading">
            <div><div className="nl-section-kicker">THE EVERYDAY WORK, CONNECTED <span>02 / CAPABILITIES</span></div><h2>Everything has<br/>a place to <em>happen.</em></h2></div>
            <p>From the first application to ongoing teaching, attendance and fee records, explore the core workflows that bring institution operations together.</p>
          </div>
          <div className="nl-capability-grid">
            {capabilityCards.map((item) => {
              const Icon = item.icon
              return <a className="nl-capability-card" href="/#/public/features" key={item.number}>
                <div className="nl-capability-top"><span className="nl-capability-icon"><Icon size={20}/></span><small>{item.number}</small></div>
                <h3>{item.title}</h3><p>{item.description}</p>
                <span className="nl-capability-link">{item.link}<ChevronRight size={15}/></span>
              </a>
            })}
          </div>
          <div className="nl-features-foot"><span>Want the full picture?</span><a href="/#/public/features">Browse the full capability catalogue <ArrowUpRight size={15}/></a></div>
        </section>


        <section className="nl-expanded-catalog-section" id="more-workflows">
          <div className="nl-section-heading">
            <div><div className="nl-section-kicker">A BROADER VIEW OF THE PLATFORM <span>03 / MODULES</span></div><h2>Connected records.<br/><em>Clear module boundaries.</em></h2></div>
            <p>Explore the main areas of the institution, from people and academics to finance and campus services. Each detailed page explains its current release status and relevant role access.</p>
          </div>
          <div className="nl-module-groups">
            {moduleGroups.map((group, index) => <article className="nl-module-group" key={group.title}>
              <div className="nl-module-group-head"><span>0{index + 1}</span><small>{group.status}</small></div>
              <h3>{group.title}</h3><p>{group.description}</p>
              <ul>{group.items.map(item => <li key={item}><Check size={14}/>{item}</li>)}</ul>
              <a href={group.href}>Explore this area <ArrowUpRight size={15}/></a>
            </article>)}
          </div>
          <p className="nl-catalog-disclaimer"><ShieldCheck size={16}/> Some campus services require institution configuration. The feature catalogue is the source of truth for planned, setup-dependent and unavailable capabilities.</p>
        </section>

        <section className="nl-roles-section" id="solutions">
          <div className="nl-roles-intro">
            <div className="nl-section-kicker">ONE COMMUNITY, DISTINCT RESPONSIBILITIES <span>03 / WHO IT SERVES</span></div>
            <h2>Different roles.<br/><em>One shared purpose.</em></h2>
            <p>Every person should see the information and actions relevant to their part in the learning community. EduSphere 360 brings seven distinct role types into a coordinated experience.</p>
            <a href="/#/public/solutions" className="nl-text-link">Explore role-based solutions <ArrowUpRight size={15}/></a>
          </div>
          <div className="nl-role-grid">
            {roleCards.map((role, index) => {
              const Icon = role.icon
              return <article className="nl-role-card" key={role.title}>
                <span className="nl-role-index">0{index + 1}</span><span className="nl-role-icon"><Icon size={19}/></span>
                <h3>{role.title}</h3><p>{role.description}</p>
              </article>
            })}
          </div>
        </section>

        <section className="nl-workflow-section" id="workflow">
          <div className="nl-section-kicker">FROM FIRST CONTACT TO EVERY MILESTONE <span>04 / THE JOURNEY</span></div>
          <div className="nl-workflow-heading"><h2>See how the pieces<br/><em>move together.</em></h2><p>Follow the connected journey across everyday institutional work—from welcoming new learners to understanding progress.</p></div>
          <div className="nl-workflow-line">
            {workflowSteps.map(step => <article key={step.number}><span className="nl-workflow-number">{step.number}</span><i/><h3>{step.title}</h3><p>{step.description}</p></article>)}
          </div>
        </section>

        <section className="nl-trust-section" id="about">
          <div className="nl-trust-visual">
            <div className="nl-trust-orbit nl-orbit-one"/><div className="nl-trust-orbit nl-orbit-two"/>
            <div className="nl-trust-core"><ShieldCheck size={39}/><b>Institution<br/>first.</b><small>EDUSPHERE 360</small></div>
            <div className="nl-trust-label nl-trust-label-a"><LockKeyhole size={15}/> Role-based access</div>
            <div className="nl-trust-label nl-trust-label-b"><Building2 size={15}/> Institution-scoped records</div>
          </div>
          <div className="nl-trust-copy">
            <div className="nl-section-kicker">BUILT WITH CLEAR BOUNDARIES <span>05 / TRUST & ACCESS</span></div>
            <h2>Your institution's information deserves <em>careful access.</em></h2>
            <p>The current online release uses role-based permissions and institution-scoped database access. Each workspace is designed around the responsibilities assigned to its users.</p>
            <div className="nl-trust-points">
              <div><CheckCircle2 size={18}/><span><b>Access by role</b><small>Distinct views for owners, administrators, teachers, students, parents and specialist roles.</small></span></div>
              <div><CheckCircle2 size={18}/><span><b>Institution boundaries</b><small>Records are governed by active institution membership and database access policies.</small></span></div>
              <div><CheckCircle2 size={18}/><span><b>Cloud-first today</b><small>The current release is online-only. Offline/local operation is not available in this release.</small></span></div>
            </div>
            <a href="/#/public/integrations" className="nl-text-link">Understand platform availability <ArrowUpRight size={15}/></a>
          </div>
        </section>


        <section className="nl-engagement-section" id="engagement">
          <div className="nl-engagement-intro">
            <div className="nl-section-kicker">KEEP THE LEARNING COMMUNITY CONNECTED <span>05 / COMMUNICATION</span></div>
            <h2>More than records.<br/><em>Better coordination.</em></h2>
            <p>Give the people around each learner clearer ways to stay informed, while keeping institution-wide tools and external services clearly distinguished.</p>
          </div>
          <div className="nl-engagement-grid">
            <article><span><Users size={20}/></span><small>CORE WORKFLOW</small><h3>Family connections</h3><p>Connect parent and guardian relationships to the student record and the role-permitted information they can access.</p><a href="/#/public/features/students-guardians">Student & guardian records <ArrowUpRight size={14}/></a></article>
            <article><span><Bell size={20}/></span><small>CORE WORKFLOW</small><h3>Announcements</h3><p>Share institutional updates through the announcements workflow, with access shaped by the user's role and institution.</p><a href="/#/public/features/announcements">Announcements & communication <ArrowUpRight size={14}/></a></article>
            <article><span><LockKeyhole size={20}/></span><small>PERMISSION-AWARE</small><h3>Private student documents</h3><p>Use institution file areas for permitted student photographs and documents, with access controlled by the application.</p><a href="/#/public/features/students-guardians">Explore student records <ArrowUpRight size={14}/></a></article>
            <article><span><Zap size={20}/></span><small>REQUIRES SEPARATE SETUP</small><h3>External messaging & services</h3><p>SMS, WhatsApp, payment gateways and device feeds are not presented as live until their providers and credentials are configured.</p><a href="/#/public/integrations">Review integration status <ArrowUpRight size={14}/></a></article>
          </div>
        </section>

        <section className="nl-campus-section" id="campus">
          <div className="nl-campus-heading">
            <div><div className="nl-section-kicker">THE SERVICES AROUND LEARNING <span>06 / CAMPUS</span></div><h2>Campus life has<br/><em>many moving parts.</em></h2></div>
            <div><p>EduSphere’s catalogue also describes campus-service areas alongside the academic and administrative core. Their availability depends on the institution’s enabled workspace and setup.</p><a href="/#/public/campus-services">Explore campus services <ArrowUpRight size={15}/></a></div>
          </div>
          <div className="nl-campus-grid">
            <article><span><BookOpen size={20}/></span><small>CAMPUS SERVICE</small><h3>Digital library</h3><p>Catalogue, circulation and learning-resource records.</p></article>
            <article><span><Building2 size={20}/></span><small>CAMPUS SERVICE</small><h3>Transport</h3><p>Routes, vehicles, drivers and student allocation context.</p></article>
            <article><span><Layers3 size={20}/></span><small>CAMPUS SERVICE</small><h3>Rooms & facilities</h3><p>Classrooms, laboratories, availability and maintenance context.</p></article>
            <article><span><Wallet size={20}/></span><small>CAMPUS SERVICE</small><h3>Inventory</h3><p>Supplies, stock movement, procurement and allocation context.</p></article>
            <article><span><ShieldCheck size={20}/></span><small>CAMPUS SERVICE</small><h3>Visitor management</h3><p>Visitor details, approvals and campus entry records.</p></article>
          </div>
          <p className="nl-campus-note">Campus-service overview does not mean every workflow is enabled for every institution. Check the individual feature status before onboarding.</p>
        </section>

        <section className="nl-mobile-section" id="mobile-access">
          <div className="nl-mobile-visual">
            <div className="nl-phone-frame"><div className="nl-phone-speaker"/><div className="nl-phone-screen">
              <div className="nl-phone-top"><span className="nl-phone-logo"><GraduationCap size={15}/></span><b>EduSphere 360</b><i/></div>
              <div className="nl-phone-welcome"><small>STUDENT WORKSPACE</small><b>Good morning.</b><span>Here is your learning overview.</span></div>
              <div className="nl-phone-mini-stats"><div><small>ATTENDANCE</small><b>Register</b></div><div><small>ACADEMICS</small><b>My classes</b></div></div>
              <div className="nl-phone-list"><b>Today</b><span><i/>Timetable & classes</span><span><i/>Assignments</span><span><i/>Announcements</span></div>
              <div className="nl-phone-nav"><i/><i/><i/><i/></div>
            </div></div>
            <span className="nl-phone-caption"><Monitor size={14}/> Responsive browser preview · Sample content</span>
          </div>
          <div className="nl-mobile-copy">
            <div className="nl-section-kicker">A WORKSPACE THAT ADAPTS <span>07 / MOBILE</span></div>
            <h2>Useful on a phone.<br/><em>Clear on a desktop.</em></h2>
            <p>The current EduSphere 360 experience is designed to respond to desktop, tablet and mobile browser sizes. Staff, students and parents can open the online platform through a supported browser and their permitted role access.</p>
            <div className="nl-mobile-points"><span><CheckCircle2 size={17}/> Responsive layouts across screen sizes</span><span><CheckCircle2 size={17}/> Role-appropriate account access</span><span><CheckCircle2 size={17}/> Online access to institution records</span></div>
            <p className="nl-mobile-disclaimer">The current release is online-only. A separate native Android or iOS app is not claimed as part of this release.</p>
            <a className="nl-text-link" href="/#/public/mobile">Read about mobile access <ArrowUpRight size={15}/></a>
          </div>
        </section>

        <section className="nl-getting-started-section" id="getting-started">
          <div className="nl-section-kicker">A CLEAR FIRST-RUN JOURNEY <span>08 / GETTING STARTED</span></div>
          <div className="nl-getting-heading"><h2>Start with the basics.<br/><em>Build with confidence.</em></h2><p>Institution onboarding starts with an owner account. From there, establish the institution and give each invited person the access their role needs.</p></div>
          <div className="nl-getting-steps">
            <article><span>01</span><h3>Create the owner account</h3><p>Enter your name, institution name, type and sign-in details.</p></article>
            <article><span>02</span><h3>Verify your email</h3><p>Confirm the registration email before the new workspace is activated.</p></article>
            <article><span>03</span><h3>Set the institution foundation</h3><p>Review institution identity and configure the academic structure you need.</p></article>
            <article><span>04</span><h3>Provision your community</h3><p>Set up permitted administrators, employees, learners and parent or guardian access.</p></article>
          </div>
          <div className="nl-getting-footer"><span>Ready to create a new institution?</span><button type="button" onClick={() => go('setup')}>Start owner registration <ArrowUpRight size={15}/></button></div>
        </section>

        <section className="nl-faq-section" id="faq">
          <div className="nl-faq-intro">
            <div className="nl-section-kicker">GOOD TO KNOW <span>09 / FREQUENT QUESTIONS</span></div>
            <h2>Clear answers<br/><em>before you begin.</em></h2>
            <p>Understand the current cloud release, mobile-browser access, connected roles and integration boundaries.</p>
            <a href="/#/public/support">Visit the help centre <ArrowUpRight size={15}/></a>
          </div>
          <div className="nl-faq-list">
            {homeFaqs.map((item,index) => <article className={openFaq === index ? 'is-open' : ''} key={item.question}>
              <h3><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(current => current === index ? null : index)}><span>{item.question}</span><i>{openFaq === index ? '−' : '+'}</i></button></h3>
              <div hidden={openFaq !== index}><p>{item.answer}</p></div>
            </article>)}
          </div>
        </section>

        <section className="nl-final-cta" id="contact">
          <div className="nl-final-pattern" aria-hidden="true"/><div className="nl-final-copy">
            <span className="nl-section-kicker">A MORE CONNECTED INSTITUTION STARTS HERE</span>
            <h2>Make room for<br/><em>what matters.</em></h2>
            <p>Bring your people, processes and progress together with EduSphere 360.</p>
          </div>
          <div className="nl-final-actions">
            <button className="nl-button nl-button-light" type="button" onClick={() => go('setup')}>Create your institution <ArrowUpRight size={18}/></button>
            <button className="nl-final-login" type="button" onClick={() => go('login')}>Already have an account? Sign in <ArrowRight size={15}/></button>
            <span><Zap size={14}/> Start with the current cloud edition</span>
          </div>
        </section>
      </main>

      <footer className="nl-footer">
        <div className="nl-footer-main">
          <div className="nl-footer-brand">
            <a className="nl-brand nl-brand-footer" href="#top" aria-label="EduSphere 360 home">
              <span className="nl-brand-mark"><GraduationCap size={25}/><i>360</i></span>
              <span className="nl-brand-type"><b>EduSphere <em>360</em></b><small>EDUCATION MANAGEMENT</small></span>
            </a>
            <p>One connected education experience for the people, learning and operations of your institution.</p>
          </div>
          <div className="nl-footer-column"><b>Platform</b><a href="#platform">Overview</a><a href="#features">Core capabilities</a><a href="/#/public/features">Full feature catalogue</a><a href="/#/public/analytics">Analytics preview</a></div>
          <div className="nl-footer-column"><b>Solutions</b><a href="#solutions">Role workspaces</a><a href="/#/public/solutions">Schools, colleges & universities</a><a href="/#/public/mobile">Mobile browser access</a><a href="/#/public/integrations">Integrations</a></div>
          <div className="nl-footer-column"><b>Explore</b><a href="/#/public/product-tour">Product tour</a><a href="/#/public/resources">Getting started</a><a href="/#/public/support">Help & FAQs</a><a href="/#/public/updates">Release information</a></div>
          <div className="nl-footer-column nl-footer-access"><b>Your account</b><button type="button" onClick={() => go('login')}>Sign in</button><button type="button" onClick={() => go('setup')}>Create an institution</button><a href="#top">Back to top ↑</a></div>
        </div>
        <div className="nl-footer-bottom"><span>© {new Date().getFullYear()} EduSphere 360. All rights reserved.</span><span>Schools · Colleges · Universities</span><span>Education management, thoughtfully connected.</span></div>
      </footer>
    </div>
  )
}
