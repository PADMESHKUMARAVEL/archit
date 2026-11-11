import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Link, useSearchParams } from 'react-router-dom';
import { Share2, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Messages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {user} = useAuth(); const [items,setItems] = useState([]); const [active,setActive] = useState(null); const [messages,setMessages] = useState([]); const [text,setText] = useState('');
  const [photo,setPhoto] = useState(null);
  const [error,setError] = useState('');
  const shareType = searchParams.get('shareType');
  const shareId = searchParams.get('shareId');
  const sharing = ['PROFILE','POST'].includes(shareType) && Number.isSafeInteger(Number(shareId)) && Number(shareId) > 0;
  useEffect(()=>{
    api.get('/chat/conversations').then(r=>{
      setItems(r.data);
      const requested = r.data.find(item=>Number(item.id)===Number(searchParams.get('conversation')));
      if (requested && (!sharing || requested.conversation_type==='CONNECTION')) setActive(requested);
    }).catch(requestError=>setError(requestError.response?.data?.message || 'Unable to load conversations'));
  },[]);
  useEffect(()=>{
    if (!active) return;
    api.get(`/chat/${active.id}/messages`).then(r=>{
      setMessages(r.data);
      setItems(current=>current.map(item=>Number(item.id)===Number(active.id)?{...item,unread_count:0}:item));
    }).catch(requestError=>setError(requestError.response?.data?.message || 'Unable to load messages'));
    const socket=io(import.meta.env.VITE_SOCKET_URL,{auth:{token:localStorage.getItem('archit_token')}});
    socket.on('connect',()=>socket.emit('conversation:join',{conversationId:active.id}));
    socket.on('message:new',m=>{
      if(Number(m.conversation_id)!==Number(active.id)) return;
      if(m.shared_type) {
        api.get(`/chat/${active.id}/messages`).then(response=>setMessages(response.data)).catch(requestError=>setError(requestError.response?.data?.message || 'Unable to load shared item'));
      } else {
        setMessages(prev=>prev.some(x=>x.id===m.id)?prev:[...prev,m]);
      }
    });
    socket.on('message:deleted',event=>{if(Number(event.conversationId)===Number(active.id))setMessages(prev=>prev.filter(message=>Number(message.id)!==Number(event.messageId)));});
    return ()=>socket.disconnect();
  },[active?.id]);
  const send=async e=>{
    e.preventDefault();
    if((!text.trim()&&!photo&&!sharing)||!active)return;
    if(sharing && active.conversation_type!=='CONNECTION') {
      setError('Profiles and posts can only be shared in a connection chat.');
      return;
    }
    const form=new FormData();
    form.append('message',text.trim());
    if(photo) form.append('photo',photo);
    if(sharing) {
      form.append('shareType',shareType);
      form.append('shareId',shareId);
    }
    try {
      const {data}=await api.post(`/chat/${active.id}/messages`,form,{headers:{'Content-Type':'multipart/form-data'}});
      setMessages(p=>p.some(x=>x.id===data.id)?p:[...p,data]);
      setText('');
      setPhoto(null);
      if(sharing) setSearchParams(current=>{current.delete('shareType');current.delete('shareId');return current;},{replace:true});
      setError('');
    } catch(requestError) {
      setError(requestError.response?.data?.message || 'Could not send message');
    }
  };
  const deleteMessage = async (message, scope) => {
    const prompt = scope === 'everyone'
      ? 'Delete this message for everyone?'
      : 'Delete this message only for you?';
    if (!window.confirm(prompt)) return;
    try {
      await api.delete(`/chat/${active.id}/messages/${message.id}`,{params:{for:scope}});
      setMessages(current=>current.filter(item=>Number(item.id)!==Number(message.id)));
      const {data}=await api.get('/chat/conversations');
      setItems(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not delete message');
    }
  };
  const clearConversation = async () => {
    if (!window.confirm('Clear this entire conversation for you? The other participant will still see their messages.')) return;
    try {
      await api.delete(`/chat/${active.id}/messages`);
      setMessages([]);
      setError('');
      const {data}=await api.get('/chat/conversations');
      setItems(data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not clear conversation');
    }
  };
  return <div className="card overflow-hidden min-h-[65vh] grid grid-cols-1 md:grid-cols-[260px_1fr]">
    <aside className="border-b md:border-b-0 md:border-r p-4"><h1 className="font-bold mb-3">Messages</h1>{sharing&&<p className="mb-3 rounded-lg bg-sand p-3 text-xs text-stone-600">Choose a connection chat to share this {shareType==='PROFILE'?'profile':'post'}.</p>}{items.map(c=><button key={c.id} onClick={()=>setActive(c)} disabled={sharing&&c.conversation_type!=='CONNECTION'} className={`block w-full text-left p-3 rounded-xl mb-1 ${Number(active?.id)===Number(c.id)?'bg-sand':'hover:bg-stone-50'} ${sharing&&c.conversation_type!=='CONNECTION'?'cursor-not-allowed opacity-40':''}`}><span className="flex items-center justify-between gap-2"><b className="truncate text-sm">{c.other_user_name || 'Conversation'}</b>{Number(c.unread_count)>0&&<span className="rounded-full bg-sage px-2 py-0.5 text-[10px] text-white">{c.unread_count}</span>}</span><p className="text-xs text-stone-500 truncate">{c.last_message || c.conversation_type}</p></button>)}{!items.length&&<p className="text-sm text-stone-500">No conversations yet. Accept a connection or send a client enquiry to start.</p>}</aside>
    <section className="flex flex-col min-h-[60vh]"><div className="p-4 border-b flex items-center justify-between gap-3"><span className="font-semibold">{active?.other_user_name || 'Select a conversation'}</span>{active&&<button onClick={clearConversation} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-stone-600 hover:bg-red-50 hover:text-red-700"><Trash2 size={15}/>Clear chat</button>}</div>{error&&<p className="px-4 pt-3 text-sm text-red-600">{error}</p>}{sharing&&active?.conversation_type==='CONNECTION'&&<div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-sage/30 bg-sand p-3 text-sm"><Share2 size={16}/><span>Ready to share a {shareType==='PROFILE'?'profile':'post'} with {active.other_user_name}.</span></div>}<div className="flex-1 p-4 space-y-3 overflow-y-auto">{messages.map(m=>{const isMine=Number(m.sender_id)===Number(user?.id);return <div key={m.id} className={`max-w-[80%] rounded-2xl p-3 text-sm ${isMine?'ml-auto bg-ink text-white':'bg-sand'}`}>{m.message&&<p className="whitespace-pre-wrap">{m.message}</p>}{m.shared_type==='PROFILE'&&(m.shared_item?.profile?<Link to={`/users/${m.shared_item.profile.id}`} className="mt-2 block rounded-xl border border-white/25 p-3 hover:bg-white/10"><b>{m.shared_item.profile.name}</b><p className="text-xs opacity-80">{m.shared_item.profile.role} profile</p>{m.shared_item.profile.is_connection?<p className="mt-2 whitespace-pre-wrap text-xs">{m.shared_item.profile.bio||'No bio added yet.'}</p>:<p className="mt-2 text-xs">Connect with this person to see their full profile.</p>}</Link>:<p className="mt-2 rounded-lg border border-white/25 p-3 text-xs">This profile is no longer available.</p>)}{m.shared_type==='POST'&&(m.shared_item?.post?<div className="mt-2 rounded-xl border border-white/25 p-3"><p className="mb-2 text-xs">Post by <Link className="font-semibold underline" to={`/users/${m.shared_item.post.user_id}?postId=${m.shared_item.post.id}`}>{m.shared_item.post.name}</Link></p><p className="whitespace-pre-wrap">{m.shared_item.post.content}</p>{m.shared_item.post.media?.map(media=>media.media_type==='IMAGE'?<img key={media.id} src={media.media_url} alt="Shared post attachment" className="mt-2 max-h-64 rounded-lg object-contain"/>:<a key={media.id} href={media.media_url} target="_blank" rel="noreferrer" className="mt-2 block text-xs underline">Open attached file</a>)}<Link className="mt-2 inline-block text-xs underline" to={`/users/${m.shared_item.post.user_id}?postId=${m.shared_item.post.id}`}>View post</Link></div>:<p className="mt-2 rounded-lg border border-white/25 p-3 text-xs">This post isn't available to you. Connect with its author to view connections-only posts.</p>)}{m.attachment_url&&<img src={m.attachment_url} alt="Shared photo" className="mt-2 max-h-72 rounded-lg object-contain"/>}<p className={`text-[10px] mt-1 ${isMine?'text-stone-300':'text-stone-500'}`}>{m.sender_name}</p><div className="mt-2 flex flex-wrap gap-3 border-t border-white/20 pt-2"><button type="button" onClick={()=>deleteMessage(m,'me')} className="text-[11px] underline opacity-80 hover:opacity-100">Delete for me</button>{isMine&&<button type="button" onClick={()=>deleteMessage(m,'everyone')} className="text-[11px] underline opacity-80 hover:opacity-100">Delete for everyone</button>}</div></div>;})}</div>{active&&<form onSubmit={send} className="p-3 border-t space-y-2"><div className="flex gap-2"><input className="field" value={text} onChange={e=>setText(e.target.value)} placeholder="Write a message..."/><button className="btn-primary" disabled={sharing&&active.conversation_type!=='CONNECTION'}>Send</button></div><div className="flex items-center gap-3"><label className="text-sm cursor-pointer text-sage font-semibold">Attach photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label>{photo&&<span className="text-xs text-stone-500">{photo.name}</span>}</div></form>}</section>
  </div>;
}
