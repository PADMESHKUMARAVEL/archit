import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const categories = ['Residential','Commercial','Interior Design','Landscape','Renovation','Institutional','Other'];
const pretty = value => String(value || '').toLowerCase().replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase());

export default function ProjectBoard({ clientMode = false }) {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const isClient = clientMode || user?.role === 'CLIENT';
  const [items,setItems] = useState([]);
  const [detail,setDetail] = useState(null);
  const [filters,setFilters] = useState({q:'',category:'',location:''});
  const [form,setForm] = useState({title:'',category:'Residential',description:'',location:'',land_area:'',budget_min:'',budget_max:'',expected_timeline:'',preferred_style:''});
  const [files,setFiles] = useState([]);
  const [proposal,setProposal] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [page,setPage] = useState(1);
  const [result,setResult] = useState({total:0,limit:12});
  const [loading,setLoading] = useState(true);

  const loadList = async (targetPage=page) => {
    setLoading(true);
    setError('');
    try {
      if (isClient) {
        const {data}=await api.get('/client/project-requests');
        setItems(data);
      } else {
        const {data}=await api.get('/client/project-board',{params:{...filters,page:targetPage,limit:12}});
        setItems(data.requests);
        setResult(data);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load project briefs');
    } finally { setLoading(false); }
  };
  useEffect(()=>{loadList(1);},[isClient]);
  const loadDetail = async () => {
    setError('');
    try {
      const {data}=await api.get(`/client/project-requests/${id}`);
      setDetail(data);
      setProposal(data.my_proposal?.message || '');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load this project brief');
    }
  };
  useEffect(()=>{setDetail(null);if(id)loadDetail();},[id]);
  const updateForm = event=>setForm(current=>({...current,[event.target.name]:event.target.value}));
  const postBrief = async event=>{
    event.preventDefault();
    setError('');
    setNotice('');
    const body=new FormData(event.currentTarget);
    try {
      await api.post('/client/project-requests',body);
      setNotice('Your brief is posted. Architects can now respond with proposals.');
      setForm({title:'',category:'Residential',description:'',location:'',land_area:'',budget_min:'',budget_max:'',expected_timeline:'',preferred_style:''});
      setFiles([]);
      event.currentTarget.reset();
      await loadList(1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not post your project brief');
    }
  };
  const search = event=>{event.preventDefault();setPage(1);loadList(1);};
  const submitProposal = async event=>{
    event.preventDefault();
    setError('');
    try {
      const {data}=await api.post(`/client/project-requests/${id}/proposals`,{message:proposal});
      setNotice(data.message);
      await loadDetail();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not send your introduction');
    }
  };
  const updateProposal = async (proposalId,status)=>{
    setError('');
    setNotice('');
    try {
      const {data}=await api.patch(`/client/project-requests/${id}/proposals/${proposalId}`,{status});
      setNotice(data.message);
      await loadDetail();
      await loadList();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not update proposal');
    }
  };
  const closeBrief = async ()=>{
    if(!window.confirm('Close this project brief? Architects will no longer be able to submit proposals.'))return;
    try { await api.patch(`/client/project-requests/${id}/close`);await loadDetail();await loadList(); }
    catch(requestError){setError(requestError.response?.data?.message||'Could not close the brief');}
  };
  const goBack=()=>navigate(isClient?'/project-requests':'/project-board');

  if(id) {
    if(error&&!detail)return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>;
    if(!detail)return <div className="card h-64 animate-pulse bg-stone-100"/>;
    return <div className="space-y-5">
      <button className="text-sm font-medium text-sage hover:underline" onClick={goBack}>← {isClient?'My project briefs':'Project board'}</button>
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-sage">{detail.category}</p><h1 className="mt-1 text-2xl font-semibold">{detail.title}</h1><p className="mt-2 text-sm text-stone-500">{detail.client_name} · {detail.location||'Location not specified'} · Posted {new Date(detail.created_at).toLocaleDateString()}</p></div><span className="rounded-full bg-sand px-3 py-1.5 text-sm">{pretty(detail.status)}</span></div>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-stone-700">{detail.description}</p>
        <div className="mt-5 grid gap-3 rounded-xl bg-stone-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Land area',detail.land_area],['Budget',detail.budget_min||detail.budget_max?`${detail.budget_min||'—'} – ${detail.budget_max||'—'}`:null],
            ['Timeline',detail.expected_timeline],['Preferred style',detail.preferred_style]
          ].filter(([,value])=>value).map(([label,value])=><p key={label}><span className="text-stone-500">{label}: </span><b>{value}</b></p>)}
        </div>
        {detail.documents?.length>0&&<div className="mt-5 border-t pt-4"><h2 className="font-semibold">Reference files</h2><div className="mt-2 flex flex-wrap gap-2">{detail.documents.map(file=><a className="btn-secondary text-sm" key={file.id} href={file.file_url} target="_blank" rel="noreferrer">{file.file_name}</a>)}</div></div>}
        {isClient&&detail.status==='OPEN'&&<div className="mt-5 border-t pt-4"><button className="btn-secondary text-sm text-red-700" onClick={closeBrief}>Close project brief</button></div>}
      </section>
      {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice&&<p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
      {!isClient&&<section className="card p-5">
        {detail.my_proposal?<><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Your proposal</h2><span className="rounded-full bg-sand px-3 py-1 text-xs">{pretty(detail.my_proposal.status)}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">{detail.my_proposal.message}</p>{detail.my_proposal.conversation_id&&<Link className="btn-primary mt-4" to={`/messages?conversation=${detail.my_proposal.conversation_id}`}>Message client</Link>}</>
        :detail.status==='OPEN'?<form onSubmit={submitProposal} className="space-y-3"><h2 className="text-lg font-semibold">Introduce yourself</h2><p className="text-sm text-stone-500">Share how your experience and approach can meet this client’s project needs.</p><textarea className="field min-h-32" maxLength="5000" required value={proposal} onChange={event=>setProposal(event.target.value)} placeholder="Write a short proposal..."/><button className="btn-primary">Send proposal</button></form>
        :<p className="text-sm text-stone-500">This project brief is closed to new proposals.</p>}
      </section>}
      {isClient&&<section className="card p-5"><div className="flex items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Architect proposals</h2><p className="text-sm text-stone-500">{detail.proposals.length} professional{detail.proposals.length===1?'':'s'} responded</p></div></div><div className="mt-4 space-y-3">{detail.proposals.map(item=><article key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start gap-3"><img src={item.architect_image||''} alt="" className="h-11 w-11 rounded-full bg-stone-100 object-cover"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link className="font-semibold hover:underline" to={`/users/${item.architect_id}`}>{item.architect_name}</Link><span className="text-xs text-stone-500">{item.firm_name||'Architect'} · {item.experience_years||0} years</span></div><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-600">{item.message}</p><p className="mt-2 text-xs text-stone-400">Sent {new Date(item.created_at).toLocaleDateString()} · {pretty(item.status)}</p></div></div><div className="mt-3 flex flex-wrap gap-2">{item.conversation_id&&<Link className="btn-secondary text-sm" to={`/messages?conversation=${item.conversation_id}`}>Message architect</Link>}{detail.status==='OPEN'&&['PENDING','SHORTLISTED'].includes(item.status)&&<><button className="btn-secondary text-sm" disabled={item.status==='SHORTLISTED'} onClick={()=>updateProposal(item.id,'SHORTLISTED')}>Shortlist</button><button className="btn-secondary text-sm text-red-700" onClick={()=>updateProposal(item.id,'REJECTED')}>Decline</button><button className="btn-primary text-sm" onClick={()=>updateProposal(item.id,'ACCEPTED')}>Accept proposal</button></>}</div></article>)}{!detail.proposals.length&&<p className="rounded-xl bg-stone-50 p-5 text-center text-sm text-stone-500">Architects who are interested will appear here. Share your brief so they can find it.</p>}</div></section>}
    </div>;
  }

  return <div className="space-y-5">
    <header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sage">{isClient?'Your project needs':'Opportunities from clients'}</p><h1 className="mt-1 text-3xl font-semibold">{isClient?'Post a project brief':'Client project board'}</h1><p className="mt-2 text-stone-500">{isClient?'Describe the work you need. Architects can discover your brief, introduce themselves, and message you.':'Browse client briefs, submit a proposal, and discuss the project directly with the client.'}</p></header>
    {!isClient&&<form onSubmit={search} className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4"><input className="field" placeholder="Search project briefs" value={filters.q} onChange={event=>setFilters({...filters,q:event.target.value})}/><select className="field" value={filters.category} onChange={event=>setFilters({...filters,category:event.target.value})}><option value="">All categories</option>{categories.map(category=><option key={category}>{category}</option>)}</select><input className="field" placeholder="Location" value={filters.location} onChange={event=>setFilters({...filters,location:event.target.value})}/><button className="btn-primary">Search briefs</button></form>}
    {isClient&&<form onSubmit={postBrief} className="card space-y-3 p-5">
      <h2 className="text-lg font-semibold">Create a public project brief</h2>
      <input className="field" name="title" placeholder="Project title" value={form.title} onChange={updateForm} maxLength="255" required/>
      <div className="grid gap-3 sm:grid-cols-2"><select className="field" name="category" value={form.category} onChange={updateForm}>{categories.map(category=><option key={category}>{category}</option>)}</select><input className="field" name="location" placeholder="Project location" value={form.location} onChange={updateForm}/></div>
      <textarea className="field min-h-28" name="description" placeholder="Describe the work, requirements and goals" value={form.description} onChange={updateForm} maxLength="10000" required/>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input className="field" name="land_area" placeholder="Land area" value={form.land_area} onChange={updateForm}/><input className="field" name="budget_min" type="number" min="0" step="0.01" placeholder="Minimum budget" value={form.budget_min} onChange={updateForm}/><input className="field" name="budget_max" type="number" min="0" step="0.01" placeholder="Maximum budget" value={form.budget_max} onChange={updateForm}/><input className="field" name="expected_timeline" placeholder="Expected timeline" value={form.expected_timeline} onChange={updateForm}/></div>
      <input className="field" name="preferred_style" placeholder="Preferred architectural style (optional)" value={form.preferred_style} onChange={updateForm}/>
      <label className="block text-sm text-stone-600">Reference images or documents (up to 5)<input className="mt-2 block w-full text-sm" type="file" name="files" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.txt" onChange={event=>setFiles([...event.target.files])}/></label>
      {files.length>0&&<p className="text-xs text-stone-500">{files.length} file(s) selected</p>}
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{notice&&<p role="status" className="text-sm text-green-700">{notice}</p>}
      <button className="btn-primary">Post project brief</button>
    </form>}
    {error&&!isClient&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="space-y-3"><h2 className="font-semibold">{isClient?'Your briefs':'Open client briefs'}</h2>{loading?<div className="card h-40 animate-pulse bg-stone-100"/>:items.map(item=><Link key={item.id} to={`${isClient?'/project-requests':'/project-board'}/${item.id}`} className="card block p-5 transition hover:border-sage/50"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-sage">{item.category}</p><h3 className="mt-1 text-lg font-semibold">{item.title}</h3><p className="mt-1 text-sm text-stone-500">{isClient?'Your brief':`${item.client_name} · ${item.location||'Location unspecified'}`}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-sand px-3 py-1 text-xs">{pretty(item.status||'OPEN')}</span><span className="text-xs text-stone-500">{isClient?`${item.proposal_count} proposal(s)`:Number(item.has_applied)?'Proposal sent':'Open to proposals'}</span></div></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-stone-600">{item.description}</p>{(item.budget_min||item.budget_max)&&<p className="mt-2 text-xs text-stone-500">Budget: {item.budget_min||'—'} – {item.budget_max||'—'}</p>}</Link>)}{!loading&&!items.length&&<div className="card p-8 text-center text-sm text-stone-500">{isClient?'You have not posted a project brief yet.':'No open project briefs match this search.'}</div>}</section>
    {!isClient&&result.total>result.limit&&<div className="flex items-center justify-between"><span className="text-sm text-stone-500">{result.total} briefs</span><div className="flex items-center gap-2"><button className="btn-secondary" disabled={page<=1} onClick={()=>{const next=page-1;setPage(next);loadList(next);}}>Previous</button><span className="text-sm">Page {page} of {Math.ceil(result.total/result.limit)}</span><button className="btn-secondary" disabled={page>=Math.ceil(result.total/result.limit)} onClick={()=>{const next=page+1;setPage(next);loadList(next);}}>Next</button></div></div>}
  </div>;
}
