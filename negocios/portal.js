/* BTS Studio: portal empresarial con autenticación independiente y datos aislados por RLS. */
(()=>{'use strict';
const BASE='https://xwehejgwufwhpkpzjzyt.supabase.co',KEY='sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz';
const STORE='bts-business-session-v1',$=id=>document.getElementById(id);
const state={session:null,assignments:[],business:null,role:'viewer',programs:[],members:[],movements:[],checkins:[],promos:[],tickets:[],tab:'programs'};
const nameRole={owner:'Propietario',manager:'Encargado',staff:'Personal',viewer:'Consulta'};
const $node=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=String(txt);if(cls)x.className=cls;return x};
const iso=()=>new Date().toISOString().slice(0,10),date=s=>s?new Date(s.slice(0,10)+'T12:00:00').toLocaleDateString('es-NI'):'Sin fecha';
function msg(t,bad=false){$('notice').textContent=t;$('notice').classList.toggle('bad',bad)}
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
 const businessRows=await api('bts_nfc_cards?id=in.('+ids.map(encodeURIComponent).join(',')+')&select=id,business_name,is_active');
 const active=businessRows.filter(x=>x.is_active&&records.some(r=>r.business_id===x.id));
 if(!active.length)throw Error('Las empresas asignadas están suspendidas.');
 state.assignments=records.filter(r=>active.some(b=>b.id===r.business_id)).map(r=>({...r,business:active.find(b=>b.id===r.business_id)}));
 $('businessSelect').replaceChildren();
 for(const a of state.assignments){const opt=new Option(a.business.business_name,a.business_id);$('businessSelect').add(opt)}
 await selectBusiness(state.assignments[0].business_id);
 showPortal();
}
async function login(e){e.preventDefault();const button=$('loginBtn');button.disabled=true;$('loginError').textContent='';
 try{
  const form=e.currentTarget,email=form.elements.namedItem('email').value.trim(),password=form.elements.namedItem('password').value;
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
 $('promoForm').classList.toggle('hidden',!canManage);
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
 for(const p of state.programs)programs.append(entry(p.title,(p.kind==='vip'?'VIP · '+p.vip_validity_months+' meses':p.goal_units+' '+p.unit_name+' para '+p.reward_label),p.is_active?'Activo':'Suspendido',p.is_active));
 renderMembers();renderPromos();renderVIP();renderSupport();
}
function renderMembers(){
 const host=$('memberRows'),q=$('memberSearch').value.trim().toLowerCase();host.replaceChildren();
 const rows=state.members.filter(m=>[m.full_name,m.card_label,m.phone].some(x=>String(x||'').toLowerCase().includes(q)));
 if(!rows.length)host.append($node('p','No hay tarjetas para mostrar.','empty'));
 for(const m of rows){
 const p=state.programs.find(x=>x.id===m.program_id);
 const note=(p?.kind==='vip'?'VIP '+m.vip_tier+' · Vence '+date(m.expires_at):m.current_units+' / '+(p?.goal_units||'—')+' '+(p?.unit_name||'puntos'));
 host.append(entry(m.full_name,m.card_label+' · '+note,m.is_active?'Activa':'Suspendida',m.is_active));
 }
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
    await loadBusiness();msg('Promoción actualizada.');
   }catch(e){msg(e.message,true)}finally{button.disabled=false}};
   row.append(button);
  }
  host.append(row);
 }
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
  const programs=await api('bts_reward_programs?business_id=eq.'+encodeURIComponent(id)+'&select=id,kind,title,goal_units,unit_name,reward_label,vip_validity_months,is_active&order=created_at.desc&limit=100');
  state.programs=programs||[];
  const pids=programs.map(x=>x.id);
  const param=pids.length?'program_id=in.('+pids.map(encodeURIComponent).join(',')+')':'program_id=eq.00000000-0000-0000-0000-000000000000';
  const [members,movements,checkins,promos,tickets]=await Promise.all([
   api('bts_reward_members?'+param+'&select=id,program_id,full_name,phone,card_label,current_units,vip_tier,expires_at,is_active&order=created_at.desc&limit=1000'),
   api('bts_reward_movements?'+param+'&select=id,member_id,program_id,action,created_at&order=created_at.desc&limit=1000'),
   api('bts_vip_checkins?'+param+'&select=id,member_id,program_id,created_at&order=created_at.desc&limit=1000'),
   api('bts_business_promotions?business_id=eq.'+encodeURIComponent(id)+'&select=id,title,description,starts_on,ends_on,is_active&order=created_at.desc&limit=200'),
   api('bts_business_support?business_id=eq.'+encodeURIComponent(id)+'&select=id,subject,details,priority,status,bts_reply,created_at&order=created_at.desc&limit=100')
  ]);
  state.members=members||[];state.movements=movements||[];state.checkins=checkins||[];state.promos=promos||[];state.tickets=tickets||[];
  render();msg('Datos actualizados desde BTS Studio.');
 }catch(err){msg('No se pudo cargar el negocio: '+err.message,true)}
}
async function submitPromo(e){
 e.preventDefault();
 if(!['owner','manager'].includes(state.role))return msg('No tenés permisos para crear promociones.',true);
 const f=e.currentTarget,b=$('savePromo'),data=Object.fromEntries(new FormData(f));
 if(data.starts_on&&data.ends_on&&data.ends_on<data.starts_on)return msg('El final no puede ser anterior al inicio.',true);
 const payload={business_id:state.business.id,title:data.title.trim(),description:data.description.trim(),starts_on:data.starts_on||null,ends_on:data.ends_on||null,created_by:state.session.user.id};
 b.disabled=true;try{await api('bts_business_promotions','POST',payload);f.reset();await loadBusiness();msg('Promoción creada correctamente.')}catch(err){msg(err.message,true)}finally{b.disabled=false}
}
async function submitSupport(e){
 e.preventDefault();const f=e.currentTarget,b=$('sendSupport'),data=Object.fromEntries(new FormData(f));
 b.disabled=true;try{
 await api('bts_business_support','POST',{business_id:state.business.id,created_by:state.session.user.id,subject:data.subject.trim(),details:data.details.trim(),priority:data.priority});
 f.reset();await loadBusiness();msg('Solicitud enviada a BTS Studio.');
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
 $('vipCode').value='';await loadBusiness();
 }catch(err){$('vipResult').textContent='Acceso rechazado: '+err.message;msg(err.message,true)}
 finally{b.disabled=false}
}
function selectTab(tab){
 state.tab=tab;
 document.querySelectorAll('[data-tab]').forEach(n=>n.classList.toggle('active',n.dataset.tab===tab));
 for(const name of ['programs','members','promotions','vip','support'])$('tab-'+name).classList.toggle('hidden',name!==tab);
}
async function boot(){
 $('loginForm').addEventListener('submit',login);$('logout').onclick=logout;
 $('reload').onclick=loadBusiness;$('businessSelect').onchange=e=>selectBusiness(e.target.value).catch(err=>msg(err.message,true));
 $('memberSearch').oninput=renderMembers;
 $('tabs').onclick=e=>{const x=e.target.closest('[data-tab]');if(x)selectTab(x.dataset.tab)};
 $('promoForm').addEventListener('submit',submitPromo);$('supportForm').addEventListener('submit',submitSupport);$('vipForm').addEventListener('submit',submitVIP);
 const s=getSaved();if(s){save(s);try{await verify()}catch(err){save(null);showLogin(err.message)}}else showLogin();
}
boot();
})();