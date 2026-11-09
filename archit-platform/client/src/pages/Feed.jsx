import { useEffect, useState } from 'react';
import api from '../services/api';
import PostCard from '../components/PostCard';
import { useAuth } from '../context/AuthContext';

export default function Feed() {
  const {user} = useAuth(); const [posts,setPosts] = useState([]); const [content,setContent] = useState(''); const [visibility,setVisibility] = useState('PUBLIC'); const [error,setError] = useState('');
  const load = async () => { const {data} = await api.get('/posts'); setPosts(data); };
  useEffect(()=>{load().catch(()=>setError('Could not load feed'));},[]);
  const [attachment,setAttachment] = useState(null);
  const publish = async e => { e.preventDefault(); if (!content.trim() && !attachment) return; try { const data=new FormData(); data.append('content',content); data.append('visibility',visibility); if(attachment) data.append('attachment',attachment); await api.post('/posts',data); setContent(''); setAttachment(null); e.currentTarget.reset(); await load(); } catch(err) { setError(err.response?.data?.message || 'Could not publish'); } };
  return <div className="max-w-3xl mx-auto space-y-5">
    <div><h1 className="text-2xl font-bold">Your architecture feed</h1><p className="text-stone-500">Ideas, projects and opportunities from your network.</p></div>
    {user && <form onSubmit={publish} className="card p-5 space-y-3">
      <textarea className="field min-h-28 resize-y" placeholder="Share a project, idea or update..." value={content} onChange={e=>setContent(e.target.value)}/>
      <div className="flex flex-wrap justify-between items-center gap-3"><label className="text-sm">Photo or file <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.doc,.docx,.txt" onChange={e=>setAttachment(e.target.files?.[0]||null)}/></label><select className="field max-w-48" value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="PUBLIC">Public post</option><option value="CONNECTIONS">Connections only</option></select><button className="btn-primary">Publish post</button></div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>}
    {posts.map(p=><PostCard key={p.id} post={p} onChanged={load}/>)}
    {!posts.length && <div className="card p-8 text-center text-stone-500">No posts yet. Share the first project update.</div>}
  </div>;
}
