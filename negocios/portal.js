/* BTS Studio: portal empresarial con autenticación independiente y datos aislados por RLS. */
(()=>{'use strict';
const BASE='https://xwehejgwufwhpkpzjzyt.supabase.co',KEY='sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz';
const STORE='bts-business-session-v1',$=id=>document.getElementById(id);
const state={session:null,assignments:[],business:null,role:'viewer',programs:[],members:[],movements:[],checkins:[],promos:[],tickets:[],inventory:[],notices:[],tab:'programs'};
const nameRole={owner:'Propietario',manager:'Encargado',staff:'Personal',viewer:'Consulta'};
const $node=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=String(txt);if(cls)x.className=cls;return x};
const iso=()=>new Date().toISOString().slice(0,10),date=s=>s?new Date(s.slice(0,10)+'T12:00:00').toLocaleDateString('es-NI'):'Sin fecha';
function msg(t,bad=false){
 $('notice').textContent=t;$('notice').classList.toggle('bad',bad);
 if(bad)window.BTSNotify?.toast({title:'No se pudo completar',message:t,type:'error',duration:6500});
}
function success(title,message){window.BTSNotify?.toast({title,message,type:'success'})}
const confirmBTS=opts=>window.BTSNotify.confirm(opts);
function getSaved(){try{return JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{return null}}
function save(s){state.session=s;if(s)sessionStorage.setItem(STORE,JSON.stringify(s));else sessionStorage.removeItem(STORE)}
async function request(path,{method='GET',payload=null,token=null}={}){
 const headers={apikey:KEY,Accept:'application/json'};
 if(token)headers.Authorization='Bearer '+token;
 if(payload!==null){headers['Content-Type']='application/json';headers.Prefer='return=representation'}
 const r=await fetch(BASE+path,{method,headers,body:payload===null?undefined:JSON.stringify(payload),cache:'no-store'});
 const raw=r.status===204?'':await r.text();let json;try{json=raw?JSON.parse(raw):null}catch{json=null}
 if(!r.ok)throw Error(json?.message||json?.error_description||json?.msg||json?.error||'Error de acceso ('+r.status+')');
 return json;
}
async function refresh(){
 let s=state.session;if(!s?.access_token||!s?.refresh_token)throw Error('Iniciá sesión para continuar.');
 if((s.expires_at||0)*1000>Date.now()+60000)return s.access_token;
 const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',payload:{refresh_token:s.refresh_token}});
 s={...s,...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600)};
 save(s);return s.access_token;
}
async function api(path,method='GET',payload=null){return request('/rest/v1/'+path,{method,payload,token:await refresh()})}
function showLogin(err=''){$('dashboard').classList.add('hidden');$('loginScreen').classList.remove('hidden');$('loginError').textContent=err}
function showPortal(){$('dashboard').classList.remove('hidden');$('loginScreen').classList.add('hidden')}
async function verify(){
 const s=state.session;if(!s?.user?.id)throw Error('No hay una cuenta válida.');
 const records=await api('bts_business_users?user_id=eq.'+encodeURIComponent(s.user.id)+'&is_active=eq.true&select=business_id,role,id&order=created_at.asc&limit=100');
 if(!records?.length)throw Error('Tu cuenta aún no tiene empresas asignadas. Solicitá acceso a BTS.');
 const ids=[...new Set(records.map(x=>x.business_id))];
 const businessRows=await api('bts_nfc_cards?id=in.('+ids.map(encodeURIComponent).join(',')+')&select=id,slug,business_name,is_active');
 const requestedSlug=new URLSearchParams(location.search).get('empresa');
 const active=businessRows.filter(x=>x.is_active&&records.some(r=>r.business_id===x.id)&&(!requestedSlug||x.slug===requestedSlug));
 if(!active.length)throw Error('No tenés acceso a este mini panel o la empresa está suspendida.');
 state.assignments=records.filter(r=>active.some(b=>b.id===r.business_id)).map(r=>({...r,business:active.find(b=>b.id===r.business_id)}));
 $('businessSelect').replaceChildren();
 for(const a of state.assignments){const opt=new Option(a.business.business_name,a.business_id);$('businessSelect').add(opt)}
 await selectBusiness(state.assignments[0].business_id);
 showPortal();
}
async function login(e){e.preventDefault();const button=$('loginBtn');button.disabled=true;$('loginError').textContent='';
 try{
  const form=e.currentTarget,username=form.elements.namedItem('email').value.trim().toLowerCase(),email=username.includes('@')?username:username+'@acceso.btsstudio.net',password=form.elements.namedItem('password').value;
  const s=await request('/auth/v1/token?grant_type=password',{method:'POST',payload:{email,password}});
  save({...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+(s.expires_in||3600)});
  form.reset();await verify();
 }catch(err){save(null);showLogin(err.message)}
 finally{button.disabled=false}
}
function logout(){save(null);state.assignments=[];showLogin()}
async function selectBusiness(id){
 const a=state.assignments.find(v=>v.business_id===id);if(!a)throw Error('La empresa no pertenece a tu cuenta');
 state.business=a.business;state.role=a.role;$('businessSelect').value=id;
 $('businessTitle').textContent=a.business.business_name;
 $('roleLabel').textContent='Cuenta empresarial · '+nameRole[a.role];
 const canManage=['owner','manager'].includes(a.role),canCheckin=['owner','manager','staff'].includes(a.role);
 $('assignCardForm').hidden=!canManage;
 $('promoForm').classList.toggle('hidden',!canManage);
 $('noticesForm').classList.toggle('hidden',!canManage);
 $('noticesPermission').textContent=canManage?'Podés publicar y pausar avisos':'Avisos de solo lectura';
 $('promoPermission').textContent=canManage?'Podés crear promociones':'Promociones de solo lectura';
 $('vipForm').classList.toggle('hidden',!canCheckin);
 await loadBusiness();
}
function entry(title,subtitle,status,good=false){
 const div=$node('article',undefined,'entry'),text=$node('div');
 text.append($node('strong',title),$node('small',subtitle||''));
 div.append(text);if(status)div.append($node('span',status,'tag'+(good?' ok':'')));
 return div;
}
function render(){
 $('kPrograms').textContent=state.programs.filter(p=>p.is_active).length;
 $('kMembers').textContent=state.members.length;
 $('kMovements').textContent=state.movements.length;
 $('kVisits').textContent=state.checkins.length;
 const programs=$('programRows');programs.replaceChildren();
 if(!state.programs.length)programs.append($node('p','Este negocio todavía no tiene programas configurados.','empty'));
 for(const p of state.programs){
  const category={purchases:'Fidelización',visits:'Visitas',points:'Puntos',vip:'VIP'}[p.card_category]||'Tarjeta';
  const detail=p.kind==='vip'?'VIP · '+p.vip_validity_months+' meses':p.goal_units+' '+p.unit_name+' para '+p.reward_label;
  programs.append(entry(p.title,category+' · '+detail,p.is_active?'Activo':'Suspendido',p.is_active));
 }
 renderMembers();renderAssignable();renderLoyalty();renderPromos();renderNotices();renderVIP();renderSupport();
}
function renderMembers(){
 const host=$('memberRows'),q=$('memberSearch').value.trim().toLowerCase();
 host.replaceChildren();
 const inv=state.inventory||[];
 $('invTotal').textContent=inv.length;
 $('invAvailable').textContent=inv.filter(x=>x.status==='available').length;
 $('invAssigned').textContent=inv.filter(x=>x.status==='assigned').length;
 $('invSuspended').textContent=inv.filter(x=>x.status==='suspended').length;
 const rows=inv.filter(x=>{
  const m=state.members.find(m=>m.id===x.member_id);
  return [x.reference,m?.full_name].some(v=>String(v||'').toLowerCase().includes(q));
 });
 if(!rows.length)host.append($node('p','No hay tarjetas del lote para mostrar. BTS debe generar primero las tarjetas.','empty'));
 for(const x of rows){
  const m=state.members.find(m=>m.id===x.member_id);
  const p=state.programs.find(p=>p.id===x.program_id);
  const name=x.status==='available'?'Sin asignar':m?.full_name||'Cliente';
  const detail=x.reference+' · '+(p?.title||'Programa')+' · '+(x.status==='available'?'Pendiente de cliente':x.benefit_label||'Beneficio asignado');
  const row=entry(name,detail,x.status==='available'?'Disponible':x.status==='assigned'?'Asignada':'Suspendida',x.status==='assigned');
  if(x.status==='assigned'&&p?.kind==='loyalty'&&m){
   const goal=Math.max(1,Number(p.goal_units)||6),count=Math.max(0,Number(m.current_units)||0);
   const progress=$node('div',undefined,'card-progress');
   progress.style.cssText='width:100%;max-width:180px;display:grid;gap:5px;margin-top:8px';
   progress.append($node('small',Math.min(goal,count)+' de '+goal+' '+(p.unit_name||'compras')));
   const track=$node('div');track.style.cssText='height:7px;border-radius:8px;overflow:hidden;background:#403a46';
   const fill=$node('span');fill.style.cssText='display:block;height:100%;background:#b74469;width:'+Math.min(100,count/goal*100)+'%';
   track.append(fill);progress.append(track);row.firstElementChild?.append(progress);
  }
  host.append(row);
 }
}
function programForSlot(slot){
 return slot?state.programs.find(p=>p.id===slot.program_id):null;
}
function benefitFromProgram(program){
 if(!program)return '';
 return String(program.kind==='vip'?program.vip_benefits:program.reward_label||'').trim();
}
function renderAssignmentPreview(){
 const slot=state.inventory.find(x=>x.id===$('assignSlot').value&&x.status==='available');
 const p=programForSlot(slot);
 const kind=p?({purchases:'Fidelización',visits:'Visitas',points:'Puntos',vip:'Membresía VIP'}[p.card_category]||'Programa NFC'):'Sin programa';
 $('assignProgramName').textContent=p?p.title+' · '+kind:'Seleccioná una tarjeta';
 $('assignProgramBenefit').textContent=p?('Beneficio predeterminado: '+(benefitFromProgram(p)||'Beneficio VIP configurado por BTS')):'El programa y beneficio se mostrarán automáticamente.';
 $('assignProgramGoal').textContent=p?(p.kind==='vip'?'Vigencia: '+p.vip_validity_months+' meses desde la asignación':'Meta: '+p.goal_units+' '+p.unit_name+(p.card_category==='points'?' · '+(p.units_per_visit||1)+' puntos por operación':'')):'';
 $('assignSubmit').disabled=!p||!p.is_active||!slot;
}
function renderAssignable(){
 const el=$('assignSlot'),old=el.value;el.replaceChildren();
 const available=state.inventory.filter(x=>x.status==='available'&&programForSlot(x)?.is_active);
 for(const x of available)el.add(new Option(x.reference+' · '+(programForSlot(x)?.title||'Programa'),x.id));
 if(available.some(x=>x.id===old))el.value=old;
 if(!available.length)el.add(new Option('No hay tarjetas disponibles',''));
 el.disabled=!available.length;
 renderAssignmentPreview();
}
async function assignCard(e){
 e.preventDefault();
 if(!['owner','manager'].includes(state.role))return msg('No tenés permiso para asignar tarjetas.',true);
 const id=$('assignSlot').value,slot=state.inventory.find(x=>x.id===id&&x.status==='available');
 if(!slot)return msg('Elegí una tarjeta pendiente de asignar.',true);
 if(!program?.is_active)return msg('La tarjeta no tiene un programa activo. Consultá a BTS.',true);
 const name=$('assignName').value.trim(),program=programForSlot(slot),benefit=benefitFromProgram(program);
 const approved=await confirmBTS({
 title:'Asignar tarjeta NFC',message:'Vas a asignar una tarjeta del lote de BTS. Esta operación no puede repetirse con otro cliente.',
 details:[{label:'Negocio',value:state.business?.business_name||'Negocio'},{label:'Tarjeta',value:slot.reference},{label:'Cliente',value:name},{label:'Programa',value:program.title},{label:'Beneficio',value:benefit||'Beneficios VIP definidos por BTS'}],
 confirmText:'Sí, asignar tarjeta',type:'warning'
 });if(!approved)return;
 const button=$('assignSubmit');button.disabled=true;
 try{
  const result=await api('rpc/bts_business_assign_nfc','POST',{p_slot_id:id,p_full_name:name,p_benefit_label:null});
  if(!result?.length)throw Error('No se confirmó la asignación.');
  $('assignCardForm').reset();await loadBusiness();$('assignResult').textContent='Tarjeta '+slot.reference+' asignada correctamente.';
  msg('Tarjeta asignada. El código NFC sigue reservado a BTS.');success('Tarjeta asignada','Se vinculó '+slot.reference+' a '+name+'. El código NFC sigue reservado a BTS.');
 }catch(error){msg(error.message,true);$('assignResult').textContent=error.message}
 finally{button.disabled=false}
}
function renderPromos(){
 const host=$('promoRows');host.replaceChildren();
 if(!state.promos.length)host.append($node('p','Aún no hay promociones.','empty'));
 for(const p of state.promos){
  const row=entry(p.title,p.description+' · '+date(p.starts_on)+' — '+date(p.ends_on),p.is_active?'Activa':'Pausada',p.is_active);
  if(['owner','manager'].includes(state.role)){
   const button=$node('button',p.is_active?'Pausar':'Activar','btn');button.type='button';
   button.onclick=async()=>{button.disabled=true;try{
    await api('bts_business_promotions?id=eq.'+encodeURIComponent(p.id)+'&business_id=eq.'+encodeURIComponent(state.business.id),'PATCH',{is_active:!p.is_active});
    await loadBusiness();msg('Promoción actualizada.');success('Promoción actualizada','Los cambios ya están guardados en tu negocio.');
   }catch(e){msg(e.message,true)}finally{button.disabled=false}};
   row.append(button);
  }
  host.append(row);
 }
}
function noticeDefaults(){
 const type=$('noticeType').value,templates={
  promotion:['¡Tenemos una promoción para vos!','Mostrá tu tarjeta NFC y consultá las promociones disponibles en nuestro negocio.'],
  gift:['¡Tenés una regalía especial!','Presentá tu tarjeta NFC en nuestro negocio para conocer tu beneficio.'],
  info:['Información para nuestros clientes','Te compartimos una novedad importante sobre tu tarjeta y sus beneficios.']
 };
 if(!$('noticeTitle').dataset.edited&&(!$('noticeTitle').value||Object.values(templates).some(x=>x[0]===$('noticeTitle').value)))
  $('noticeTitle').value=templates[type][0];
 if(!$('noticeMessage').dataset.edited&&(!$('noticeMessage').value||Object.values(templates).some(x=>x[1]===$('noticeMessage').value)))
  $('noticeMessage').value=templates[type][1];
}
function renderNoticeMembers(){
 const sel=$('noticeMember'),previous=sel.value,program=$('noticeProgram').value;
 sel.replaceChildren();
 const members=state.members.filter(m=>m.program_id===program&&m.is_active&&state.inventory.some(i=>i.member_id===m.id&&i.status==='assigned'));
 for(const m of members)sel.add(new Option(m.full_name+' · '+(state.inventory.find(i=>i.member_id===m.id)?.reference||'Tarjeta'),m.id));
 if([...sel.options].some(x=>x.value===previous))sel.value=previous;
 if(!members.length)sel.add(new Option('No hay tarjetas asignadas',''));
 sel.disabled=!members.length;
}
function renderNoticeTarget(){
 const one=$('noticeTarget').value==='one';
 $('noticeMemberField').hidden=!one;
 $('noticeMember').required=one;
 renderNoticeMembers();
}
function renderNotices(){
 const prog=$('noticeProgram'),previous=prog.value;prog.replaceChildren();
 for(const p of state.programs.filter(p=>p.is_active))prog.add(new Option(p.title,p.id));
 if([...prog.options].some(x=>x.value===previous))prog.value=previous;
 if(!prog.options.length)prog.add(new Option('Sin programas activos',''));
 prog.disabled=!state.programs.some(p=>p.is_active);
 $('noticeSave').disabled=prog.disabled;
 renderNoticeTarget();
 const list=$('noticeRows');list.replaceChildren();
 if(!state.notices.length)list.append($node('p','Todavía no hay avisos publicados en las tarjetas.','empty'));
 const typeNames={promotion:'Promoción',gift:'Regalía',info:'Información'};
 for(const notice of state.notices){
  const owner=state.programs.find(p=>p.id===notice.program_id)?.title||'Programa';
  const target=notice.member_id?state.members.find(m=>m.id===notice.member_id)?.full_name||'Tarjeta específica':'Todos los clientes';
  const row=entry(notice.title,(typeNames[notice.notice_type]||'Aviso')+' · '+owner+' · '+target+' · '+notice.message,notice.is_active?'Visible':'Pausado',notice.is_active);
  if(['owner','manager'].includes(state.role)){
   const b=$node('button',notice.is_active?'Pausar':'Activar','btn');b.type='button';
   b.onclick=async()=>{
    const confirmed=await confirmBTS({title:notice.is_active?'Pausar aviso':'Volver a publicar aviso',
     message:'Este cambio afecta el mensaje que verá el cliente cuando escanee su tarjeta NFC.',
     details:[{label:'Aviso',value:notice.title},{label:'Estado nuevo',value:notice.is_active?'Pausado':'Activo'}],
     confirmText:notice.is_active?'Pausar aviso':'Activar aviso'});
    if(!confirmed)return;
    b.disabled=true;
    try{await api('bts_nfc_card_notices?id=eq.'+encodeURIComponent(notice.id)+'&business_id=eq.'+encodeURIComponent(state.business.id),'PATCH',{is_active:!notice.is_active});
      await loadBusiness();success('Aviso actualizado','El mensaje de la tarjeta NFC ya tiene su nuevo estado.')}
    catch(e){msg(e.message,true)}finally{b.disabled=false}
   };row.append(b);
  }
  list.append(row);
 }
}
async function submitNotice(e){
 e.preventDefault();
 if(!['owner','manager'].includes(state.role))return msg('No tenés permiso para publicar avisos.',true);
 const programId=$('noticeProgram').value,program=state.programs.find(p=>p.id===programId&&p.is_active);
 if(!program)return msg('Seleccioná un programa activo.',true);
 const personal=$('noticeTarget').value==='one',memberId=personal?$('noticeMember').value:null;
 if(personal&&!state.members.some(m=>m.id===memberId&&m.program_id===programId&&state.inventory.some(i=>i.member_id===m.id&&i.status==='assigned')))
  return msg('Seleccioná un cliente que ya tenga tarjeta asignada.',true);
 const starts=$('noticeStarts').value||null,ends=$('noticeEnds').value||null;
 if(starts&&ends&&ends<starts)return msg('La fecha final no puede ser anterior a la inicial.',true);
 const title=$('noticeTitle').value.trim(),message=$('noticeMessage').value.trim(),type=$('noticeType').value;
 if(title.length<2||title.length>90||message.length<3||message.length>300)return msg('Revisá el título y el mensaje del aviso.',true);
 const ok=await confirmBTS({title:'Publicar mensaje en tarjetas NFC',
   message:'El mensaje aparecerá en la página digital cuando el cliente escanee su tarjeta. No se enviarán SMS ni notificaciones push.',
   details:[{label:'Programa',value:program.title},{label:'Destinatarios',value:personal?'Una tarjeta':'Todos los clientes del programa'},{label:'Título',value:title}],
   confirmText:'Publicar aviso',type:'info'});
 if(!ok)return;
 const button=$('noticeSave');button.disabled=true;
 try{
  await api('bts_nfc_card_notices','POST',{
   business_id:state.business.id,program_id:programId,member_id:memberId,
   notice_type:type,title,message,starts_on:starts,ends_on:ends,is_active:true
  });
  $('noticesForm').reset();$('noticeTitle').dataset.edited='';$('noticeMessage').dataset.edited='';
  await loadBusiness();noticeDefaults();success('Aviso publicado','Se mostrará al escanear las tarjetas válidas del programa.');
 }catch(err){msg(err.message,true)}finally{button.disabled=false}
}
function renderLoyalty(){
 const selector=$('loyaltyProgram'),old=selector.value;
 selector.replaceChildren();const programs=state.programs.filter(p=>p.kind==='loyalty'&&p.is_active);
 for(const p of programs)selector.add(new Option(p.title,p.id));
 if(programs.some(p=>p.id===old))selector.value=old;
 selector.disabled=!programs.length;
 if(!programs.length)selector.add(new Option('No hay programas de fidelización',''));
 renderLoyaltyMembers();
 const allowed=['owner','manager','staff'].includes(state.role);
 $('loyaltyForm').classList.toggle('hidden',!allowed);
 const host=$('loyaltyRows');host.replaceChildren();
 const recent=state.movements.filter(m=>programs.some(p=>p.id===m.program_id)).slice(0,30);
 if(!recent.length)host.append($node('p','Todavía no hay operaciones de fidelización.','empty'));
 for(const m of recent){
   const member=state.members.find(x=>x.id===m.member_id);
   host.append(entry((m.action==='redeem'?'Premio canjeado':'Compra acreditada')+' · '+(member?.full_name||'Cliente'),
     new Date(m.created_at).toLocaleString('es-NI'),'Registrado',true));
 }
}
function renderLoyaltyMembers(){
 const id=$('loyaltyProgram').value,selector=$('loyaltyMember'),old=selector.value;
 const members=state.members.filter(m=>m.program_id===id&&m.is_active&&state.inventory.some(x=>x.member_id===m.id&&x.status==='assigned'));
 selector.replaceChildren();
 for(const m of members)selector.add(new Option(m.full_name+' · '+m.card_label+' ('+m.current_units+' puntos)',m.id));
 if(members.some(m=>m.id===old))selector.value=old;
 selector.disabled=!members.length;
 if(!members.length)selector.add(new Option('Sin tarjetas activas',''));
}
async function loyaltyEvent(action){
 if(!['owner','manager','staff'].includes(state.role))return msg('No tenés permisos para operar este programa.',true);
 const program=$('loyaltyProgram').value,memberId=$('loyaltyMember').value,receipt=$('loyaltyReceipt').value.trim().toUpperCase();
 const m=state.members.find(x=>x.id===memberId&&x.program_id===program);
 if(!m)return msg('Seleccioná una tarjeta válida del negocio.',true);
 if(action==='earn'&&(receipt.length<3||receipt.length>80))return msg('Ingresá una referencia de factura de 3 a 80 caracteres.',true);
 if(action==='redeem'){
  const p=state.programs.find(p=>p.id===program);
  if(!p||m.current_units<p.goal_units)return msg('La tarjeta todavía no alcanza el premio.',true);
 }
 const approved=await confirmBTS({
  title:action==='earn'?'Acreditar compra':'Canjear recompensa',
  message:action==='earn'?'Se registrará una compra válida y se actualizará el progreso del cliente.':'Se entregará el premio y el contador de compras volverá a cero; el historial permanecerá registrado.',
  details:[{label:'Cliente',value:m.full_name},{label:'Programa',value:state.programs.find(p=>p.id===program)?.title||'Fidelización'},
   {label:'Operación',value:action==='earn'?'Registrar compra':'Canjear premio'},
   ...(action==='earn'?[{label:'Referencia',value:receipt}]:[{label:'Compras acumuladas',value:String(m.current_units)}])],
  confirmText:action==='earn'?'Sí, acreditar compra':'Confirmar canje',type:action==='earn'?'info':'warning'
 });if(!approved)return;
 const button=$(action==='earn'?'loyaltyEarn':'loyaltyRedeem');button.disabled=true;
 try{
   const response=await api('rpc/bts_business_loyalty_event','POST',{p_member_id:memberId,p_action:action,p_receipt_ref:action==='earn'?receipt:''});
   if(!response?.length)throw Error('La operación no fue confirmada por el servidor.');
   const message=action==='earn'?'Compra acreditada · saldo '+response[0].new_balance:'Premio canjeado y saldo reiniciado';
   await loadBusiness();$('loyaltyReceipt').value='';$('loyaltyResult').textContent=message;msg(message);success(action==='earn'?'Compra acreditada':'Premio canjeado',message);
 }catch(e){$('loyaltyResult').textContent=e.message;msg(e.message,true)}finally{button.disabled=false}
}
function renderVIP(){
 const host=$('vipRows'),selector=$('vipProgram');host.replaceChildren();selector.replaceChildren();
 const vipPrograms=state.programs.filter(p=>p.kind==='vip'&&p.is_active);
 if(!vipPrograms.length){selector.add(new Option('No hay programas VIP',''));selector.disabled=true}
 else{selector.disabled=false;for(const p of vipPrograms)selector.add(new Option(p.title,p.id))}
 if(!state.checkins.length)host.append($node('p','No hay entradas registradas.','empty'));
 for(const c of state.checkins.slice(0,30)){
 const member=state.members.find(m=>m.id===c.member_id);
 host.append(entry(member?.full_name||'Miembro VIP',new Date(c.created_at).toLocaleString('es-NI'),'Registrado',true));
 }
}
function renderSupport(){
 const host=$('supportRows');host.replaceChildren();if(!state.tickets.length)host.append($node('p','No hay solicitudes de soporte.','empty'));
 for(const t of state.tickets)host.append(entry(t.subject,t.details.slice(0,160)+(t.bts_reply?' · BTS: '+t.bts_reply.slice(0,180):''),t.status,t.status==='resuelto'));
}
async function loadBusiness(){
 const id=state.business?.id;if(!id)return;msg('Cargando datos privados de '+state.business.business_name+'...');
 try{
  const programs=await api('bts_reward_programs?business_id=eq.'+encodeURIComponent(id)+'&select=id,kind,card_category,title,goal_units,unit_name,units_per_visit,reward_label,vip_benefits,vip_validity_months,is_active&order=created_at.desc&limit=100');
  state.programs=programs||[];
  const pids=programs.map(x=>x.id);
  const param=pids.length?'program_id=in.('+pids.map(encodeURIComponent).join(',')+')':'program_id=eq.00000000-0000-0000-0000-000000000000';
  const [members,movements,checkins,promos,tickets,inventory,notices]=await Promise.all([
   api('bts_reward_members?'+param+'&select=id,program_id,full_name,phone,card_label,current_units,vip_tier,expires_at,is_active&order=created_at.desc&limit=1000'),
   api('bts_reward_movements?'+param+'&select=id,member_id,program_id,action,created_at&order=created_at.desc&limit=1000'),
   api('bts_vip_checkins?'+param+'&select=id,member_id,program_id,created_at&order=created_at.desc&limit=1000'),
   api('bts_business_promotions?business_id=eq.'+encodeURIComponent(id)+'&select=id,title,description,starts_on,ends_on,is_active&order=created_at.desc&limit=200'),
   api('bts_business_support?business_id=eq.'+encodeURIComponent(id)+'&select=id,subject,details,priority,status,bts_reply,created_at&order=created_at.desc&limit=100'),
   api('bts_nfc_inventory?business_id=eq.'+encodeURIComponent(id)+'&select=id,member_id,program_id,reference,status,benefit_label,number&order=created_at.asc&limit=1000'),
   api('bts_nfc_card_notices?business_id=eq.'+encodeURIComponent(id)+'&select=id,program_id,member_id,notice_type,title,message,starts_on,ends_on,is_active,created_at&order=created_at.desc&limit=300')
  ]);
  state.members=members||[];state.movements=movements||[];state.checkins=checkins||[];state.promos=promos||[];state.tickets=tickets||[];state.inventory=inventory||[];state.notices=notices||[];
  render();msg('Datos actualizados desde BTS Studio.');
 }catch(err){msg('No se pudo cargar el negocio: '+err.message,true)}
}
async function submitPromo(e){
 e.preventDefault();
 if(!['owner','manager'].includes(state.role))return msg('No tenés permisos para crear promociones.',true);
 const f=e.currentTarget,b=$('savePromo'),data=Object.fromEntries(new FormData(f));
 if(data.starts_on&&data.ends_on&&data.ends_on<data.starts_on)return msg('El final no puede ser anterior al inicio.',true);
 const payload={business_id:state.business.id,title:data.title.trim(),description:data.description.trim(),starts_on:data.starts_on||null,ends_on:data.ends_on||null,created_by:state.session.user.id};
 b.disabled=true;try{await api('bts_business_promotions','POST',payload);f.reset();await loadBusiness();msg('Promoción creada correctamente.');success('Promoción creada','La nueva promoción ya está disponible para tu negocio.');}catch(err){msg(err.message,true)}finally{b.disabled=false}
}
async function submitSupport(e){
 e.preventDefault();const f=e.currentTarget,b=$('sendSupport'),data=Object.fromEntries(new FormData(f));
 b.disabled=true;try{
 await api('bts_business_support','POST',{business_id:state.business.id,created_by:state.session.user.id,subject:data.subject.trim(),details:data.details.trim(),priority:data.priority});
 f.reset();await loadBusiness();msg('Solicitud enviada a BTS Studio.');success('Solicitud enviada','El equipo de BTS recibió tu solicitud de soporte.');
 }catch(err){msg(err.message,true)}finally{b.disabled=false}
}
async function submitVIP(e){
 e.preventDefault();if(!['owner','manager','staff'].includes(state.role))return msg('No tenés permisos para registrar entradas.',true);
 const b=$('validateVip'),code=$('vipCode').value.trim().toLowerCase(),programId=$('vipProgram').value;
 if(!/^[a-f0-9]{20}$/.test(code))return msg('Ingresá un código NFC válido de 20 caracteres.',true);
 if(!state.programs.some(p=>p.id===programId&&p.kind==='vip'&&p.is_active))return msg('Seleccioná un programa VIP activo.',true);
 b.disabled=true;$('vipResult').textContent='Validando tarjeta...';
 try{
 const rows=await api('rpc/bts_business_vip_checkin','POST',{p_program_id:programId,p_card_code:code});
 const v=rows?.[0];if(!v)throw Error('No se recibió confirmación del servidor.');
 $('vipResult').textContent='Entrada autorizada: '+v.member_name+' · '+v.tier+' · vigente hasta '+date(v.expires_on);
 $('vipCode').value='';await loadBusiness();success('Acceso VIP validado','Ingreso autorizado para '+v.member_name+'.');
 }catch(err){$('vipResult').textContent='Acceso rechazado: '+err.message;msg(err.message,true)}
 finally{b.disabled=false}
}
function selectTab(tab){
 const valid=['programs','members','loyalty','promotions','notices','vip','support'];
 if(!valid.includes(tab))tab='programs';
 state.tab=tab;
 document.querySelectorAll('[data-tab]').forEach(n=>{
   const on=n.dataset.tab===tab;n.classList.toggle('active',on);
   n.setAttribute('aria-current',on?'page':'false');
 });
 for(const name of valid)$('tab-'+name).classList.toggle('hidden',name!==tab);
 const heading=document.querySelector('#tab-'+tab+' h2');
 if(heading)heading.setAttribute('tabindex','-1');
 try{history.replaceState(null,'','#'+tab)}catch(_){}
}
async function boot(){
 const prefillKey='bts-business-login-prefill-v1';
 try{const candidate=sessionStorage.getItem(prefillKey);if(candidate&&/^bts-[a-z0-9-]{5,}$/.test(candidate))$('loginForm').elements.namedItem('email').value=candidate;sessionStorage.removeItem(prefillKey)}catch(_){}
 $('loginForm').addEventListener('submit',login);$('logout').onclick=logout;
 $('reload').onclick=loadBusiness;$('businessSelect').onchange=e=>selectBusiness(e.target.value).catch(err=>msg(err.message,true));
 $('memberSearch').oninput=renderMembers;$('assignCardForm').addEventListener('submit',assignCard);$('assignSlot').onchange=renderAssignmentPreview;$('loyaltyProgram').onchange=renderLoyaltyMembers;$('loyaltyEarn').onclick=()=>loyaltyEvent('earn');$('loyaltyRedeem').onclick=()=>loyaltyEvent('redeem');
 $('tabs').onclick=e=>{const x=e.target.closest('[data-tab]');if(x)selectTab(x.dataset.tab)};
 document.querySelectorAll('[data-open-tab]').forEach(button=>button.addEventListener('click',()=>{selectTab(button.dataset.openTab);$('tabs').scrollIntoView({behavior:'smooth',block:'start'})}));
 selectTab(location.hash.slice(1));
 $('promoForm').addEventListener('submit',submitPromo);
 $('noticesForm').addEventListener('submit',submitNotice);
 $('noticeProgram').onchange=renderNoticeMembers;
 $('noticeTarget').onchange=renderNoticeTarget;
 $('noticeType').onchange=noticeDefaults;
 $('noticeTitle').oninput=()=>{$('noticeTitle').dataset.edited='1'};
 $('noticeMessage').oninput=()=>{$('noticeMessage').dataset.edited='1'};
 noticeDefaults();$('supportForm').addEventListener('submit',submitSupport);$('vipForm').addEventListener('submit',submitVIP);
 const s=getSaved();if(s){save(s);try{await verify()}catch(err){save(null);showLogin(err.message)}}else showLogin();
}
boot();
})();