import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const statuses = ['INITIATED','PLANNING','DESIGN','APPROVAL','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED'];
const pretty = value => String(value || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export default function ClientProjects() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const loadList = async () => {
    try { const {data} = await api.get('/client/projects'); setProjects(data); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load projects'); }
  };
  useEffect(() => { loadList(); }, [user?.id]);
  useEffect(() => {
    setError('');
    setProject(null);
    if (id) api.get(`/client/projects/${id}`).then(({data})=>setProject(data))
      .catch(requestError=>setError(requestError.response?.data?.message || 'Unable to load this project'));
  }, [id]);
  if (!id) return <div className="space-y-5">
    <header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sage">Work in progress</p><h1 className="mt-1 text-3xl font-semibold">My projects</h1><p className="mt-2 text-stone-500">Accepted enquiries and the updates shared by your architect.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-3 md:grid-cols-2">{projects.map(item=><Link className="card p-5 hover:border-sage/50" to={`/projects/${item.id}`} key={item.id}>
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-sage">{item.category || 'Architecture project'}</p><h2 className="mt-1 text-lg font-semibold">{item.title}</h2><p className="mt-1 text-sm text-stone-500">{item.other_party_name}{item.location ? ` · ${item.location}` : ''}</p></div><span className="rounded-full bg-sand px-3 py-1 text-xs">{pretty(item.status)}</span></div>
      {item.latest_update && <p className="mt-4 line-clamp-2 border-t pt-3 text-sm text-stone-600">{item.latest_update}</p>}<p className="mt-3 text-xs text-stone-400">Updated {new Date(item.latest_update_at || item.updated_at).toLocaleDateString()}</p>
    </Link>)}</div>
    {!projects.length && <div className="card p-10 text-center text-stone-500">Accepted enquiries will appear here as active projects.</div>}
  </div>;
  if (!project) return error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : <div className="card h-64 animate-pulse bg-stone-100"/>;
  const isArchitect = user?.role === 'ARCHITECT';
  const updateStatus = async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try { await api.patch(`/client/projects/${id}/status`, {status: form.get('status'), expected_completion_date: form.get('expected_completion_date') || null}); const {data}=await api.get(`/client/projects/${id}`);setProject(data); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not update project status'); }
  };
  const publishUpdate = async event => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    try { await api.post(`/client/projects/${id}/updates`, form); const {data}=await api.get(`/client/projects/${id}`);setProject(data);formElement.reset(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not publish update'); }
  };
  const uploadFiles = async event => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const body = new FormData(formElement);
    try { await api.post(`/client/projects/${id}/documents`, body); const {data}=await api.get(`/client/projects/${id}`);setProject(data);formElement.reset(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not upload documents'); }
  };
  const addMilestone = async event => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const body = Object.fromEntries(new FormData(formElement));
    try { await api.post(`/client/projects/${id}/milestones`, body); const {data}=await api.get(`/client/projects/${id}`);setProject(data);formElement.reset(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not add milestone'); }
  };
  const toggleMilestone = async milestone => {
    const status = milestone.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try { await api.patch(`/client/projects/${id}/milestones/${milestone.id}`, {status}); const {data}=await api.get(`/client/projects/${id}`);setProject(data); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not update milestone'); }
  };
  return <div className="space-y-5">
    <button className="text-sm font-medium text-sage hover:underline" onClick={()=>navigate('/projects')}>← All projects</button>
    <section className="card p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-sage">{project.category || 'Architecture project'}</p><h1 className="mt-1 text-2xl font-semibold">{project.title}</h1><p className="mt-2 text-sm text-stone-500">{project.location || 'Location not specified'} · {isArchitect ? project.client_name : project.architect_name}</p></div><span className="rounded-full bg-sand px-3 py-1.5 text-sm">{pretty(project.status)}</span></div>
      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]"><div><h2 className="font-semibold">Project brief</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-600">{project.description}</p></div><div className="rounded-xl bg-stone-50 p-4 text-sm"><p><b>Expected timeline:</b> {project.expected_timeline || 'Not specified'}</p><p className="mt-2"><b>Land area:</b> {project.land_area || 'Not specified'}</p><p className="mt-2"><b>Budget:</b> {project.budget_min || project.budget_max ? `${project.budget_min || '—'} – ${project.budget_max || '—'}` : project.budget || 'Not specified'}</p>{project.expected_completion_date && <p className="mt-2"><b>Expected completion:</b> {new Date(project.expected_completion_date).toLocaleDateString()}</p>}</div></div>
    </section>
    {isArchitect && <div className="grid gap-4 md:grid-cols-2"><form onSubmit={publishUpdate} className="card space-y-3 p-5"><h2 className="font-semibold">Publish project update</h2><textarea className="field min-h-24" name="message" placeholder="Progress update" maxLength="5000" required/><input className="field" name="progress" type="number" min="0" max="100" placeholder="Progress percentage (optional)"/><button className="btn-primary">Publish update</button></form><form onSubmit={updateStatus} className="card space-y-3 p-5"><h2 className="font-semibold">Project status</h2><select className="field" name="status" defaultValue={project.status}>{statuses.map(status=><option key={status} value={status}>{pretty(status)}</option>)}</select><label className="text-sm text-stone-500">Expected completion date<input className="field mt-1" name="expected_completion_date" type="date" defaultValue={project.expected_completion_date?.slice(0,10) || ''}/></label><button className="btn-secondary">Save status</button></form></div>}
    <section className="card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Milestones</h2><p className="text-sm text-stone-500">{project.milestones?.filter(item=>item.status==='COMPLETED').length || 0} of {project.milestones?.length || 0} complete</p></div>{isArchitect&&<form onSubmit={addMilestone} className="mt-4 grid gap-2 border-b pb-4 sm:grid-cols-[1fr_180px_auto]"><input className="field" name="title" placeholder="Milestone title" maxLength="255" required/><input className="field" name="due_date" type="date"/><button className="btn-secondary">Add milestone</button><textarea className="field sm:col-span-3" name="description" placeholder="Description (optional)" maxLength="5000"/></form>}<div className="mt-3 divide-y">{project.milestones?.map(milestone=><div key={milestone.id} className="flex items-start gap-3 py-3"><span className={`mt-1 h-3 w-3 rounded-full ${milestone.status==='COMPLETED'?'bg-sage':'bg-stone-300'}`}/><div className="min-w-0 flex-1"><p className={`font-medium ${milestone.status==='COMPLETED'?'text-stone-400 line-through':''}`}>{milestone.title}</p>{milestone.description&&<p className="mt-1 text-sm text-stone-500">{milestone.description}</p>}{milestone.due_date&&<p className="mt-1 text-xs text-stone-400">Due {new Date(milestone.due_date).toLocaleDateString()}</p>}</div>{isArchitect&&<button className="text-xs font-semibold text-sage" onClick={()=>toggleMilestone(milestone)}>{milestone.status==='COMPLETED'?'Reopen':'Complete'}</button>}</div>)}{!project.milestones?.length&&<p className="py-4 text-sm text-stone-500">No milestones have been added.</p>}</div></section>
    <section className="card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Progress updates</h2>{project.updates?.length>0&&<div className="h-2 w-40 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-sage" style={{width:`${Math.max(...project.updates.map(item=>item.progress ?? 0))}%`}}/></div>}</div><div className="mt-4 space-y-3">{project.updates?.map(item=><article key={item.id} className="rounded-xl bg-stone-50 p-4"><div className="flex justify-between gap-3"><b className="text-sm">{item.author_name}</b><time className="text-xs text-stone-400">{new Date(item.created_at).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-600">{item.message}</p>{item.progress !== null && <p className="mt-2 text-xs font-medium text-sage">{item.progress}% complete</p>}</article>)}{!project.updates?.length&&<p className="text-sm text-stone-500">No progress updates have been shared yet.</p>}</div></section>
    <section className="card p-5"><h2 className="text-lg font-semibold">Shared documents</h2><div className="mt-3 flex flex-wrap gap-2">{project.documents?.map(file=><a key={file.id} className="btn-secondary text-sm" href={file.file_url} target="_blank" rel="noreferrer">{file.file_name}</a>)}{!project.documents?.length&&<p className="text-sm text-stone-500">No documents shared yet.</p>}</div><form onSubmit={uploadFiles} className="mt-4 flex flex-wrap items-end gap-3 border-t pt-4"><label className="min-w-52 flex-1 text-sm text-stone-600">Add images or documents<input className="mt-1 block w-full text-sm" type="file" name="files" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.txt" required/></label><button className="btn-primary">Upload files</button></form></section>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>;
}
