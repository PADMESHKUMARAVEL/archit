import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Messages() {
  const {user} = useAuth(); const [items,setItems] = useState([]); const [active,setActive] = useState(null); const [messages,setMessages] = useState([]); const [text,setText] = useState('');
  const [photo,setPhoto] = useState(null);
  useEffect(()=>{api.get('/chat/conversations').then(r=>setItems(r.data));},[]);
  useEffect(()=>{
    if (!active) return;
    api.get(`/chat/${active.id}/messages`).then(r=>setMessages(r.data));
    const socket=io(import.meta.env.VITE_SOCKET_URL,{auth:{token:localStorage.getItem('archit_token')}});
    socket.on('connect',()=>socket.emit('conversation:join',{conversationId:active.id}));
    socket.on('message:new',m=>{if(Number(m.conversation_id)===Number(active.id))setMessages(prev=>prev.some(x=>x.id===m.id)?prev:[...prev,m]);});
    return ()=>socket.disconnect();
  },[active?.id]);
  const send=async e=>{
    e.preventDefault();
    if((!text.trim()&&!photo)||!active)return;
    const form=new FormData();
    form.append('message',text.trim());
    if(photo) form.append('photo',photo);
    const {data}=await api.post(`/chat/${active.id}/messages`,form,{headers:{'Content-Type':'multipart/form-data'}});
    setMessages(p=>p.some(x=>x.id===data.id)?p:[...p,data]);
    setText('');
    setPhoto(null);
  };
  return <div className="card overflow-hidden min-h-[65vh] grid grid-cols-1 md:grid-cols-[260px_1fr]">
    <aside className="border-b md:border-b-0 md:border-r p-4"><h1 className="font-bold mb-3">Messages</h1>{items.map(c=><button key={c.id} onClick={()=>setActive(c)} className={`block w-full text-left p-3 rounded-xl mb-1 ${active?.id===c.id?'bg-sand':'hover:bg-stone-50'}`}><b className="text-sm">{c.other_user_name || 'Conversation'}</b><p className="text-xs text-stone-500 truncate">{c.last_message || c.conversation_type}</p></button>)}{!items.length&&<p className="text-sm text-stone-500">No conversations yet. Accept a connection or send a client enquiry to start.</p>}</aside>
    <section className="flex flex-col min-h-[60vh]"><div className="p-4 border-b font-semibold">{active?.other_user_name || 'Select a conversation'}</div><div className="flex-1 p-4 space-y-3 overflow-y-auto">{messages.map(m=><div key={m.id} className={`max-w-[80%] rounded-2xl p-3 text-sm ${m.sender_id===user?.id?'ml-auto bg-ink text-white':'bg-sand'}`}>{m.message&&<p className="whitespace-pre-wrap">{m.message}</p>}{m.attachment_url&&<img src={m.attachment_url} alt="Shared photo" className="mt-2 max-h-72 rounded-lg object-contain"/>}<p className={`text-[10px] mt-1 ${m.sender_id===user?.id?'text-stone-300':'text-stone-500'}`}>{m.sender_name}</p></div>)}</div>{active&&<form onSubmit={send} className="p-3 border-t space-y-2"><div className="flex gap-2"><input className="field" value={text} onChange={e=>setText(e.target.value)} placeholder="Write a message..."/><button className="btn-primary">Send</button></div><div className="flex items-center gap-3"><label className="text-sm cursor-pointer text-sage font-semibold">Attach photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e=>setPhoto(e.target.files?.[0]||null)}/></label>{photo&&<span className="text-xs text-stone-500">{photo.name}</span>}</div></form>}</section>
  </div>;
}
