import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ExternalLink,
  Facebook, FileText, GraduationCap, Landmark, Mail, MapPin, Menu,
  Newspaper, Phone, School, ShieldCheck, Users, X, Microscope, Image as ImageIcon,
  Building2, Award, BookMarked, Compass,
} from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import type { AppRole } from '../lib/types'
import { supabase } from '../lib/supabase'
import '../styles/college-home-page.css'

type Props = {
  navigate: (screen: 'welcome' | 'login' | 'setup', role?: AppRole) => void
  initialSection?: string
}

type FacultyProfile = {
  id: string
  full_name: string
  department?: string | null
  subject?: string | null
  is_principal?: boolean
  public_designation?: string | null
  public_qualification?: string | null
  public_bio?: string | null
  public_photo_url?: string | null
  public_profile_order?: number
}

type WebsitePhoto = {
  id: string
  title: string
  category: string
  imageUrl: string
  sourceUrl?: string
  published?: boolean
  alt?: string
}

type WebsiteNews = { id: string; title: string; body: string; date?: string; url?: string; published?: boolean; imageUrl?: string }
type MagazineIssue = { id: string; title: string; issue?: string; year?: string; pdfUrl: string; coverUrl?: string; published?: boolean }
type AcademicProgram = { id: string; title: string; detail?: string; officialUrl?: string }

type WebsiteContent = {
  heroHeading?: string
  heroText?: string
  heroPhotoUrl?: string
  heroPhotoSource?: string
  aboutText?: string
  aboutMission?: string
  principalMessage?: string
  campusIntro?: string
  facilities?: string[]
  contactPhone?: string
  contactEmail?: string
  contactAddress?: string
  contactWebsite?: string
  accentColor?: string
  programs?: AcademicProgram[]
  gallery?: WebsitePhoto[]
  news?: WebsiteNews[]
  magazines?: MagazineIssue[]
  approvedFacebookPhotoIds?: string[]
}

const PUBLIC_INSTITUTION_IDS = [
  '20b0493c-1e73-421f-91f0-6868eeadd838',
  '1df694ac-22c1-4b5c-a2c3-a176382511bf',
]

const DEFAULT_CONTENT: WebsiteContent = {
  heroHeading: 'Government Islamia Degree College Badin',
  heroText: 'A government degree college serving the Badin community.',
  aboutText: 'Government Islamia Degree College Badin is listed in the Government of Sindh district-wise directory of government colleges. The directory lists Science as the stream for the college.',
  aboutMission: '',
  campusIntro: '',
  facilities: [],
  programs: [{ id: 'science', title: 'Science', detail: 'Listed for Government Islamia Degree College Badin in the Government of Sindh government-colleges directory.', officialUrl: 'https://college.sindh.gov.pk/government-colleges' }],
  gallery: [
    { id: 'gidc-event-guidance-05', title: 'Student guidance session', category: 'college-events', imageUrl: '/gidc-badin/events/student-guidance-session-event-05.webp', alt: 'Teacher guiding students during a college session', published: true }
  ],
  news: [],
  magazines: [],
  approvedFacebookPhotoIds: [],
}

const pages = [
  { id: 'home', label: 'Home', icon: Landmark },
  { id: 'about', label: 'About', icon: Building2 },
  { id: 'academics', label: 'Academics', icon: BookOpen },
  { id: 'principal', label: 'Principal', icon: Award },
  { id: 'faculty', label: 'Faculty', icon: Users },
  { id: 'departments', label: 'Faculty arrangement', icon: Users },
  { id: 'campus', label: 'Campus', icon: School },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'content', label: 'News & announcements', icon: Newspaper },
  { id: 'gallery', label: 'Gallery', icon: ImageIcon },
  { id: 'emagazine', label: 'E-magazine', icon: BookMarked },
  { id: 'contact', label: 'Contact', icon: MapPin },
]

