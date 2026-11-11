import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

function destination(item, role) {
  if (!item.reference_id) return null;
  if (item.notification_type === 'ENQUIRY') return `/enquiries/${item.reference_id}`;
  if (item.notification_type === 'PROJECT_PROPOSAL') return role === 'ARCHITECT'
    ? `/project-board/${item.reference_id}`
    : `/project-requests/${item.reference_id}`;
  if (['PROJECT_UPDATE','PROJECT_STATUS'].includes(item.notification_type)) return `/projects/${item.reference_id}`;
  return null;
}

export default function Notifications() {
  const {user} = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/notifications').then(({data})=>setItems(data)).catch(requestError=>setError(requestError.response?.data?.message || 'Unable to load notifications')); }, []);
  const markRead = async item => {
    try { await api.patch(`/notifications/${item.id}/read`); setItems(current=>current.map(row=>row.id===item.id?{...row,is_read:1}:row)); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not mark notification as read'); }
  };
  const markAll = async () => {
    try { await api.patch('/notifications/read-all'); setItems(current=>current.map(row=>({...row,is_read:1}))); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not mark notifications as read'); }
  };
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sage">Updates</p><h1 className="mt-1 text-3xl font-semibold">Notifications</h1></div>{items.some(item=>!item.is_read)&&<button className="btn-secondary" onClick={markAll}>Mark all read</button>}</header>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="card divide-y">{items.map(item=>{const to=destination(item,user?.role);const content=<div className="flex flex-1 items-start gap-3"><span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.is_read?'bg-stone-200':'bg-sage'}`}/><div className="flex-1"><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-stone-600">{item.message}</p><time className="mt-2 block text-xs text-stone-400">{new Date(item.created_at).toLocaleString()}</time></div></div>;return <div key={item.id} className="flex items-center gap-3 p-4">{to?<Link to={to} className="flex flex-1 hover:opacity-80" onClick={()=>!item.is_read&&markRead(item)}>{content}</Link>:content}{!item.is_read&&<button className="text-xs font-semibold text-sage" onClick={()=>markRead(item)}>Mark read</button>}</div>;})}
      {!items.length&&!error&&<p className="p-10 text-center text-sm text-stone-500">You are all caught up.</p>}</div>
  </div>;
}
