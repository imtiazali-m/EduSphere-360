import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { ChangeEvent } from 'react'
import {
  AlertCircle, BookMarked, Check, CheckCircle2, ExternalLink, Globe2,
  ImagePlus, Megaphone, Plus, Save, ShieldCheck, Trash2, Upload, Users, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import '../styles/college-website-manager.css'

const GIDC_IDS = [
  '20b0493c-1e73-421f-91f0-6868eeadd838',
  '1df694ac-22c1-4b5c-a2c3-a176382511bf',
]
type PhotoCategory = 'main-campus' | 'campus-activities' | 'college-events' | 'student-life' | 'campus-facility'
type Program = { id: string; title: string; detail: string; officialUrl: string }
type Photo = { id: string; title: string; category: PhotoCategory; imageUrl: string; sourceUrl: string; published: boolean; alt: string }
type Notice = { id: string; title: string; body: string; date: string; url: string; published: boolean }
type Magazine = { id: string; title: string; issue: string; year: string; pdfUrl: string; coverUrl: string; published: boolean }
type SiteContent = {
  heroHeading: string
  heroText: string
  heroPhotoUrl: string
  heroPhotoSource: string
  aboutText: string
  aboutMission: string
  principalMessage: string
  campusIntro: string
  facilities: string[]
  contactPhone: string
  contactEmail: string
  contactAddress: string
  contactWebsite: string
  accentColor: string
  programs: Program[]
  gallery: Photo[]
  news: Notice[]
  magazines: Magazine[]
  approvedFacebookPhotoIds: string[]
}
type Teacher = {
  id: string
  full_name: string
  department: string | null
  subject: string | null
  employment_status: string
  is_public_profile: boolean
  is_principal: boolean
  public_designation: string | null
  public_qualification: string | null
  public_bio: string | null
  public_photo_url: string | null
  public_profile_order: number
}

const coverChoices = [
  { id: 'gidc-cover-1', title: 'Facebook cover photo 1', url: 'https://www.facebook.com/photo/?fbid=947437973852174&set=a.541418854454090', image: 'https://scontent-sjc6-1.xx.fbcdn.net/v/t39.30808-6/482278097_1101918731737430_5190993433085170007_n.jpg?stp=dst-jpg_tt6&cstp=mx981x363&ctp=s417x417&_nc_cat=101&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=86c6b0&_nc_ohc=SKA4T0ZMkOgQ7kNvwFBsVW9&_nc_oc=AdooV2JwyTR5aZkIDS08MJV3GfksYXuFE_pXctqwE123nYbuvrIc8mAF_tM_gAvwjIc&_nc_zt=23&_nc_ht=scontent-sjc6-1.xx&_nc_gid=Vo7OQ8UyD-3TQ98Teohh0A&_nc_ss=7b289&oh=00_AQQzPLg1Vhye-ijutzniBcdeYE10Z4k01iDKiEFeKXbfQg&oe=6AFDD00F' },
  { id: 'gidc-cover-2', title: 'Facebook cover photo 2', url: 'https://www.facebook.com/photo/?fbid=541418884454087&set=a.541418854454090', image: 'https://scontent-sjc3-1.xx.fbcdn.net/v/t39.30808-6/474781692_1069923271603643_4028461545376206158_n.jpg?stp=dst-jpg_tt6&cstp=mx1280x720&ctp=s417x417&_nc_cat=100&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=86c6b0&_nc_ohc=iOZF-xkdW8YQ7kNvwGNXKH4&_nc_oc=AdrhnwbKwBZinLoJr7qQIzDA59KGyrjmDc5ykivTlxaeEG9j3iShSKyOXOvaSIAnbr8&_nc_zt=23&_nc_ht=scontent-sjc3-1.xx&_nc_gid=Vo7OQ8UyD-3TQ98Teohh0A&_nc_ss=7b289&oh=00_AQQP2PMxVw23_XtuoCLQwZu8RCZCEIaR1uLiVUeUPd_uwQ&oe=6AFDD6F8' },
  { id: 'gidc-cover-3', title: 'Facebook cover photo 3', url: 'https://www.facebook.com/photo/?fbid=1282997795400950&set=a.541418854454090', image: 'https://scontent-sjc3-1.xx.fbcdn.net/v/t1.6435-9/122388657_1282997802067616_144999525467400152_n.jpg?stp=dst-jpg_tt6&cstp=mx1280x720&ctp=s417x417&_nc_cat=100&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=86c6b0&_nc_ohc=TFhaqpQcdFMQ7kNvwEJa_Vj&_nc_oc=AdrvIqoq5nYQW9FcFrtNUdNVYBkYIr8mxvwtp9Pq3z3OdlvV7lXLgg1M3HdBDXmjTn0&_nc_zt=23&_nc_ht=scontent-sjc3-1.xx&_nc_gid=Vo7OQ8UyD-3TQ98Teohh0A&_nc_ss=7b289&oh=00_AQQIOGS1h0JvdvszfwJpnlRZSB8ddmqMAjWvgRDPrYi_CQ&oe=6B1F5CA4' },
  { id: 'gidc-cover-4', title: 'Facebook cover photo 4', url: 'https://www.facebook.com/photo/?fbid=1251748731859190&set=a.541418854454090', image: 'https://scontent-sjc6-1.xx.fbcdn.net/v/t1.6435-9/119520038_1251748735192523_4032561162598661558_n.jpg?stp=dst-jpg_tt6&cstp=mx960x550&ctp=s417x417&_nc_cat=104&_nc_map=urlgen_bucketless&ccb=1-7&_nc_sid=cc71e4&_nc_ohc=SoiX-V2J7kYQ7kNvwEhPXl4&_nc_oc=AdpIgVDbvXrCKPrGw96EEjMgVJMQgrn1pK91IcppPOykYi02klUfX7AI8kRf8adCQ-s&_nc_zt=23&_nc_ht=scontent-sjc6-1.xx&_nc_gid=Vo7OQ8UyD-3TQ98Teohh0A&_nc_ss=7b289&oh=00_AQRKFq_ObDPZ1uTwjzKvJpKOmY6-e8xjxLYLuxUkfEUeJg&oe=6B1F5BAF' },
]
const emptyContent: SiteContent = {
  heroHeading: 'Government Islamia Degree College Badin',
  heroText: 'A government degree college serving the Badin community.',
  heroPhotoUrl: '',
  heroPhotoSource: '',
  aboutText: 'Government Islamia Degree College Badin is listed in the Government of Sindh district-wise directory of government colleges.',
  aboutMission: '',
  principalMessage: '',
  campusIntro: '',
  facilities: [],
  contactPhone: '',
  contactEmail: '',
  contactAddress: 'Badin, Sindh, Pakistan',
  contactWebsite: '',
  accentColor: '#176342',
  programs: [{ id: 'science', title: 'Science', detail: 'Listed in the Government of Sindh college directory.', officialUrl: 'https://college.sindh.gov.pk/government-colleges' }],
  gallery: [],
  news: [],
  magazines: [],
  approvedFacebookPhotoIds: [],
}

const categories: { value: PhotoCategory; label: string }[] = [
  { value: 'main-campus', label: 'Main campus' },
  { value: 'campus-activities', label: 'Campus activities' },
  { value: 'college-events', label: 'College events' },
  { value: 'student-life', label: 'Student life' },
  { value: 'campus-facility', label: 'Campus facilities' },
]

function makeId(prefix: string) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7)
}

