import { useEffect, useState } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, CheckCircle2,
  ExternalLink, GraduationCap, Landmark, LibraryBig, Menu,
  Microscope, Newspaper, Pause, Play, ShieldCheck, Users, X,
} from 'lucide-react'
import type { AppRole } from '../lib/types'
import '../styles/college-home-page.css'

type Props = {
  navigate: (screen: 'welcome' | 'login' | 'setup', role?: AppRole) => void
  initialSection?: string
}

const navigation = [
  { label: 'Home', href: '#home' },
  { label: 'Our college', href: '#about' },
  { label: 'Programmes', href: '#programmes' },
  { label: 'Admissions', href: '#admissions' },
  { label: 'Campus life', href: '#campus-life' },
  { label: 'Gallery', href: '#gallery' },
  { label: 'Notices', href: '#notices' },
  { label: 'Contact', href: '#contact' },
]

const portalLinks: { role: AppRole; title: string; note: string }[] = [
  { role: 'owner', title: 'College management', note: 'Principal and authorised management accounts' },
  { role: 'teacher', title: 'Faculty & employees', note: 'Teaching and approved staff accounts' },
  { role: 'student', title: 'Student portal', note: 'Enrolled students' },
  { role: 'parent', title: 'Parent / guardian', note: 'Verified student guardians' },
  { role: 'accountant', title: 'Accounts office', note: 'Authorised finance staff' },
  { role: 'exam_officer', title: 'Examination office', note: 'Authorised examination staff' },
]

const photo = {
  students: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=85',
  library: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1400&q=85',
  science: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1400&q=85',
  classroom: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=85',
  graduates: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1400&q=85',
  study: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1400&q=85',
  collegeDirectory: 'https://lh5.googleusercontent.com/p/AF1QipOUOOw-XvK3g8WEHRnrrxkXQq4VnEgx0DW4ufDF=w1080-k-no',
}

type GallerySlide = { src: string; alt: string; title: string; label: string; note: string; source?: string }

const gallerySlides: GallerySlide[] = [
  {
    src: photo.collegeDirectory,
    alt: 'A courtyard and building shown in a public directory photo associated with Government Islamia Degree College Badin.',
    title: 'A photograph associated with the college',
    label: 'PUBLIC DIRECTORY IMAGE',
    note: 'This image appears on a third-party public listing. Its date and the present condition of the campus have not been independently confirmed.',
    source: 'https://pk.worldorgs.com/catalog/badin/college/government-islamia-degree-college-badin',
  },
  {
    src: photo.students,
    alt: 'Students collaborating around a table in a representative education photograph.',
    title: 'Learning through collaboration',
    label: 'REPRESENTATIVE EDUCATION IMAGE',
    note: 'An illustrative image of students learning together; not a photograph of this college.',
  },
  {
    src: photo.classroom,
    alt: 'A bright classroom in a representative education photograph.',
    title: 'A focused place to learn',
    label: 'REPRESENTATIVE EDUCATION IMAGE',
    note: 'An illustrative classroom scene; actual college facilities should be confirmed with the administration.',
  },
  {
    src: photo.library,
    alt: 'Rows of books in a representative library photograph.',
    title: 'Reading opens new perspectives',
    label: 'REPRESENTATIVE EDUCATION IMAGE',
    note: 'An illustrative library image; not a verified photograph of the college library.',
  },
  {
    src: photo.science,
    alt: 'Scientific equipment in a representative laboratory photograph.',
    title: 'Questions, discovery and science',
    label: 'REPRESENTATIVE EDUCATION IMAGE',
    note: 'An illustrative science image; current laboratories and available facilities should be verified by the college.',
  },
  {
    src: photo.graduates,
    alt: 'Graduates celebrating at a commencement ceremony in a representative education photograph.',
    title: 'Every achievement begins with a step',
    label: 'REPRESENTATIVE EDUCATION IMAGE',
    note: 'An illustrative graduation scene; it does not document a college event.',
  },
  {
    src: photo.study,
    alt: 'Books and notes arranged on a desk in a representative study photograph.',
    title: 'Preparation creates opportunity',
    label: 'REPRESENTATIVE EDUCATION IMAGE',
    note: 'An illustrative study scene; not a photograph from the college.',
  },
]

