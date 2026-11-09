import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';

export default function UserProfile() {
  const { id } = useParams(); const { user } = useAuth(); const [profile, setProfile] = useState(null); const [posts, setPosts] = useState([]); const [error, setError] = useState('');
  const load = async () => {
    const [profileResponse, postsResponse] = await Promise.all([api.get(`/users/${id}`), api.get(`/users/${id}/posts`)]);
    setProfile(profileResponse.data); setPosts(postsResponse.data);
  };
  useEffect(() => { load().catch(err => setError(err.response?.data?.message || 'Profile unavailable')); }, [id]);
  if (error) return <div className="card p-6 text-red-600">{error}</div>;
  if (!profile) return <div className="card p-6 text-stone-500">Loading profile…</div>;
  if (Number(profile.id) === Number(user?.id)) return <div className="card p-6">This is your profile. <Link className="text-sage underline" to="/profile">Edit it here</Link>.</div>;
  const details = profile.role === 'STUDENT' ? [profile.college, profile.degree, profile.specialization, profile.graduation_year && `Class of ${profile.graduation_year}`] : [profile.firm_name, profile.experience_years != null && `${profile.experience_years} years experience`, profile.website];
  return <div className="max-w-3xl space-y-5"><article className="card p-6"><div className="flex items-center gap-4"><div>{profile.profile_image ? <img src={profile.profile_image} alt="" className="h-24 w-24 rounded-full object-cover"/> : <div className="grid h-24 w-24 place-items-center rounded-full bg-sand text-3xl">{profile.name?.[0]}</div>}</div><div><h1 className="text-2xl font-bold">{profile.name}</h1><p className="text-sm font-medium text-sage">{profile.role}</p><p className="text-sm text-stone-500">{profile.location || 'Location not specified'}</p></div></div><p className="mt-6 whitespace-pre-wrap leading-7">{profile.bio || 'No bio added yet.'}</p><div className="mt-5 space-y-1 text-sm text-stone-600">{details.filter(Boolean).map(detail => <p key={detail}>{detail}</p>)}</div></article><section className="space-y-4"><h2 className="text-xl font-bold">Posts</h2>{posts.map(post => <PostCard key={post.id} post={post} onChanged={load}/>)}{!posts.length && <div className="card p-5 text-sm text-stone-500">No posts you can view.</div>}</section></div>;
}
