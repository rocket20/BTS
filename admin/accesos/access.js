/* BTS Admin · Asignación segura de usuarios empresariales. */
(()=>{'use strict';
const BASE='https://xwehejgwufwhpkpzjzyt.supabase.co',KEY='sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz',STORE='bts-admin-sb-session-v1';
const $=id=>document.getElementById(id);let users=[],businesses=[],support=[],batchRows=[],batchPrograms=[],inventory=[],selectedBusinessId=null,selectedBatchId=null;
const notice=(text,bad=false)=>{
 $('notice').textContent=text;$('notice').classList.toggle('bad',bad);
 if(bad)window.BTSNotify?.toast({title:'No se pudo completar',message:text,type:'error',duration:6500});
};
const success=(title,message)=>window.BTSNotify?.toast({title,message,type:'success'});
const confirmBTS=options=>window.BTSNotify.confirm(options);
const currentCompanyName=()=>selectedBusiness()?.business_name||'Empresa seleccionada';
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
 const visible=users.filter(u=>u.business_id===selectedBusinessId);if(!visible.length){const tr=node('tr'),td=node('td','Esta empresa todavía no tiene usuarios asignados.');td.colSpan=5;tr.append(td);tbody.append(tr);return}
 for(const u of visible){
  const business=businesses.find(b=>b.id===u.business_id);
  const tr=node('tr');
  const first=node('td');first.append(node('strong',business?.business_name||'Empresa no disponible'),node('small',u.business_id));
  if(business?.slug){
   const link=node('a','Abrir mini panel');link.href='/negocios/?empresa='+encodeURIComponent(business.slug);
   link.target='_blank';link.rel='noopener noreferrer';link.style.cssText='display:inline-block;margin-top:6px;font-size:11px;color:#e989a7';
   first.append(link);
  }
  const second=node('td');second.append(node('strong',u.display_email||'Cuenta de empresa'),node('small',u.user_id));
  const third=node('td'),role=node('select');role.className='field';
  for(const [key,label] of [['owner','Propietario'],['manager','Encargado'],['staff','Personal'],['viewer','Solo lectura']])role.add(new Option(label,key));
  role.value=u.role;third.append(role);
  const fourth=node('td'),badge=node('span',u.is_active?'Activo':'Suspendido','tag '+(u.is_active?'on':'off'));fourth.append(badge);
  const last=node('td'),buttons=node('div',undefined,'action'),save=node('button','Guardar','btn'),toggle=node('button',u.is_active?'Suspender':'Reactivar','btn warning');
  save.type=toggle.type='button';
  save.onclick=async()=>{
   if(role.value===u.role)return notice('Este usuario ya tiene ese rol.');
   const approved=await confirmBTS({
    title:'Actualizar permisos',message:'Vas a cambiar el nivel de acceso de esta cuenta empresarial.',
    details:[{label:'Empresa',value:business?.business_name||'Empresa'},{label:'Usuario',value:u.display_email||'Usuario empresarial'},{label:'Nuevo permiso',value:role.options[role.selectedIndex]?.text||role.value}],
    confirmText:'Guardar permisos',type:'warning'
   });if(!approved)return;
   save.disabled=true;
   try{await api('bts_business_users?id=eq.'+encodeURIComponent(u.id),'PATCH',{role:role.value});await load();notice('Permisos actualizados.');success('Permisos actualizados','Se guardó el nuevo rol de '+(u.display_email||'la cuenta')+'.')}
   catch(e){notice(e.message,true)}finally{save.disabled=false}
  };
  toggle.onclick=async()=>{
   const approved=await confirmBTS({
    title:u.is_active?'Suspender acceso empresarial':'Reactivar acceso empresarial',
    message:u.is_active?'Esta persona perderá el acceso a su mini panel hasta que BTS lo reactive.':'La cuenta volverá a tener acceso al mini panel con sus permisos actuales.',
    details:[{label:'Empresa',value:business?.business_name||'Empresa'},{label:'Cuenta',value:u.display_email||'Usuario empresarial'},{label:'Acción',value:u.is_active?'Suspender':'Reactivar'}],
    confirmText:u.is_active?'Sí, suspender acceso':'Reactivar acceso',type:u.is_active?'danger':'warning'
   });if(!approved)return;
   toggle.disabled=true;
   try{await api('bts_business_users?id=eq.'+encodeURIComponent(u.id),'PATCH',{is_active:!u.is_active});await load();notice('Estado actualizado.');success(u.is_active?'Acceso suspendido':'Acceso reactivado','Se actualizó correctamente la cuenta empresarial.')}
   catch(e){notice(e.message,true)}finally{toggle.disabled=false}
  };
  buttons.append(save,toggle);last.append(buttons);tr.append(first,second,third,fourth,last);tbody.append(tr);
 }
}
function renderSupport(){
 const host=$('supportRows');host.replaceChildren();
 if(!support.some(x=>x.business_id===selectedBusinessId)){const tr=node('tr'),td=node('td','Esta empresa no tiene solicitudes de soporte.');td.colSpan=5;tr.append(td);host.append(tr);return}
 for(const item of support.filter(x=>x.business_id===selectedBusinessId)){
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
      await loadSupport();notice('Respuesta de soporte guardada.');success('Respuesta guardada','El estado y la respuesta de soporte se actualizaron.');
    }catch(e){notice(e.message,true)}finally{save.disabled=false}
  };
  response.append(text,save);tr.append(c,subject,prio,status,response);host.append(tr);
 }
}
async function loadSupport(){
 try{support=await api('bts_business_support?select=id,business_id,created_by,subject,details,priority,status,bts_reply,created_at&order=created_at.desc&limit=200')||[];renderSupport()}
 catch(e){notice('No se pudo cargar soporte: '+e.message,true)}
}


