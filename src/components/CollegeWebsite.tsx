import { useState, type ReactNode } from 'react'
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, Building2,
  CheckCircle2, ChevronDown, ClipboardList, ExternalLink, FlaskConical,
  GraduationCap, Landmark, Library, MapPin, Menu, ShieldCheck, Users, X,
} from 'lucide-react'
import type { AppRole } from '../lib/types'
import '../styles/college-website.css'

type Props = {
  navigate: (screen: 'welcome' | 'login' | 'setup', role?: AppRole) => void
}

const officialCollegeList = 'https://college.sindh.gov.pk/government-colleges'
const departmentHome = 'https://college.sindh.gov.pk/'
const governmentAdmissions = 'https://seccap.dgcs.gos.pk/'
const universityAffiliations = 'https://usindh.edu.pk/colleges'
const mapsSearch = 'https://www.google.com/maps/search/?api=1&query=Government+Islamia+Degree+College+Badin'

const portalLinks: { role: AppRole; title: string; detail: string; icon: typeof Building2; short: string }[] = [
  { role: 'owner', title: 'Principal / College Head', detail: 'College-wide oversight and authorised decisions', icon: Landmark, short: '01' },
  { role: 'admin', title: 'College Administrator', detail: 'Office operations, people and institutional records', icon: Building2, short: '02' },
  { role: 'teacher', title: 'Lecturer / Faculty', detail: 'Assigned classes, attendance and academic work', icon: BookOpen, short: '03' },
  { role: 'exam_officer', title: 'Examination Officer', detail: 'Examination schedules, marks and result workflows', icon: ClipboardList, short: '04' },
  { role: 'accountant', title: 'Accounts Officer', detail: 'Authorised fee, receipt and finance records', icon: ShieldCheck, short: '05' },
  { role: 'student', title: 'Student', detail: 'Personal academic information and notices', icon: GraduationCap, short: '06' },
  { role: 'parent', title: 'Parent / Guardian', detail: 'Information for verified linked students', icon: Users, short: '07' },
]

const usefulLinks = [
  {
    label: 'Government colleges directory',
    detail: 'Find the official college listing published by the College Education Department.',
    href: officialCollegeList,
    tag: 'COLLEGE DIRECTORY',
  },
  {
    label: 'Government college admissions',
    detail: 'Check the current admission cycle and instructions before submitting an application.',
    href: governmentAdmissions,
    tag: 'ADMISSIONS',
  },
  {
    label: 'College Education Department',
    detail: 'Official notifications, circulars, policies and department announcements.',
    href: departmentHome,
    tag: 'OFFICIAL NOTICES',
  },
  {
    label: 'University of Sindh affiliated colleges',
    detail: 'View the university directory that includes Government Islamia College Badin.',
    href: universityAffiliations,
    tag: 'AFFILIATION DIRECTORY',
  },
]

const questions = [
  {
    q: 'Where can I find the current admission instructions?',
    a: 'Admission dates, eligibility, merit procedures and application instructions can change each cycle. Use the official Government Colleges admission portal and follow the latest notification issued by the College Education Department.',
  },
  {
    q: 'Which study stream is listed for the college?',
    a: 'The Sindh College Education Department directory currently lists Science for Government Islamia Degree College Badin. Ask the college office or consult the latest prospectus for the subject combinations and programmes available in the current session.',
  },
  {
    q: 'How do students and staff get portal access?',
    a: 'Portal accounts are issued or approved by the college administration. Students and parents should not create staff or management accounts themselves. A parent account must be connected to a verified student record.',
  },
  {
    q: 'Can parents see another student’s information?',
    a: 'No. The parent workspace is designed around verified guardian-to-student relationships. It should only display records for the children connected to the signed-in guardian account.',
  },
]

function CollegeMark() {
  return (
    <span className="gic-mark" aria-hidden="true">
      <span className="gic-mark-inner"><BookOpen size={25} strokeWidth={1.7} /></span>
      <i>G I</i>
    </span>
  )
}

function OfficialLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="gic-official-link" href={href} target="_blank" rel="noreferrer">
      {children}<ExternalLink size={14} aria-hidden="true" />
    </a>
  )
}

