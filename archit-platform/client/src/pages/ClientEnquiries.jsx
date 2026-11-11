import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const pretty = value => String(value || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export default function ClientEnquiries() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const loadList = async () => {
    setLoading(true);
    try { const {data} = await api.get('/enquiries'); setItems(data); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load enquiries'); }
    finally { setLoading(false); }
  };
  const loadDetail = async () => {
    try { const {data} = await api.get(`/enquiries/${id}`); setSelected(data); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Unable to load this enquiry'); }
  };
  useEffect(() => { loadList(); }, [user?.id]);
  useEffect(() => { setSelected(null); setError(''); if (id) loadDetail(); }, [id]);
  const changeStatus = async status => {
    try {
      await api.patch(`/enquiries/${id}/status`, {status});
      await loadDetail();
      await loadList();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not update enquiry'); }
  };
  const cancel = async () => {
    if (!window.confirm('Cancel this enquiry?')) return;
    try { await api.patch(`/enquiries/${id}/cancel`); await loadDetail(); await loadList(); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not cancel enquiry'); }
  };
  if (loading && !items.length && !id) return <div className="card h-64 animate-pulse bg-stone-100"/>;
  if (!id) return <div className="space-y-5">
    <header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sage">Project conversations</p><h1 className="mt-1 text-3xl font-semibold">My enquiries</h1><p className="mt-2 text-stone-500">Requirements and responses shared with architects.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="space-y-3">{items.map(item=><Link key={item.id} to={`/enquiries/${item.id}`} className="card flex flex-wrap items-center gap-4 p-5 hover:border-sage/50">
      <img src={item.other_party_image || ''} alt="" className="h-12 w-12 rounded-full bg-stone-100 object-cover"/><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{item.title}</h2><p className="text-sm text-stone-500">{item.other_party_name} · {new Date(item.created_at).toLocaleDateString()}</p></div>
      <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium">{pretty(item.status)}</span>{item.document_count > 0 && <span className="text-xs text-stone-500">{item.document_count} files</span>}
    </Link>)}
      {!items.length && <div className="card p-10 text-center text-stone-500">No enquiries yet. Start by exploring architects.</div>}
    </div>
  </div>;
  if (!selected) return error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : <div className="card h-64 animate-pulse bg-stone-100"/>;
  const isArchitect = user?.role === 'ARCHITECT';
  return <div className="space-y-5">
    <button className="text-sm font-medium text-sage hover:underline" onClick={()=>navigate('/enquiries')}>← All enquiries</button>
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-sage">{selected.category || 'Project enquiry'}</p><h1 className="mt-1 text-2xl font-semibold">{selected.title}</h1><p className="mt-2 text-sm text-stone-500">{isArchitect ? selected.client_name : selected.architect_name} · {new Date(selected.created_at).toLocaleDateString()}</p></div><span className="rounded-full bg-sand px-3 py-1.5 text-sm font-medium">{pretty(selected.status)}</span></div>
      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
        <div><h2 className="font-semibold">Project brief</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-stone-600">{selected.description}</p></div>
        <dl className="space-y-3 rounded-xl bg-stone-50 p-4 text-sm">
          {[['Location',selected.location],['Land area',selected.land_area],['Budget',selected.budget_min || selected.budget_max ? `${selected.budget_min || '—'} – ${selected.budget_max || '—'}` : selected.budget],['Timeline',selected.expected_timeline],['Preferred style',selected.preferred_style]].filter(([,value])=>value).map(([label,value])=><div key={label}><dt className="text-xs text-stone-500">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>)}
        </dl>
      </div>
      <div className="mt-6 border-t pt-5"><h2 className="font-semibold">Shared files</h2>{selected.documents?.length ? <div className="mt-2 flex flex-wrap gap-2">{selected.documents.map(file=><a key={file.id} className="btn-secondary text-sm" href={file.file_url} target="_blank" rel="noreferrer">{file.file_name}</a>)}</div> : <p className="mt-2 text-sm text-stone-500">No attachments were shared.</p>}</div>
      <div className="mt-6 flex flex-wrap gap-2 border-t pt-5">
        {selected.conversation_id && <Link className="btn-primary" to={`/messages?conversation=${selected.conversation_id}`}>Continue in messages</Link>}
        {isArchitect && (selected.status==='PENDING'||selected.status==='VIEWED'?['RESPONDED','IN_DISCUSSION','ACCEPTED','REJECTED']:selected.status==='RESPONDED'?['IN_DISCUSSION','ACCEPTED','REJECTED']:selected.status==='IN_DISCUSSION'?['ACCEPTED','REJECTED']:[]).map(status=><button key={status} className={status==='ACCEPTED'?'btn-primary':'btn-secondary'} onClick={()=>changeStatus(status)}>{status==='ACCEPTED'?'Accept and create project':pretty(status)}</button>)}
        {!isArchitect && ['PENDING','VIEWED','RESPONDED','IN_DISCUSSION'].includes(selected.status) && <button className="btn-secondary text-red-700" onClick={cancel}>Cancel enquiry</button>}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </section>
  </div>;
}
