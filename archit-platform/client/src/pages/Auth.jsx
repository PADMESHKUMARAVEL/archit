import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const {login} = useAuth(); const nav = useNavigate();
  const [email,setEmail] = useState(''); const [password,setPassword] = useState(''); const [error,setError] = useState('');
  const submit = async e => { e.preventDefault(); setError(''); try { await login(email.trim().toLowerCase(),password.trim()); nav('/'); } catch(err) { setError(err.response?.data?.message || 'Unable to sign in'); } };
  return <AuthShell title="Welcome back" subtitle="Sign in to your architecture network.">
    <form onSubmit={submit} className="space-y-3"><input className="field" type="email" required autoComplete="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)}/><input className="field" type="password" required autoComplete="current-password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/>{error && <p className="text-sm text-red-600">{error}</p>}<button className="btn-primary w-full">Sign in</button></form>
    <div className="mt-5 rounded-lg bg-stone-100 p-3 text-xs text-stone-600"><b>Student test account</b><br/>student1@archit.test<br/>Student@123</div>
    <p className="text-sm text-center mt-5 text-stone-500">New to Archit? <Link className="text-sage font-semibold" to="/register">Create an account</Link></p>
  </AuthShell>;
}
export function Register() {
  const {register} = useAuth(); const nav = useNavigate();
  const [form,setForm] = useState({name:'',email:'',password:'',role:'STUDENT'}); const [error,setError] = useState(''); const [done,setDone] = useState(false);
  const change = e => setForm({...form,[e.target.name]:e.target.value});
  const submit = async e => { e.preventDefault(); setError(''); try { await register(form); setDone(true); } catch(err) { setError(err.response?.data?.message || 'Registration failed'); } };
  return <AuthShell title="Join Archit" subtitle="Create your professional profile.">
    {done ? <div className="text-center"><p className="mb-4">Account created successfully.</p><button className="btn-primary" onClick={()=>nav('/login')}>Continue to sign in</button></div> :
    <form onSubmit={submit} className="space-y-3">
      <input className="field" name="name" required placeholder="Full name" value={form.name} onChange={change}/>
      <input className="field" name="email" type="email" required placeholder="Email address" value={form.email} onChange={change}/>
      <input className="field" name="password" type="password" minLength="8" required placeholder="Password (8+ characters)" value={form.password} onChange={change}/>
      <label className="block text-sm font-medium">I am joining as</label>
      <select className="field" name="role" value={form.role} onChange={change}><option value="STUDENT">Student</option><option value="ARCHITECT">Architect</option><option value="CLIENT">Client</option></select>
      {error && <p className="text-sm text-red-600">{error}</p>}<button className="btn-primary w-full">Create account</button>
    </form>}
    <p className="text-sm text-center mt-5 text-stone-500">Already registered? <Link className="text-sage font-semibold" to="/login">Sign in</Link></p>
  </AuthShell>;
}
function AuthShell({title,subtitle,children}) { return <div className="min-h-screen grid place-items-center px-4 py-10"><div className="w-full max-w-md card p-8"><div className="text-2xl font-black mb-8">archit<span className="text-sage">.</span></div><h1 className="text-2xl font-bold">{title}</h1><p className="text-stone-500 mt-1 mb-6">{subtitle}</p>{children}</div></div>; }
