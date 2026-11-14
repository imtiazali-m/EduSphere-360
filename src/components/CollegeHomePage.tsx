import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, CheckCircle2,
  ExternalLink, Facebook, GraduationCap, Landmark, LibraryBig, Mail, MapPin, Menu,
  Microscope, Newspaper, Pause, Play, Send, ShieldCheck, Users, X,
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
  { label: 'Complaints & contact', href: '#contact' },
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
  facebookCampus: 'https://scontent-atl3-1.xx.fbcdn.net/v/t39.30808-6/837326798_1563832948879337_8955334978266408820_n.jpg?stp=c0.139.843.843a_dst-jpg_tt6&cstp=mx843x843&ctp=s160x160&_nc_cat=100&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=8a6525&_nc_ohc=dpSnJfh7LCgQ7kNvwFZu_6i&_nc_oc=AdqW63zCMRB-wa4vsMZSR0ln5BY1KXhhRD0VjDTtPquEwaz_3vuTIRzq0HbM0htq9yA&_nc_zt=23&_nc_ht=scontent-atl3-1.xx&_nc_gid=DIwOg7xMwvJcuDoTTfZ3KA&_nc_ss=7b289&oh=00_AQTwXnpsAqiO65H_FdKptMXc8w23lnvR3FxzuTqsKCeRmA&oe=6AFD9874',
  facebookCommunity: 'https://scontent-atl3-1.xx.fbcdn.net/v/t39.30808-6/829492494_1560229799239652_2457396095144441737_n.jpg?stp=c0.138.862.862a_dst-jpg_tt6&cstp=mx862x862&ctp=s160x160&_nc_cat=105&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=8a6525&_nc_ohc=3HCW0AQl_9YQ7kNvwEn0zH_&_nc_oc=AdpD797cCL_N2cZSgsmqhRGPsXcrSWUAt8mH0fnbeq2yTEPQ-7rlt5FQBU4RSImtMP8&_nc_zt=23&_nc_ht=scontent-atl3-1.xx&_nc_gid=DIwOg7xMwvJcuDoTTfZ3KA&_nc_ss=7b289&oh=00_AQQa4m2j2tPDa76uWY-94M9V_vS3beNIvUYeQ85TwlD--w&oe=6AFDA51E',
  facebookEvent: 'https://scontent-atl3-1.xx.fbcdn.net/v/t39.30808-6/831568121_1560219499240682_1759028695435918981_n.jpg?stp=c0.161.1048.1048a_dst-jpg_tt6&cstp=mx1048x1048&ctp=s160x160&_nc_cat=104&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=8a6525&_nc_ohc=ICJj61035ZAQ7kNvwFadnAm&_nc_oc=AdrhqMEt8IvtqkW241kvhUxSs5OWOiB2hrnmmFX5DNO6LBW9pOa7p9I-MEzr3Qj1DFw&_nc_zt=23&_nc_ht=scontent-atl3-1.xx&_nc_gid=DIwOg7xMwvJcuDoTTfZ3KA&_nc_ss=7b289&oh=00_AQSWMcX3IXnoskQaAWWGwYduL-iH9FEp8IftmUpDgflV4Q&oe=6AFD9E24',
}

type GallerySlide = { src: string; fallback: string; alt: string; title: string; label: string; note: string; source?: string }

