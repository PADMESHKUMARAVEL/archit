import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
export default function Discover() {
  const {user} = useAuth();
  const [people,setPeople] = useState([]);
  const [q,setQ] = useState('');
  const [error,setError] = useState('');
  const targetRole = user?.role === 'ARCHITECT' ? 'CLIENT' : undefined;
  const load=async()=>{
    setError('');
    try {
      const {data}=await api.get('/users',{params:{role:targetRole,q}});
      const candidates=data.filter(person=>person.id!==user?.id);
      if(user?.role==='ARCHITECT') {
        const states=await Promise.all(candidates.map(person=>api.get(`/network/status/${person.id}`)));
        setPeople(candidates.map((person,index)=>({...person,connection:states[index].data})));
      } else setPeople(candidates);
    } catch (requestError) {
      setError(requestError.response?.data?.message||'Could not load people');
    }
  };
  useEffect(()=>{load();},[user?.id,user?.role]);
  const search=async event=>{event.preventDefault();await load();};
  const connect=async person=>{
    setError('');
    try {
      await api.post(`/network/request/${person.id}`);
      setPeople(current=>current.map(item=>item.id===person.id?{...item,connection:{status:'PENDING',requester_id:user.id}}:item));
    } catch(requestError) {
      setError(requestError.response?.data?.message||'Could not contact this client');
    }
  };
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold">{user?.role==='ARCHITECT'?'Discover clients':'Discover people'}</h1><p className="text-stone-500">{user?.role==='ARCHITECT'?'Find clients, view their profiles, and request a connection to discuss working together.':'Explore professionals and their work.'}</p></div>
    <form onSubmit={search} className="flex gap-2"><input className="field" placeholder="Search by name, bio or location" value={q} onChange={event=>setQ(event.target.value)}/><button className="btn-primary">Search</button></form>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2">{people.map(person=><div key={person.id} className="card p-5"><div className="flex items-center gap-3"><img src={person.profile_image||''} alt="" className="h-12 w-12 rounded-full bg-stone-100 object-cover"/><div><div className="font-bold">{person.name}</div><p className="mt-1 text-xs font-semibold text-sage">{person.role}</p></div></div><p className="mt-3 text-sm text-stone-500">{person.bio||'No bio added yet.'}</p><p className="mt-2 text-xs text-stone-400">{person.location||'Location not specified'}</p><div className="mt-4 flex flex-wrap gap-2"><Link className="btn-secondary text-sm" to={`/users/${person.id}`}>View profile</Link>{user?.role==='ARCHITECT'&&person.role==='CLIENT'&&(person.connection?.status==='ACCEPTED'?<span className="self-center text-xs text-stone-500">Connected</span>:person.connection?.status==='PENDING'?<span className="self-center text-xs text-stone-500">{Number(person.connection.requester_id)===Number(user.id)?'Request sent':'Request received'}</span>:<button className="btn-primary text-sm" onClick={()=>connect(person)}>Connect with client</button>)}</div></div>)}</div>
    {!people.length&&<div className="card p-8 text-center text-sm text-stone-500">No profiles found. Try a broader search.</div>}
  </div>;
}
