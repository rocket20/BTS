/* BTS Studio — Usuarios y actividad, solo en /admin/. La autorización real depende de RLS/RPC. */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const BASE='https://xwehejgwufwhpkpzjzyt.supabase.co';
const KEY='sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz';
const STORAGE='bts-admin-sb-session-v1';
const names={owner:'Propietario',admin:'Administrador',editor:'Editor',viewer:'Visor'};
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
let records=[],users=[],myRole='',ready=false;
function token(){
 try{const s=JSON.parse(sessionStorage.getItem(STORAGE)||'null');return s?.access_token||'';}catch{return '';}
}
async function api(path, method='GET', body){
 const t=token();if(!t)throw Error('Iniciá sesión nuevamente.');
 const r=await fetch(BASE+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+t,'Content-Type':'application/json',Accept:'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.message||d.error||('Error '+r.status));}
 if(r.status===204)return null;const raw=await r.text();return raw?JSON.parse(raw):null;
}
function note(id,t){const e=$('#'+id);if(e)e.textContent=t;}
function insert(){
 const nav=$('.sidebar nav'), main=$('main.content');if(!nav||!main)return;
 const group=document.createElement('div');group.className='sidebar-label sub';group.textContent='SEGURIDAD';
 const btn=(name,label,ico)=>{const b=document.createElement('button');b.type='button';b.className='nav-item';b.dataset.page=name;b.innerHTML='<span class="nav-ico"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><use href="icons/lucide-ui.svg#'+ico+'"></use></svg></span><span class="nav-text">'+label+'</span>';return b;};
 // Usar SVG internos existentes: si falta un símbolo, conservar texto y no generar iconos.
 const a=btn('usuarios','Usuarios y roles','users-round'),b=btn('historial','Historial de actividad','history');
 nav.append(group,a,b);
 const section=document.createElement('div');
 section.innerHTML=`
 <section class="page" id="page-usuarios"><div class="page-intro"><div><div class="eyebrow">ADMINISTRACIÓN / ACCESOS</div><h1>Usuarios y roles.</h1><p>Asigná permisos a usuarios registrados en Supabase Authentication.</p></div></div>
 <div class="panel audit-panel"><div class="panel-header"><h2>Usuarios autorizados</h2><button type="button" class="btn btn-secondary" id="auditRefreshUsers">Actualizar</button></div>
 <p class="tiny-note">Para crear cuentas nuevas: Supabase → Authentication → Users. Después agregalas a bts_admins. Solo el propietario puede cambiar roles.</p>
 <div id="auditUsersStatus" class="tiny-note">Cargando usuarios…</div><div class="audit-scroll"><table class="audit-table"><thead><tr><th>Usuario</th><th>UID</th><th>Rol</th><th>Acción</th></tr></thead><tbody id="auditUsersRows"></tbody></table></div></div></section>
 <section class="page" id="page-historial"><div class="page-intro"><div><div class="eyebrow">ADMINISTRACIÓN / AUDITORÍA</div><h1>Historial de movimientos.</h1><p>Registro de modificaciones realizadas en Supabase.</p></div></div>
 <div class="panel audit-panel"><div class="panel-header"><h2>Actividad reciente</h2><button type="button" class="btn btn-secondary" id="auditRefreshLogs">Actualizar</button></div>
 <div class="audit-filters"><input id="auditSearch" class="input" placeholder="Buscar usuario, tabla o acción" aria-label="Buscar actividad"><select id="auditType" class="input"><option value="">Todas las acciones</option><option value="INSERT">Creaciones</option><option value="UPDATE">Modificaciones</option><option value="DELETE">Eliminaciones</option></select></div>
 <div id="auditLogsStatus" class="tiny-note">Cargando historial…</div><div class="audit-scroll"><table class="audit-table"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Detalle</th></tr></thead><tbody id="auditLogRows"></tbody></table></div>
 <p class="tiny-note">Auditoría disponible para tablas con triggers instalados. Las publicaciones en GitHub requieren registro adicional en su Edge Function. El historial no es retroactivo.</p></div></section>`;
 while(section.firstElementChild)main.appendChild(section.firstElementChild);
 $('#auditRefreshUsers').addEventListener('click',loadUsers);
 $('#auditRefreshLogs').addEventListener('click',loadLogs);
 $('#auditSearch').addEventListener('input',renderLogs);
 $('#auditType').addEventListener('change',renderLogs);
 $('#auditUsersRows').addEventListener('click',async e=>{
  const b=e.target.closest('[data-user]');if(!b)return;const sel=b.closest('tr').querySelector('select');const role=sel.value;
  if(!confirm('¿Asignar rol '+names[role]+' a este usuario?'))return;
  b.disabled=true;try{await api('/rest/v1/rpc/bts_set_user_role','POST',{target_user_id:b.dataset.user,new_role:role});await loadUsers();await loadLogs();}
  catch(err){note('auditUsersStatus','No se pudo cambiar el rol: '+err.message);}finally{b.disabled=false;}
 });
 ready=true;
}
async function loadUsers(){
 if(!token())return;note('auditUsersStatus','Consultando usuarios…');
 try{
  // Leer directamente con RLS: owner/admin pueden consultar el equipo tras aplicar
  // admin/sql/usuarios-visibles.sql. Si aún no están las columnas opcionales,
  // seguir mostrando UID y rol en vez de fallar completamente.
  let minimal=false;
  try{
   users=await api('/rest/v1/bts_admins?select=user_id,role,created_at,email,display_name&order=created_at.asc')||[];
  }catch(e){
   if(!/column|does not exist|42703|PGRST204|PGRST200/i.test(e.message))throw e;
   minimal=true;
   users=await api('/rest/v1/bts_admins?select=user_id,role,created_at&order=created_at.asc')||[];
  }
  const me=JSON.parse(sessionStorage.getItem(STORAGE)||'{}')?.user?.id;
  myRole=users.find(x=>x.user_id===me)?.role||'';
  const el=$('#auditUsersRows');el.replaceChildren();
  for(const u of users){
   const tr=document.createElement('tr');
   tr.innerHTML='<td><strong>'+esc(u.display_name||u.email||(u.user_id===me?'Tu cuenta':'Usuario '+u.user_id.slice(0,8)))+'</strong><br><span class="tiny-note">'+esc(u.email||(u.user_id===me?JSON.parse(sessionStorage.getItem(STORAGE)||'{}')?.user?.email||'':'Correo disponible al activar la consulta segura'))+'</span></td><td><code>'+esc(u.user_id)+'</code></td><td><select class="input" aria-label="Rol de usuario" '+(myRole!=='owner'?'disabled':'')+'>'+Object.entries(names).map(([k,v])=>'<option value="'+k+'" '+(u.role===k?'selected':'')+'>'+v+'</option>').join('')+'</select></td><td>'+(myRole==='owner'?'<button type="button" class="btn btn-secondary" data-user="'+esc(u.user_id)+'">Guardar rol</button>':'Solo lectura')+'</td>';
   el.appendChild(tr);
  }
  const limited=users.length===1 && ['owner','admin'].includes(myRole);
  note('auditUsersStatus',
    (limited?'Solo se ve tu cuenta: RLS está ocultando las otras filas. Ejecutá admin/sql/usuarios-visibles.sql en Supabase.':
    users.length+' usuario(s) visibles · Tu rol: '+(names[myRole]||'Sin asignar'))+
    (minimal?' · Correos no configurados aún.':'')+
    (myRole!=='owner'?' · Para modificar roles, asigná owner a tu UID en Supabase.':'')
  );
 }catch(e){note('auditUsersStatus','No se pudo cargar: '+e.message+'. Verificá la migración y las políticas RLS.');}
}
function renderLogs(){
 const q=$('#auditSearch')?.value.trim().toLowerCase()||'',t=$('#auditType')?.value||'';
 const rows=records.filter(r=>(!t||r.action===t)&&(!q||[r.user_id,r.action,r.table_name,JSON.stringify(r.old_data),JSON.stringify(r.new_data)].some(v=>String(v||'').toLowerCase().includes(q))));
 const el=$('#auditLogRows');el.replaceChildren();
 for(const r of rows){
  const tr=document.createElement('tr'),user=users.find(u=>u.user_id===r.user_id);
  const changes=[];
  if(r.action==='UPDATE'&&r.old_data&&r.new_data){
   for(const key of Object.keys(r.new_data)){if(JSON.stringify(r.old_data[key])!==JSON.stringify(r.new_data[key]))changes.push(key+': '+JSON.stringify(r.old_data[key]??null)+' → '+JSON.stringify(r.new_data[key]??null));}
  }else changes.push(r.action==='INSERT'?'Registro creado':'Registro eliminado');
  const details=changes.join('; ').slice(0,1000);
  tr.innerHTML='<td>'+esc(new Date(r.created_at).toLocaleString('es-NI'))+'</td><td>'+esc(user?.display_name||user?.email||r.user_id||'Sistema / sin identificar')+'</td><td>'+esc(r.action)+'</td><td>'+esc(r.table_name)+'</td><td class="audit-detail" title="'+esc(details)+'">'+esc(details)+'</td>';
  el.appendChild(tr);
 }
 note('auditLogsStatus',rows.length+' movimientos mostrados · Últimos 200 registros consultados');
}
async function loadLogs(){
 if(!token())return;note('auditLogsStatus','Consultando movimientos…');
 try{records=await api('/rest/v1/bts_audit_logs?select=id,user_id,action,table_name,old_data,new_data,created_at&order=created_at.desc&limit=200')||[];renderLogs();}
 catch(e){note('auditLogsStatus','No se pudo leer el historial: '+e.message+'. Solo propietario y administrador pueden consultarlo.');}
}
window.BTSAdminAudit={open(name){if(!ready)return;if(name==='usuarios')loadUsers();if(name==='historial'){loadUsers().then(loadLogs);}}};
insert();
})();