export function CollegeWebsite({ navigate }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openQuestion, setOpenQuestion] = useState<number | null>(0)
  const closeMenu = () => setMobileOpen(false)

  const nav = [
    ['About', '#about'],
    ['Academics', '#academics'],
    ['Admissions', '#admissions'],
    ['Notices', '#notices'],
    ['Portal access', '#portal'],
    ['Contact', '#contact'],
  ]

  return (
    <div className="gic-site" id="top">
      <a className="gic-skip-link" href="#main-content">Skip to main content</a>

      <div className="gic-government-bar">
        <div className="gic-container gic-government-inner">
          <span><Landmark size={14} /> Government of Sindh</span>
          <a href={departmentHome} target="_blank" rel="noreferrer">
            College Education Department <ArrowUpRight size={13} />
          </a>
        </div>
      </div>

      <header className="gic-header">
        <div className="gic-container gic-header-inner">
          <a href="#top" className="gic-brand" onClick={closeMenu} aria-label="Government Islamia Degree College Badin home">
            <CollegeMark />
            <span className="gic-brand-copy">
              <strong>Government Islamia</strong>
              <b>Degree College, Badin</b>
              <small>BADIN · SINDH · PAKISTAN</small>
            </span>
          </a>

          <button
            type="button"
            className="gic-menu-toggle"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            aria-controls="gic-main-nav"
            onClick={() => setMobileOpen(value => !value)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <nav id="gic-main-nav" className={'gic-nav' + (mobileOpen ? ' is-open' : '')} aria-label="Main navigation">
            {nav.map(([label, href]) => (
              <a key={href} href={href} onClick={closeMenu}>{label}</a>
            ))}
            <button type="button" className="gic-nav-login" onClick={() => { closeMenu(); navigate('login') }}>
              College portal <ArrowUpRight size={15} />
            </button>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="gic-hero" aria-labelledby="gic-hero-title">
          <div className="gic-container gic-hero-grid">
            <div className="gic-hero-copy">
              <div className="gic-overline"><span /> GOVERNMENT ISLAMIA DEGREE COLLEGE, BADIN</div>
              <h1 id="gic-hero-title">Learn here.<br /><em>Take it</em> <strong>further.</strong></h1>
              <p className="gic-hero-lead">
                Government Islamia Degree College Badin is part of Sindh’s public college network.
                Explore the college, check official academic information and find the right route to admission.
              </p>
              <div className="gic-hero-actions">
                <a className="gic-button gic-button-primary" href="#admissions">
                  Admission information <ArrowRight size={17} />
                </a>
                <a className="gic-text-action" href="#about">
                  Discover the college <ArrowDownRight size={17} />
                </a>
              </div>
              <div className="gic-hero-meta">
                <span><MapPin size={15} /> Badin District, Sindh</span>
                <span><ShieldCheck size={15} /> Government college</span>
              </div>
            </div>

            <div className="gic-hero-visual">
              <div className="gic-photo-frame">
                <img
                  src="https://images.unsplash.com/photo-1758270704787-615782711641?auto=format&fit=crop&fm=jpg&ixlib=rb-4.1.0&q=82&w=1800"
                  alt="Students talking and studying together in a lecture hall; illustrative educational photograph, not a photograph of the Badin campus"
                  fetchPriority="high"
                />
                <div className="gic-photo-shade" />
                <div className="gic-photo-label">
                  <span>LEARNING IS A SHARED JOURNEY</span>
                  <b>Knowledge opens doors.</b>
                </div>
                <div className="gic-photo-stamp">
                  <CollegeMark />
                  <span><b>G.I.D.C.</b><small>BADIN · SINDH</small></span>
                </div>
              </div>
              <div className="gic-hero-note">
                <span className="gic-note-rule" />
                <p>Official information first. Clear guidance at every step.</p>
              </div>
            </div>
          </div>
          <div className="gic-hero-bottom">
            <div className="gic-container gic-hero-bottom-inner">
              <span className="gic-fact-label">COLLEGE AT A GLANCE</span>
              <div><b>Government</b><small>Public sector college</small></div>
              <div><b>Badin</b><small>Badin District · Sindh</small></div>
              <div><b>Science</b><small>Stream listed in the government directory</small></div>
              <OfficialLink href={officialCollegeList}>View official listing</OfficialLink>
            </div>
          </div>
        </section>

        <section className="gic-intro gic-section" id="about" aria-labelledby="gic-intro-title">
          <div className="gic-container gic-intro-grid">
            <div className="gic-section-index">
              <span>01 / ABOUT THE COLLEGE</span>
              <div className="gic-index-line" />
              <small>BADIN, SINDH</small>
            </div>
            <div className="gic-intro-main">
              <p className="gic-section-kicker">A PUBLIC COLLEGE WITH A LOCAL ROOT</p>
              <h2 id="gic-intro-title">A government college<br />in <em>Badin.</em></h2>
              <p className="gic-intro-text">
                Government Islamia Degree College Badin is listed by the Sindh College Education Department
                among the functional government colleges of Badin District. The same directory identifies
                Science as the college’s listed stream.
              </p>
              <div className="gic-intro-links">
                <OfficialLink href={officialCollegeList}>Department college directory</OfficialLink>
                <OfficialLink href={universityAffiliations}>University of Sindh college directory</OfficialLink>
              </div>
            </div>
            <aside className="gic-intro-aside">
              <div className="gic-aside-ornament"><BookOpen size={30} /></div>
              <blockquote>A good education gives curiosity room to grow.</blockquote>
              <small>A COLLEGE-WIDE PRINCIPLE</small>
              <p className="gic-quote-note">An invitation to think carefully, ask questions and keep learning.</p>
            </aside>
          </div>
        </section>

        <section className="gic-academics gic-section" id="academics" aria-labelledby="gic-academics-title">
          <div className="gic-container">
            <div className="gic-section-heading">
              <div>
                <span className="gic-section-kicker">02 / ACADEMIC INFORMATION</span>
                <h2 id="gic-academics-title">Follow your curiosity.<br /><em>Build your next step.</em></h2>
              </div>
              <p>
                Start with verified information. Subject combinations, seat availability and eligibility
                are determined by the current prospectus and official admission notices.
              </p>
            </div>

            <div className="gic-academic-feature">
              <div className="gic-academic-number">01</div>
              <div className="gic-academic-icon"><FlaskConical size={29} /></div>
              <div className="gic-academic-copy">
                <span>OFFICIAL DIRECTORY LISTING</span>
                <h3>Science stream</h3>
                <p>
                  Science is the stream shown for Government Islamia Degree College Badin in the
                  College Education Department’s published government-college directory.
                </p>
                <OfficialLink href={officialCollegeList}>Check the department listing</OfficialLink>
              </div>
              <div className="gic-academic-side">
                <span>For current applicants</span>
                <b>Check the latest prospectus and admission notice before applying.</b>
                <a href={governmentAdmissions} target="_blank" rel="noreferrer">Admission portal <ArrowUpRight size={15} /></a>
              </div>
            </div>

            <div className="gic-academic-footnote">
              <CheckCircle2 size={17} />
              <p>
                This website does not guess programme names, subject combinations, merit criteria or fees.
                The college office and the latest official notice remain the source for current details.
              </p>
            </div>
          </div>
        </section>

        <section className="gic-admissions gic-section" id="admissions" aria-labelledby="gic-admissions-title">
          <div className="gic-container gic-admissions-grid">
            <div className="gic-admissions-copy">
              <span className="gic-section-kicker">03 / ADMISSIONS</span>
              <h2 id="gic-admissions-title">Your next chapter<br /><em>starts with a question.</em></h2>
              <p>
                Admission schedules and procedures may change from one session to the next.
                Use the official Sindh government admission channel for current dates, eligibility,
                application steps and merit information.
              </p>
              <a className="gic-button gic-button-light" href={governmentAdmissions} target="_blank" rel="noreferrer">
                Visit the government admission portal <ArrowUpRight size={17} />
              </a>
              <small className="gic-admission-caution">Admission status is not represented as open or closed here. Please follow the latest official notification.</small>
            </div>
            <div className="gic-admission-steps">
              <div><span>01</span><b>Read the current notice</b><p>Confirm the session, programme, eligibility and closing date.</p></div>
              <div><span>02</span><b>Prepare your documents</b><p>Follow the document checklist in the official admission instructions.</p></div>
              <div><span>03</span><b>Apply through the stated channel</b><p>Use the designated government portal or the process stated by the college.</p></div>
              <div><span>04</span><b>Follow the merit and joining instructions</b><p>Check official updates for verification, selection and enrolment steps.</p></div>
            </div>
          </div>
        </section>

        <section className="gic-notices gic-section" id="notices" aria-labelledby="gic-notices-title">
          <div className="gic-container">
            <div className="gic-notice-heading">
              <div><span className="gic-section-kicker">04 / OFFICIAL INFORMATION</span><h2 id="gic-notices-title">Notices that <em>matter.</em></h2></div>
              <p>For the most recent dates, circulars and policy changes, consult the issuing government or university source.</p>
            </div>
            <div className="gic-notice-list">
              {usefulLinks.map((item, index) => (
                <a className="gic-notice-row" href={item.href} target="_blank" rel="noreferrer" key={item.label}>
                  <span className="gic-notice-no">{String(index + 1).padStart(2, '0')}</span>
                  <span className="gic-notice-copy"><small>{item.tag}</small><b>{item.label}</b><em>{item.detail}</em></span>
                  <span className="gic-notice-arrow"><ArrowUpRight size={19} /></span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="gic-life gic-section" aria-labelledby="gic-life-title">
          <div className="gic-container gic-life-grid">
            <div className="gic-life-copy">
              <span className="gic-section-kicker">05 / THE COLLEGE EXPERIENCE</span>
              <h2 id="gic-life-title">Ask questions.<br /><em>Find your way.</em></h2>
              <p>
                College is a time to build knowledge, confidence and friendships. Use the official college
                channels to confirm the facilities, student activities and support currently available on campus.
              </p>
              <div className="gic-life-points">
                <span><FlaskConical size={18} /> Science and practical learning</span>
                <span><Library size={18} /> Reading and independent study</span>
                <span><Users size={18} /> Learning with peers and teachers</span>
              </div>
            </div>
            <div className="gic-life-photo">
              <svg className="gic-library-illustration" viewBox="0 0 880 520" role="img" aria-label="A hand-drawn illustration of a college library with bookshelves, a reading table, books, plants and daylight">
                <defs>
                  <linearGradient id="gic-library-wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f2eadb"/><stop offset="1" stopColor="#dfe6d7"/></linearGradient>
                  <linearGradient id="gic-library-window" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b8d0c5"/><stop offset="1" stopColor="#e3e9d8"/></linearGradient>
                </defs>
                <rect width="880" height="520" fill="url(#gic-library-wall)"/>
                <rect y="390" width="880" height="130" fill="#c8bda7"/>
                <rect x="48" y="48" width="330" height="260" rx="4" fill="#fffdf7" stroke="#193d31" strokeWidth="9"/>
                <rect x="63" y="63" width="300" height="230" fill="url(#gic-library-window)"/>
                <path d="M63 205 Q130 156 194 190 T363 165 V293 H63Z" fill="#9bae8a"/>
                <path d="M63 243 Q135 210 211 236 T363 218 V293 H63Z" fill="#718d69"/>
                <path d="M211 63V293 M63 178H363" stroke="#f7f2e8" strokeWidth="10"/>
                <rect x="430" y="42" width="398" height="310" rx="3" fill="#8d6545"/>
                <rect x="442" y="54" width="374" height="286" fill="#d7c5a7"/>
                <g stroke="#714d37" strokeWidth="8">
                  <path d="M442 148H816 M442 242H816 M442 336H816"/>
                </g>
                <g>
                  <rect x="454" y="70" width="34" height="70" rx="3" fill="#294f3e"/><rect x="492" y="83" width="29" height="57" rx="2" fill="#ad6546"/><rect x="526" y="62" width="39" height="78" rx="3" fill="#c6a15e"/><rect x="570" y="78" width="31" height="62" rx="2" fill="#657f66"/><rect x="606" y="65" width="42" height="75" rx="3" fill="#8b5640"/><rect x="653" y="86" width="28" height="54" rx="2" fill="#3e6453"/><rect x="687" y="71" width="40" height="69" rx="3" fill="#c19a5d"/><rect x="733" y="80" width="34" height="60" rx="3" fill="#49624e"/><rect x="773" y="66" width="32" height="74" rx="3" fill="#a75e43"/>
                  <rect x="456" y="156" width="27" height="80" rx="2" fill="#c3975a"/><rect x="487" y="170" width="42" height="66" rx="3" fill="#6b8162"/><rect x="534" y="159" width="31" height="77" rx="2" fill="#9c523e"/><rect x="570" y="177" width="38" height="59" rx="2" fill="#d3b579"/><rect x="613" y="158" width="30" height="78" rx="2" fill="#345844"/><rect x="648" y="167" width="44" height="69" rx="3" fill="#9d7050"/><rect x="697" y="156" width="32" height="80" rx="2" fill="#55745b"/><rect x="734" y="177" width="38" height="59" rx="2" fill="#c18b56"/><rect x="778" y="158" width="26" height="78" rx="2" fill="#6b5542"/>
                  <rect x="455" y="249" width="37" height="83" rx="2" fill="#42624d"/><rect x="497" y="265" width="27" height="67" rx="2" fill="#b66a47"/><rect x="529" y="252" width="43" height="80" rx="2" fill="#d0b277"/><rect x="578" y="268" width="28" height="64" rx="2" fill="#405d4a"/><rect x="612" y="253" width="36" height="79" rx="2" fill="#995d48"/><rect x="653" y="261" width="39" height="71" rx="2" fill="#b79256"/><rect x="698" y="251" width="30" height="81" rx="2" fill="#41694f"/><rect x="734" y="267" width="37" height="65" rx="2" fill="#9c6545"/><rect x="777" y="253" width="28" height="79" rx="2" fill="#d2b57e"/>
                </g>
                <rect x="94" y="355" width="622" height="24" rx="5" fill="#694b36"/>
                <path d="M124 379L104 486 M684 379L708 486" stroke="#694b36" strokeWidth="15" strokeLinecap="round"/>
                <rect x="235" y="325" width="170" height="22" rx="3" fill="#b78c59"/>
                <rect x="254" y="306" width="128" height="17" rx="3" fill="#f4ebd8"/>
                <rect x="268" y="289" width="100" height="16" rx="3" fill="#55735d"/>
                <rect x="516" y="334" width="116" height="19" rx="3" fill="#b66a47"/>
                <rect x="535" y="315" width="96" height="18" rx="3" fill="#e2c789"/>
                <path d="M745 365Q752 306 776 298Q800 316 798 365" fill="#69865e"/>
                <path d="M774 380V305 M774 340L746 316 M775 345L803 322" stroke="#54764f" strokeWidth="8" strokeLinecap="round"/>
                <path d="M725 381H822L813 421H736Z" fill="#a65b3b"/>
                <ellipse cx="390" cy="420" rx="82" ry="28" fill="#193d31" opacity=".12"/>
                <g transform="translate(390 350)">
                  <path d="M-10 32Q-20 4 2 -16Q28 -26 42 -3L55 48H1Z" fill="#a65b3b"/>
                  <circle cx="14" cy="-30" r="22" fill="#b98260"/>
                  <path d="M-7 -35Q-3 -62 27 -54Q49 -45 34 -29Q14 -40 -7 -35Z" fill="#253c32"/>
                  <path d="M5 48L-13 94 M42 48L57 93" stroke="#294f3e" strokeWidth="15" strokeLinecap="round"/>
                  <path d="M-10 7L-51 37 M42 4L77 22" stroke="#b98260" strokeWidth="12" strokeLinecap="round"/>
                  <path d="M-42 39L-77 39" stroke="#b98260" strokeWidth="10" strokeLinecap="round"/>
                </g>
                <g fill="#e3ce9c" opacity=".7"><circle cx="406" cy="95" r="4"/><circle cx="400" cy="118" r="2"/><circle cx="388" cy="140" r="3"/></g>
              </svg>
              <span>COLLEGE LIBRARY · ILLUSTRATIVE ARTWORK</span>
            </div>
          </div>
        </section>

        <section className="gic-portal gic-section" id="portal" aria-labelledby="gic-portal-title">
          <div className="gic-container">
            <div className="gic-section-heading gic-portal-heading">
              <div><span className="gic-section-kicker">06 / COLLEGE PORTAL</span><h2 id="gic-portal-title">One college.<br /><em>Different responsibilities.</em></h2></div>
              <p>
                Access is based on your approved college role. Sign in with the account issued by the
                administration; menus and records are restricted according to your responsibilities.
              </p>
            </div>
            <div className="gic-portal-grid">
              {portalLinks.map(({ role, title, detail, icon: Icon, short }) => (
                <button key={role} type="button" className="gic-portal-card" onClick={() => navigate('login', role)}>
                  <span className="gic-portal-card-no">{short}</span>
                  <span className="gic-portal-icon"><Icon size={22} /></span>
                  <span className="gic-portal-title">{title}</span>
                  <span className="gic-portal-detail">{detail}</span>
                  <span className="gic-portal-enter">Continue to sign in <ArrowUpRight size={15} /></span>
                </button>
              ))}
            </div>
            <p className="gic-portal-security"><ShieldCheck size={16} /> Student and guardian access is limited to their own verified records and relationships.</p>
          </div>
        </section>

        <section className="gic-faq gic-section" id="faq" aria-labelledby="gic-faq-title">
          <div className="gic-container gic-faq-grid">
            <div><span className="gic-section-kicker">07 / QUICK ANSWERS</span><h2 id="gic-faq-title">Good to <em>know.</em></h2><p>Practical guidance for students, families and college staff.</p></div>
            <div className="gic-faq-list">
              {questions.map((item, index) => (
                <div className={'gic-faq-item' + (openQuestion === index ? ' is-open' : '')} key={item.q}>
                  <button type="button" aria-expanded={openQuestion === index} onClick={() => setOpenQuestion(openQuestion === index ? null : index)}>
                    <span>{item.q}</span><ChevronDown size={18} />
                  </button>
                  {openQuestion === index && <p>{item.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="gic-contact gic-section" id="contact" aria-labelledby="gic-contact-title">
          <div className="gic-container gic-contact-grid">
            <div><span className="gic-section-kicker">08 / FIND THE COLLEGE</span><h2 id="gic-contact-title">Badin is <em>home.</em></h2></div>
            <div className="gic-contact-details">
              <p><MapPin size={18} /> Government Islamia Degree College, Badin, Sindh, Pakistan</p>
              <p><Landmark size={18} /> Listed in the Government of Sindh college directory</p>
              <div className="gic-contact-actions">
                <OfficialLink href={mapsSearch}>Find on map</OfficialLink>
                <OfficialLink href={departmentHome}>Government college information</OfficialLink>
              </div>
              <small>For telephone numbers, office hours and in-person admission requirements, confirm details directly with the college or the College Education Department.</small>
            </div>
          </div>
        </section>
      </main>

      <footer className="gic-footer">
        <div className="gic-container">
          <div className="gic-footer-main">
            <a href="#top" className="gic-brand gic-footer-brand">
              <CollegeMark />
              <span className="gic-brand-copy"><strong>Government Islamia</strong><b>Degree College, Badin</b><small>BADIN · SINDH · PAKISTAN</small></span>
            </a>
            <p>A public college in Badin, Sindh. Use official government sources for current admissions, notices and academic information.</p>
            <button type="button" onClick={() => navigate('login')}>College portal <ArrowUpRight size={15} /></button>
          </div>
          <div className="gic-footer-bottom">
            <span>© {new Date().getFullYear()} Government Islamia Degree College Badin</span>
            <span>Illustrative hero photograph: Vitaly Gariev / Unsplash · Library illustration: original vector artwork</span>
            <a href="#top">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