function selectedBusiness(){return businesses.find(b=>b.id===selectedBusinessId)||null}
function syncPasswordUsers(){
 const el=$('passwordUser'),old=el.value;el.replaceChildren();
 for(const u of users.filter(x=>x.business_id===selectedBusinessId))
  el.add(new Option((u.display_email||u.user_id)+(u.is_active?'':' · suspendido'),u.user_id));
 if([...el.options].some(o=>o.value===old))el.value=old;
 $('resetBusinessPassword').disabled=!el.options.length;
}
function panelUrl(b){return '/negocios/?empresa='+encodeURIComponent(b?.slug||'')}
function applyBusinessSelection(id,clearCredentials=true){
 selectedBusinessId=id;
 if(clearCredentials)$('generatedAccess').hidden=true;
 if(selectedBatchId&&!batchRows.some(x=>x.id===selectedBatchId&&x.business_id===id)){$('batchReport').hidden=true;selectedBatchId=null;}
 const b=selectedBusiness();
 $('companyPicker').value=id;
 $('provisionMode').value=b?'create_access':'create_company';
 mode();
 syncProgramBusiness();syncPasswordUsers();
 if(b){$('programBusiness').value=b.id;$('batchCompany').value=b.id;setProgramKind();setBatchPrograms()}
 renderCompany();
 render();renderBatches();renderSupport();
}
function nextStep(){
 const b=selectedBusiness();
 let section='panelStep';
 if(b){
  const accounts=users.filter(u=>u.business_id===b.id&&u.is_active);
  const programs=batchPrograms.filter(p=>p.business_id===b.id&&p.is_active);
  section=!accounts.length?'panelStep':!programs.length?'programStep':'batchStep';
 }
 const target=$(section);target.open=true;target.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderCompany(){
 const business=selectedBusiness();
 $('companyPicker').value=business?.id||'__new__';
 const selected=business?.id||null;
 const accounts=users.filter(u=>u.business_id===selected);
 const active=accounts.filter(u=>u.is_active);
 const programs=batchPrograms.filter(p=>p.business_id===selected);
 const activePrograms=programs.filter(p=>p.is_active);
 const cards=inventory.filter(c=>c.business_id===selected);
 $('companyPanelsCount').textContent=accounts.length;
 $('companyProgramsCount').textContent=programs.length;
 $('companyCardsCount').textContent=cards.length;
 $('panelStepStatus').textContent=accounts.length?(active.length?'Panel creado':'Panel suspendido'):'Sin panel';
 $('programStepStatus').textContent=activePrograms.length?activePrograms.length+' programa(s)':'Sin beneficio configurado';
 $('batchStepStatus').textContent=cards.length?cards.length+' tarjetas registradas':'Sin tarjetas';
 const noticeBox=$('existingPanelInfo');
 const form=$('provisionForm');
 $('programStep').hidden=!business;
 $('batchStep').hidden=!business;
 $('programBusiness').disabled=true;
 $('batchCompany').disabled=true;
 $('programBusiness').closest('label').hidden=true;
 $('batchCompany').closest('label').hidden=true;
 if(!business){
  $('companySummaryTitle').textContent='Nueva empresa';
  $('companySummaryText').textContent='Ingresá el nombre y el identificador. BTS creará su panel y sus credenciales una sola vez.';
  $('companyNextAction').textContent='Registrar empresa nueva';$('companyNextAction').onclick=nextStep;
  noticeBox.hidden=true;form.hidden=false;
  $('createPanel').disabled=false;
  $('createPanel').textContent='Registrar empresa y crear acceso';
  $('newCompanyField').hidden=false;$('newSlugField').hidden=false;
  return;
 }
 $('companySummaryTitle').textContent=business.business_name;
 const overview=accounts.length?
   (active.length?'El mini panel ya existe. No necesitás generar otro.':'Existe un mini panel suspendido. Reactivá el acceso desde Otras herramientas.'):
   'La empresa está registrada, pero aún no tiene acceso empresarial. Podés generarlo una vez desde el paso 1.';
 const steps=activePrograms.length?cards.length?
   ' Programa y tarjetas disponibles para gestionar.':
   ' Falta generar un lote de tarjetas en el paso 3.':
   ' Falta configurar el beneficio del programa en el paso 2.';
 $('companySummaryText').textContent=overview+steps;
 $('companyNextAction').textContent=!accounts.length?'Crear acceso empresarial':!activePrograms.length?'Configurar beneficio':cards.length?'Administrar tarjetas':'Generar primeras tarjetas';
 $('companyNextAction').onclick=nextStep;
 noticeBox.hidden=accounts.length===0;
 form.hidden=accounts.length>0;
 $('existingPanelTitle').textContent=active.length?'Esta empresa ya tiene su mini panel':'Esta empresa ya tiene panel, pero el acceso está suspendido';
 const names=accounts.map(a=>(a.display_email||'Usuario empresarial')+(a.is_active?'':' · suspendido'));
 $('existingPanelDetails').textContent=names.join(' · ')+' · '+accounts.length+' usuario(s). Para recuperar el acceso, usá Otras herramientas.';
 $('existingPanelLink').href=panelUrl(business);
 $('createPanel').disabled=accounts.length>0;
 $('createPanel').textContent='Crear acceso para '+business.business_name;
 $('newCompanyField').hidden=true;$('newSlugField').hidden=true;
 const list=$('programList');list.replaceChildren();
 if(!programs.length){list.textContent='Todavía no hay beneficio configurado. Completá el formulario siguiente una sola vez.'}
 else{
  const note=node('p','Programas de esta empresa:');
  list.append(note);
  for(const p of programs){
   const names={purchases:'Compras',visits:'Visitas',points:'Puntos',vip:'VIP'};const line=node('div',p.title+' · '+(names[p.card_category]||'Programa')+(p.is_active?' · Activo':' · Inactivo'),'help-line');
   list.append(line);
  }
 }
 $('programSetupPanel').hidden=activePrograms.length>0;
 $('addProgram').hidden=activePrograms.length===0;
 $('addProgram').textContent='Agregar otro programa';
 if($('programBusiness').value!==business.id)$('programBusiness').value=business.id;
 if($('batchCompany').value!==business.id){$('batchCompany').value=business.id;setBatchPrograms()}
 const released=new Set(batchRows.filter(b=>b.business_id===selected&&b.released_at).map(b=>b.id));
 const available=cards.filter(x=>x.status==='available'&&released.has(x.batch_id)).length, assigned=cards.filter(x=>x.status==='assigned'&&released.has(x.batch_id)).length;
 if(cards.length)$('batchPrerequisite').textContent='BTS tiene '+cards.length+' tarjetas generadas para esta empresa: '+available+' enviadas y sin asignar, '+assigned+' asignadas. Las pendientes de envío todavía no están visibles para el negocio.';
 else $('batchPrerequisite').textContent=activePrograms.length?'Programa listo: elegí cuántas tarjetas querés emitir para este negocio.':'Primero configurá un programa en el paso 2; después podés generar sus tarjetas.';
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
 $('newCompanyName').required=isNew;$('newCompanySlug').required=isNew;$('provisionCompany').required=false;
}
async function createPanel(e){
 e.preventDefault();
 const b=$('createPanel');b.disabled=true;
 try{
  const company=selectedBusiness();
  if(company&&users.some(u=>u.business_id===company.id)){
   renderCompany();throw Error('Esta empresa ya tiene un mini panel. Abrí su acceso existente en lugar de crear otro.');
  }
  if(!company){
   const name=$('newCompanyName').value.trim(),slug=$('newCompanySlug').value.trim().toLowerCase();
   if(businesses.some(x=>x.slug===slug||x.business_name.trim().toLocaleLowerCase('es')===name.toLocaleLowerCase('es')))
     throw Error('Esta empresa ya existe en BTS. Seleccionala arriba para revisar su panel.');
  }
  const action=company?'create_access':'create_company';
  const payload=company?{business_id:company.id}:{business_name:$('newCompanyName').value.trim(),slug:$('newCompanySlug').value.trim().toLowerCase()};
  const data=await provision(action,payload);
  selectedBusinessId=data.business_id;
  await load();
  reveal(data);
  $('panelStep').open=true;
  notice('Acceso creado para '+(selectedBusiness()?.business_name||'la empresa')+'. Copiá las credenciales ahora; no se podrán recuperar después.');success('Mini panel creado','Copiá el usuario y la contraseña temporal: solo se mostrarán ahora.');
 }catch(err){notice(err.message,true);renderCompany()}finally{b.disabled=!!(selectedBusiness()&&users.some(u=>u.business_id===selectedBusinessId))}
}
async function resetPassword(){
 const id=$('passwordUser').value;if(!id)return notice('Seleccioná un acceso empresarial.',true);
 const account=users.find(u=>u.user_id===id&&u.business_id===selectedBusinessId);
 const approved=await confirmBTS({
  title:'Generar contraseña nueva',message:'La contraseña actual dejará de funcionar. Entregá la nueva únicamente a la persona autorizada.',
  details:[{label:'Empresa',value:currentCompanyName()},{label:'Cuenta',value:account?.display_email||'Usuario empresarial'}],
  confirmText:'Restablecer contraseña',type:'danger',note:'La contraseña generada se mostrará una sola vez.'
 });if(!approved)return;
 const b=$('resetBusinessPassword');b.disabled=true;
 try{
  const data=await provision('reset_password',{user_id:id});
  $('generatedAccess').hidden=false;$('generatedUrl').value='https://www.btsstudio.net/negocios/';
  $('generatedUsername').value=users.find(x=>x.user_id===id)?.display_email?.split('@')[0]||'';
  $('generatedPassword').value=data.password;notice('Contraseña nueva generada. Compartila por canal seguro.');success('Contraseña actualizada','Copiá las credenciales nuevas y entregalas por un canal seguro.');
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
 notice('Códigos privados descargados: '+rows.length+'. Reservados para programación NFC BTS.');success('CSV privado descargado',rows.length+' códigos NFC disponibles para programación exclusiva de BTS.');
}
function batchCompany(batch){return businesses.find(b=>b.id===batch.business_id)?.business_name||'Empresa'}
function batchProgram(batch){return batchPrograms.find(p=>p.id===batch.program_id)?.title||'Programa NFC'}
function batchItems(batch){return inventory.filter(c=>c.batch_id===batch.id).sort((a,b)=>a.number-b.number)}
function batchSent(batch){return !!batch.released_at}
function smallMetric(label,value){
 const stat=node('div',undefined,'batch-report-stat');
 stat.append(node('small',label),node('strong',String(value)));return stat;
}
function renderBatches(){
 const host=$('batchRows');host.replaceChildren();
 const batches=batchRows.filter(x=>x.business_id===selectedBusinessId);
 if(!batches.length){
  const empty=node('div','Esta empresa todavía no tiene lotes NFC. Generá el primero con el formulario de arriba.','batch-lot');
  host.append(empty);$('batchReport').hidden=true;selectedBatchId=null;return;
 }
 for(const batch of batches){
  const cards=batchItems(batch),assigned=cards.filter(c=>c.status==='assigned').length;
  const entry=node('article',undefined,'batch-lot'),top=node('div',undefined,'batch-lot-top'),heading=node('div');
  heading.append(node('div','LOTE BTS · '+batch.id.slice(0,8).toUpperCase(),'batch-lot-kicker'),node('h3',batchProgram(batch)));
  const badge=node('span',batchSent(batch)?'Enviado al mini panel':'Pendiente de envío','batch-status'+(batchSent(batch)?' batch-status--sent':''));
  top.append(heading,badge);
  const info=node('div',undefined,'batch-lot-info');
  for(const text of [batch.quantity+' tarjetas',assigned+' asignadas',new Date(batch.created_at).toLocaleDateString('es-NI')])info.append(node('span',text));
  const actions=node('div',undefined,'batch-lot-actions');
  const view=node('button','Ver ficha del lote','btn'),add=node('button','+ Agregar tarjetas','btn');
  view.type=add.type='button';view.onclick=()=>openBatchReport(batch.id);
  add.onclick=()=>prepareAdditionalBatch(batch.id);
  actions.append(view,add);
  if(!batchSent(batch)){
   const send=node('button','Enviar al mini panel','btn primary');send.type='button';
   send.onclick=()=>sendBatch(batch.id,send);actions.append(send);
  }
  entry.append(top,info,actions);host.append(entry);
 }
 if(selectedBatchId)renderBatchReport();
}
function openBatchReport(id){
 selectedBatchId=id;
 renderBatchReport();
 $('batchReport').hidden=false;
 $('batchReport').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderBatchReport(){
 const batch=batchRows.find(x=>x.id===selectedBatchId&&x.business_id===selectedBusinessId);
 if(!batch){$('batchReport').hidden=true;selectedBatchId=null;return}
 const cards=batchItems(batch);
 $('batchReport').hidden=false;
 $('batchReportTitle').textContent='Lote '+batch.id.slice(0,8).toUpperCase();
 $('batchReportSubtitle').textContent=batchCompany(batch)+' · '+batchProgram(batch);
 const stats=$('batchReportStats');stats.replaceChildren(
  smallMetric('EMPRESA',batchCompany(batch)),
  smallMetric('PROGRAMA',batchProgram(batch)),
  smallMetric('TARJETAS DEL LOTE',batch.quantity),
  smallMetric('ESTADO',batchSent(batch)?'Enviado al mini panel':'Pendiente de envío'),
  smallMetric('FECHA DE GENERACIÓN',new Date(batch.created_at).toLocaleString('es-NI')),
  smallMetric('ASIGNADAS',cards.filter(x=>x.status==='assigned').length+' de '+batch.quantity)
 );
 $('batchReportInfo').textContent=batchSent(batch)?
  'Este lote ya fue enviado al mini panel y sus tarjetas están disponibles para el negocio.':
  'Este lote está guardado en BTS. La empresa no verá sus tarjetas hasta que confirmés «Enviar al mini panel».';
 $('batchReportSend').hidden=batchSent(batch);
 $('batchReportSend').disabled=batchSent(batch);
 const host=$('batchReportRows');host.replaceChildren();
 for(const card of cards){
  const row=node('tr');
  for(const value of [String(card.number).padStart(3,'0'),card.reference,card.status==='assigned'?'Asignada':card.status==='suspended'?'Suspendida':'Pendiente de asignación'])
   row.append(node('td',value));
  host.append(row);
 }
 if(!cards.length){const tr=node('tr'),td=node('td','No hay tarjetas registradas en este lote.');td.colSpan=3;tr.append(td);host.append(tr)}
}
async function sendBatch(id,button){
 const batch=batchRows.find(b=>b.id===id&&b.business_id===selectedBusinessId);
 if(!batch)return notice('No se encontró el lote.',true);
 if(batchSent(batch))return notice('Este lote ya fue enviado al mini panel.',true);
 const recipients=users.filter(u=>u.business_id===batch.business_id&&u.is_active);
 const approved=await confirmBTS({
  title:'Enviar tarjetas al mini panel',type:'warning',
  message:'Vas a habilitar las tarjetas de este lote para que la empresa pueda asignar nombres y beneficios. Los códigos NFC privados no se compartirán.',
  details:[{label:'Empresa',value:batchCompany(batch)},{label:'Programa',value:batchProgram(batch)},{label:'Tarjetas',value:batch.quantity},{label:'Accesos empresariales activos',value:recipients.length}],
  confirmText:'Sí, enviar tarjetas',
  note:recipients.length?'Las tarjetas aparecerán en el inventario del negocio.':'La empresa todavía no tiene usuario activo. Las tarjetas quedarán habilitadas cuando BTS cree o reactive su acceso.'
 });if(!approved)return;
 button.disabled=true;
 try{
  const result=await api('rpc/bts_admin_release_nfc_batch','POST',{p_batch_id:id});
  if(!result?.length)throw Error('El servidor no confirmó el envío.');
  await loadBatches();
  selectedBatchId=id;renderBatchReport();
  success('Tarjetas enviadas',batch.quantity+' tarjetas disponibles en el mini panel de '+batchCompany(batch)+'.');
  notice('Lote enviado. La empresa puede administrar las tarjetas que recibió.');
 }catch(error){notice('No se pudieron enviar las tarjetas: '+error.message,true)}
 finally{button.disabled=false}
}
function prepareAdditionalBatch(id){
 const batch=batchRows.find(b=>b.id===id&&b.business_id===selectedBusinessId);
 if(!batch)return notice('Seleccioná un lote válido de esta empresa.',true);
 $('batchProgram').value=batch.program_id;
 $('batchQuantity').value='10';
 $('batchStep').open=true;
 $('batchReport').hidden=true;
 selectedBatchId=null;
 $('batchForm').scrollIntoView({behavior:'smooth',block:'center'});
 $('batchQuantity').focus({preventScroll:true});
 notice('Elegí cuántas tarjetas adicionales querés crear. El nuevo lote quedará pendiente de envío.');
}
function syncProgramBusiness(){
 const el=$('programBusiness'),old=el.value;el.replaceChildren();
 for(const b of businesses.filter(b=>b.is_active))el.add(new Option(b.business_name,b.id));
 if(businesses.some(b=>b.id===old&&b.is_active))el.value=old;
}
function setProgramKind(){
 const type=$('programKind').value,vip=type==='vip';
 $('programGoalField').style.display=vip?'none':'';
 $('programUnitField').style.display=vip?'none':'';
 $('programVipMonthsField').style.display=vip?'':'none';
 $('programEarnField').style.display=type==='points'?'':'none';
 $('programGoal').required=!vip;$('programEarn').required=type==='points';
 $('programBenefit').maxLength=vip?600:130;
 $('programBenefit').placeholder=vip?'Ej. 15 % de descuento, eventos exclusivos y prioridad de atención':'Ej. Regalo o descuento al completar la meta';
 $('programUnit').value=type==='purchases'?'compras':type==='visits'?'visitas':type==='points'?'puntos':'membresía';
 const names={purchases:'Fidelización',visits:'Visitas',points:'Puntos',vip:'VIP'};
 if(!$('programTitle').dataset.manual){
  const company=selectedBusiness()?.business_name||'';
  $('programTitle').value=names[type]+' · '+company.slice(0,65);
 }
 $('programSetupHint').textContent=vip?'La membresía ofrece beneficios y vigencia. BTS generará sus tarjetas VIP al emitir un lote.':
 type==='points'?'Definí los puntos que se obtienen por operación y la meta para retirar el premio.':
 'Elegí cuántas '+$('programUnit').value+' debe completar el cliente para obtener el beneficio.';
}
async function createRewardProgram(e){
 e.preventDefault();
 const businessId=selectedBusinessId,category=$('programKind').value,kind=category==='vip'?'vip':'loyalty',company=selectedBusiness();
 const button=$('programCreate');button.disabled=true;
 try{
  if(!company?.is_active)throw Error('Seleccioná una empresa activa.');
  const title=$('programTitle').value.trim(),benefit=$('programBenefit').value.trim();
  if(title.length<2||title.length>85)throw Error('El nombre del programa debe tener entre 2 y 85 caracteres.');
  if(!benefit||benefit.length>(kind==='vip'?600:130))throw Error('Revisá los beneficios de la tarjeta.');
  if(!['purchases','visits','points','vip'].includes(category))throw Error('Tipo de tarjeta inválido.');
  const existing=batchPrograms.filter(p=>p.business_id===businessId&&p.card_category===category);
  if(existing.length)throw Error('Esta empresa ya tiene la categoría '+category+'. Seleccioná el programa existente al generar el lote; no tenés que crearlo otra vez.');
  const goal=Number($('programGoal').value),months=Number($('programVipMonths').value),earn=Number($('programEarn').value);
  if(kind==='loyalty'&&(!Number.isInteger(goal)||goal<1||goal>10000))throw Error('La meta debe estar entre 1 y 10000.');
  if(kind==='vip'&&(!Number.isInteger(months)||months<1||months>60))throw Error('La vigencia VIP debe estar entre 1 y 60 meses.');
  if(category==='points'&&(!Number.isInteger(earn)||earn<1||earn>1000))throw Error('Los puntos por compra deben estar entre 1 y 1000.');
  const approved=await confirmBTS({
   title:'Configurar programa de tarjetas',message:'El programa quedará disponible para esta empresa, pero todavía no se emitirán códigos NFC.',
   details:[{label:'Empresa',value:company.business_name},{label:'Programa',value:title},{label:'Tipo',value:kind==='vip'?'Membresía VIP':'Fidelización'},{label:'Beneficio',value:benefit}],
   confirmText:'Sí, crear programa',type:'info'
  });if(!approved)return;
  const payload={business_id:businessId,kind,card_category:category,title,reward_label:kind==='vip'?'Beneficios VIP':benefit,is_active:true};
  if(kind==='loyalty'){payload.goal_units=goal;payload.unit_name=category==='visits'?'visitas':category==='points'?'puntos':'compras';payload.units_per_visit=category==='points'?earn:1;}
  if(kind==='vip'){payload.vip_benefits=benefit;payload.vip_validity_months=months;}
  const rows=await api('bts_reward_programs','POST',payload);
  if(!rows?.[0]?.id)throw Error('No se recibió confirmación del programa.');
  await loadBatches();
  $('batchCompany').value=businessId;
  setBatchPrograms();
  $('batchProgram').value=rows[0].id;
  $('batchQuantity').value='3';
  $('programSetupHint').textContent='Programa listo. Elegí cantidad y presioná «Generar lote NFC» más abajo. Para prueba recomendamos 3 tarjetas.';
  $('batchStep').open=true;
  notice('Programa creado. Falta emitir el lote de tarjetas desde BTS.');success('Programa configurado','Ahora podés emitir el lote de tarjetas de '+company.business_name+'.');
 }catch(err){notice('No se pudo crear el programa: '+err.message,true)}finally{button.disabled=false}
}
function setBatchPrograms(){
 const businessId=selectedBusinessId,sel=$('batchProgram'),old=sel.value;
 sel.replaceChildren();
 for(const p of batchPrograms.filter(x=>x.business_id===businessId&&x.is_active))sel.add(new Option(p.title+' · '+({purchases:'Compras',visits:'Visitas',points:'Puntos',vip:'VIP'}[p.card_category]||'Tarjeta'),p.id));
 if([...sel.options].some(o=>o.value===old))sel.value=old;
 if(!sel.options.length)sel.add(new Option('Sin programas activos',''));
 sel.disabled=!batchPrograms.some(x=>x.business_id===businessId&&x.is_active);
 $('batchGenerate').disabled=sel.disabled;
}
async function loadBatches(){
 try{
  const [programs,batches,cards]=await Promise.all([
   api('bts_reward_programs?select=id,business_id,kind,card_category,title,is_active&order=created_at.desc&limit=500'),
   api('bts_nfc_batches?select=id,business_id,program_id,quantity,created_at,released_at,released_by&order=created_at.desc&limit=500'),
   api('bts_nfc_inventory?select=id,batch_id,business_id,number,status,reference&order=created_at.desc&limit=5000')
  ]);
  batchPrograms=programs||[];batchRows=batches||[];inventory=cards||[];
  const select=$('batchCompany'),old=select.value;select.replaceChildren();
  for(const b of businesses.filter(b=>b.is_active))select.add(new Option(b.business_name,b.id));
  if(businesses.some(b=>b.id===old&&b.is_active))select.value=old;
  if(selectedBusinessId&&businesses.some(b=>b.id===selectedBusinessId))select.value=selectedBusinessId;
  setBatchPrograms();renderBatches();renderCompany();
 }catch(e){notice('No se pudieron consultar los lotes: '+e.message,true)}
}
async function generateBatch(e){
 e.preventDefault();
 const b=$('batchGenerate');b.disabled=true;
 const businessId=selectedBusinessId,programId=$('batchProgram').value,quantity=Number($('batchQuantity').value);
 try{
  if(!Number.isInteger(quantity)||quantity<1||quantity>200)throw Error('Generá entre 1 y 200 tarjetas por lote.');
  if(!batchPrograms.some(x=>x.id===programId&&x.business_id===businessId&&x.is_active))throw Error('Programa inválido.');
  const company=selectedBusiness(),program=batchPrograms.find(x=>x.id===programId);
  const approved=await confirmBTS({
   title:'Generar lote de tarjetas NFC',
   message:'Vas a emitir códigos privados y únicos para esta empresa. Esta operación creará tarjetas reales en el inventario BTS.',
   details:[{label:'Empresa',value:company?.business_name||'Empresa'},{label:'Programa',value:program?.title||'Programa NFC'},{label:'Cantidad',value:quantity+' tarjetas NFC'},{label:'Códigos privados',value:'Solo BTS'},{label:'Al finalizar',value:'Ficha de lote en BTS; envío por separado'}],
   confirmText:quantity<=3?'Sí, generar prueba':'Sí, generar lote',type:'warning',
   note:'El lote quedará pendiente: no aparecerá en el mini panel hasta que presionés «Enviar al mini panel». Los códigos privados permanecen en BTS.'
  });if(!approved)return;
  const rows=await api('rpc/bts_issue_nfc_batch','POST',{p_business_id:businessId,p_program_id:programId,p_quantity:quantity,p_note:'Lote BTS'});
  if(!rows?.length||rows.length!==quantity)throw Error('El servidor no confirmó todas las tarjetas.');
  const newBatchId=rows[0].batch_id;
  await loadBatches();openBatchReport(newBatchId);
  notice('Lote creado y guardado en BTS. Revisá su ficha y decidí cuándo enviarlo al mini panel.');
  success('Lote listo para revisar',rows.length+' tarjetas generadas. Los códigos privados se descargan desde «CSV privado»; el negocio aún no ve este lote.');
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
  const picker=$('companyPicker');picker.replaceChildren();
  for(const row of businesses)picker.add(new Option(row.business_name+(row.is_active?'':' · inactiva'),row.id));
  picker.add(new Option('+ Registrar empresa nueva','__new__'));
  if(!selectedBusinessId||(!businesses.some(x=>x.id===selectedBusinessId)&&selectedBusinessId!=='__new__'))selectedBusinessId=businesses[0]?.id||'__new__';
  picker.value=selectedBusinessId;
  const select=$('provisionCompany');select.replaceChildren();
  for(const business of businesses.filter(b=>b.is_active))select.add(new Option(business.business_name,business.id));
  if(selectedBusinessId!=='__new__')select.value=selectedBusinessId;
  syncPasswordUsers();
  const bSelected=selectedBusiness();
  $('provisionMode').value=bSelected?'create_access':'create_company';
  mode();
  render();
  syncProgramBusiness();
  await Promise.all([loadSupport(),loadBatches()]);
  renderCompany();
  notice('Información de '+(bSelected?.business_name||'empresas')+' actualizada.');
 }catch(err){notice('No se pudieron consultar las empresas: '+err.message,true)}
}
async function init(){
 try{
  const session=current();if(!session?.user?.id)throw Error('Iniciá sesión desde /admin/ para gestionar accesos.');
  const admins=await api('bts_admins?user_id=eq.'+encodeURIComponent(session.user.id)+'&select=user_id,role&limit=1');
  if(!admins.length||!['owner','admin'].includes(admins[0].role))throw Error('Tu cuenta no tiene acceso de administración BTS.');
  $('companyPicker').onchange=e=>applyBusinessSelection(e.target.value);
  $('newBusiness').onclick=()=>{applyBusinessSelection('__new__');$('panelStep').open=true;$('panelStep').scrollIntoView({behavior:'smooth',block:'start'})};
  $('manageExistingAccess').onclick=()=>{$('advancedStep').open=true;$('advancedStep').scrollIntoView({behavior:'smooth',block:'start'})};
  $('addProgram').onclick=()=>{$('programSetupPanel').hidden=false;$('addProgram').hidden=true;$('programStep').open=true;$('programTitle').dataset.manual='';setProgramKind()};
  $('provisionForm').onsubmit=createPanel;
  $('newCompanyName').oninput=()=>{
   if(!$('newCompanySlug').dataset.manual)$('newCompanySlug').value=$('newCompanyName').value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);
  };
  $('newCompanySlug').oninput=()=>{$('newCompanySlug').dataset.manual='1'};
  $('resetBusinessPassword').onclick=resetPassword;
  $('copyGenerated').onclick=async()=>{
   const message='Enlace: '+$('generatedUrl').value+'\nUsuario: '+$('generatedUsername').value+'\nContraseña: '+$('generatedPassword').value;
   try{await navigator.clipboard.writeText(message);notice('Datos copiados. Compartilos por un canal seguro.');success('Datos copiados','Compartí las credenciales por un canal seguro.')}catch{notice('Copiá los datos manualmente.',true)}
  };
  $('reload').onclick=load;$('reloadSupport').onclick=loadSupport;
  $('programSetupForm').onsubmit=createRewardProgram;
  $('programKind').onchange=setProgramKind;
  $('programTitle').oninput=()=>{$('programTitle').dataset.manual='1'};
  $('batchTestThree').onclick=()=>{
   $('batchQuantity').value='3';
   $('batchPrerequisite').textContent='Prueba preparada: se emitirán 3 códigos solo después de confirmar «Generar lote NFC».';
  };
  $('batchForm').onsubmit=generateBatch;$('batchRefresh').onclick=loadBatches;
  $('batchReportClose').onclick=()=>{$('batchReport').hidden=true;selectedBatchId=null};
  $('batchReportPrint').onclick=()=>{if(selectedBatchId)window.print()};
  $('batchReportPrivate').onclick=async()=>{const id=selectedBatchId;if(!id)return;const btn=$('batchReportPrivate');btn.disabled=true;try{await fetchCodes(id)}catch(e){notice(e.message,true)}finally{btn.disabled=false}};
  $('batchReportSend').onclick=()=>{if(selectedBatchId)sendBatch(selectedBatchId,$('batchReportSend'))};
  $('batchReportAdd').onclick=()=>{if(selectedBatchId)prepareAdditionalBatch(selectedBatchId)};
  await load();
 }catch(err){notice(err.message,true);$('createPanel').disabled=true;$('reload').disabled=true;$('batchGenerate').disabled=true;$('programCreate').disabled=true}
}
init();
})();