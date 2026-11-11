(()=>{'use strict';
const BASE='https://xwehejgwufwhpkpzjzyt.supabase.co',KEY='sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz',SESSION='bts-admin-sb-session-v1',KIND=new URLSearchParams(location.search).get('kind')==='vip'?'vip':'loyalty';
const $=id=>document.getElementById(id);let businesses=[],business=null,program=null,members=[],movements=[],memberAudit=[],vipCheckins=[],chosen=null,editing=null;
function notice(m,bad=false){$('notice').textContent=m;$('notice').classList.toggle('error',bad)}
function session(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch{return null}}
async function refresh(s){const r=await fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});const d=await r.json();if(!r.ok||!d.access_token)throw Error('Sesión vencida. Iniciá sesión desde el Dashboard.');const v={...s,...d,expires_at:d.expires_at||Math.floor(Date.now()/1000)+(d.expires_in||3600)};sessionStorage.setItem(SESSION,JSON.stringify(v));return v}
async function api(path,opt={},retry=true){let s=session();if(!s?.access_token||!s?.refresh_token)throw Error('Iniciá sesión en BTS Studio.');if((s.expires_at||0)*1000<Date.now()+60000)s=await refresh(s);const r=await fetch(BASE+path,{...opt,cache:'no-store',headers:{apikey:KEY,Authorization:'Bearer '+s.access_token,Accept:'application/json',...(opt.headers||{})}});if(r.status===401&&retry){await refresh(s);return api(path,opt,false)}if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.message||d.error||'Error '+r.status)}if(r.status===204)return null;const t=await r.text();return t?JSON.parse(t):null}
function opt(body,method='POST',prefer='return=minimal'){return {method,headers:{'Content-Type':'application/json',Prefer:prefer},body:JSON.stringify(body)}}
const node=(tag,txt,cls)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
function btn(name,handler,cls=''){const b=node('button',name,'button '+cls);b.type='button';b.onclick=handler;return b}
const cardUrl=m=>location.origin+'/nfc/tarjeta/?card='+m.card_code;
const today=()=>new Date().toISOString().slice(0,10);
const fmt=n=>Number(n||0).toLocaleString('es-NI');
const day=d=>d?new Date(d+'T12:00:00').toLocaleDateString('es-NI'):'Sin vencimiento';
async function copy(v){try{await navigator.clipboard.writeText(v);notice('URL NFC copiada.')}catch{window.prompt('Copiá este enlace NFC:',v)}}
function addMonths(n,start){const d=start?new Date(start+'T12:00:00'):new Date();const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);d.setDate(Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function resetProgram(){ $('programForm').reset();$('programTitle').value=KIND==='vip'?'Club VIP · Beneficios exclusivos':'Club de fidelización';$('goalUnits').value=6;$('rewardLabel').value='Producto gratis';$('unitsPerVisit').value=1;$('vipTier').value='Gold';$('vipMonths').value=12;$('vipBenefits').value='Descuentos, promociones y atención preferencial';$('programActive').checked=true}
function showProgram(){resetProgram();if(program){for(const [field,key] of [['programTitle','title'],['description','description'],['unitName','unit_name'],['goalUnits','goal_units'],['unitsPerVisit','units_per_visit'],['rewardLabel','reward_label'],['vipTier','vip_default_tier'],['vipMonths','vip_validity_months'],['vipBenefits','vip_benefits'],['theme','card_theme'],['accent','accent_color']])$(field).value=program[key];$('programActive').checked=program.is_active}$('programState').textContent=program?(program.is_active?'Activo':'Suspendido'):'Sin configurar';$('saveProgram').textContent=program?'Guardar cambios':'Crear programa';$('newMember').disabled=true;$('saveMember').disabled=!editing;$('addUnit').textContent=program?.unit_name==='puntos'?'+ Acreditar puntos':'+ Acreditar compra / visita';drawCard()}
function resetMember(){editing=null;$('memberForm').reset();$('memberActive').checked=true;$('memberLabel').value='Tarjeta '+String(members.length+1).padStart(3,'0');$('memberTier').value=program?.vip_default_tier||'Gold';$('memberHeading').textContent='Emitir tarjeta';$('saveMember').textContent='Guardar tarjeta'}
function selectMember(m){chosen=m;if(KIND==='vip'&&m)$('vipCode').value=m.card_code||'';$('controlBody').hidden=!m;$('controlEmpty').hidden=!!m;$('controlHint').textContent=m?m.full_name+' · '+m.card_label:'Seleccioná una tarjeta emitida para administrarla.';if(m){$('cardUrl').value=cardUrl(m);$('openNfc').href=cardUrl(m)}control();drawCard()}
function drawCard(){const p=program,c=chosen,b=business;const title=b?.business_name||'TU NEGOCIO',goal=Number($('goalUnits').value)||6,theme=$('theme').value,accent=$('accent').value;
for(const id of ['cardFront','cardBack']){$(id).dataset.theme=theme;$(id).style.setProperty('--card-accent',accent)}
$('cardBrand').textContent=title;$('backBrand').textContent=title;$('cardName').textContent=(c?.full_name||'NOMBRE DEL CLIENTE').toUpperCase();$('cardType').textContent=KIND==='vip'?'MEMBRESÍA VIP':'TARJETA DE FIDELIZACIÓN';
$('cardDetail').textContent=KIND==='vip'?String($('vipBenefits').value||'Beneficios exclusivos').slice(0,65):goal+' '+$('unitName').value+' · '+$('rewardLabel').value;
$('cardNumber').textContent=c?.card_label||'BTS · TARJETA NFC';$('cardLevel').textContent=KIND==='vip'?(c?.vip_tier||p?.vip_default_tier||'Gold'):'REWARDS';
$('backHeadline').textContent=KIND==='vip'?'Tu acceso VIP':$('rewardLabel').value;
$('backInstruction').textContent=KIND==='vip'?'Acercá el NFC para consultar beneficios y vigencia.':'Acercá tu NFC para consultar tu avance y canjear premios.';
$('backCode').textContent=c?'NFC '+c.card_code.toUpperCase():'EJEMPLO · SIN EMITIR';$('stampTrack').replaceChildren();
if(KIND==='loyalty'){let slots=Math.min(goal,12);for(let i=0;i<slots;i++)$('stampTrack').append(node('span','', 'stamp'+(i<Math.floor((c?.current_units||0)/goal*slots)?' done':'')))}
}
function control(){const m=chosen,p=program;if(!m||!p)return;let vip=KIND==='vip';$('balanceText').textContent=vip?m.vip_tier+' · '+day(m.expires_at):m.current_units+' / '+p.goal_units;$('balanceText').style.fontSize=vip?'18px':'26px';$('balanceCaption').textContent=vip?'Nivel y vencimiento':'Progreso';$('balanceNote').textContent=vip?(m.is_active?'Membresía activa':'Membresía suspendida'):'Histórico '+m.lifetime_units+' · Canjes '+m.redeemed_count;$('progressFill').style.width=(vip?(m.is_active?100:0):Math.min(100,m.current_units/p.goal_units*100))+'%';$('loyaltyActions').hidden=vip;$('vipActions').hidden=!vip;$('vipState').hidden=!vip;$('addUnit').disabled=!(m.is_active&&p.is_active);$('redeem').disabled=!(m.is_active&&p.is_active&&m.current_units>=p.goal_units)}
function kpis(){$('totalMembers').textContent=members.length;$('activeMembers').textContent=members.filter(x=>x.is_active).length;
$('totalEarned').textContent=KIND==='vip'?members.filter(x=>x.expires_at&&x.expires_at>=today()).length:fmt(members.reduce((n,x)=>n+x.lifetime_units,0));
$('totalRedeemed').textContent=KIND==='vip'?members.filter(x=>x.expires_at&&x.expires_at<today()).length:fmt(members.reduce((n,x)=>n+x.redeemed_count,0))}
function listMembers(){const host=$('members');host.replaceChildren();const q=$('searchMember').value.toLowerCase();const list=members.filter(x=>[x.full_name,x.phone,x.card_label].some(v=>String(v||'').toLowerCase().includes(q)));if(!list.length){host.append(node('p',q?'No hay coincidencias.':'No hay tarjetas emitidas.','empty'));return}
for(const m of list){const row=node('div',undefined,'member-row'),icon=node('div',m.full_name[0].toUpperCase(),'member-icon'),info=node('div'),buttons=node('div',undefined,'member-actions');info.append(node('strong',m.full_name),node('small',m.card_label+' · '+(m.is_active?'Activa':'Suspendida')),node('small',KIND==='vip'?'Nivel '+m.vip_tier+' · '+day(m.expires_at):m.current_units+'/'+(program?.goal_units||6)+' '+(program?.unit_name||'compras')));
buttons.append(btn('Control',()=>selectMember(m),'primary'),btn('Editar',()=>editMember(m)),btn('Copiar NFC',()=>copy(cardUrl(m))));row.append(icon,info,buttons);host.append(row)}}
function listMovements(){const host=$('movements');host.replaceChildren();
 if(KIND==='vip'){
  if(!memberAudit.length){host.append(node('p','Todavía no hay altas ni renovaciones.','empty'));return}
  for(const x of memberAudit.slice(0,50)){
   const holder=node('div',undefined,'ledger-row');
   const name=x.new_data?.full_name||x.old_data?.full_name||'Cliente VIP';
   const type=x.operation==='INSERT'?'Membresía emitida':x.operation==='DELETE'?'Membresía anulada':
    x.old_data?.expires_at!==x.new_data?.expires_at?'Vigencia modificada / renovada':'Ficha VIP actualizada';
   holder.append(node('strong',type+' · '+name),
     node('small',new Date(x.occurred_at).toLocaleString('es-NI')+
       (x.new_data?.expires_at?' · vence '+day(x.new_data.expires_at):'')));
   host.append(holder);
  }
  return;
 }
 if(!movements.length){host.append(node('p','Sin movimientos aún.','empty'));return}for(const x of movements.slice(0,50)){const e=node('div',undefined,'ledger-row'),m=members.find(y=>y.id===x.member_id);e.append(node('strong',({earn:'Acumulación',redeem:'Premio entregado',adjust:'Ajuste'})[x.action]+' · '+(m?.full_name||'Cliente')),node('small',(x.delta>0?'+':'')+x.delta+' · Saldo: '+x.balance_after+' · '+new Date(x.created_at).toLocaleString('es-NI')));host.append(e)}}
async function load(){vipCheckins=[];business=businesses.find(x=>x.id===$('business').value)||null;program=null;members=[];movements=[];memberAudit=[];chosen=null;editing=null;resetMember();selectMember(null);listMembers();listMovements();kpis();showProgram();if(!business)return notice('Elegí un negocio para comenzar.');notice('Cargando '+business.business_name+'…');try{const r=await api('/rest/v1/bts_reward_programs?business_id=eq.'+encodeURIComponent(business.id)+'&kind=eq.'+KIND+'&select=*&limit=1');program=r?.[0]||null;if(program){const id=encodeURIComponent(program.id);const [m,h,a]=await Promise.all([api('/rest/v1/rpc/bts_admin_member_list',opt({p_program_id:program.id},'POST','return=representation')),api('/rest/v1/bts_reward_movements?program_id=eq.'+id+'&select=*&order=created_at.desc&limit=1000'),api('/rest/v1/bts_reward_member_audit?program_id=eq.'+id+'&select=operation,old_data,new_data,occurred_at&order=occurred_at.desc&limit=1000')]);members=m||[];movements=h||[];memberAudit=a||[];if(KIND==='vip'){vipCheckins=await api('/rest/v1/bts_vip_checkins?program_id=eq.'+id+'&select=id,member_id,created_at,checked_by&order=created_at.desc&limit=50')||[];}}resetMember();showProgram();renderVipHistory();listMembers();listMovements();kpis();selectMember(null);notice(program?'Programa conectado · '+members.length+' tarjetas.':'Este negocio aún no tiene un programa. Configuralo y guardalo.')}catch(e){notice(e.message,true)}}
async function saveProgram(e){e.preventDefault();if(!business)return notice('Seleccioná un negocio.',true);const data={business_id:business.id,kind:KIND,title:$('programTitle').value.trim(),description:$('description').value.trim(),goal_units:Number($('goalUnits').value),unit_name:$('unitName').value,units_per_visit:Number($('unitsPerVisit').value),reward_label:$('rewardLabel').value.trim()||'Premio de fidelización',vip_default_tier:$('vipTier').value.trim()||'Gold',vip_benefits:$('vipBenefits').value.trim()||'Beneficios exclusivos',vip_validity_months:Number($('vipMonths').value),card_theme:$('theme').value,accent_color:$('accent').value,is_active:$('programActive').checked};const b=$('saveProgram');b.disabled=true;try{await api(program?'/rest/v1/bts_reward_programs?id=eq.'+program.id:'/rest/v1/bts_reward_programs',opt(data,program?'PATCH':'POST'));await load();notice('Programa guardado en Supabase.')}catch(err){notice(err.message,true)}finally{b.disabled=false}}
function editMember(m){editing=m;for(const [id,key] of [['memberName','full_name'],['memberPhone','phone'],['memberEmail','email'],['memberLabel','card_label'],['memberNotes','notes'],['memberTier','vip_tier']])$(id).value=m[key]||'';$('memberActive').checked=m.is_active;$('memberHeading').textContent='Editar tarjeta · '+m.card_label;$('saveMember').textContent='Guardar cambios';$('memberForm').scrollIntoView({behavior:'smooth',block:'start'})}
async function saveMember(e){
 e.preventDefault();if(!editing)return notice('Primero generá tarjetas en lotes desde BTS > Accesos empresariales. Ya no se pueden emitir tarjetas sueltas aquí.',true);
 const data={full_name:$('memberName').value.trim(),phone:$('memberPhone').value.trim(),email:$('memberEmail').value.trim(),card_label:$('memberLabel').value.trim()||'Tarjeta NFC',notes:$('memberNotes').value.trim(),vip_tier:$('memberTier').value.trim()||program.vip_default_tier};
 const button=$('saveMember');button.disabled=true;
 try{await api('/rest/v1/bts_reward_members?id=eq.'+editing.id,opt(data,'PATCH','return=minimal'));await load();notice('Cambios administrativos guardados.')}
 catch(err){notice(err.message,true)}finally{button.disabled=false}
}
async function action(act){const m=chosen;if(!m||!program)return;const units=act==='earn'?(program.unit_name==='puntos'?program.units_per_visit:1):1;const receiptRef=act==='earn'?$('purchaseRef').value.trim().toUpperCase():'';if(act==='earn'&&(receiptRef.length<3||receiptRef.length>80))return notice('Ingresá una referencia única de compra válida (3 a 80 caracteres).',true);if(!confirm(act==='redeem'?'¿Entregar el premio y reiniciar el contador de '+m.full_name+'?':'¿Confirmás la compra '+receiptRef+' y acreditar '+units+' '+program.unit_name+' a '+m.full_name+'?'))return;const button=$(act==='earn'?'addUnit':'redeem');button.disabled=true;try{if(act==='earn')await api('/rest/v1/rpc/bts_reward_record_purchase',opt({p_member_id:m.id,p_receipt_ref:receiptRef,p_units:units}));else await api('/rest/v1/rpc/bts_reward_apply_event',opt({p_member_id:m.id,p_action:'redeem',p_units:1}));await load();selectMember(members.find(x=>x.id===m.id)||null);if(act==='earn')$('purchaseRef').value='';notice(act==='redeem'?'Premio registrado y contador reiniciado.':'Compra '+receiptRef+' acreditada sin duplicados.')}catch(e){notice(e.message,true)}finally{button.disabled=false}}
function renderVipHistory(){
 if(KIND!=='vip')return;
 const host=$('vipHistory');host.replaceChildren();
 if(!vipCheckins.length){host.append(node('p','Todavía no hay ingresos registrados.','subtle'));return;}
 for(const check of vipCheckins.slice(0,20)){
  const m=members.find(x=>x.id===check.member_id);
  const item=node('div',undefined,'ledger-row');
  item.append(node('strong',m?.full_name||'Miembro VIP'),node('small','Ingreso validado · '+new Date(check.created_at).toLocaleString('es-NI')));
  host.append(item);
 }
}
async function vipCheckin(){
 if(KIND!=='vip'||!program)return notice('Seleccioná un programa VIP.',true);
 const code=$('vipCode').value.trim().toLowerCase();
 if(!/^[a-f0-9]{20}$/.test(code))return notice('Ingresá el código NFC de 20 caracteres.',true);
 const button=$('vipCheckin');button.disabled=true;$('vipResult').textContent='Verificando...';
 try{
  const rows=await api('/rest/v1/rpc/bts_vip_checkin',opt({p_program_id:program.id,p_card_code:code,p_note:''},'POST','return=representation'));
  const item=rows?.[0];
  if(!item)throw Error('No recibimos confirmación del acceso.');
  const msg='Ingreso autorizado: '+item.member_name+' · '+item.tier+' · vence '+day(item.expires_on);
  $('vipResult').textContent=msg;notice(msg);
  vipCheckins=await api('/rest/v1/bts_vip_checkins?program_id=eq.'+encodeURIComponent(program.id)+'&select=id,member_id,created_at,checked_by&order=created_at.desc&limit=50')||[];
  renderVipHistory();
 }catch(err){$('vipResult').textContent=err.message;notice('Ingreso rechazado: '+err.message,true)}
 finally{button.disabled=false}
}
async function renewVip(){
 if(KIND!=='vip'||!chosen||!program)return;
 const member=chosen;
 if(!member.is_active||!program.is_active)return notice('Activá primero la tarjeta y el programa.',true);
 const months=Number(program.vip_validity_months)||12;
 const starting=member.expires_at&&member.expires_at>today()?member.expires_at:today();
 const until=addMonths(months,starting);
 if(!confirm('¿Renovar '+member.full_name+' por '+months+' meses, hasta '+day(until)+'?'))return;
 $('renewVip').disabled=true;
 try{
  await api('/rest/v1/bts_reward_members?id=eq.'+encodeURIComponent(member.id),opt({expires_at:until},'PATCH'));
  await load();selectMember(members.find(x=>x.id===member.id)||null);
  notice('Membresía VIP renovada hasta '+day(until)+'.');
 }catch(e){notice('No se pudo renovar: '+e.message,true)}finally{$('renewVip').disabled=false}
}
function printCard(){
 const win=window.open('','_blank','width=800,height=750');if(!win)return notice('Permití las ventanas emergentes para imprimir.',true);
 const card1=$('cardFront').cloneNode(true),card2=$('cardBack').cloneNode(true);
 const css='@page{size:85.6mm 53.98mm;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.physical-card{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;width:85.6mm;height:53.98mm;padding:4mm 5mm;color:white;background:linear-gradient(130deg,#151923,#2b2d39);break-after:page;page-break-after:always;--card-accent:#b03b60}.physical-card:last-child{break-after:auto;page-break-after:auto}.physical-card[data-theme=wine]{background:linear-gradient(130deg,#220e1c,#5e1936)}.physical-card[data-theme=champagne]{background:linear-gradient(130deg,#191a20,#494133)}.physical-card[data-theme=forest]{background:linear-gradient(130deg,#10241e,#315547)}.physical-card[data-theme=ivory]{background:linear-gradient(130deg,#f6f3eb,#e9e4d7);color:#25252a}.physical-top,.physical-bottom{display:flex;justify-content:space-between;font-size:7pt}.physical-top b{font-size:10pt}.physical-center{display:grid;gap:3px}.physical-center strong{font-size:17pt}.physical-center small,.physical-center span{font-size:8pt}.back-center strong{font-size:13pt}.back-center p{font-size:9pt}.stamp-track{display:flex;gap:3px}.stamp{width:4mm;height:4mm;border:1px solid currentColor;border-radius:50%;opacity:.35}.stamp.done{background:var(--card-accent);opacity:1}';
 const markup='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tarjeta NFC CR80</title><style>'+css+'</style></head><body>'+card1.outerHTML+card2.outerHTML+'</body></html>';
 win.document.open();win.document.write(markup);win.document.close();win.focus();win.print();
}
async function init(){
 const vip=KIND==='vip';$('eyebrow').textContent='BTS STUDIO / '+(vip?'TARJETAS VIP':'FIDELIZACIÓN');$('title').textContent=vip?'Tarjetas VIP.':'Tarjetas de fidelización.';$('subtitle').textContent=vip?'Membresías exclusivas por nivel, beneficios y vigencia.':'Controlá compras, puntos, premios y canjes por negocio.';$('vipFields').hidden=!vip;$('loyaltyFields').hidden=vip;$('tierField').hidden=!vip;$('loyaltyActions').hidden=vip;$('vipState').hidden=!vip;$('unitKpi').textContent=vip?'Membresías vigentes':'Unidades acreditadas';$('redeemedTitle').textContent=vip?'Membresías vencidas':'Premios entregados';$('redeemedDesc').textContent=vip?'Según vencimiento':'Canjes registrados';$('newMember').disabled=true;$('saveMember').disabled=true;resetProgram();drawCard();
 try{const s=session();if(!s?.user?.id)throw Error('Iniciá sesión desde el dashboard.');const allowed=await api('/rest/v1/bts_admins?user_id=eq.'+s.user.id+'&select=user_id&limit=1');if(!allowed?.length)throw Error('No tenés permisos para este módulo.');businesses=await api('/rest/v1/bts_nfc_cards?select=id,business_name,slug,is_active&order=business_name.asc&limit=500')||[];for(const b of businesses){const o=node('option',b.business_name);o.value=b.id;$('business').append(o)}if(businesses.length){$('business').value=businesses[0].id;await load()}else notice('Primero creá un negocio en NFC normal o corporativo.')}catch(e){notice(e.message,true)}
}
$('business').addEventListener('change',load);$('programForm').addEventListener('submit',saveProgram);$('memberForm').addEventListener('submit',saveMember);$('newMember').addEventListener('click',()=>{resetMember();$('memberName').focus()});$('resetMember').addEventListener('click',resetMember);$('searchMember').addEventListener('input',listMembers);$('addUnit').addEventListener('click',()=>action('earn'));$('redeem').addEventListener('click',()=>action('redeem'));$('renewVip').addEventListener('click',renewVip);$('vipCheckin').addEventListener('click',vipCheckin);$('copyNfc').addEventListener('click',()=>chosen&&copy(cardUrl(chosen)));$('copyCardUrl').addEventListener('click',()=>chosen?copy(cardUrl(chosen)):notice('Emití y seleccioná primero una tarjeta.',true));$('printCard').addEventListener('click',printCard);
for(const id of ['theme','accent','programTitle','vipBenefits','goalUnits','unitName','unitsPerVisit','rewardLabel','vipTier'])$(id).addEventListener('input',drawCard);
init();
})();