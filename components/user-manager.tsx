'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, jsonInit } from '@/lib/client';

type User = { id:string; name:string; email:string; role:'STAFF'|'SUPER_ADMIN'; active:boolean; createdAt:string };
const empty = { name:'', email:'', password:'', role:'STAFF' as 'STAFF'|'SUPER_ADMIN', active:true };

export function UserManager({ initialUsers }:{initialUsers:User[]}){
 const router=useRouter(); const [users,setUsers]=useState(initialUsers); const [f,setF]=useState(empty); const [editing,setEditing]=useState<string|null>(null); const [busy,setBusy]=useState(false); const [err,setErr]=useState('');
 function openEdit(u:User){setEditing(u.id);setF({name:u.name,email:u.email,password:'',role:u.role,active:u.active});setErr('');}
 function openNew(){setEditing(null);setF(empty);setErr('');}
 async function save(){setBusy(true);setErr('');try{if(editing){const x=await api<User>('/api/users',jsonInit('PATCH',{id:editing,...f}));setUsers(a=>a.map(u=>u.id===editing?{...u,...x}:u));}else{const x=await api<User>('/api/users',jsonInit('POST',f));setUsers(a=>[...a,x]);}openNew();router.refresh();}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
 async function remove(id:string){if(!confirm('Delete this user? If the user has sales history, the account will be safely deactivated instead.'))return;setBusy(true);setErr('');try{const r=await api<{deleted?:boolean;deactivated?:boolean;message?:string}>(`/api/users?id=${id}`,{method:'DELETE'});if(r.message)alert(r.message);setUsers(a=>r.deactivated?a.map(u=>u.id===id?{...u,active:false}:u):a.filter(u=>u.id!==id));router.refresh();}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
 return <div className="grid xl:grid-cols-[1fr_360px] gap-6 items-start">
  <div className="card p-5"><div className="flex justify-between items-center mb-5"><div><h2 className="font-bold text-lg">Staff accounts</h2><p className="text-xs text-gray-400">Only Super Admins can manage users.</p></div><button className="btn btn-gold" onClick={openNew}>＋ Add user</button></div>
   {err&&<div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{err}</div>}
   <div className="space-y-3">{users.map(u=><div key={u.id} className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><div className="font-semibold">{u.name} {u.active?<span className="text-green-600 text-[10px]">● ACTIVE</span>:<span className="text-red-500 text-[10px]">● DISABLED</span>}</div><div className="text-xs text-gray-500">{u.email}</div><div className="text-[10px] text-gray-400 mt-1">{u.role.replace('_',' ')} · Added {new Date(u.createdAt).toLocaleDateString('en-NG')}</div></div><div className="flex gap-2"><button className="btn btn-light text-xs" onClick={()=>openEdit(u)}>Edit</button><button className="text-xs px-3 py-2 rounded-xl text-red-600 hover:bg-red-50" onClick={()=>remove(u.id)} disabled={busy}>Delete</button></div></div>)}</div>
  </div>
  <div className="card p-5"><h2 className="font-bold text-lg mb-4">{editing?'Edit user':'Add user'}</h2><label className="label">Full name</label><input className="input mb-3" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/><label className="label">Email</label><input className="input mb-3" type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/><label className="label">{editing?'New password (optional)':'Password'}</label><input className="input mb-3" type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} placeholder={editing?'Leave blank to keep current password':''}/><label className="label">Role</label><select className="input mb-3" value={f.role} onChange={e=>setF({...f,role:e.target.value as User['role']})}><option value="STAFF">Staff</option><option value="SUPER_ADMIN">Super Admin</option></select>{editing&&<label className="flex items-center gap-2 text-sm mb-5"><input type="checkbox" checked={f.active} onChange={e=>setF({...f,active:e.target.checked})}/> Account active</label>}<div className="flex gap-2"><button className="btn btn-gold flex-1" disabled={busy||!f.name||!f.email||(!editing&&!f.password)} onClick={save}>{busy?'Saving…':editing?'Save changes':'Create user'}</button>{editing&&<button className="btn btn-light" onClick={openNew}>Cancel</button>}</div></div>
 </div>;
}