const gallerySlides: GallerySlide[] = [
  { src: photo.collegeDirectory, fallback: photo.classroom, alt: 'A building and courtyard shown in a public directory photograph associated with Government Islamia Degree College Badin.', title: 'A view associated with the college', label: 'PUBLIC DIRECTORY PHOTOGRAPH', note: 'This image appears on a public listing. Its date and the present condition of the campus have not been independently confirmed.', source: 'https://pk.worldorgs.com/catalog/badin/college/government-islamia-degree-college-badin' },
  { src: photo.facebookCampus, fallback: photo.students, alt: 'Photograph shared on the college public Facebook photo page.', title: 'From the college community', label: 'COLLEGE FACEBOOK PHOTO', note: 'This image is linked from the college public photo page. Open the source page for its original post and context.', source: 'https://www.facebook.com/GIDCBadin/photos' },
  { src: photo.facebookCommunity, fallback: photo.graduates, alt: 'A photograph shared by Government Islamia Degree College Badin on its public Facebook page.', title: 'College moments and memories', label: 'COLLEGE FACEBOOK PHOTO', note: 'A public photo linked from the college Facebook page.', source: 'https://www.facebook.com/GIDCBadin/photos' },
  { src: photo.facebookEvent, fallback: photo.classroom, alt: 'A college-related photograph published on the public Facebook page.', title: 'Learning and participation', label: 'COLLEGE FACEBOOK PHOTO', note: 'A public photo linked from the college Facebook page.', source: 'https://www.facebook.com/GIDCBadin/photos' },
  { src: photo.students, fallback: photo.study, alt: 'Representative photograph of students collaborating on coursework.', title: 'Learn with curiosity', label: 'REPRESENTATIVE EDUCATION IMAGE', note: 'Illustrative education imagery; not a verified photograph of this college.' },
  { src: photo.science, fallback: photo.classroom, alt: 'Representative science-learning photograph.', title: 'Ask questions. Discover more.', label: 'REPRESENTATIVE EDUCATION IMAGE', note: 'Illustrative science imagery; current facilities should be confirmed with the college.' },
  { src: photo.library, fallback: photo.study, alt: 'Representative library photograph.', title: 'Make room for reading', label: 'REPRESENTATIVE EDUCATION IMAGE', note: 'Illustrative library imagery; not a confirmed photograph of the college library.' },
  { src: photo.graduates, fallback: photo.students, alt: 'Representative graduation photograph.', title: 'Every step moves you forward', label: 'REPRESENTATIVE EDUCATION IMAGE', note: 'Illustrative graduation imagery; not a photograph of a college ceremony.' },
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
  const [complaintName, setComplaintName] = useState('')
  const [complaintEmail, setComplaintEmail] = useState('')
  const [complaintType, setComplaintType] = useState('Admission enquiry')
  const [complaintMessage, setComplaintMessage] = useState('')
  const [complaintNotice, setComplaintNotice] = useState('')

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
    }, 4800)
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

  const submitComplaint = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const subject = 'GIDC Badin website complaint — ' + complaintType
    const body = [
      'Name: ' + complaintName.trim(),
      'Reply email: ' + complaintEmail.trim(),
      'Category: ' + complaintType,
      '',
      'Message:',
      complaintMessage.trim(),
      '',
      'Sent through the Government Islamia Degree College Badin website.',
    ].join('\n')
    const mailto = 'mailto:gidcbadin@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body)
    window.location.href = mailto
    setComplaintNotice('Your email application should open with this message prepared. Review it and press Send to deliver your complaint to the college.')
  }

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
                <img src={photo.collegeDirectory} alt="Public directory photograph associated with Government Islamia Degree College Badin." onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = photo.students }}/>
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
              <p>Government Islamia Degree College Badin is listed in the Government of Sindh’s district-wise government-colleges directory, where Science is the stream shown for the college. It is also named in the University of Sindh’s published 2024 directory of affiliated colleges.</p>
              <p>This website brings admissions links, official references, public updates and secure college services together in one place for students, families, teachers and staff.</p>
              <p>For current subject combinations, merit criteria and admission dates, use the latest college and Government of Sindh notices.</p>
              <a className="gidc-text-link" href="https://college.sindh.gov.pk/government-colleges" target="_blank" rel="noreferrer">View Government of Sindh college directory <ExternalLink size={15}/></a>
            </div>
            <div className="gidc-about-art">
              <div className="gidc-about-image gidc-about-image-main">
                <img src={photo.facebookCampus} alt="A photo shared on the college’s public Facebook page." onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = photo.library }}/>
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
                  <p>The Government of Sindh’s college directory lists Science for Government Islamia Degree College Badin. Check the latest notice for current subject combinations and eligibility.</p>
                  <a href="https://college.sindh.gov.pk/government-colleges" target="_blank" rel="noreferrer">Check official college listing <ExternalLink size={14}/></a>
                </div>
              </article>
              <article className="gidc-programme-card gidc-programme-guidance">
                <div className="gidc-guidance-art"><BookOpen size={37}/><span>YOUR NEXT STEP</span></div>
                <div className="gidc-programme-body">
                  <span className="gidc-programme-index">02 / ADMISSION GUIDANCE</span>
                  <h3>Subject combinations & degree routes</h3>
                  <p>The University of Sindh’s 2024 affiliated-colleges directory includes Government Islamia College Badin. Use the University’s current notices for programme-specific degree details.</p>
                  <a href="https://usindh.edu.pk/colleges" target="_blank" rel="noreferrer">University of Sindh directory <ExternalLink size={14}/></a>
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
                <a className="gidc-button gidc-button-gold" href="https://seccap.ced.gos.pk/" target="_blank" rel="noreferrer">Open SECCAP admissions <ExternalLink size={15}/></a>
                <a className="gidc-text-link" href="https://college.sindh.gov.pk/government-colleges" target="_blank" rel="noreferrer">Government colleges directory <ArrowUpRight size={15}/></a><a className="gidc-text-link" href="https://www.facebook.com/GIDCBadin/" target="_blank" rel="noreferrer">College updates on Facebook <Facebook size={15}/></a>
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
                <img src={photo.facebookCommunity} alt="A photograph shared on the college’s public Facebook page." onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = photo.students }}/>
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
            <p className="gidc-image-disclaimer">This collection includes public photos linked from the college Facebook page and a public directory, alongside clearly labelled representative education imagery.</p>
          </div>
        </section>

        <section className="gidc-section gidc-gallery" id="gallery" data-reveal="up">
          <div className="gidc-container">
            <div className="gidc-gallery-heading">
              <div>
                <span className="gidc-overline">A CLOSER LOOK</span>
                <h2>Education, community <em>and campus life.</em></h2>
                <p>Explore photographs linked from the college public page and public directory, alongside representative education imagery. Captions identify each image source.</p>
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
                    <img src={slide.src} alt={slide.alt} loading="lazy" decoding="async" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = slide.fallback }}/>
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
              <span>Auto-advances every 4.8 seconds</span>
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
            <div className="gidc-notice-empty gidc-notice-feature">
              <span className="gidc-notice-icon"><Newspaper size={26}/></span>
              <span className="gidc-notice-label">OFFICIAL COLLEGE UPDATES</span>
              <b>Stay close to the latest college news.</b>
              <p>Admission announcements, enrolment reminders, event photographs and student notices are shared on the college’s public Facebook page. Check the original post for dates and instructions before taking action.</p>
              <div className="gidc-notice-actions">
                <a href="https://www.facebook.com/GIDCBadin/" target="_blank" rel="noreferrer">Open college Facebook page <Facebook size={15}/></a>
                <a href="https://seccap.ced.gos.pk/" target="_blank" rel="noreferrer">SECCAP admission portal <ExternalLink size={15}/></a>
              </div>
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
            <div className="gidc-section-heading"><div><span className="gidc-overline">OFFICIAL RESOURCES</span><h2>Find your next step <em>through trusted links.</em></h2></div><p>Use the college and university directories for reference, and SECCAP for the official Class XI centralised admission process.</p></div>
            <div className="gidc-link-grid">
              <a href="https://seccap.ced.gos.pk/" target="_blank" rel="noreferrer"><span><GraduationCap size={21}/></span><b>SECCAP admissions</b><small>Official centralised Class XI admission portal</small><ExternalLink size={15}/></a><a href="https://college.sindh.gov.pk/government-colleges" target="_blank" rel="noreferrer"><span><Landmark size={21}/></span><b>Government colleges directory</b><small>College Education Department, Government of Sindh</small><ExternalLink size={15}/></a>
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
          <div className="gidc-container">
            <div className="gidc-contact-heading">
              <span className="gidc-overline">CONTACT · FEEDBACK · COMPLAINTS</span>
              <h2>Your voice matters. <em>We are ready to listen.</em></h2>
              <p>Contact the college for admissions and general enquiries, or prepare a complaint email for the college office. Include a reply email so the administration can respond.</p>
            </div>
            <div className="gidc-contact-grid">
              <div className="gidc-contact-side">
                <div className="gidc-contact-card">
                  <span className="gidc-contact-icon"><Mail size={24}/></span>
                  <small className="gidc-contact-label">PUBLIC COLLEGE PAGE EMAIL</small>
                  <b>Write to the college</b>
                  <a href="mailto:gidcbadin@gmail.com">gidcbadin@gmail.com <ArrowUpRight size={15}/></a>
                  <small>For admissions, records, certificates, general questions and complaints.</small>
                </div>
                <div className="gidc-contact-card gidc-contact-card-social">
                  <span className="gidc-contact-icon"><Facebook size={24}/></span>
                  <small className="gidc-contact-label">PUBLIC COLLEGE UPDATES</small>
                  <b>Follow GIDC Badin</b>
                  <span>Photographs, public announcements and college updates.</span>
                  <a href="https://www.facebook.com/GIDCBadin/" target="_blank" rel="noreferrer">Open the college Facebook page <ExternalLink size={15}/></a>
                </div>
                <div className="gidc-contact-card gidc-contact-card-map">
                  <span className="gidc-contact-icon"><MapPin size={24}/></span>
                  <small className="gidc-contact-label">LOCATION</small>
                  <b>Government Islamia Degree College Badin</b>
                  <span>Badin, Sindh, Pakistan</span>
                  <a href="https://www.google.com/maps/search/?api=1&query=Government+Islamia+Degree+College+Badin" target="_blank" rel="noreferrer">Find the college on Maps <ArrowUpRight size={15}/></a>
                </div>
              </div>
              <form className="gidc-complaint-form" onSubmit={submitComplaint}>
                <div className="gidc-complaint-form-heading">
                  <span><Send size={18}/></span>
                  <div><small>COLLEGE FEEDBACK DESK</small><h3>Send a complaint or enquiry</h3><p>Your message will be prepared for the college email address. Review it before sending.</p></div>
                </div>
                <div className="gidc-complaint-fields">
                  <label>Full name
                    <input type="text" name="name" autoComplete="name" placeholder="Your full name" value={complaintName} onChange={event => setComplaintName(event.target.value)} required maxLength={100}/>
                  </label>
                  <label>Your email address
                    <input type="email" name="email" autoComplete="email" placeholder="you@example.com" value={complaintEmail} onChange={event => setComplaintEmail(event.target.value)} required maxLength={180}/>
                  </label>
                  <label className="gidc-complaint-category">Reason for contacting
                    <select name="category" value={complaintType} onChange={event => setComplaintType(event.target.value)}>
                      <option>Admission enquiry</option>
                      <option>Academic matter</option>
                      <option>Student support</option>
                      <option>Staff or service complaint</option>
                      <option>Campus or facility concern</option>
                      <option>Other feedback</option>
                    </select>
                  </label>
                  <label className="gidc-complaint-message">Complaint or message
                    <textarea name="message" rows={6} placeholder="Write your concern or enquiry clearly. Include dates or reference numbers where useful." value={complaintMessage} onChange={event => setComplaintMessage(event.target.value)} required maxLength={5000}/>
                  </label>
                </div>
                <button className="gidc-button gidc-button-gold gidc-complaint-submit" type="submit">Prepare email to the college <Send size={16}/></button>
                <p className="gidc-complaint-privacy">Your email application opens with the details filled in. Press Send there to deliver it. Please do not include passwords, identity documents, financial details or other sensitive personal information.</p>
                {complaintNotice && <p className="gidc-complaint-status" role="status">{complaintNotice}</p>}
              </form>
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
          <p>A public degree college in Badin, Sindh. Find admissions, official education links, college updates, contact details and secure digital services.</p>
          <div className="gidc-footer-links"><a href="#about">About</a><a href="#programmes">Programmes</a><a href="#admissions">Admissions</a><a href="#gallery">Gallery</a><a href="#affiliations">Official links</a><a href="#notices">Notices</a><a href="#contact">Complaints</a><a href="#portals">College portal</a></div>
        </div>
        <div className="gidc-footer-bottom"><div className="gidc-container"><span>© {new Date().getFullYear()} Government Islamia Degree College Badin</span><span>For current notices, visit the college and Government of Sindh links above.</span><a href="#home">Back to top ↑</a></div></div>
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
