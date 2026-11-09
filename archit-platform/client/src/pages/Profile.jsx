import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
export default function Profile() {
  const {user} = useAuth(); const [form,setForm] = useState({name:'',bio:'',location:'',profile_image:''}); const [saved,setSaved] = useState(false);
  useEffect(()=>{api.get('/auth/me').then(({data})=>setForm({name:data.name||'',bio:data.bio||'',location:data.location||'',profile_image:data.profile_image||''}));},[]);
  const submit=async e=>{e.preventDefault();await api.patch('/users/me',form);setSaved(true);};
  const uploadPhoto=async e=>{
    if (!e.target.files?.[0]) return;
    const data=new FormData();
    data.append('photo',e.target.files[0]);
    const response=await api.post('/users/me/photo',data,{headers:{'Content-Type':'multipart/form-data'}});
    setForm(current=>({...current,profile_image:response.data.profile_image}));
    setSaved(true);
  };
  return <div className="card p-6 max-w-2xl"><h1 className="text-2xl font-bold">Your profile</h1><p className="text-sm text-stone-500 mb-5">{user?.role}</p><form onSubmit={submit} className="space-y-4">
    <div className="flex items-center gap-4">
      {form.profile_image ? <img src={form.profile_image} alt="Profile" className="h-24 w-24 rounded-full object-cover"/> : <div className="h-24 w-24 rounded-full bg-sand flex items-center justify-center text-3xl">{form.name?.[0] || '?'}</div>}
      <div><label className="btn-primary cursor-pointer inline-block">Upload photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={uploadPhoto}/></label><p className="text-xs text-stone-500 mt-2">JPG, PNG, WEBP or GIF, up to 5 MB</p></div>
    </div>
    <label className="block text-sm">Name</label><input className="field" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
    <label className="block text-sm">Bio</label><textarea className="field min-h-28" value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/>
    <label className="block text-sm">Location</label><input className="field" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/>
    <button className="btn-primary">Save profile</button>{saved&&<span className="text-sm text-green-700 ml-3">Saved</span>}
  </form></div>;
}
