import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Bookmark, BookmarkCheck, BriefcaseBusiness, Search, Share2 } from 'lucide-react';
import api from '../services/api';

function readableList(value) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value !== 'string') return '';
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.join(', ');
  } catch { /* specialization may be stored as plain text */ }
  return value;
}

export default function ClientArchitects({ savedOnly = false }) {
  const [architects, setArchitects] = useState([]);
  const [filters, setFilters] = useState({ q: '', location: '', specialization: '', project_type: '', min_experience: '', sort: 'relevance' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ total: 0, limit: 12 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = async (targetPage = page) => {
    setLoading(true);
    setError('');
    try {
      if (savedOnly) {
        const { data } = await api.get('/client/saved-architects');
        setArchitects(data);
      } else {
        const [{data}, {data: saved}] = await Promise.all([
          api.get('/client/architects', { params: { ...filters, page: targetPage, limit: 12 } }),
          api.get('/client/saved-architects')
        ]);
        const savedIds = new Set(saved.map(item=>Number(item.id)));
        setArchitects(data.architects.map(item=>({...item,saved:savedIds.has(Number(item.id))})));
        setResult(data);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load architects');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(1); }, [savedOnly]);
  const search = event => {
    event.preventDefault();
    setPage(1);
    load(1);
  };
  const toggleSaved = async architect => {
    const saved = architects.some(item => Number(item.id) === Number(architect.id) && item.saved);
    try {
      if (saved || savedOnly) {
        await api.delete(`/client/saved-architects/${architect.id}`);
        if (savedOnly) setArchitects(items => items.filter(item => Number(item.id) !== Number(architect.id)));
        else setArchitects(items => items.map(item => Number(item.id) === Number(architect.id) ? { ...item, saved: false } : item));
      } else {
        await api.post(`/client/saved-architects/${architect.id}`);
        setArchitects(items => items.map(item => Number(item.id) === Number(architect.id) ? { ...item, saved: true } : item));
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update saved architects');
    }
  };
  return <section className="space-y-5">
    <header>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sage">{savedOnly ? 'Your shortlist' : 'Find your architect'}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{savedOnly ? 'Saved architects' : 'Discover architects'}</h1>
      <p className="mt-2 text-stone-500">{savedOnly ? 'The professionals you bookmarked for future projects.' : 'Explore verified architecture profiles and public portfolio work.'}</p>
    </header>
    {!savedOnly && <form onSubmit={search} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="relative"><Search className="absolute left-3 top-3 text-stone-400" size={17}/><input className="field pl-10" aria-label="Search architects" placeholder="Name, firm or keyword" value={filters.q} onChange={e=>setFilters({...filters,q:e.target.value})}/></label>
      <input className="field" placeholder="Location" value={filters.location} onChange={e=>setFilters({...filters,location:e.target.value})}/>
      <input className="field" placeholder="Specialization" value={filters.specialization} onChange={e=>setFilters({...filters,specialization:e.target.value})}/>
      <input className="field" placeholder="Project type" value={filters.project_type} onChange={e=>setFilters({...filters,project_type:e.target.value})}/>
      <select className="field" aria-label="Minimum experience" value={filters.min_experience} onChange={e=>setFilters({...filters,min_experience:e.target.value})}><option value="">Any experience</option><option value="3">3+ years</option><option value="5">5+ years</option><option value="10">10+ years</option></select>
      <div className="flex gap-2"><select className="field" aria-label="Sort architects" value={filters.sort} onChange={e=>setFilters({...filters,sort:e.target.value})}><option value="relevance">Name</option><option value="experience">Experience</option></select><button className="btn-primary shrink-0">Search</button></div>
    </form>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0,1,2].map(item=><div key={item} className="card h-64 animate-pulse bg-stone-100"/>)}</div> :
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{architects.map(architect=><article key={architect.id} className="card overflow-hidden">
        {architect.cover_image ? <img src={architect.cover_image} alt="" className="h-36 w-full object-cover"/> : <div className="h-36 bg-gradient-to-br from-stone-200 via-sand to-sage/30"/>}
        <div className="p-5">
          <div className="flex items-start gap-3"><img src={architect.profile_image || ''} alt="" className="h-12 w-12 rounded-full bg-stone-100 object-cover"/><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-semibold">{architect.name}</h2><p className="truncate text-sm text-stone-500">{architect.firm_name || 'Architect'}</p></div>
            <button type="button" onClick={()=>toggleSaved(architect)} aria-label={architect.saved || savedOnly ? 'Remove saved architect' : 'Save architect'} className="rounded-xl border p-2 text-sage hover:bg-sand">{architect.saved || savedOnly ? <BookmarkCheck size={18}/> : <Bookmark size={18}/>}</button>
          </div>
          <p className="mt-3 flex items-center gap-1 text-sm text-stone-500"><MapPin size={15}/>{architect.location || 'Location not specified'}</p>
          <p className="mt-2 line-clamp-3 min-h-14 text-sm leading-6 text-stone-600">{architect.bio || 'Explore this architect’s portfolio and professional profile.'}</p>
          {readableList(architect.specializations) && <p className="mt-2 line-clamp-1 text-xs font-medium text-sage">{readableList(architect.specializations)}</p>}
          <div className="mt-3 flex items-center gap-2 text-xs text-stone-500"><BriefcaseBusiness size={15}/>{architect.experience_years || 0} years experience · {architect.portfolio_count || 0} projects</div>
          {architect.portfolio_title && <p className="mt-2 truncate text-xs text-stone-500">Featured: {architect.portfolio_title}</p>}
          <div className="mt-4 flex gap-2"><Link className="btn-secondary flex-1 text-sm" to={`/architects/${architect.id}`}>View profile</Link><Link className="btn-primary flex-1 text-sm" to={`/architects/${architect.id}?enquire=1`}>Send enquiry</Link></div>
        </div>
      </article>)}</div>}
    {!loading && !architects.length && <div className="card p-10 text-center text-stone-500">{savedOnly ? 'No saved architects yet. Discover professionals and bookmark profiles you like.' : 'No architects matched those filters. Try broadening your search.'}</div>}
    {!savedOnly && result.total > result.limit && <div className="flex items-center justify-between"><span className="text-sm text-stone-500">{result.total} architects</span><div className="flex gap-2"><button className="btn-secondary" disabled={page<=1} onClick={()=>{const next=page-1;setPage(next);load(next);}}>Previous</button><span className="self-center text-sm">Page {page} of {Math.ceil(result.total/result.limit)}</span><button className="btn-secondary" disabled={page>=Math.ceil(result.total/result.limit)} onClick={()=>{const next=page+1;setPage(next);load(next);}}>Next</button></div></div>}
  </section>;
}

export function ClientArchitectProfile() {
  const { id } = useParams();
  const [architect, setArchitect] = useState(null);
  const [error, setError] = useState('');
  const [showEnquiry, setShowEnquiry] = useState(new URLSearchParams(window.location.search).get('enquire') === '1');
  useEffect(() => {
    api.get(`/client/architects/${id}`).then(({data})=>setArchitect(data))
      .catch(requestError=>setError(requestError.response?.data?.message || 'Unable to load this profile'));
  }, [id]);
  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>;
  if (!architect) return <div className="card h-72 animate-pulse bg-stone-100"/>;
  return <div className="space-y-5">
    <section className="card overflow-hidden">
      <div className="h-48 bg-gradient-to-br from-stone-200 via-sand to-sage/30"/>
      <div className="p-6 sm:flex sm:items-end sm:gap-5">
        <img src={architect.profile_image || ''} alt="" className="-mt-16 h-28 w-28 rounded-2xl border-4 border-white bg-white object-cover"/>
        <div className="mt-3 flex-1"><p className="text-sm uppercase tracking-widest text-sage">{architect.firm_name || 'Architect'}</p><h1 className="text-3xl font-semibold">{architect.name}</h1><p className="mt-1 text-stone-500">{architect.location || 'Location not specified'} · {architect.experience_years || 0} years experience</p></div>
        <div className="mt-4 flex items-center gap-2 sm:mt-0"><Link to={`/messages?shareType=PROFILE&shareId=${architect.id}`} className="rounded-lg p-2 text-stone-500 hover:bg-sand hover:text-sage" aria-label="Share profile in chat" title="Share profile in chat"><Share2 size={18}/></Link><button className="btn-primary" onClick={()=>setShowEnquiry(value=>!value)}>{showEnquiry ? 'Close enquiry' : 'Send project enquiry'}</button></div>
      </div>
      <div className="grid gap-6 border-t p-6 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
        <div><h2 className="font-semibold">About</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-600">{architect.bio || 'This architect has not added a biography yet.'}</p></div>
        <div><h2 className="font-semibold">Practice</h2><p className="mt-2 text-sm text-stone-600">{readableList(architect.specializations) || 'Specializations not listed'}</p>{architect.website && <a className="mt-2 block text-sm text-sage underline" href={architect.website} target="_blank" rel="noreferrer">Professional website</a>}</div>
      </div>
    </section>
    {showEnquiry && <EnquiryForm architectId={architect.id}/>}
    <section className="space-y-3"><h2 className="text-xl font-semibold">Portfolio</h2>{architect.projects?.length ? <div className="grid gap-4 md:grid-cols-2">{architect.projects.map(project=><article className="card overflow-hidden" key={project.id}>{project.cover_image && <img src={project.cover_image} alt="" className="h-52 w-full object-cover"/>}<div className="p-5"><p className="text-xs uppercase tracking-wider text-sage">{project.category || 'Architecture project'}</p><h3 className="mt-1 text-lg font-semibold">{project.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">{project.description}</p>{project.media?.length>0&&<div className="mt-4 grid grid-cols-3 gap-2">{project.media.slice(0,3).map((media,index)=><img key={index} src={media.media_url} alt={`${project.title} view ${index+1}`} className="h-24 w-full rounded-lg object-cover"/>)}</div>}</div></article>)}</div> : <div className="card p-8 text-center text-stone-500">No portfolio projects are available yet.</div>}</section>
  </div>;
}

export function EnquiryForm({ architectId, onCreated }) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const submit = async event => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const { data } = await api.post(`/enquiries/${architectId}`, form);
      setSuccess('Your enquiry has been sent. You can track it from My Enquiries.');
      formElement.reset();
      onCreated?.(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not send your enquiry');
    }
  };
  return <form onSubmit={submit} className="card space-y-3 p-5">
    <h2 className="text-lg font-semibold">Tell us about your project</h2>
    <input className="field" name="title" placeholder="Project title" maxLength="255" required/>
    <select className="field" name="category" defaultValue="" required><option value="" disabled>Project category</option>{['Residential','Commercial','Interior Design','Landscape','Renovation','Institutional','Other'].map(category=><option key={category}>{category}</option>)}</select>
    <textarea className="field min-h-28" name="description" placeholder="Describe your requirements" maxLength="10000" required/>
    <div className="grid gap-3 sm:grid-cols-2"><input className="field" name="location" placeholder="Project location"/><input className="field" name="land_area" placeholder="Land area (optional)"/></div>
    <div className="grid gap-3 sm:grid-cols-2"><input className="field" name="budget_min" type="number" min="0" step="0.01" placeholder="Minimum budget"/><input className="field" name="budget_max" type="number" min="0" step="0.01" placeholder="Maximum budget"/></div>
    <div className="grid gap-3 sm:grid-cols-2"><input className="field" name="expected_timeline" placeholder="Expected timeline"/><input className="field" name="preferred_style" placeholder="Preferred style (optional)"/></div>
    <label className="block text-sm text-stone-600">Reference images or site documents (up to 5; max upload size applies)<input className="mt-2 block w-full text-sm" type="file" name="files" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.txt"/></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{success && <p role="status" className="text-sm text-green-700">{success}</p>}
    <button className="btn-primary">Send enquiry</button>
  </form>;
}
