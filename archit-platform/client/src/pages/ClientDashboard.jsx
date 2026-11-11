import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, MessageCircle, Search } from 'lucide-react';
import api from '../services/api';

export default function ClientDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/client/dashboard').then(({data: dashboard})=>setData(dashboard))
      .catch(requestError=>setError(requestError.response?.data?.message || 'Unable to load your dashboard'));
  }, []);
  if (error) return <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>;
  if (!data) return <div className="card h-64 animate-pulse bg-stone-100"/>;
  const cards = [
    { title: 'Total enquiries', value: data.enquiries.total || 0, icon: BriefcaseBusiness, tint: 'bg-sand' },
    { title: 'Awaiting response', value: data.enquiries.pending || 0, icon: Clock3, tint: 'bg-amber-50' },
    { title: 'Active projects', value: data.projects.active || 0, icon: CheckCircle2, tint: 'bg-emerald-50' },
    { title: 'Unread messages', value: data.unread_messages || 0, icon: MessageCircle, tint: 'bg-blue-50' }
  ];
  return <div className="space-y-6">
    <header className="card overflow-hidden bg-ink p-7 text-white sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sage">Client workspace</p>
      <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Make your next space a considered one.</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-stone-300">Find a professional, share your brief, and keep every project conversation and update in one place.</p>
      <div className="mt-6 flex flex-wrap gap-3"><Link className="btn-primary bg-white text-ink hover:bg-stone-100" to="/discover"><Search size={16} className="mr-2"/>Discover architects</Link><Link className="btn-secondary border-white/30 bg-transparent text-white hover:bg-white/10" to="/project-requests">Post a project brief<ArrowRight size={16} className="ml-2"/></Link><Link className="btn-secondary border-white/30 bg-transparent text-white hover:bg-white/10" to="/projects">View projects</Link></div>
    </header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({title,value,icon:Icon,tint})=><article key={title} className="card flex items-center gap-4 p-5"><div className={`rounded-xl p-3 ${tint}`}><Icon size={20}/></div><div><p className="text-sm text-stone-500">{title}</p><p className="text-2xl font-semibold">{value}</p></div></article>)}</section>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
      <section className="card p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Recent enquiries</h2><p className="text-sm text-stone-500">Keep track of conversations with architects.</p></div><Link className="text-sm font-semibold text-sage" to="/enquiries">View all</Link></div>
        <div className="mt-4 divide-y">{data.recent_enquiries.map(enquiry=><Link key={enquiry.id} to={`/enquiries/${enquiry.id}`} className="flex items-center gap-3 py-3 hover:bg-stone-50"><img src={enquiry.architect_image || ''} alt="" className="h-10 w-10 rounded-full bg-stone-100 object-cover"/><div className="min-w-0 flex-1"><p className="truncate font-medium">{enquiry.title}</p><p className="text-xs text-stone-500">{enquiry.architect_name}</p></div><span className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-medium">{enquiry.status.replaceAll('_',' ')}</span></Link>)}
          {!data.recent_enquiries.length && <div className="py-10 text-center"><p className="text-sm text-stone-500">Your first enquiry is a few steps away.</p><Link className="mt-3 inline-block text-sm font-semibold text-sage underline" to="/discover">Browse architects</Link></div>}</div>
      </section>
      <div className="space-y-5"><section className="card p-5"><h2 className="text-lg font-semibold">Project snapshot</h2><p className="mt-1 text-sm text-stone-500">Accepted enquiries appear here as projects.</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-stone-50 p-4"><p className="text-xs text-stone-500">Active</p><p className="mt-1 text-2xl font-semibold">{data.projects.active || 0}</p></div><div className="rounded-xl bg-stone-50 p-4"><p className="text-xs text-stone-500">Completed</p><p className="mt-1 text-2xl font-semibold">{data.projects.completed || 0}</p></div></div>{data.recent_projects.map(project=><Link className="mt-3 block rounded-lg border p-3 hover:bg-stone-50" to={`/projects/${project.id}`} key={project.id}><span className="flex items-center justify-between gap-2"><b className="truncate text-sm">{project.title}</b><span className="text-[10px] text-sage">{project.status.replaceAll('_',' ')}</span></span>{project.latest_update&&<p className="mt-1 line-clamp-2 text-xs text-stone-500">{project.latest_update}</p>}</Link>)}<Link className="btn-secondary mt-4 w-full" to="/projects">Open my projects</Link></section>
        <section className="card p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Recent notifications</h2><Link className="text-xs font-semibold text-sage" to="/notifications">View all</Link></div><div className="mt-2 divide-y">{data.recent_notifications.map(item=><Link to="/notifications" key={item.id} className="block py-2"><p className="text-sm font-medium">{item.title}</p><p className="line-clamp-1 text-xs text-stone-500">{item.message}</p></Link>)}{!data.recent_notifications.length&&<p className="py-3 text-sm text-stone-500">No recent notifications.</p>}</div></section></div>
    </div>
  </div>;
}
