import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function Network() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [connections, setConnections] = useState([]);
  const [people, setPeople] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const load = async () => {
    const [received, sent, accepted] = await Promise.all([api.get('/network/requests'), api.get('/network/requests/sent'), api.get('/network/connections')]);
    setRequests(received.data); setSentRequests(sent.data); setConnections(accepted.data);
  };
  useEffect(() => { load().catch(() => setError('Could not load your network.')); }, []);
  const search = async event => {
    event.preventDefault(); setError('');
    try {
      const { data } = await api.get('/users', { params: { q } });
      const candidates = data.filter(person => person.id !== user?.id);
      const states = await Promise.all(candidates.map(person => api.get(`/network/status/${person.id}`)));
      setPeople(candidates.map((person, index) => ({ ...person, connection: states[index].data })));
    }
    catch { setError('Could not search people.'); }
  };
  const respond = async (id, status) => {
    try { await api.patch(`/network/requests/${id}`, { status }); await load(); }
    catch (err) { setError(err.response?.data?.message || 'Could not update the request.'); }
  };
  const connect = async id => {
    try {
      await api.post(`/network/request/${id}`); await load();
      setPeople(current => current.map(person => person.id === id ? { ...person, connection: { status: 'PENDING', requester_id: user.id } } : person));
    } catch (err) { setError(err.response?.data?.message || 'Could not send request.'); }
  };
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">My network</h1>
    <section className="card p-5"><h2 className="font-semibold mb-3">Find people</h2><form onSubmit={search} className="flex gap-2"><input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="Search people..."/><button className="btn-primary">Search</button></form>
      <div className="grid sm:grid-cols-2 gap-3 mt-4">{people.map(person => <div key={person.id} className="border rounded-xl p-3 flex items-center justify-between gap-2"><div><Link className="font-bold hover:underline" to={`/users/${person.id}`}>{person.name}</Link><p className="text-xs text-stone-500">{person.role} · {person.location}</p></div>{person.connection?.status === 'ACCEPTED' ? <span className="text-xs text-stone-500">Connected</span> : person.connection?.status === 'PENDING' ? <span className="text-xs text-stone-500">{Number(person.connection.requester_id) === Number(user?.id) ? 'Request sent' : 'Request received'}</span> : <button className="btn-secondary text-xs" onClick={() => connect(person.id)}>Connect</button>}</div>)}</div>
    </section>
    <section className="card p-5"><h2 className="font-semibold mb-3">Received requests ({requests.length})</h2>{requests.map(request => <div key={request.request_id} className="py-3 border-t flex items-center justify-between"><div><Link className="font-bold hover:underline" to={`/users/${request.user_id}`}>{request.name}</Link><p className="text-xs text-stone-500">{request.role}</p></div><div className="flex gap-2"><button className="btn-primary text-sm" onClick={() => respond(request.request_id, 'ACCEPTED')}>Accept</button><button className="btn-secondary text-sm" onClick={() => respond(request.request_id, 'REJECTED')}>Decline</button></div></div>)}{!requests.length && <p className="text-sm text-stone-500">No pending requests.</p>}</section>
    <section className="card p-5"><h2 className="font-semibold mb-3">Sent requests ({sentRequests.length})</h2>{sentRequests.map(request => <div key={request.request_id} className="py-3 border-t"><b>{request.name}</b><p className="text-xs text-stone-500">{request.role} · Waiting for acceptance</p></div>)}{!sentRequests.length && <p className="text-sm text-stone-500">No pending sent requests.</p>}</section>
    <section className="card p-5"><h2 className="font-semibold mb-3">Connections ({connections.length})</h2><div className="grid sm:grid-cols-2 gap-3">{connections.map(connection => <div key={connection.id} className="border rounded-xl p-3"><b>{connection.name}</b><p className="text-xs text-stone-500">{connection.role} · {connection.location}</p></div>)}</div></section>
    {error && <p className="text-sm text-red-600">{error}</p>}
  </div>;
}
