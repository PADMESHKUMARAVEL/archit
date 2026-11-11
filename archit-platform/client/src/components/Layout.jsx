import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bell, Home, Users, BriefcaseBusiness, MessageCircle, Compass, LogOut, UserRound, Bookmark, FolderOpen, FileText, BellRing, ClipboardList } from 'lucide-react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const defaultLinks = [
  ['/', 'Feed', Home],
  ['/network', 'My network', Users],
  ['/jobs', 'Jobs', BriefcaseBusiness],
  ['/discover', 'Discover', Compass],
  ['/messages', 'Messages', MessageCircle],
  ['/profile', 'Profile', UserRound]
];
export default function Layout() {
  const { user,logout } = useAuth();
  const navigate = useNavigate();
  const [notifications,setNotifications] = useState([]);
  const [showNotifications,setShowNotifications] = useState(false);
  useEffect(()=>{
    api.get('/notifications').then(({data})=>setNotifications(data)).catch(()=>setNotifications([]));
    const socket=io(import.meta.env.VITE_SOCKET_URL,{auth:{token:localStorage.getItem('archit_token')}});
    socket.on('notification:new',notification=>setNotifications(current=>[notification,...current]));
    return ()=>socket.disconnect();
  },[]);
  const unread=notifications.filter(notification=>!notification.is_read).length;
  const links = user?.role === 'CLIENT' ? [
    ['/', 'Overview', Home],
    ['/discover', 'Discover architects', Compass],
    ['/saved', 'Saved architects', Bookmark],
    ['/project-requests', 'Post a project brief', ClipboardList],
    ['/enquiries', 'My enquiries', BriefcaseBusiness],
    ['/projects', 'My projects', FolderOpen],
    ['/messages', 'Messages', MessageCircle],
    ['/notifications', 'Notifications', BellRing],
    ['/documents', 'My documents', FileText],
    ['/profile', 'Settings', UserRound]
  ] : user?.role === 'ARCHITECT' ? [
    [ '/', 'Work feed', Home ],
    ['/network', 'My network', Users],
    ['/jobs', 'Jobs & internships', BriefcaseBusiness],
    ['/discover', 'Find clients', Compass],
    ['/project-board', 'Client project briefs', ClipboardList],
    ['/enquiries', 'Client enquiries', BriefcaseBusiness],
    ['/projects', 'Projects', FolderOpen],
    ...defaultLinks.slice(4)
  ] : user?.role === 'STUDENT' ? [
    ['/', 'Achievements & work', Home],
    ['/network', 'My network', Users],
    ['/jobs', 'Jobs & internships', BriefcaseBusiness],
    ['/discover', 'Discover people', Compass],
    ['/messages', 'Messages', MessageCircle],
    ['/profile', 'Profile', UserRound]
  ] : defaultLinks;
  const markAll=async()=>{await api.patch('/notifications/read-all');setNotifications(current=>current.map(notification=>({...notification,is_read:true})));};
  return <div className="min-h-screen">
    <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <NavLink to="/" className="text-xl font-black tracking-tight">archit<span className="text-sage">.</span></NavLink>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-sm text-stone-500">{user?.name} · {user?.role?.toLowerCase()}</span>
          <div className="relative">
            <button className="relative p-2" onClick={()=>setShowNotifications(value=>!value)} aria-label="Notifications"><Bell size={20}/>{unread>0&&<span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{unread}</span>}</button>
            {showNotifications&&<div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border bg-white shadow-xl"><div className="flex items-center justify-between border-b p-3"><b>Notifications</b>{unread>0&&<button className="text-xs text-sage" onClick={markAll}>Mark all read</button>}</div><div className="max-h-96 overflow-y-auto">{notifications.map(notification=><div key={notification.id} className={`border-b p-3 text-sm ${notification.is_read?'':'bg-sand'}`}><b>{notification.title}</b><p className="text-xs text-stone-600">{notification.message}</p></div>)}{!notifications.length&&<p className="p-5 text-center text-sm text-stone-500">No notifications yet.</p>}</div></div>}
          </div>
          <button className="btn-secondary text-sm" onClick={() => { logout(); navigate('/login'); }}><LogOut size={16}/> <span className="ml-2">Sign out</span></button>
        </div>
      </div>
    </header>
    <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-6">
      <aside className="card p-3 h-fit">
        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {links.map(([to,label,Icon]) => <NavLink key={to} to={to} end={to==='/'} className={({isActive}) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm whitespace-nowrap ${isActive ? 'bg-sand font-semibold' : 'text-stone-600 hover:bg-stone-50'}`}><Icon size={18}/>{label}</NavLink>)}
        </nav>
        <div className="hidden md:block mt-5 p-3 rounded-xl bg-sand text-xs text-stone-600">A professional network for the people who shape spaces.</div>
      </aside>
      <main className="min-w-0"><Outlet /></main>
    </div>
  </div>;
}
