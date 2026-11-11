import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function ClientDocuments() {
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api.get('/client/documents').then(({data})=>setDocuments(data))
      .catch(requestError=>setError(requestError.response?.data?.message || 'Unable to load documents'));
  }, []);
  return <div className="space-y-5">
    <header><p className="text-sm font-semibold uppercase tracking-[0.18em] text-sage">Shared files</p><h1 className="mt-1 text-3xl font-semibold">My documents</h1><p className="mt-2 text-stone-500">Private files shared by you and your project collaborators.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="card divide-y">{documents.map(file=><div key={`${file.context_type}-${file.id}`} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><a href={file.file_url} target="_blank" rel="noreferrer" className="font-medium text-sage hover:underline">{file.file_name}</a><p className="text-xs text-stone-500"><Link to={`/${file.context_type==='PROJECT'?'projects':'enquiries'}/${file.context_id}`} className="hover:underline">{file.context_title}</Link> · {file.uploaded_by_name} · {(Number(file.file_size)/1024/1024).toFixed(2)} MB</p></div><a className="btn-secondary text-sm" href={file.file_url} target="_blank" rel="noreferrer">Open</a></div>)}
      {!documents.length && !error && <p className="p-10 text-center text-sm text-stone-500">Project documents shared with you will appear here.</p>}</div>
  </div>;
}