function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function goToPage(id: string) {
  window.location.hash = '#/public/' + id
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function PhotoCard({ item }: { item: WebsitePhoto }) {
  return (
    <article className="gidc-photo-card">
      <div className="gidc-photo-card-image">
        <img src={item.imageUrl} alt={item.alt || item.title} loading="lazy" />
      </div>
      <div className="gidc-photo-card-copy">
        <span>{item.category.replaceAll('-', ' ')}</span>
        <h3>{item.title}</h3>
        {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Original source <ExternalLink size={14}/></a>}
      </div>
    </article>
  )
}

export function CollegeHomePage({ navigate, initialSection }: Props) {
  const page = pages.some(item => item.id === initialSection) ? initialSection! : 'home'
  const [content, setContent] = useState<WebsiteContent>(DEFAULT_CONTENT)
  const [faculty, setFaculty] = useState<FacultyProfile[]>([])
  const [internalNews, setInternalNews] = useState<WebsiteNews[]>([])
  const [principal, setPrincipal] = useState<FacultyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let live = true
    async function loadPublicContent(showLoading = false) {
      if (showLoading) setLoading(true)
      setLoadError('')
      if (!supabase) {
        if (live) {
          setLoading(false)
          setLoadError('The public content service is not connected.')
        }
        return
      }
      try {
        const [settingsResult, facultyResult, announcementsResult] = await Promise.all([
          supabase.from('institution_settings')
            .select('setting_value, updated_at')
            .in('institution_id', PUBLIC_INSTITUTION_IDS)
            .eq('category', 'website')
            .eq('setting_key', 'public_site')
            .eq('is_public', true)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('teachers')
            .select('id,institution_id,full_name,department,subject,is_public_profile,is_principal,public_designation,public_qualification,public_bio,public_photo_url,public_profile_order')
            .in('institution_id', PUBLIC_INSTITUTION_IDS)
            .eq('is_public_profile', true)
            .order('public_profile_order', { ascending: true })
            .order('full_name', { ascending: true }),
          supabase.from('announcements')
            .select('id,title,body,created_at,published_at')
            .in('institution_id', PUBLIC_INSTITUTION_IDS)
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(50),
        ])
        if (settingsResult.error) throw settingsResult.error
        if (facultyResult.error) throw facultyResult.error
        if (announcementsResult.error) throw announcementsResult.error
        const saved = (settingsResult.data?.setting_value ?? {}) as WebsiteContent
        const merged = { ...DEFAULT_CONTENT, ...saved }
        const profiles = (facultyResult.data ?? []) as FacultyProfile[]
        const publicNotices: WebsiteNews[] = (announcementsResult.data ?? []).map(item => ({
          id: 'internal-' + item.id,
          title: String(item.title),
          body: String(item.body),
          date: new Date(item.published_at || item.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }),
          published: true,
        }))
        if (live) {
          setContent(merged)
          setFaculty(profiles.filter(item => item.is_principal !== true))
          setPrincipal(profiles.find(item => item.is_principal === true) ?? null)
          setInternalNews(publicNotices)
        }
      } catch (error) {
        if (live) setLoadError(error instanceof Error ? error.message : 'Public college information could not be loaded.')
      } finally {
        if (live && showLoading) setLoading(false)
      }
    }
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadPublicContent(false)
    }
    void loadPublicContent(true)
    window.addEventListener('focus', refresh)
    const refreshTimer = window.setInterval(refresh, 60000)
    return () => {
      live = false
      window.removeEventListener('focus', refresh)
      window.clearInterval(refreshTimer)
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [page])

  const galleryItems = useMemo(() => {
    const uploaded = (content.gallery ?? []).filter(item => item.published !== false && Boolean(item.imageUrl))
    return uploaded
  }, [content])

  const news = [...internalNews, ...(content.news ?? []).filter(item => item.published !== false)]
  const magazines = (content.magazines ?? []).filter(item => item.published !== false)
  const programmeList = content.programs?.length ? content.programs : DEFAULT_CONTENT.programs ?? []
  const facultyGroups = useMemo(() => {
    const grouped = new Map<string, FacultyProfile[]>()
    faculty.forEach(person => {
      const key = String(person.department || 'Department not entered').trim()
      grouped.set(key, [...(grouped.get(key) ?? []), person])
    })
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [faculty])
  const eventPhotos = galleryItems.filter(item => item.category === 'college-events' || item.category === 'campus-activities')
  const contactAddress = textValue(content.contactAddress, 'Badin, Sindh, Pakistan')
  const contactEmail = textValue(content.contactEmail)
  const contactPhone = textValue(content.contactPhone)
  const mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Government Islamia Degree College Badin')

  const header = (
    <>
      <div className="gidc-public-topline">
        <div className="gidc-public-shell gidc-public-topline-inner">
          <span><Landmark size={14}/> Government college · Badin, Sindh</span>
          <span><MapPin size={14}/> Badin, Pakistan</span>
        </div>
      </div>
      <header className="gidc-public-header">
        <div className="gidc-public-shell gidc-public-header-inner">
          <a className="gidc-public-brand" href="#/public/home" onClick={event => { event.preventDefault(); goToPage('home') }}>
            <img src="/gidc-badin-official-logo.svg" alt="Government Islamia Degree College Badin official crest"/>
            <span>
              <strong>GOVERNMENT ISLAMIA</strong>
              <b>DEGREE COLLEGE BADIN</b>
              <small>BADIN · SINDH · PAKISTAN</small>
            </span>
          </a>
          <PublicNavigation activePage={page}/>
          <div className="gidc-public-header-actions">
            <button type="button" className="gidc-public-login" onClick={() => navigate('login')}>
              <ShieldCheck size={16}/> Log in
            </button>
          </div>
        </div>
      </header>
    </>
  )

  const footer = (
    <footer className="gidc-public-footer">
      <div className="gidc-public-shell gidc-public-footer-grid">
        <div className="gidc-public-footer-brand">
          <img src="/gidc-badin-official-logo.svg" alt="Official GIDC Badin crest"/>
          <div><strong>Government Islamia Degree College Badin</strong><span>Badin, Sindh, Pakistan</span></div>
        </div>
        <div className="gidc-public-footer-links">
          {pages.map(item => <a key={item.id} href={'#/public/' + item.id} onClick={event => { event.preventDefault(); goToPage(item.id) }}>{item.label}</a>)}
        </div>
        <div className="gidc-public-footer-social">
          <a href="https://www.facebook.com/GIDCBadin/" target="_blank" rel="noreferrer"><Facebook size={17}/> Official Facebook page</a>
          <a href={mapUrl} target="_blank" rel="noreferrer"><MapPin size={17}/> Find the college</a>
          <button type="button" onClick={() => navigate('login')}>College portal <ArrowUpRight size={15}/></button>
        </div>
      </div>
      <div className="gidc-public-footer-bottom">
        <div className="gidc-public-shell"><span>© {new Date().getFullYear()} Government Islamia Degree College Badin</span><span>Official college information and public notices</span></div>
      </div>
    </footer>
  )

  return (
    <div className="gidc-public-site" style={{ '--gidc-accent': content.accentColor || '#176342' } as CSSProperties}>
      {header}
      <main>
        {loadError && <div className="gidc-public-shell"><p className="gidc-public-error" role="status">{loadError}</p></div>}
        {page === 'home' && (
          <>
            <section className="gidc-public-hero">
              <div className="gidc-public-shell gidc-public-hero-grid">
                <div className="gidc-public-hero-copy">
                  <span className="gidc-public-eyebrow"><i/> GOVERNMENT DEGREE COLLEGE · BADIN</span>
                  <h1>{textValue(content.heroHeading, 'Government Islamia Degree College Badin')}</h1>
                  <p>{textValue(content.heroText, 'A government degree college serving the Badin community.')}</p>
                  <div className="gidc-public-hero-actions">
                    <button type="button" onClick={() => goToPage('academics')}>Explore academics <ArrowRight size={18}/></button>
                    <button type="button" className="gidc-public-hero-secondary" onClick={() => goToPage('campus')}>Explore the campus <Compass size={17}/></button>
                  </div>
                  <div className="gidc-public-hero-tags">
                    <span><ShieldCheck size={16}/> Government institution</span>
                    <span><MapPin size={16}/> Badin, Sindh</span>
                  </div>
                </div>
                <div className="gidc-public-hero-visual">
                  {content.heroPhotoUrl ? (
                    <img className="gidc-public-hero-photo" src={content.heroPhotoUrl} alt="Approved photograph of Government Islamia Degree College Badin"/>
                  ) : (
                    <div className="gidc-public-hero-emblem">
                      <span className="gidc-public-emblem-orbit gidc-orbit-one"/>
                      <span className="gidc-public-emblem-orbit gidc-orbit-two"/>
                      <img src="/gidc-badin-official-logo.svg" alt="Official college crest"/>
                      <strong>GIDC</strong><small>BADIN · SINDH</small>
                    </div>
                  )}
                  {principal?.public_photo_url && (
                    <div className="gidc-public-principal-teaser">
                      <img src={principal.public_photo_url} alt={principal.full_name}/>
                      <span><small>PRINCIPAL</small><b>{principal.full_name}</b><em>{principal.public_designation || 'Principal'}</em></span>
                    </div>
                  )}
                  <div className="gidc-public-hero-location"><MapPin size={17}/><span>Badin, Sindh, Pakistan</span></div>
                </div>
              </div>
            </section>
            <section className="gidc-public-quicklinks">
              <div className="gidc-public-shell gidc-public-quicklink-grid">
                {[
                  { id: 'academics', title: 'Academic programmes', detail: 'Explore the college academic stream and admission links.', icon: BookOpen, tone: 'green' },
                  { id: 'campus', title: 'Campus & facilities', detail: 'Campus location, approved photographs and facilities.', icon: School, tone: 'blue' },
                  { id: 'content', title: 'Official updates', detail: 'College announcements and admission notices.', icon: Newspaper, tone: 'gold' },
                  { id: 'gallery', title: 'College gallery', detail: 'Campus, activities, events and student-life photographs.', icon: ImageIcon, tone: 'rose' },
                ].map(item => <button type="button" className={'gidc-public-quick-card tone-' + item.tone} key={item.id} onClick={() => goToPage(item.id)}>
                  <span><item.icon size={23}/></span><b>{item.title}</b><small>{item.detail}</small><em>Open page <ArrowUpRight size={14}/></em>
                </button>)}
              </div>
            </section>
            {principal && (
              <section className="gidc-public-principal-band">
                <div className="gidc-public-shell gidc-public-principal-band-inner">
                  {principal.public_photo_url && <img src={principal.public_photo_url} alt={principal.full_name}/>}
                  <div><span className="gidc-public-eyebrow">MESSAGE FROM THE PRINCIPAL</span><h2>{principal.full_name}</h2><p>{textValue(content.principalMessage, principal.public_bio || '')}</p><button type="button" onClick={() => goToPage('principal')}>Principal's profile <ArrowRight size={16}/></button></div>
                </div>
              </section>
            )}
            {news.length > 0 && <section className="gidc-public-section gidc-public-section-soft">
              <div className="gidc-public-shell"><SectionHeading eyebrow="COLLEGE NEWS" title="Official notices & updates" intro="Published information from the college." action={() => goToPage('content')}/>
                <div className="gidc-public-news-grid">{news.slice(0, 3).map(item => <NewsCard key={item.id} item={item}/>)}</div>
              </div>
            </section>}
            {galleryItems.length > 0 && <section className="gidc-public-section">
              <div className="gidc-public-shell"><SectionHeading eyebrow="COLLEGE PHOTOGRAPHS" title="A look around GIDC Badin" intro="Photographs approved for publication by the college." action={() => goToPage('gallery')}/>
                <div className="gidc-public-photo-grid">{galleryItems.slice(0, 3).map(item => <PhotoCard key={item.id} item={item}/>)}</div>
              </div>
            </section>}
          </>
        )}

        {page === 'about' && (
          <PageFrame eyebrow="THE INSTITUTION" title="About the college" lead="Government Islamia Degree College Badin" icon={Landmark}>
            <div className="gidc-public-about-layout">
              <div className="gidc-public-rich-copy">
                <p>{textValue(content.aboutText, textValue(DEFAULT_CONTENT.aboutText))}</p>
                {content.aboutMission && <blockquote>{content.aboutMission}</blockquote>}
                <a className="gidc-public-inline-link" href="https://college.sindh.gov.pk/government-colleges" target="_blank" rel="noreferrer">Government of Sindh college directory <ExternalLink size={15}/></a>
                <a className="gidc-public-inline-link" href="https://usindh.edu.pk/colleges" target="_blank" rel="noreferrer">University of Sindh colleges directory <ExternalLink size={15}/></a>
              </div>
              <div className="gidc-public-about-side">
                <div><span><Landmark size={22}/></span><small>INSTITUTION TYPE</small><b>Government degree college</b></div>
                <div><span><MapPin size={22}/></span><small>LOCATION</small><b>Badin, Sindh, Pakistan</b></div>
                <div><span><BookOpen size={22}/></span><small>OFFICIAL STREAM LISTING</small><b>Science</b></div>
              </div>
            </div>
          </PageFrame>
        )}

        {page === 'academics' && (
          <PageFrame eyebrow="LEARNING & ADMISSIONS" title="Academic information" lead="Academic pathways and official admission resources." icon={BookOpen}>
            <div className="gidc-public-academic-grid">
              {programmeList.map(program => <article className="gidc-public-academic-card" key={program.id}>
                <span><Microscope size={28}/></span><small>ACADEMIC STREAM</small><h3>{program.title}</h3><p>{program.detail}</p>
                {program.officialUrl && <a href={program.officialUrl} target="_blank" rel="noreferrer">Official information <ExternalLink size={14}/></a>}
              </article>)}
              <article className="gidc-public-academic-card gidc-academic-admission">
                <span><GraduationCap size={28}/></span><small>ADMISSIONS</small><h3>Admission notices</h3><p>Use the current college announcement and official admission instructions for dates, eligibility and required documents.</p>
                <a href="https://seccap.ced.gos.pk/" target="_blank" rel="noreferrer">Open SECCAP <ExternalLink size={14}/></a>
              </article>
            </div>
            <div className="gidc-public-source-note">The Government of Sindh directory currently lists Science for Government Islamia Degree College Badin. <a href="https://college.sindh.gov.pk/government-colleges" target="_blank" rel="noreferrer">View the official directory <ExternalLink size={13}/></a></div>
          </PageFrame>
        )}

        {page === 'principal' && (
          <PageFrame eyebrow="COLLEGE LEADERSHIP" title="Principal" lead="Principal's profile and message." icon={Award}>
            {principal ? (
              <div className="gidc-public-principal-profile">
                <div className="gidc-public-principal-portrait">{principal.public_photo_url ? <img src={principal.public_photo_url} alt={principal.full_name}/> : <img src="/gidc-badin-official-logo.svg" alt="GIDC Badin official crest"/>}</div>
                <div><span className="gidc-public-pill">PRINCIPAL</span><h2>{principal.full_name}</h2><h3>{principal.public_designation || 'Principal'}</h3>{principal.public_qualification && <p className="gidc-public-qualification">{principal.public_qualification}</p>}<p>{textValue(content.principalMessage, principal.public_bio || '')}</p></div>
              </div>
            ) : <EmptyState icon={Award} title="Principal profile" detail="No principal profile is currently published."/>}
          </PageFrame>
        )}

        {page === 'faculty' && (
          <PageFrame eyebrow="TEACHING & ACADEMIC STAFF" title="Faculty directory" lead="Faculty profiles published by the college." icon={Users}>
            {faculty.length > 0 ? <div className="gidc-public-faculty-grid">{faculty.map(person => <article className="gidc-public-faculty-card" key={person.id}>
              <div className="gidc-public-faculty-photo">{person.public_photo_url ? <img src={person.public_photo_url} alt={person.full_name}/> : <Users size={38}/>}</div>
              <div className="gidc-public-faculty-info"><h3>{person.full_name}</h3><b>{person.public_designation || person.subject || 'Faculty member'}</b><span>{person.department || 'Department'}</span>{person.public_qualification && <small>{person.public_qualification}</small>}{person.public_bio && <p>{person.public_bio}</p>}</div>
            </article>)}</div> : <EmptyState icon={Users} title="Faculty directory" detail="No faculty profiles are currently published."/>}
          </PageFrame>
        )}

        {page === 'departments' && (
          <PageFrame eyebrow="ACADEMIC STRUCTURE" title="Faculty arrangement" lead="Publicly approved faculty grouped using the department information in the internal employee register." icon={Users}>
            {facultyGroups.length > 0 ? <div className="gidc-public-department-groups">{facultyGroups.map(([department, people]) => (
              <section className="gidc-public-department-group" key={department}>
                <div className="gidc-public-department-heading"><div><small>DEPARTMENT</small><h2>{department}</h2></div><span>{people.length} {people.length === 1 ? 'profile' : 'profiles'}</span></div>
                <div className="gidc-public-faculty-grid">{people.map(person => (
                  <article className="gidc-public-faculty-card" key={person.id}>
                    <div className="gidc-public-faculty-photo">{person.public_photo_url ? <img src={person.public_photo_url} alt={person.full_name}/> : <Users size={38}/>}</div>
                    <div className="gidc-public-faculty-info"><h3>{person.full_name}</h3><b>{person.public_designation || person.subject || 'Faculty member'}</b>{person.public_qualification && <small>{person.public_qualification}</small>}</div>
                  </article>
                ))}</div>
              </section>
            ))}</div> : <EmptyState icon={Users} title="Faculty arrangement" detail="Published faculty records will be grouped here by their internal department assignment."/>}
          </PageFrame>
        )}

        {page === 'campus' && (
          <PageFrame eyebrow="CAMPUS INFORMATION" title="Campus & facilities" lead={textValue(content.campusIntro, 'College location and campus information.')} icon={School}>
            <div className="gidc-public-campus-grid">
              <div className="gidc-public-campus-map">
                <div className="gidc-public-map-art"><MapPin size={42}/><span>GIDC BADIN</span></div>
                <small>COLLEGE LOCATION</small><h3>Government Islamia Degree College Badin</h3><p>{contactAddress}</p>
                <a href={mapUrl} target="_blank" rel="noreferrer">Open campus location in Maps <ArrowUpRight size={16}/></a>
              </div>
              <div className="gidc-public-facilities">
                <small>CAMPUS FACILITIES</small><h3>Facilities</h3>
                {content.facilities?.length ? <div className="gidc-public-facility-list">{content.facilities.map((facility, index) => <div key={facility}><span><Building2 size={18}/></span><b>{facility}</b><small>{String(index + 1).padStart(2, '0')}</small></div>)}</div> : <EmptyState icon={Building2} title="Campus facilities" detail="No campus facilities are currently published."/>}
              </div>
            </div>
            {galleryItems.filter(item => item.category === 'main-campus' || item.category === 'campus-facility').length > 0 && <div className="gidc-public-subsection"><SectionHeading eyebrow="CAMPUS PHOTOGRAPHS" title="Campus views"/><div className="gidc-public-photo-grid">{galleryItems.filter(item => item.category === 'main-campus' || item.category === 'campus-facility').map(item => <PhotoCard item={item} key={item.id}/>)}</div></div>}
          </PageFrame>
        )}

        {page === 'events' && (
          <PageFrame eyebrow="COLLEGE ACTIVITIES" title="Events & achievements" lead="College events, academic activities, visits and official sessions approved for public display." icon={CalendarDays}>
            {eventPhotos.length > 0 ? <div className="gidc-public-gallery-grid">{eventPhotos.map(item => <PhotoCard item={item} key={item.id}/>)}</div> : <EmptyState icon={CalendarDays} title="College events" detail="Approved event photographs will appear here when the college publishes them in the website gallery."/>}
          </PageFrame>
        )}

        {page === 'content' && (
          <PageFrame eyebrow="OFFICIAL COLLEGE INFORMATION" title="News & announcements" lead="College updates published by authorised management." icon={Newspaper}>
            {news.length > 0 ? <div className="gidc-public-news-list">{news.map(item => <NewsCard item={item} key={item.id}/>)}</div> : <EmptyState icon={Newspaper} title="Official college updates" detail="New notices and announcements will appear here after publication by the college administration."/>}
            <div className="gidc-public-social-source"><Facebook size={20}/><div><b>Official Facebook page</b><span>College announcements and photographs</span></div><a href="https://www.facebook.com/GIDCBadin/" target="_blank" rel="noreferrer">Open page <ArrowUpRight size={15}/></a></div>
          </PageFrame>
        )}

        {page === 'gallery' && (
          <PageFrame eyebrow="PHOTOGRAPHS" title="College gallery" lead="Campus, activities, college events, student life and facilities." icon={ImageIcon}>
            {galleryItems.length > 0 ? <div className="gidc-public-gallery-grid">{galleryItems.map(item => <PhotoCard item={item} key={item.id}/>)}</div> : <EmptyState icon={ImageIcon} title="College photo gallery" detail="No college photographs are currently published."/>}
          </PageFrame>
        )}

        {page === 'emagazine' && (
          <PageFrame eyebrow="COLLEGE PUBLICATIONS" title="E-magazine" lead="Digital college magazine and published issues." icon={BookMarked}>
            {magazines.length > 0 ? <div className="gidc-public-magazine-grid">{magazines.map(issue => <article className="gidc-public-magazine-card" key={issue.id}>
              <div className="gidc-public-magazine-cover">{issue.coverUrl ? <img src={issue.coverUrl} alt={issue.title + ' cover'}/> : <BookMarked size={42}/>}</div>
              <div><small>{issue.issue || 'COLLEGE MAGAZINE'} · {issue.year || ''}</small><h3>{issue.title}</h3><a href={issue.pdfUrl} target="_blank" rel="noreferrer">Read issue <FileText size={15}/></a></div>
            </article>)}</div> : <EmptyState icon={BookMarked} title="College e-magazine" detail="No e-magazine issues are currently published."/>}
          </PageFrame>
        )}

        {page === 'contact' && (
          <PageFrame eyebrow="CONTACT THE COLLEGE" title="Contact & location" lead="Official contact details and campus location." icon={MapPin}>
            <div className="gidc-public-contact-grid">
              <div className="gidc-public-contact-card"><span><MapPin size={22}/></span><small>COLLEGE ADDRESS</small><b>Government Islamia Degree College Badin</b><p>{contactAddress}</p><a href={mapUrl} target="_blank" rel="noreferrer">View map <ExternalLink size={14}/></a></div>
              {contactPhone && <div className="gidc-public-contact-card"><span><Phone size={22}/></span><small>PHONE</small><b>{contactPhone}</b><a href={'tel:' + contactPhone.replace(/[^\d+]/g, '')}>Call the college <ArrowUpRight size={14}/></a></div>}
              {contactEmail && <div className="gidc-public-contact-card"><span><Mail size={22}/></span><small>EMAIL</small><b>{contactEmail}</b><a href={'mailto:' + contactEmail}>Write to the college <ArrowUpRight size={14}/></a></div>}
              {content.contactWebsite && <div className="gidc-public-contact-card"><span><ExternalLink size={22}/></span><small>WEBSITE</small><b>{content.contactWebsite}</b><a href={content.contactWebsite} target="_blank" rel="noreferrer">Open website <ArrowUpRight size={14}/></a></div>}
            </div>
          </PageFrame>
        )}
      </main>
      {footer}
      {loading && <div className="gidc-public-loading" aria-live="polite"><span/>Loading college information…</div>}
    </div>
  )
}

