import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ClientSettings() {
  const {user} = useAuth();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState({current_password:'',new_password:'',confirm_password:''});
  const preferences = form?.notification_preferences || {messages:true,enquiries:true,projects:true,activity:true};
  const setPreference = (key, value) => setForm(current=>({...current,notification_preferences:{...preferences,[key]:value}}));
  useEffect(() => {
    api.get('/client/profile').then(({data})=>setForm(data))
      .catch(requestError=>setError(requestError.response?.data?.message || 'Unable to load your profile'));
  }, []);
  const change = event => setForm(current=>({...current,[event.target.name]:event.target.value}));
  const save = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try { await api.put('/client/profile', form); setMessage('Your profile has been saved.'); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Could not save your profile'); }
    finally { setSaving(false); }
  };
  const uploadPhoto = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('photo', file);
    try {
      const {data} = await api.post('/users/me/photo', body);
      setForm(current=>({...current, profile_image:data.profile_image}));
      setMessage('Profile picture updated.');
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not update your photo'); }
  };
  const changePassword = async event => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password.new_password !== password.confirm_password) {
      setError('New password and confirmation do not match.');
      return;
    }
    try {
      const {data} = await api.post('/auth/password', {current_password:password.current_password,new_password:password.new_password});
      setMessage(data.message);
      setPassword({current_password:'',new_password:'',confirm_password:''});
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not change your password'); }
  };
  if (!form) return error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p> : <div className="card h-64 animate-pulse bg-stone-100"/>;
  return <section className="mx-auto max-w-3xl space-y-5">
    <header className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sage">Your account</p><h1 className="mt-1 text-3xl font-semibold">Profile & settings</h1><p className="mt-2 text-stone-500">Keep your contact and organization details current.</p></div><Link to={`/messages?shareType=PROFILE&shareId=${user?.id}`} className="rounded-lg p-2 text-stone-500 hover:bg-sand hover:text-sage" aria-label="Share profile in chat" title="Share profile in chat"><Share2 size={18}/></Link></header>
    <div className="card flex flex-wrap items-center gap-4 p-5"><img className="h-20 w-20 rounded-2xl bg-stone-100 object-cover" src={form.profile_image || ''} alt="Profile"/><div><h2 className="font-semibold">{form.name}</h2><p className="text-sm text-stone-500">{form.email}</p><label className="mt-2 inline-block cursor-pointer text-sm font-semibold text-sage">Change profile photo<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={uploadPhoto}/></label></div></div>
    <form onSubmit={save} className="card space-y-4 p-5">
      <label className="block text-sm font-medium">Full name<input className="field mt-1" name="name" value={form.name || ''} onChange={change} maxLength="150" required/></label>
      <label className="block text-sm font-medium">Email address<input className="field mt-1" value={form.email || ''} readOnly/></label>
      <label className="block text-sm font-medium">About you<textarea className="field mt-1 min-h-24" name="bio" value={form.bio || ''} onChange={change} maxLength="5000"/></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Phone<input className="field mt-1" name="phone" type="tel" value={form.phone || ''} onChange={change} maxLength="50"/></label><label className="block text-sm font-medium">Location<input className="field mt-1" name="location" value={form.location || ''} onChange={change} maxLength="255"/></label></div>
      <label className="block text-sm font-medium">Client type<select className="field mt-1" name="client_type" value={form.client_type || 'INDIVIDUAL'} onChange={event=>setForm(current=>({...current,client_type:event.target.value,organization:event.target.value==='INDIVIDUAL'?'':current.organization}))}><option value="INDIVIDUAL">Individual</option><option value="COMPANY">Company</option><option value="ORGANIZATION">Organization</option></select></label>
      {form.client_type !== 'INDIVIDUAL' && <label className="block text-sm font-medium">Organization name<input className="field mt-1" name="organization" value={form.organization || ''} onChange={change} maxLength="255"/></label>}
      <fieldset className="space-y-3 border-t pt-4"><legend className="font-semibold">In-app notification preferences</legend>{[['messages','New messages'],['enquiries','Enquiry updates'],['projects','Project updates'],['activity','Other account activity']].map(([key,label])=><label key={key} className="flex items-center gap-3 text-sm text-stone-600"><input type="checkbox" checked={preferences[key] !== false} onChange={event=>setPreference(key,event.target.checked)}/>{label}</label>)}</fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-green-700">{message}</p>}
      <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
    </form>
    <form onSubmit={changePassword} className="card space-y-4 p-5">
      <h2 className="text-lg font-semibold">Change password</h2>
      <label className="block text-sm font-medium">Current password<input className="field mt-1" type="password" autoComplete="current-password" required value={password.current_password} onChange={event=>setPassword({...password,current_password:event.target.value})}/></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">New password<input className="field mt-1" type="password" autoComplete="new-password" minLength="8" required value={password.new_password} onChange={event=>setPassword({...password,new_password:event.target.value})}/></label><label className="block text-sm font-medium">Confirm new password<input className="field mt-1" type="password" autoComplete="new-password" minLength="8" required value={password.confirm_password} onChange={event=>setPassword({...password,confirm_password:event.target.value})}/></label></div>
      <button className="btn-secondary">Update password</button>
    </form>
  </section>;
}