function TextInput({ label, value, onChange, placeholder = '', type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label className="cwm-field"><span>{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/></label>
}
function TextArea({ label, value, onChange, placeholder = '', rows = 4 }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; rows?: number }) {
  return <label className="cwm-field"><span>{label}</span><textarea rows={rows} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}/></label>
}
function AdminSection({ icon: Icon, title, description, children }: { icon: typeof Globe2; title: string; description: string; children: ReactNode }) {
  return <section className="cwm-section"><div className="cwm-section-heading"><span><Icon size={21}/></span><div><h2>{title}</h2><p>{description}</p></div></div><div className="cwm-section-body">{children}</div></section>
}

export function CollegeWebsiteManager({ onToast }: { onToast: (message: string, error?: boolean) => void }) {
  const { user } = useAuth()
  const [content, setContent] = useState<SiteContent>(emptyContent)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [recordId, setRecordId] = useState<string | null>(null)
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [newFacility, setNewFacility] = useState('')

  const allowedInstitution = Boolean(user?.institutionId && GIDC_IDS.includes(user.institutionId))
  const canManage = Boolean(user && ['owner', 'admin'].includes(user.role))

  useEffect(() => {
    let live = true
    async function loadManagerData() {
      if (!user || !canManage || !allowedInstitution || !supabase) {
        setLoading(false)
        if (user && !allowedInstitution) setLoadError('This account is not connected to either GIDC Badin institution record. Sign in to the GIDC Badin owner account to manage this public website.')
        return
      }
      setLoading(true)
      setLoadError('')
      try {
        const [settingsResult, teachersResult] = await Promise.all([
          supabase.from('institution_settings')
            .select('id,setting_value,is_public')
            .eq('institution_id', user.institutionId)
            .eq('category', 'website')
            .eq('setting_key', 'public_site')
            .maybeSingle(),
          supabase.from('teachers')
            .select('id,full_name,department,subject,employment_status,is_public_profile,is_principal,public_designation,public_qualification,public_bio,public_photo_url,public_profile_order')
            .eq('institution_id', user.institutionId)
            .order('full_name', { ascending: true }),
        ])
        if (settingsResult.error) throw settingsResult.error
        if (teachersResult.error) throw teachersResult.error
        if (settingsResult.data) {
          setRecordId(String(settingsResult.data.id))
          setContent({ ...emptyContent, ...(settingsResult.data.setting_value as Partial<SiteContent>) })
          setPublished(Boolean(settingsResult.data.is_public))
        }
        setTeachers((teachersResult.data ?? []) as Teacher[])
      } catch (error) {
        if (live) setLoadError(error instanceof Error ? error.message : 'The website editor could not load its records.')
      } finally {
        if (live) setLoading(false)
      }
    }
    void loadManagerData()
    return () => { live = false }
  }, [user?.id, user?.institutionId, user?.role, canManage, allowedInstitution])

  const approvedCount = content.approvedFacebookPhotoIds.length
  const principalCount = teachers.filter(person => person.is_public_profile && person.is_principal).length
  const publicFacultyCount = teachers.filter(person => person.is_public_profile && !person.is_principal && person.employment_status === 'active').length

  const set = <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => setContent(current => ({ ...current, [key]: value }))

  async function uploadImage(file: File, folder: string) {
    if (!supabase || !user) throw new Error('The college media service is not available.')
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const safeName = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'college-image'
    const path = user.institutionId + '/website/' + folder + '/' + Date.now() + '-' + safeName + '.' + extension
    const { error } = await supabase.storage.from('gidc-public-media').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (error) throw error
    return supabase.storage.from('gidc-public-media').getPublicUrl(path).data.publicUrl
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>, folder: string, onUploaded: (url: string) => void) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setStatusMessage('')
    try {
      const url = await uploadImage(file, folder)
      onUploaded(url)
      setStatusMessage('Image uploaded. Save and publish the website to display it publicly.')
      onToast('Image uploaded successfully.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Image upload failed.'
      setStatusMessage(message)
      onToast(message, true)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function saveWebsite() {
    if (!supabase || !user) return
    setSaving(true)
    setStatusMessage('')
    try {
      const payload = {
        institution_id: user.institutionId,
        category: 'website',
        setting_key: 'public_site',
        setting_value: content,
        is_public: published,
        updated_by: user.id,
      }
      if (recordId) {
        const { error } = await supabase.from('institution_settings').update(payload).eq('id', recordId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('institution_settings').insert(payload).select('id').single()
        if (error) throw error
        setRecordId(String(data.id))
      }
      setStatusMessage(published ? 'Website content saved and published.' : 'Draft saved. Public visitors will not see these changes until publication is enabled.')
      onToast(published ? 'Public website updated.' : 'Website draft saved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Website changes could not be saved.'
      setStatusMessage(message)
      onToast(message, true)
    } finally {
      setSaving(false)
    }
  }

  function toggleApprovedCover(id: string, approve: boolean) {
    const candidate = coverChoices.find(item => item.id === id)
    setContent(current => {
      const nextIds = approve
        ? Array.from(new Set([...current.approvedFacebookPhotoIds, id]))
        : current.approvedFacebookPhotoIds.filter(item => item !== id)
      const selected = nextIds.map(item => coverChoices.find(photo => photo.id === item)).find(Boolean)
      const nextHero = approve && !current.heroPhotoUrl && candidate
        ? candidate.image
        : !approve && current.heroPhotoSource === candidate?.url
          ? (selected?.image ?? '')
          : current.heroPhotoUrl
      const nextSource = approve && !current.heroPhotoSource && candidate
        ? candidate.url
        : !approve && current.heroPhotoSource === candidate?.url
          ? (selected?.url ?? '')
          : current.heroPhotoSource
      return { ...current, approvedFacebookPhotoIds: nextIds, heroPhotoUrl: nextHero, heroPhotoSource: nextSource }
    })
  }

  function updateFacultyDraft(id: string, changes: Partial<Teacher>) {
    setTeachers(current => current.map(item => item.id === id ? { ...item, ...changes } : item))
  }

  async function saveFaculty(person: Teacher) {
    if (!supabase || !user) return
    try {
      if (person.is_principal && person.is_public_profile) {
        const { error: clearError } = await supabase.from('teachers')
          .update({ is_principal: false })
          .eq('institution_id', user.institutionId)
          .neq('id', person.id)
        if (clearError) throw clearError
      }
      const { error } = await supabase.from('teachers').update({
        is_public_profile: person.is_public_profile,
        is_principal: person.is_public_profile && person.is_principal,
        public_designation: person.public_designation,
        public_qualification: person.public_qualification,
        public_bio: person.public_bio,
        public_photo_url: person.public_photo_url,
        public_profile_order: person.public_profile_order,
      }).eq('id', person.id).eq('institution_id', user.institutionId)
      if (error) throw error
      setStatusMessage(person.is_public_profile ? 'Faculty profile saved. It will appear on the public directory.' : 'Faculty profile hidden from the public directory.')
      onToast('Faculty website profile saved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Faculty profile could not be saved.'
      setStatusMessage(message)
      onToast(message, true)
    }
  }

  function addProgram() {
    set('programs', [...content.programs, { id: makeId('program'), title: '', detail: '', officialUrl: '' }])
  }
  function updateProgram(id: string, changes: Partial<Program>) {
    set('programs', content.programs.map(item => item.id === id ? { ...item, ...changes } : item))
  }
  function addPhoto() {
    set('gallery', [...content.gallery, { id: makeId('photo'), title: '', category: 'main-campus', imageUrl: '', sourceUrl: '', published: false, alt: '' }])
  }
  function updatePhoto(id: string, changes: Partial<Photo>) {
    set('gallery', content.gallery.map(item => item.id === id ? { ...item, ...changes } : item))
  }
  function addNotice() {
    set('news', [...content.news, { id: makeId('notice'), title: '', body: '', date: '', url: '', published: false }])
  }
  function updateNotice(id: string, changes: Partial<Notice>) {
    set('news', content.news.map(item => item.id === id ? { ...item, ...changes } : item))
  }
  function addMagazine() {
    set('magazines', [...content.magazines, { id: makeId('magazine'), title: '', issue: '', year: '', pdfUrl: '', coverUrl: '', published: false }])
  }
  function updateMagazine(id: string, changes: Partial<Magazine>) {
    set('magazines', content.magazines.map(item => item.id === id ? { ...item, ...changes } : item))
  }

  if (!user || !canManage) return <div className="cwm-page"><div className="cwm-access-error"><ShieldCheck size={34}/><h2>Website management access required</h2><p>Only the college owner or an authorised administrator can manage public content.</p></div></div>
  if (!allowedInstitution) return <div className="cwm-page"><div className="cwm-access-error"><AlertCircle size={34}/><h2>GIDC Badin account required</h2><p>{loadError || 'Sign in to the Government Islamia Degree College Badin owner account to manage its public website.'}</p></div></div>

  return (
    <div className="cwm-page">
      <div className="cwm-header">
        <div><span className="cwm-eyebrow"><Globe2 size={15}/> PUBLIC WEBSITE CONTROL</span><h1>Website & Public Content</h1><p>Manage information that appears on the college's external website.</p></div>
        <div className="cwm-header-actions"><span className={published ? 'cwm-publish-status is-live' : 'cwm-publish-status'}>{published ? 'Published content' : 'Draft mode'}</span><button type="button" className="cwm-save" onClick={() => void saveWebsite()} disabled={saving || loading}><Save size={17}/>{saving ? 'Saving…' : 'Save & publish'}</button></div>
      </div>
      {loadError && <div className="cwm-alert"><AlertCircle size={17}/>{loadError}</div>}
      {statusMessage && <div className="cwm-status" role="status"><CheckCircle2 size={16}/>{statusMessage}</div>}
      {loading ? <div className="cwm-loading">Loading website settings and faculty records…</div> : <>
        <div className="cwm-summary-grid">
          <div><span><Users size={20}/></span><strong>{teachers.length}</strong><small>Internal faculty records</small></div>
          <div><span><CheckCircle2 size={20}/></span><strong>{publicFacultyCount}</strong><small>Published faculty profiles</small></div>
          <div><span><ShieldCheck size={20}/></span><strong>{principalCount}</strong><small>Published principal profiles</small></div>
          <div><span><ImagePlus size={20}/></span><strong>{approvedCount}</strong><small>Approved Facebook images</small></div>
        </div>

        <AdminSection icon={ImagePlus} title="Homepage photographs — approval required" description="Four photographs from the official GIDC Badin Facebook Cover Photos album. Open each original, then mark Yes or No. Nothing is shown publicly until you save.">
          <div className="cwm-source-line"><Facebook size={17}/><span>Source: <a href="https://www.facebook.com/GIDCBadin/photos" target="_blank" rel="noreferrer">GIDC Badin official Facebook Photos</a> → Cover photos album</span></div>
          <div className="cwm-cover-grid">
            {coverChoices.map((photo, index) => {
              const approved = content.approvedFacebookPhotoIds.includes(photo.id)
              return <article className={approved ? 'cwm-cover-card is-approved' : 'cwm-cover-card'} key={photo.id}>
                <div className="cwm-cover-image"><img src={photo.image} alt={photo.title} loading="lazy" onError={event => { event.currentTarget.style.opacity = '0.18' }}/><span>CHOICE {index + 1}</span></div>
                <div className="cwm-cover-copy"><b>{photo.title}</b><a href={photo.url} target="_blank" rel="noreferrer">Open original Facebook photo <ExternalLink size={13}/></a>
                  <div className="cwm-yes-no" role="group" aria-label={'Approve photo choice ' + (index + 1)}>
                    <button type="button" className={approved ? 'is-yes selected' : 'is-yes'} aria-pressed={approved} onClick={() => toggleApprovedCover(photo.id, true)}><Check size={14}/> Yes</button>
                    <button type="button" className={!approved ? 'is-no selected' : 'is-no'} aria-pressed={!approved} onClick={() => toggleApprovedCover(photo.id, false)}><X size={14}/> No</button>
                  </div>
                </div>
              </article>
            })}
          </div>
          <p className="cwm-help">A Yes selection approves that original Facebook image for the college gallery. The first approved choice becomes the homepage image unless you upload or select a different hero photograph.</p>
          <TextInput label="Homepage image URL (optional override)" value={content.heroPhotoUrl} onChange={value => set('heroPhotoUrl', value)} placeholder="Paste a college-owned or approved image URL"/>
          <TextInput label="Source link for homepage image" value={content.heroPhotoSource} onChange={value => set('heroPhotoSource', value)} placeholder="Original Facebook post or album link"/>
          <label className="cwm-upload"><Upload size={17}/><span>{uploading ? 'Uploading…' : 'Upload an approved campus image'}</span><input type="file" accept="image/*" disabled={uploading} onChange={event => void handleImageUpload(event, 'homepage', url => set('heroPhotoUrl', url))}/></label>
        </AdminSection>

        <AdminSection icon={Globe2} title="Homepage, identity & college introduction" description="The official crest is already installed. It is displayed as a horizontal logo lockup without a square badge.">
          <div className="cwm-logo-preview"><img src="/gidc-badin-official-logo.svg" alt="GIDC Badin official logo"/><div><strong>GOVERNMENT ISLAMIA</strong><b>DEGREE COLLEGE BADIN</b><small>BADIN · SINDH · PAKISTAN</small></div><span>HORIZONTAL LOGO</span></div>
          <div className="cwm-fields-two">
            <TextInput label="Homepage headline" value={content.heroHeading} onChange={value => set('heroHeading', value)}/>
            <TextInput label="Short homepage introduction" value={content.heroText} onChange={value => set('heroText', value)}/>
          </div>
          <TextArea label="About the college" value={content.aboutText} onChange={value => set('aboutText', value)} rows={5} placeholder="College overview approved for publication"/>
          <TextArea label="Mission or institutional statement (optional)" value={content.aboutMission} onChange={value => set('aboutMission', value)} rows={3}/>
          <div className="cwm-fields-two">
            <label className="cwm-field"><span>Website accent colour</span><div className="cwm-color-field"><input type="color" value={content.accentColor} onChange={event => set('accentColor', event.target.value)}/><code>{content.accentColor}</code></div></label>
            <div className="cwm-field"><span>Public display</span><label className="cwm-switch"><input type="checkbox" checked={published} onChange={event => setPublished(event.target.checked)}/><i/><b>{published ? 'Website content is published' : 'Keep these changes as a draft'}</b></label></div>
          </div>
        </AdminSection>

        <AdminSection icon={BookMarked} title="Academic information" description="Add or update academic streams and programme information.">
          {content.programs.map((program, index) => <div className="cwm-repeat-card" key={program.id}>
            <div className="cwm-repeat-top"><b>Academic item {index + 1}</b><button type="button" aria-label="Remove academic item" onClick={() => set('programs', content.programs.filter(item => item.id !== program.id))}><Trash2 size={15}/></button></div>
            <div className="cwm-fields-two"><TextInput label="Programme or stream" value={program.title} onChange={value => updateProgram(program.id, { title: value })}/><TextInput label="Official information link" value={program.officialUrl} onChange={value => updateProgram(program.id, { officialUrl: value })}/></div>
            <TextArea label="Description" value={program.detail} onChange={value => updateProgram(program.id, { detail: value })} rows={2}/>
          </div>)}
          <button type="button" className="cwm-add" onClick={addProgram}><Plus size={16}/> Add academic programme</button>
        </AdminSection>

        <AdminSection icon={Users} title="Principal & faculty directory" description="Profiles are drawn from the internal Faculty & Staff register. Publish only approved profiles; the public website will update automatically after saving.">
          <div className="cwm-notice-inline"><ShieldCheck size={17}/><span>Internal employee email, phone, employee ID and private records are not shown on the public website.</span></div>
          <TextArea label="Principal's message" value={content.principalMessage} onChange={value => set('principalMessage', value)} rows={4} placeholder="Message from the principal"/>
          {teachers.length === 0 ? <div className="cwm-empty"><Users size={25}/><b>No faculty records found</b><span>Add faculty in the internal Faculty & Staff register. They will appear here for publication settings.</span></div> :
            <div className="cwm-teacher-list">{teachers.map(person => <FacultyEditor key={person.id} person={person} onChange={changes => updateFacultyDraft(person.id, changes)} onSave={() => void saveFaculty(person)} onUpload={event => void handleImageUpload(event, 'faculty', url => updateFacultyDraft(person.id, { public_photo_url: url }))}/>)}</div>}
        </AdminSection>

        <AdminSection icon={Building2} title="Campus, location & facilities" description="Use the college's verified location and add each facility only after the college confirms it.">
          <TextArea label="Campus introduction" value={content.campusIntro} onChange={value => set('campusIntro', value)} rows={3}/>
          <TextInput label="Campus address for the website" value={content.contactAddress} onChange={value => set('contactAddress', value)} placeholder="Badin, Sindh, Pakistan"/>
          <div className="cwm-facility-editor"><div className="cwm-facility-add"><input value={newFacility} onChange={event => setNewFacility(event.target.value)} placeholder="Add a verified campus facility"/><button type="button" onClick={() => { if (newFacility.trim()) { set('facilities', [...content.facilities, newFacility.trim()]); setNewFacility('') } }}><Plus size={16}/> Add</button></div>
            <div className="cwm-facility-chips">{content.facilities.map(item => <span key={item}>{item}<button type="button" aria-label={'Remove ' + item} onClick={() => set('facilities', content.facilities.filter(value => value !== item))}><X size={12}/></button></span>)}</div>
          </div>
        </AdminSection>

        <AdminSection icon={ImagePlus} title="Campus photographs & gallery" description="Upload or link authentic college photographs and assign each one to its correct gallery category.">
          {content.gallery.map((photo, index) => <div className="cwm-repeat-card" key={photo.id}>
            <div className="cwm-repeat-top"><b>Photograph {index + 1}</b><button type="button" aria-label="Remove photograph" onClick={() => set('gallery', content.gallery.filter(item => item.id !== photo.id))}><Trash2 size={15}/></button></div>
            <div className="cwm-fields-two"><TextInput label="Photo title" value={photo.title} onChange={value => updatePhoto(photo.id, { title: value })}/><label className="cwm-field"><span>Category</span><select value={photo.category} onChange={event => updatePhoto(photo.id, { category: event.target.value as PhotoCategory })}>{categories.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label></div>
            <div className="cwm-fields-two"><TextInput label="Image URL" value={photo.imageUrl} onChange={value => updatePhoto(photo.id, { imageUrl: value })}/><TextInput label="Original source link" value={photo.sourceUrl} onChange={value => updatePhoto(photo.id, { sourceUrl: value })}/></div>
            <div className="cwm-fields-two"><TextInput label="Image description" value={photo.alt} onChange={value => updatePhoto(photo.id, { alt: value })}/><label className="cwm-upload cwm-upload-small"><Upload size={15}/><span>Upload photo</span><input type="file" accept="image/*" disabled={uploading} onChange={event => void handleImageUpload(event, 'gallery', url => updatePhoto(photo.id, { imageUrl: url }))}/></label></div>
            <label className="cwm-check"><input type="checkbox" checked={photo.published} onChange={event => updatePhoto(photo.id, { published: event.target.checked })}/> Publish this photograph in the public gallery</label>
          </div>)}
          <button type="button" className="cwm-add" onClick={addPhoto}><Plus size={16}/> Add gallery photograph</button>
        </AdminSection>

        <AdminSection icon={Megaphone} title="Official college news & announcements" description="Publish admission notices, academic announcements, event updates and official circulars.">
          {content.news.map((notice, index) => <div className="cwm-repeat-card" key={notice.id}>
            <div className="cwm-repeat-top"><b>Announcement {index + 1}</b><button type="button" aria-label="Remove announcement" onClick={() => set('news', content.news.filter(item => item.id !== notice.id))}><Trash2 size={15}/></button></div>
            <div className="cwm-fields-two"><TextInput label="Title" value={notice.title} onChange={value => updateNotice(notice.id, { title: value })}/><TextInput label="Publication date" type="date" value={notice.date} onChange={value => updateNotice(notice.id, { date: value })}/></div>
            <TextArea label="Announcement details" value={notice.body} onChange={value => updateNotice(notice.id, { body: value })} rows={3}/>
            <TextInput label="Official notice / source link (optional)" value={notice.url} onChange={value => updateNotice(notice.id, { url: value })}/>
            <label className="cwm-check"><input type="checkbox" checked={notice.published} onChange={event => updateNotice(notice.id, { published: event.target.checked })}/> Publish this announcement</label>
          </div>)}
          <button type="button" className="cwm-add" onClick={addNotice}><Plus size={16}/> Add college announcement</button>
        </AdminSection>

        <AdminSection icon={BookMarked} title="E-magazine" description="Prepare the e-magazine section now. Add PDF issues and cover artwork when each issue is ready.">
          {content.magazines.map((issue, index) => <div className="cwm-repeat-card" key={issue.id}>
            <div className="cwm-repeat-top"><b>Magazine issue {index + 1}</b><button type="button" aria-label="Remove magazine issue" onClick={() => set('magazines', content.magazines.filter(item => item.id !== issue.id))}><Trash2 size={15}/></button></div>
            <div className="cwm-fields-two"><TextInput label="Magazine title" value={issue.title} onChange={value => updateMagazine(issue.id, { title: value })}/><TextInput label="Issue / volume" value={issue.issue} onChange={value => updateMagazine(issue.id, { issue: value })}/></div>
            <div className="cwm-fields-two"><TextInput label="Year" value={issue.year} onChange={value => updateMagazine(issue.id, { year: value })}/><TextInput label="PDF issue URL" value={issue.pdfUrl} onChange={value => updateMagazine(issue.id, { pdfUrl: value })}/></div>
            <div className="cwm-fields-two"><TextInput label="Cover image URL" value={issue.coverUrl} onChange={value => updateMagazine(issue.id, { coverUrl: value })}/><label className="cwm-upload cwm-upload-small"><Upload size={15}/><span>Upload cover</span><input type="file" accept="image/*" disabled={uploading} onChange={event => void handleImageUpload(event, 'magazine-covers', url => updateMagazine(issue.id, { coverUrl: url }))}/></label></div>
            <label className="cwm-check"><input type="checkbox" checked={issue.published} onChange={event => updateMagazine(issue.id, { published: event.target.checked })}/> Publish this magazine issue</label>
          </div>)}
          <button type="button" className="cwm-add" onClick={addMagazine}><Plus size={16}/> Add e-magazine issue</button>
        </AdminSection>

        <AdminSection icon={ShieldCheck} title="Official contact details" description="Enter the correct college phone number and email. Only publish the details after the college confirms them.">
          <div className="cwm-fields-two"><TextInput label="Official telephone" value={content.contactPhone} onChange={value => set('contactPhone', value)} placeholder="Add verified phone number"/><TextInput label="Official email" value={content.contactEmail} onChange={value => set('contactEmail', value)} placeholder="Add verified college email" type="email"/></div>
          <TextInput label="Official website (optional)" value={content.contactWebsite} onChange={value => set('contactWebsite', value)} placeholder="https://"/>
          <p className="cwm-help">The public Contact page displays phone and email only when you enter and publish them here. The address field is managed in the Campus section above.</p>
        </AdminSection>

        <div className="cwm-bottom-save"><div><b>{published ? 'Ready to publish the latest approved information' : 'Draft changes are private'}</b><span>Saving here updates the connected public website. No local code changes are needed.</span></div><button type="button" className="cwm-save" onClick={() => void saveWebsite()} disabled={saving || uploading}><Save size={17}/>{saving ? 'Saving…' : 'Save & publish website'}</button></div>
      </>}
    </div>
  )
}

function FacultyEditor({ person, onChange, onSave, onUpload }: { person: Teacher; onChange: (changes: Partial<Teacher>) => void; onSave: () => void; onUpload: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <article className="cwm-faculty-card">
    <div className="cwm-faculty-overview">
      <div className="cwm-faculty-avatar">{person.public_photo_url ? <img src={person.public_photo_url} alt={person.full_name}/> : <Users size={23}/>}</div>
      <div><b>{person.full_name}</b><small>{person.department || person.subject || 'Faculty / staff record'}</small><em>{person.employment_status.replaceAll('_', ' ')}</em></div>
      <label className="cwm-check"><input type="checkbox" checked={person.is_public_profile} onChange={event => onChange({ is_public_profile: event.target.checked, is_principal: event.target.checked ? person.is_principal : false })}/> Publish profile</label>
    </div>
    <div className="cwm-fields-two"><TextInput label="Public designation" value={person.public_designation || ''} onChange={value => onChange({ public_designation: value })} placeholder="Principal / Lecturer / Assistant Professor"/><TextInput label="Public qualification" value={person.public_qualification || ''} onChange={value => onChange({ public_qualification: value })}/></div>
    <div className="cwm-fields-two"><TextInput label="Public photograph URL" value={person.public_photo_url || ''} onChange={value => onChange({ public_photo_url: value })}/><label className="cwm-upload cwm-upload-small"><Upload size={15}/><span>Upload portrait</span><input type="file" accept="image/*" onChange={onUpload}/></label></div>
    <TextArea label="Public profile / biography" value={person.public_bio || ''} onChange={value => onChange({ public_bio: value })} rows={2}/>
    <div className="cwm-faculty-actions"><label className="cwm-check"><input type="checkbox" checked={person.is_principal} disabled={!person.is_public_profile} onChange={event => onChange({ is_principal: event.target.checked })}/> Use as principal profile</label><button type="button" onClick={onSave}><Check size={15}/> Save profile</button></div>
  </article>
}