function PublicNavigation({ activePage }: { activePage: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="gidc-public-menu-toggle" onClick={() => setOpen(value => !value)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>{open ? <X size={22}/> : <Menu size={22}/>}</button>
      <nav className={open ? 'gidc-public-nav is-open' : 'gidc-public-nav'} aria-label="Public website pages">
        {pages.map(item => <a key={item.id} className={activePage === item.id ? 'is-active' : ''} href={'#/public/' + item.id} onClick={event => { event.preventDefault(); setOpen(false); goToPage(item.id) }}>{item.label}</a>)}
      </nav>
    </>
  )
}

function SectionHeading({ eyebrow, title, intro, action }: { eyebrow: string; title: string; intro?: string; action?: () => void }) {
  return <div className="gidc-public-section-heading"><div><small>{eyebrow}</small><h2>{title}</h2>{intro && <p>{intro}</p>}</div>{action && <button type="button" onClick={action}>View all <ArrowRight size={16}/></button>}</div>
}

function PageFrame({ eyebrow, title, lead, icon: Icon, children }: { eyebrow: string; title: string; lead: string; icon: typeof Landmark; children: ReactNode }) {
  return <section className="gidc-public-page">
    <div className="gidc-public-page-hero"><div className="gidc-public-shell gidc-public-page-hero-inner"><div><span>{eyebrow}</span><h1>{title}</h1><p>{lead}</p></div><div className="gidc-public-page-icon"><Icon size={40}/></div></div></div>
    <div className="gidc-public-shell gidc-public-page-content">{children}</div>
  </section>
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof Users; title: string; detail: string }) {
  return <div className="gidc-public-empty"><span><Icon size={28}/></span><h3>{title}</h3><p>{detail}</p></div>
}

function NewsCard({ item }: { item: WebsiteNews }) {
  return <article className="gidc-public-news-card">
    {item.imageUrl && <img className="gidc-public-news-image" src={item.imageUrl} alt={item.title} loading="lazy"/>}
    <div className="gidc-public-news-icon"><CalendarDays size={22}/></div>
    <div><small>{item.date || 'COLLEGE NOTICE'}</small><h3>{item.title}</h3><p>{item.body}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer">Open notice <ExternalLink size={14}/></a>}</div>
  </article>
}