function scrollToSection(href: string) {
  const id = href.replace('#', '')
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function CollegeHomePage({ navigate, initialSection }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [galleryPaused, setGalleryPaused] = useState(false)

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.gidc-site')
    if (!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    root.classList.add('gidc-motion-ready')
    const elements = root.querySelectorAll<HTMLElement>('[data-reveal]')
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' })
    elements.forEach(element => observer.observe(element))
    return () => {
      observer.disconnect()
      root.classList.remove('gidc-motion-ready')
    }
  }, [])

  useEffect(() => {
    if (galleryPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const interval = window.setInterval(() => {
      setGalleryIndex(current => (current + 1) % gallerySlides.length)
    }, 5600)
    return () => window.clearInterval(interval)
  }, [galleryPaused])

  useEffect(() => {
    if (!portalOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPortalOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [portalOpen])

  useEffect(() => {
    if (!initialSection || initialSection === 'home') return
    const sectionMap: Record<string, string> = {
      about: 'about', features: 'programmes', programmes: 'programmes',
      admissions: 'admissions', gallery: 'gallery', solutions: 'portals', roles: 'portals',
      'product-tour': 'campus-life', 'campus-services': 'campus-life',
      analytics: 'notices', notices: 'notices', contact: 'contact',
      resources: 'official-links', support: 'contact', mobile: 'portals',
      integrations: 'official-links', pricing: 'about', updates: 'notices',
      reviews: 'about',
    }
    const target = sectionMap[initialSection.split('/')[0]] ?? 'about'
    window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'auto', block: 'start' }), 80)
  }, [initialSection])

  const goTo = (href: string) => {
    setMenuOpen(false)
    setPortalOpen(false)
    if (href.startsWith('#')) scrollToSection(href)
  }

  return (
    <div className="gidc-site" id="home">
      <div className="gidc-topline">
        <div className="gidc-container gidc-topline-inner">
          <span><Landmark size={14}/> Government of Sindh · Public Degree College</span>
          <span className="gidc-topline-location">Badin, Sindh, Pakistan</span>
        </div>
      </div>

      <header className="gidc-header">
        <div className="gidc-container gidc-header-inner">
          <a className="gidc-brand" href="#home" onClick={() => goTo('#home')} aria-label="Government Islamia Degree College Badin home">
            <img className="gidc-crest-image" src="/gidc-badin-official-logo.svg" alt="Official Government Islamia Degree College Badin emblem"/>
            <span className="gidc-brand-copy">
              <strong>Government Islamia</strong>
              <b>Degree College Badin</b>
              <small>LEARNING · SERVICE · OPPORTUNITY</small>
            </span>
          </a>

          <button className="gidc-menu-toggle" type="button" onClick={() => setMenuOpen(v => !v)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen}>
            {menuOpen ? <X size={22}/> : <Menu size={22}/>}
          </button>

          <nav className={menuOpen ? 'gidc-nav is-open' : 'gidc-nav'} aria-label="College navigation">
            {navigation.map(item => (
              <a key={item.href} href={item.href} onClick={() => goTo(item.href)}>{item.label}</a>
            ))}
          </nav>

          <div className="gidc-header-actions">
            <button className="gidc-portal-button" type="button" onClick={() => { setPortalOpen(true); setMenuOpen(false) }}>
              College portal <ArrowUpRight size={16}/>
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="gidc-hero" aria-labelledby="gidc-title" data-reveal="up">
          <div className="gidc-hero-pattern" aria-hidden="true"/>
          <div className="gidc-container gidc-hero-grid">
            <div className="gidc-hero-copy">
              <div className="gidc-kicker"><span/> A PUBLIC COLLEGE IN BADIN</div>
              <h1 id="gidc-title">Knowledge opens doors. <em>Education builds futures.</em></h1>
              <p className="gidc-hero-lead">A place to discover your strengths, develop your knowledge and take the next step towards your ambitions.</p>
              <div className="gidc-hero-actions">
                <a className="gidc-button gidc-button-gold" href="#programmes" onClick={() => goTo('#programmes')}>Explore programmes <ArrowRight size={17}/></a>
                <a className="gidc-button gidc-button-outline" href="#admissions" onClick={() => goTo('#admissions')}>Admission information <ArrowUpRight size={17}/></a>
              </div>
              <div className="gidc-hero-values">
                <span><ShieldCheck size={16}/> Government college</span>
                <span><Landmark size={16}/> Badin, Sindh</span>
              </div>
            </div>

            <div className="gidc-hero-visual">
              <div className="gidc-photo-frame">
                <img src={photo.students} alt="Illustrative photograph of college students studying together; not a photograph of the Government Islamia Degree College campus."/>
                <div className="gidc-photo-shade"/>
                <div className="gidc-photo-caption">
                  <span>LEARN TOGETHER</span>
                  <strong>Make your next chapter count.</strong>
                </div>
              </div>
              <div className="gidc-photo-note"><span className="gidc-note-mark"><GraduationCap size={19}/></span><span><b>Every ambition deserves a start</b><small>Representative education photograph</small></span></div>
              <div className="gidc-hero-stamp" aria-label="GIDC Badin">
                <span>GIDC</span><small>BADIN</small>
              </div>
            </div>
          </div>
          <a className="gidc-scroll-cue" href="#about" aria-label="Scroll to college introduction"><span>DISCOVER THE COLLEGE</span><ArrowDown size={15}/></a>
        </section>

        <section className="gidc-facts-strip" aria-label="College information">
          <div className="gidc-container gidc-facts-grid">
            <div><span className="gidc-fact-icon"><Landmark size={19}/></span><span><b>Public institution</b><small>Government college directory listing</small></span></div>
            <div><span className="gidc-fact-icon"><BookOpen size={19}/></span><span><b>Degree college</b><small>Intermediate and degree college context</small></span></div>
            <div><span className="gidc-fact-icon"><Microscope size={19}/></span><span><b>Science</b><small>Shown in the Sindh Government college listing</small></span></div>
            <div><span className="gidc-fact-icon"><Landmark size={19}/></span><span><b>Badin, Sindh</b><small>Pakistan</small></span></div>
          </div>
        </section>

        <section className="gidc-section gidc-about" id="about" data-reveal="up">
          <div className="gidc-container gidc-about-grid">
            <div className="gidc-section-intro">
              <span className="gidc-overline">OUR COLLEGE</span>
              <h2>A place to learn, <em>belong and move forward.</em></h2>
              <p>Government Islamia Degree College Badin is included in the Government of Sindh’s official government-colleges directory for Badin District, where Science is the stream shown in the published listing. The college is also named in the University of Sindh’s published 2024 directory of affiliated colleges. This website is being shaped as a clear digital front door for students, families, teachers and the college administration.</p>
              <p>Our purpose is practical: help prospective students understand their next step, make verified notices and academic information easier to find, give families a clearer route to college updates, and support educators and staff with dependable digital services. We aim to encourage curiosity, strengthen communication and make everyday college processes more accessible.</p>
              <p>Programme details, admission dates, office contacts and campus facilities will be published as confirmed information—not assumptions—so visitors can make decisions with confidence.</p>
              <a className="gidc-text-link" href="https://college.sindh.gov.pk/government-colleges" target="_blank" rel="noreferrer">View Government of Sindh college directory <ExternalLink size={15}/></a>
            </div>
            <div className="gidc-about-art">
              <div className="gidc-about-image gidc-about-image-main">
                <img src={photo.library} alt="Illustrative library photograph, not verified as a photograph of the college library."/>
                <span>READ · QUESTION · DISCOVER</span>
              </div>
              <div className="gidc-about-note">
                <span className="gidc-note-rule"/>
                <b>Education is built one thoughtful step at a time.</b>
                <small>Government Islamia Degree College Badin</small>
              </div>
              <div className="gidc-about-ornament" aria-hidden="true">G</div>
            </div>
          </div>
        </section>

        <section className="gidc-section gidc-programmes" id="programmes" data-reveal="up">
          <div className="gidc-container">
            <div className="gidc-section-heading">
              <div><span className="gidc-overline">ACADEMIC PATHWAYS</span><h2>Find the path that <em>fits your ambition.</em></h2></div>
              <p>Programme availability, eligibility and subject combinations are determined by the current official admission notice.</p>
            </div>
            <div className="gidc-programme-grid">
              <article className="gidc-programme-card gidc-programme-science">
                <div className="gidc-programme-image"><img src={photo.science} alt="Illustrative science learning photograph; not a verified image of the college laboratory."/></div>
                <div className="gidc-programme-body">
                  <span className="gidc-programme-index">01 / ACADEMIC STREAM</span>
                  <h3>Science</h3>
                  <p>Science is shown for Government Islamia Degree College Badin in the Government of Sindh’s public college directory. Confirm current subject combinations and admission requirements through the latest notice.</p>
                  <a href="https://college.sindh.gov.pk/government-colleges" target="_blank" rel="noreferrer">Check official college listing <ExternalLink size={14}/></a>
                </div>
              </article>
              <article className="gidc-programme-card gidc-programme-guidance">
                <div className="gidc-guidance-art"><BookOpen size={37}/><span>YOUR NEXT STEP</span></div>
                <div className="gidc-programme-body">
                  <span className="gidc-programme-index">02 / ADMISSION GUIDANCE</span>
                  <h3>Subject combinations & degree routes</h3>
                  <p>Ask the college office about the subject groups, class levels and degree pathways currently open. Do not rely on an old prospectus or third-party directory for current availability.</p>
                  <a href="#admissions" onClick={() => goTo('#admissions')}>Read admission guidance <ArrowRight size={14}/></a>
                </div>
              </article>
            </div>
            <p className="gidc-verification-note"><CheckCircle2 size={15}/> Academic details are presented conservatively and should be checked against the latest college and Government of Sindh admission notices.</p>
          </div>
        </section>

        <section className="gidc-section gidc-admissions" id="admissions" data-reveal="up">
          <div className="gidc-container gidc-admissions-grid">
            <div className="gidc-admissions-copy">
              <span className="gidc-overline">ADMISSIONS</span>
              <h2>Your next step starts with <em>the right information.</em></h2>
              <p>Admission schedules, eligibility, available groups, merit criteria and required documents can change from one session to another. Always follow the latest official notice before submitting an application.</p>
              <div className="gidc-admission-actions">
                <a className="gidc-button gidc-button-dark" href="https://college.sindh.gov.pk/" target="_blank" rel="noreferrer">College Education Department <ExternalLink size={15}/></a>
                <a className="gidc-text-link" href="https://college.sindh.gov.pk/government-colleges" target="_blank" rel="noreferrer">Find the college in the directory <ArrowUpRight size={15}/></a>
              </div>
            </div>
            <div className="gidc-admission-steps">
              {[
                ['01','Read the latest notice','Check dates, eligibility, subject groups and instructions.'],
                ['02','Prepare your documents','Keep the academic record and identity documents requested in the notice.'],
                ['03','Follow the official application route','Use the admission process specified by the College Education Department or college office.'],
                ['04','Confirm your admission','Follow merit-list, verification and enrolment instructions issued by the college.'],
              ].map(([number,title,detail]) => (
                <div className="gidc-step" key={number}><span>{number}</span><div><b>{title}</b><small>{detail}</small></div><ArrowUpRight size={16}/></div>
              ))}
            </div>
          </div>
        </section>

        <section className="gidc-section gidc-campus-life" id="campus-life" data-reveal="up">
          <div className="gidc-container">
            <div className="gidc-section-heading gidc-campus-heading">
              <div><span className="gidc-overline">COLLEGE LIFE</span><h2>Learning continues <em>beyond the timetable.</em></h2></div>
              <p>A college community is shaped by curiosity, friendship, discipline and the everyday effort of students and educators.</p>
            </div>
            <div className="gidc-life-grid">
              <article className="gidc-life-card gidc-life-feature">
                <img src={photo.students} alt="Illustrative photograph of students collaborating on coursework."/>
                <div><span>01 · STUDENT COMMUNITY</span><h3>Learn with others.</h3><p>Share ideas, ask questions and take part in a respectful learning environment.</p></div>
              </article>
              <article className="gidc-life-card">
                <span className="gidc-life-icon"><Microscope size={25}/></span><span className="gidc-life-number">02 / CURIOSITY</span><h3>Explore the sciences.</h3><p>Build understanding through questions, evidence and practical learning where facilities are available.</p>
              </article>
              <article className="gidc-life-card gidc-life-library">
                <span className="gidc-life-icon"><LibraryBig size={25}/></span><span className="gidc-life-number">03 / KNOWLEDGE</span><h3>Make time to read.</h3><p>Use learning resources and library services available through the college.</p>
              </article>
              <article className="gidc-life-card gidc-life-gold">
                <span className="gidc-life-icon"><Users size={25}/></span><span className="gidc-life-number">04 / PERSONAL GROWTH</span><h3>Find your voice.</h3><p>Develop confidence, responsibility and the habits that support lifelong learning.</p>
              </article>
            </div>
            <p className="gidc-image-disclaimer">Photographs on this page are representative education imagery, not confirmed photographs of the college premises or facilities.</p>
          </div>
        </section>

        <section className="gidc-section gidc-gallery" id="gallery" data-reveal="up">
          <div className="gidc-container">
            <div className="gidc-gallery-heading">
              <div>
                <span className="gidc-overline">A CLOSER LOOK</span>
                <h2>Education, community <em>and campus life.</em></h2>
                <p>Explore a visual collection connected with the college and the wider learning experience. Captions identify sourced campus imagery separately from representative photographs.</p>
              </div>
              <div className="gidc-gallery-controls">
                <button type="button" aria-label="Previous gallery image" onClick={() => setGalleryIndex(current => (current - 1 + gallerySlides.length) % gallerySlides.length)}><ArrowLeft size={19}/></button>
                <button type="button" aria-label="Next gallery image" onClick={() => setGalleryIndex(current => (current + 1) % gallerySlides.length)}><ArrowRight size={19}/></button>
                <button type="button" className="gidc-gallery-pause" aria-label={galleryPaused ? 'Resume automatic gallery' : 'Pause automatic gallery'} onClick={() => setGalleryPaused(value => !value)}>
                  {galleryPaused ? <Play size={16}/> : <Pause size={16}/>}
                  <span>{galleryPaused ? 'Play' : 'Pause'}</span>
                </button>
              </div>
            </div>
            <div className="gidc-gallery-frame" aria-roledescription="carousel" aria-label="College and education photo gallery">
              <div className="gidc-gallery-track" style={{ transform: `translate3d(-${galleryIndex * 100}%,0,0)` }}>
                {gallerySlides.map((slide, index) => (
                  <figure className="gidc-gallery-slide" key={slide.title} aria-hidden={index !== galleryIndex}>
                    <img src={slide.src} alt={slide.alt} loading="lazy" decoding="async"/>
                    <figcaption>
                      <span>{slide.label}</span>
                      <strong>{slide.title}</strong>
                      <small>{slide.note}</small>
                      {slide.source && <a href={slide.source} target="_blank" rel="noreferrer" tabIndex={index === galleryIndex ? 0 : -1}>View source listing <ExternalLink size={13}/></a>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
            <div className="gidc-gallery-bottom">
              <span>{String(galleryIndex + 1).padStart(2, '0')} / {String(gallerySlides.length).padStart(2, '0')}</span>
              <div className="gidc-gallery-dots" role="group" aria-label="Choose gallery image">
                {gallerySlides.map((slide, index) => (
                  <button key={slide.title} type="button" className={index === galleryIndex ? 'is-active' : ''} aria-label={`Show image ${index + 1}: ${slide.title}`} aria-pressed={index === galleryIndex} onClick={() => setGalleryIndex(index)}/>
                ))}
              </div>
              <span>Auto-advances every 5.6 seconds</span>
            </div>
          </div>
        </section>

        <section className="gidc-section gidc-notices" id="notices" data-reveal="up">
          <div className="gidc-container gidc-notices-grid">
            <div className="gidc-notices-copy">
              <span className="gidc-overline">NOTICE BOARD</span>
              <h2>Important updates, <em>in one place.</em></h2>
              <p>Official admission notices, examination schedules, circulars and college announcements should be published here after verification by the college administration.</p>
              <a className="gidc-text-link" href="https://college.sindh.gov.pk/" target="_blank" rel="noreferrer">Visit the College Education Department <ExternalLink size={15}/></a>
            </div>
            <div className="gidc-notice-empty">
              <span className="gidc-notice-icon"><Newspaper size={26}/></span>
              <b>No public notice has been published here yet.</b>
              <p>Check official Government of Sindh admission and college announcements for the latest information.</p>
              <a href="https://college.sindh.gov.pk/" target="_blank" rel="noreferrer">Open official notices and resources <ArrowUpRight size={15}/></a>
            </div>
          </div>
        </section>

        <section className="gidc-portal-section" id="portals" data-reveal="up">
          <div className="gidc-container gidc-portal-grid">
            <div className="gidc-portal-copy">
              <span className="gidc-overline">COLLEGE DIGITAL SERVICES</span>
              <h2>One secure place for <em>your college work.</em></h2>
              <p>College systems are available to authorised users. Choose the sign-in route that matches your account. Access is granted by the college and depends on your assigned responsibilities.</p>
              <div className="gidc-portal-points"><span><ShieldCheck size={16}/> Account-based access</span><span><CheckCircle2 size={16}/> Personalised workspace</span></div>
            </div>
            <div className="gidc-portal-cards">
              {portalLinks.map(link => (
                <button type="button" className="gidc-portal-card" key={link.role} onClick={() => navigate('login', link.role)}>
                  <span className="gidc-portal-card-icon">{link.role === 'student' ? <GraduationCap size={20}/> : link.role === 'parent' ? <Users size={20}/> : link.role === 'teacher' ? <BookOpen size={20}/> : link.role === 'accountant' ? <Landmark size={20}/> : link.role === 'exam_officer' ? <CalendarDays size={20}/> : <ShieldCheck size={20}/>}</span>
                  <span className="gidc-portal-card-copy"><b>{link.title}</b><small>{link.note}</small></span>
                  <ArrowUpRight size={17}/>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="gidc-section gidc-official-links" id="official-links">
          <div className="gidc-container">
            <div className="gidc-section-heading"><div><span className="gidc-overline">OFFICIAL RESOURCES</span><h2>Useful links from <em>education authorities.</em></h2></div></div>
            <div className="gidc-link-grid">
              <a href="https://college.sindh.gov.pk/government-colleges" target="_blank" rel="noreferrer"><span><Landmark size={21}/></span><b>Government colleges directory</b><small>College Education Department, Government of Sindh</small><ExternalLink size={15}/></a>
              <a href="https://college.sindh.gov.pk/" target="_blank" rel="noreferrer"><span><Newspaper size={21}/></span><b>College Education Department</b><small>Notices and official college resources</small><ExternalLink size={15}/></a>
              <a href="https://usindh.edu.pk/colleges" target="_blank" rel="noreferrer"><span><GraduationCap size={21}/></span><b>University of Sindh colleges</b><small>University college directory</small><ExternalLink size={15}/></a>
            </div>
          </div>
        </section>

        <section className="gidc-section gidc-affiliations" id="affiliations" data-reveal="up">
          <div className="gidc-container">
            <div className="gidc-section-heading">
              <div><span className="gidc-overline">INSTITUTIONAL REFERENCES</span><h2>Our college and <em>education partners.</em></h2></div>
              <p>These marks identify the college itself and the public institutions whose directories provide reference information. They are not interchangeable logos.</p>
            </div>
            <div className="gidc-affiliation-grid">
              <a className="gidc-affiliation-card gidc-affiliation-college" href="#home" onClick={() => goTo('#home')}>
                <span className="gidc-affiliation-logo"><img src="/gidc-badin-official-logo.svg" alt="Government Islamia Degree College Badin official emblem"/></span>
                <span className="gidc-affiliation-copy"><small>COLLEGE IDENTITY</small><b>Government Islamia Degree College Badin</b><em>Official college emblem supplied for this website</em></span>
              </a>
              <a className="gidc-affiliation-card" href="https://usindh.edu.pk/colleges" target="_blank" rel="noreferrer">
                <span className="gidc-affiliation-logo"><img src="https://usindh.edu.pk/images/usindh/logo.png" alt="University of Sindh logo" loading="lazy"/></span>
                <span className="gidc-affiliation-copy"><small>UNIVERSITY DIRECTORY</small><b>University of Sindh</b><em>Its published 2024 affiliated-colleges directory includes Government Islamia College Badin.</em></span>
                <ExternalLink size={16}/>
              </a>
              <a className="gidc-affiliation-card" href="https://college.sindh.gov.pk/" target="_blank" rel="noreferrer">
                <span className="gidc-affiliation-logo"><img src="https://college.sindh.gov.pk/images/icons/logo-main.png" alt="College Education Department, Government of Sindh logo" loading="lazy"/></span>
                <span className="gidc-affiliation-copy"><small>PROVINCIAL DEPARTMENT</small><b>College Education Department</b><em>Government of Sindh · official college information and resources</em></span>
                <ExternalLink size={16}/>
              </a>
            </div>
            <div className="gidc-directory-link">
              <span><Landmark size={18}/> Government Colleges in Sindh</span>
              <a href="https://college.sindh.gov.pk/government-colleges" target="_blank" rel="noreferrer">Open the official district-wise directory <ArrowUpRight size={15}/></a>
            </div>
          </div>
        </section>

        <section className="gidc-contact" id="contact" data-reveal="up">
          <div className="gidc-container gidc-contact-grid">
            <div><span className="gidc-overline">GET IN TOUCH</span><h2>We’re here to help you <em>take the next step.</em></h2><p>For current admissions, subject combinations, office timings, certificates and official documents, please contact the college office directly.</p></div>
            <div className="gidc-contact-card">
              <span className="gidc-contact-icon"><Landmark size={24}/></span>
              <b>Government Islamia Degree College Badin</b>
              <span>Badin, Sindh, Pakistan</span>
              <a href="https://www.google.com/maps/search/?api=1&query=Government+Islamia+Degree+College+Badin" target="_blank" rel="noreferrer">Find the college on Maps <ArrowUpRight size={15}/></a>
              <small>Office telephone, email address and opening hours should be added here after verification by the college.</small>
            </div>
          </div>
        </section>
      </main>

      <footer className="gidc-footer">
        <div className="gidc-container gidc-footer-main">
          <a className="gidc-brand gidc-footer-brand" href="#home" onClick={() => goTo('#home')}>
            <img className="gidc-crest-image gidc-crest-image-footer" src="/gidc-badin-official-logo.svg" alt="Official Government Islamia Degree College Badin emblem"/>
            <span className="gidc-brand-copy"><strong>Government Islamia</strong><b>Degree College Badin</b><small>LEARNING · SERVICE · OPPORTUNITY</small></span>
          </a>
          <p>A public degree college in Badin, Sindh. This website is designed to make verified college information and authorised digital services easier to reach.</p>
          <div className="gidc-footer-links"><a href="#about">About</a><a href="#programmes">Programmes</a><a href="#admissions">Admissions</a><a href="#gallery">Gallery</a><a href="#affiliations">Official links</a><a href="#notices">Notices</a><a href="#portals">College portal</a></div>
        </div>
        <div className="gidc-footer-bottom"><div className="gidc-container"><span>© {new Date().getFullYear()} Government Islamia Degree College Badin</span><span>Official information should be confirmed with the college office.</span><a href="#home">Back to top ↑</a></div></div>
      </footer>

      {portalOpen && (
        <div className="gidc-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPortalOpen(false) }}>
          <section className="gidc-portal-modal" role="dialog" aria-modal="true" aria-labelledby="gidc-modal-title">
            <button className="gidc-modal-close" type="button" aria-label="Close portal options" onClick={() => setPortalOpen(false)}><X size={20}/></button>
            <span className="gidc-overline">SECURE COLLEGE ACCESS</span>
            <h2 id="gidc-modal-title">Choose your portal</h2>
            <p>Sign in using the account provided or approved by the college.</p>
            <div className="gidc-modal-links">
              {portalLinks.map(link => <button type="button" key={link.role} onClick={() => navigate('login', link.role)}><span><b>{link.title}</b><small>{link.note}</small></span><ArrowRight size={17}/></button>)}
            </div>
            <small className="gidc-modal-foot">New accounts and role changes are handled by authorised college administration.</small>
          </section>
        </div>
      )}
    </div>
  )
}
