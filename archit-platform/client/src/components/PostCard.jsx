import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function PostCard({ post, onChanged, highlighted = false }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]); const [show, setShow] = useState(false); const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const like = async () => { await api.post(`/posts/${post.id}/like`); onChanged(); };
  const loadComments = async () => { if (!show) { const { data } = await api.get(`/posts/${post.id}/comments`); setComments(data); } setShow(!show); };
  const addComment = async event => { event.preventDefault(); if (!comment.trim()) return; await api.post(`/posts/${post.id}/comments`, { comment }); setComment(''); const { data } = await api.get(`/posts/${post.id}/comments`); setComments(data); };
  const remove = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api.delete(`/posts/${post.id}`);
      await onChanged();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete post');
    }
  };
  return <article id={`post-${post.id}`} className={`card p-5 ${highlighted ? 'ring-2 ring-sage' : ''}`}><div className="flex items-start justify-between gap-3 mb-3"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-sand flex items-center justify-center font-bold">{post.name?.[0]}</div><div><Link className="font-semibold hover:underline" to={`/users/${post.user_id}`}>{post.name}</Link><div className="text-xs text-stone-500">{post.role} · {new Date(post.created_at).toLocaleString()}</div></div></div><div className="flex items-center">{Number(post.user_id) === Number(user?.id) && <button onClick={remove} className="rounded-lg p-2 text-stone-500 hover:bg-red-50 hover:text-red-700" aria-label="Delete post" title="Delete post"><Trash2 size={17}/></button>}<Link to={`/messages?shareType=POST&shareId=${post.id}`} className="rounded-lg p-2 text-stone-500 hover:bg-sand hover:text-sage" aria-label="Share post in chat" title="Share post in chat"><Share2 size={17}/></Link></div></div><p className="whitespace-pre-wrap leading-7">{post.content}</p>{post.media?.map(media => media.media_type === 'IMAGE' ? <img key={media.id || media.media_url} src={media.media_url} alt="Post attachment" className="mt-4 max-h-[480px] w-full rounded-xl object-cover"/> : <a key={media.id || media.media_url} href={media.media_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-sage underline">Open attached file</a>)}<div className="mt-4 pt-3 border-t flex gap-5 text-sm text-stone-600"><button onClick={like} className="flex items-center gap-2 hover:text-rose-600"><Heart size={17}/>{post.likes_count} Like</button><button onClick={loadComments} className="flex items-center gap-2 hover:text-sage"><MessageCircle size={17}/>Comments</button></div>{error&&<p className="mt-3 text-sm text-red-600">{error}</p>}{show && <div className="mt-4 space-y-3">{comments.map(item => <div key={item.id} className="text-sm"><b>{item.name}</b><span className="text-stone-500"> · {item.comment}</span></div>)}<form onSubmit={addComment} className="flex gap-2"><input className="field" value={comment} onChange={event => setComment(event.target.value)} placeholder="Write a comment..."/><button className="btn-primary">Send</button></form></div>}</article>;
}
