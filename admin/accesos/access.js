/* BTS Admin · Asignación segura de usuarios empresariales. */
(()=>{'use strict';
const BASE='https://xwehejgwufwhpkpzjzyt.supabase.co',KEY='sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz',STORE='bts-admin-sb-session-v1';
const $=id=>document.getElementById(id);let users=[],businesses=[];
const notice=(text,bad=false)=>{$('notice').textContent=text;$('notice').classList.toggle('bad',bad)};
function current(){try{return JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{return null}}
async function api(endpoint,method='GET',payload){
 let session=current();if(!session?.refresh_token||!session?.access_token)throw Error('Primero iniciá sesión en el dashboard BTS.');
 if((session.expires_at||0)*1000<Date.now()+45000){
  const response=await fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
  const newSession=await response.json();if(!response.ok)throw Error('La sesión expiró: iniciá sesión nuevamente.');
  session={...session,...newSession,expires_at:newSession.expires_at||Math.floor(Date.now()/1000)+(newSession.expires_in||3600)};
  sessionStorage.setItem(STORE,JSON.stringify(session));
 }
 const headers={apikey:KEY,Authorization:'Bearer '+session.access_token,Accept:'application/json'};
 if(payload!==undefined){headers['Content-Type']='application/json';headers.Prefer='return=representation'}
 const r=await fetch(BASE+'/rest/v1/'+endpoint,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload),cache:'no-store'});
 if(!r.ok){const body=await r.json().catch(()=>({}));throw Error(body.message||body.error||'Error '+r.status)}
 const text=r.status===204?'':await r.text();return text?JSON.parse(text):[];
}
const node=(tag,label,cls)=>{const el=document.createElement(tag);if(label!==undefined)el.textContent=label;if(cls)el.className=cls;return el};
function render(){
 const tbody=$('rows');tbody.replaceChildren();
 if(!users.length){const tr=node('tr'),td=node('td','Sin usuarios empresariales asignados.');td.colSpan=5;tr.append(td);tbody.append(tr);return}
 for(const u of users){
  const business=businesses.find(b=>b.id===u.business_id);
  const tr=node('tr');
  const first=node('td');first.append(node('strong',business?.business_name||'Empresa no disponible'),node('small',u.business_id));
  const second=node('td');second.append(node('strong',u.display_email||'Cuenta de empresa'),node('small',u.user_id));
  const third=node('td'),role=node('select');role.className='field';
  for(const [key,label] of [['owner','Propietario'],['manager','Encargado'],['staff','Personal'],['viewer','Solo lectura']])role.add(new Option(label,key));
  role.value=u.role;third.append(role);
  const fourth=node('td'),badge=node('span',u.is_active?'Activo':'Suspendido','tag '+(u.is_active?'on':'off'));fourth.append(badge);
  const last=node('td'),buttons=node('div',undefined,'action'),save=node('button','Guardar','btn'),toggle=node('button',u.is_active?'Suspender':'Reactivar','btn warning');
  save.type=toggle.type='button';
  save.onclick=async()=>{if(role.value===u.role)return notice('Este usuario ya tiene ese rol.');if(!confirm('¿Cambiar los permisos de esta cuenta?'))return;save.disabled=true;try{await api('bts_business_users?id=eq.'+encodeURIComponent(u.id),'PATCH',{role:role.value});await load();notice('Permisos actualizados.')}catch(e){notice(e.message,true)}finally{save.disabled=false}};
  toggle.onclick=async()=>{if(!confirm((u.is_active?'¿Suspender':'¿Reactivar')+' este acceso empresarial?'))return;toggle.disabled=true;try{await api('bts_business_users?id=eq.'+encodeURIComponent(u.id),'PATCH',{is_active:!u.is_active});await load();notice('Estado actualizado.')}catch(e){notice(e.message,true)}finally{toggle.disabled=false}};
  buttons.append(save,toggle);last.append(buttons);tr.append(first,second,third,fourth,last);tbody.append(tr);
 }
}
async function load(){
 try{
  const [b,u]=await Promise.all([
   api('bts_nfc_cards?select=id,business_name,is_active&order=business_name.asc&limit=500'),
   api('bts_business_users?select=id,business_id,user_id,role,is_active,display_email,created_at&order=created_at.desc&limit=1000')
  ]);
  businesses=b||[];users=u||[];
  const sel=$('business'),old=sel.value;sel.replaceChildren();
  for(const row of businesses)sel.add(new Option(row.business_name+(row.is_active?'':' (suspendido)'),row.id));
  if(businesses.some(b=>b.id===old))sel.value=old;
  render();notice(users.length+' accesos empresariales registrados.');
 }catch(e){notice('Error al consultar accesos: '+e.message,true)}
}
async function assign(e){
 e.preventDefault();const button=$('submit');button.disabled=true;
 try{
  const id=$('userId').value.trim(),bid=$('business').value;
  if(!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id))throw Error('Ingresá un UUID válido.');
  if(!businesses.some(b=>b.id===bid&&b.is_active))throw Error('La empresa seleccionada debe estar activa.');
  await api('bts_business_users','POST',{business_id:bid,user_id:id,role:$('role').value,is_active:true,display_email:$('userEmail').value.trim()});
  $('assignForm').reset();await load();notice('Acceso asignado. El usuario puede entrar al portal de su empresa.');
 }catch(e){notice('No se pudo asignar la cuenta: '+e.message,true)}
 finally{button.disabled=false}
}
async function init(){
 try{
  const session=current();if(!session?.user?.id)throw Error('Iniciá sesión desde /admin/ para gestionar accesos.');
  const rows=await api('bts_admins?user_id=eq.'+encodeURIComponent(session.user.id)+'&select=user_id&limit=1');
  if(!rows.length)throw Error('La cuenta no tiene permisos de administrador BTS.');
  $('assignForm').onsubmit=assign;$('reload').onclick=load;await load();
 }catch(e){notice(e.message,true);$('submit').disabled=true;$('reload').disabled=true}
}
init();
})();