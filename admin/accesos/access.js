/* BTS Admin · Asignación segura de usuarios empresariales. */
(()=>{'use strict';
const BASE='https://xwehejgwufwhpkpzjzyt.supabase.co',KEY='sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz',STORE='bts-admin-sb-session-v1';
const $=id=>document.getElementById(id);let users=[],businesses=[],support=[],batchRows=[],batchPrograms=[];
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
function renderSupport(){
 const host=$('supportRows');host.replaceChildren();
 if(!support.length){const tr=node('tr'),td=node('td','Todavía no hay solicitudes empresariales.');td.colSpan=5;tr.append(td);host.append(tr);return}
 for(const item of support){
  const tr=node('tr'),company=businesses.find(b=>b.id===item.business_id);
  const c=node('td',company?.business_name||'Empresa'),subject=node('td');
  subject.append(node('strong',item.subject),node('small',item.details.slice(0,250)),node('small',new Date(item.created_at).toLocaleString('es-NI')));
  const prio=node('td',item.priority),status=node('td'),select=node('select');
  select.className='field';
  for(const [key,label] of [['abierto','Abierto'],['en_proceso','En proceso'],['resuelto','Resuelto'],['cerrado','Cerrado']])select.add(new Option(label,key));
  select.value=item.status;status.append(select);
  const response=node('td'),text=document.createElement('textarea');text.value=item.bts_reply||'';text.maxLength=2000;text.rows=3;text.style.cssText='width:100%;min-width:220px;background:#101116;border:1px solid #504653;border-radius:9px;color:#fff;padding:9px;font:inherit;';
  const save=node('button','Guardar respuesta','btn');save.type='button';save.onclick=async()=>{
    save.disabled=true;try{
      await api('bts_business_support?id=eq.'+encodeURIComponent(item.id),'PATCH',{status:select.value,bts_reply:text.value.trim()});
      await loadSupport();notice('Respuesta de soporte guardada.');
    }catch(e){notice(e.message,true)}finally{save.disabled=false}
  };
  response.append(text,save);tr.append(c,subject,prio,status,response);host.append(tr);
 }
}
async function loadSupport(){
 try{support=await api('bts_business_support?select=id,business_id,created_by,subject,details,priority,status,bts_reply,created_at&order=created_at.desc&limit=200')||[];renderSupport()}
 catch(e){notice('No se pudo cargar soporte: '+e.message,true)}
}

async function provision(action,payload){
 let session=current();if(!session?.access_token)throw Error('Iniciá sesión en BTS.');
 if((session.expires_at||0)*1000<Date.now()+45000){
  const resp=await fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
  const next=await resp.json();if(!resp.ok)throw Error('La sesión expiró. Ingresá nuevamente.');
  session={...session,...next,expires_at:next.expires_at||Math.floor(Date.now()/1000)+(next.expires_in||3600)};
  sessionStorage.setItem(STORE,JSON.stringify(session));
 }
 const response=await fetch(BASE+'/functions/v1/bts-business-provision',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.ok)throw Error(result.error||'No se pudo completar la operación.');
 return result;
}
function reveal(data){
 $('generatedAccess').hidden=false;
 $('generatedUrl').value=data.panel_url||'';
 $('generatedUsername').value=data.username||'';
 $('generatedPassword').value=data.password||'';
}
function mode(){
 const isNew=$('provisionMode').value==='create_company';
 $('newCompanyField').style.display=isNew?'':'none';
 $('newSlugField').style.display=isNew?'':'none';
 $('existingCompanyField').style.display=isNew?'none':'';
 $('newCompanyName').required=isNew;$('newCompanySlug').required=isNew;$('provisionCompany').required=!isNew;
}
async function createPanel(e){
 e.preventDefault();const b=$('createPanel');b.disabled=true;$('generatedAccess').hidden=true;
 try{
  const action=$('provisionMode').value;
  const payload=action==='create_company'?{business_name:$('newCompanyName').value.trim(),slug:$('newCompanySlug').value.trim().toLowerCase()}:{business_id:$('provisionCompany').value};
  const data=await provision(action,payload);
  reveal(data);await load();notice('Mini panel y cuenta generados. Copiá el acceso antes de salir.');
 }catch(err){notice(err.message,true)}finally{b.disabled=false}
}
async function resetPassword(){
 const id=$('passwordUser').value;if(!id)return notice('Seleccioná un acceso empresarial.',true);
 if(!confirm('¿Restablecer contraseña? El cliente deberá usar la nueva clave.'))return;
 const b=$('resetBusinessPassword');b.disabled=true;
 try{
  const data=await provision('reset_password',{user_id:id});
  $('generatedAccess').hidden=false;$('generatedUrl').value='https://www.btsstudio.net/negocios/';
  $('generatedUsername').value=users.find(x=>x.user_id===id)?.display_email?.split('@')[0]||'';
  $('generatedPassword').value=data.password;notice('Contraseña nueva generada. Compartila por canal seguro.');
 }catch(err){notice(err.message,true)}finally{b.disabled=false}
}
function downloadBatchCSV(rows){
 const heading=['Referencia interna BTS','Código NFC privado','Enlace para grabar en NFC'];
 const quote=x=>'"'+String(x??'').replace(/"/g,'""').replace(/[\r\n]+/g,' ')+'"';
 const csv='\uFEFF'+[heading,...rows.map(r=>[r.reference,r.card_code,location.origin+'/nfc/tarjeta/?card='+r.card_code])]
    .map(line=>line.map(quote).join(',')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='BTS-LOTE-NFC-'+new Date().toISOString().slice(0,10)+'.csv';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function fetchCodes(batchId){
 const rows=await api('rpc/bts_admin_batch_codes','POST',{p_batch_id:batchId});
 if(!rows?.length)throw Error('El lote no tiene códigos.');
 downloadBatchCSV(rows);
 notice('Códigos privados descargados: '+rows.length+'. Reservados para programación NFC BTS.');
}
function renderBatches(){
 const host=$('batchRows');host.replaceChildren();
 if(!batchRows.length){const tr=node('tr'),td=node('td','No hay lotes NFC generados.');td.colSpan=6;tr.append(td);host.append(tr);return;}
 for(const batch of batchRows){
  const tr=node('tr');
  const company=businesses.find(x=>x.id===batch.business_id)?.business_name||'Empresa';
  const program=batchPrograms.find(x=>x.id===batch.program_id)?.title||'Programa';
  for(const value of [company,program,batch.id.slice(0,8),String(batch.quantity),new Date(batch.created_at).toLocaleDateString('es-NI')])tr.append(node('td',value));
  const td=node('td'),button=node('button','Descargar CSV privado','btn');button.type='button';
  button.onclick=async()=>{button.disabled=true;try{await fetchCodes(batch.id)}catch(e){notice(e.message,true)}finally{button.disabled=false}};
  td.append(button);tr.append(td);host.append(tr);
 }
}
function setBatchPrograms(){
 const businessId=$('batchCompany').value,sel=$('batchProgram'),old=sel.value;
 sel.replaceChildren();
 for(const p of batchPrograms.filter(x=>x.business_id===businessId&&x.is_active))sel.add(new Option(p.title+' · '+(p.kind==='vip'?'VIP':'Fidelización'),p.id));
 if([...sel.options].some(o=>o.value===old))sel.value=old;
 if(!sel.options.length)sel.add(new Option('Sin programas activos',''));
 sel.disabled=!batchPrograms.some(x=>x.business_id===businessId&&x.is_active);
 $('batchGenerate').disabled=sel.disabled;
}
async function loadBatches(){
 try{
  const [programs,batches]=await Promise.all([
   api('bts_reward_programs?select=id,business_id,kind,title,is_active&order=created_at.desc&limit=500'),
   api('bts_nfc_batches?select=id,business_id,program_id,quantity,created_at&order=created_at.desc&limit=500')
  ]);
  batchPrograms=programs||[];batchRows=batches||[];
  const select=$('batchCompany'),old=select.value;select.replaceChildren();
  for(const b of businesses.filter(b=>b.is_active))select.add(new Option(b.business_name,b.id));
  if(businesses.some(b=>b.id===old&&b.is_active))select.value=old;
  setBatchPrograms();renderBatches();
 }catch(e){notice('No se pudieron consultar los lotes: '+e.message,true)}
}
async function generateBatch(e){
 e.preventDefault();
 const b=$('batchGenerate');b.disabled=true;
 const businessId=$('batchCompany').value,programId=$('batchProgram').value,quantity=Number($('batchQuantity').value);
 try{
  if(!Number.isInteger(quantity)||quantity<1||quantity>200)throw Error('Generá entre 1 y 200 tarjetas por lote.');
  if(!batchPrograms.some(x=>x.id===programId&&x.business_id===businessId&&x.is_active))throw Error('Programa inválido.');
  if(!confirm('¿Generar '+quantity+' tarjetas NFC privadas para esta empresa? Solo BTS tendrá acceso a los códigos.'))return;
  const rows=await api('rpc/bts_issue_nfc_batch','POST',{p_business_id:businessId,p_program_id:programId,p_quantity:quantity,p_note:'Lote BTS'});
  if(!rows?.length||rows.length!==quantity)throw Error('El servidor no confirmó todas las tarjetas.');
  downloadBatchCSV(rows);await loadBatches();
  notice('Lote emitido correctamente: '+rows.length+' tarjetas. CSV descargado para grabación física.');
 }catch(err){notice('No se pudo generar lote: '+err.message,true)}
 finally{b.disabled=false}
}
async function load(){
 try{
  const [b,u]=await Promise.all([
   api('bts_nfc_cards?select=id,business_name,slug,is_active&order=business_name.asc&limit=500'),
   api('bts_business_users?select=id,business_id,user_id,role,is_active,display_email,created_at&order=created_at.desc&limit=1000')
  ]);
  businesses=b||[];users=u||[];
  const previous=$('provisionCompany').value;
  $('provisionCompany').replaceChildren();
  for(const business of businesses)if(business.is_active)$('provisionCompany').add(new Option(business.business_name,business.id));
  if(businesses.some(x=>x.id===previous&&x.is_active))$('provisionCompany').value=previous;
  $('passwordUser').replaceChildren();
  for(const row of users)$('passwordUser').add(new Option((row.display_email||row.user_id)+' · '+(businesses.find(x=>x.id===row.business_id)?.business_name||'Empresa'),row.user_id));
  render();await loadSupport();await loadBatches();notice(users.length+' accesos empresariales registrados.');
 }catch(e){notice('Error al consultar accesos: '+e.message,true)}
}
async function init(){
 try{
  const session=current();if(!session?.user?.id)throw Error('Iniciá sesión desde /admin/ para gestionar accesos.');
  const rows=await api('bts_admins?user_id=eq.'+encodeURIComponent(session.user.id)+'&select=user_id,role&limit=1');
  if(!rows.length)throw Error('La cuenta no tiene permisos de administrador BTS.');
  if(!['owner','admin'].includes(rows[0].role))throw Error('Solo el administrador puede generar credenciales empresariales.');
  $('provisionForm').onsubmit=createPanel;
  $('provisionMode').onchange=mode;
  $('newCompanyName').oninput=()=>{if(!$('newCompanySlug').dataset.manual)$('newCompanySlug').value=$('newCompanyName').value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)};
  $('newCompanySlug').oninput=()=>{$('newCompanySlug').dataset.manual='1'};
  $('resetBusinessPassword').onclick=resetPassword;
  $('copyGenerated').onclick=async()=>{
   const msg='Enlace: '+$('generatedUrl').value+'\nUsuario: '+$('generatedUsername').value+'\nContraseña: '+$('generatedPassword').value;
   try{await navigator.clipboard.writeText(msg);notice('Acceso copiado. Compartilo por un canal seguro.')}catch{notice('Copiá las credenciales manualmente.',true)}
  };
  $('reload').onclick=load;$('reloadSupport').onclick=loadSupport;$('batchForm').onsubmit=generateBatch;$('batchRefresh').onclick=loadBatches;$('batchCompany').onchange=setBatchPrograms;mode();await load();
 }catch(e){notice(e.message,true);$('createPanel').disabled=true;$('reload').disabled=true}
}
init();
})();