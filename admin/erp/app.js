/* BTS ERP: interfaz privada; datos reales, sin indicadores ficticios. */
(() => {
'use strict';
const BASE='https://xwehejgwufwhpkpzjzyt.supabase.co';
const KEY='sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz';
const SESSION='bts-admin-sb-session-v1';
const $=id=>document.getElementById(id);
const names={clients:'Clientes',services:'Servicios',transactions:'Finanzas',cards:'Inventario NFC',tickets:'Soporte',audit:'Historial'};
const tableNames={clients:'bts_erp_clients',services:'bts_erp_services',transactions:'bts_erp_transactions',cards:'bts_erp_cards',tickets:'bts_erp_tickets',audit:'bts_erp_audit'};
const fields={
  clients:[
   ['business_name','Nombre del negocio','text',true],['contact_name','Persona de contacto','text'],['email','Correo','email'],['phone','Teléfono','tel'],
   ['client_type','Tipo de cliente','select',true,['empresa','individuo','institucion']],
   ['status','Estado','select',true,['prospecto','activo','pausado','archivado']],['notes','Notas internas','textarea']],
  services:[
   ['client_id','Cliente','client',true],['service_type','Tipo de servicio','select',true,['nfc','corporativo','vip','fidelizacion','educativo','web','video','diseno','otro']],
   ['name','Nombre del servicio','text',true],['status','Estado','select',true,['preparacion','activo','pausado','finalizado']],
   ['billing_cycle','Facturación','select',true,['ninguno','mensual','anual']],['currency','Moneda','select',true,['USD','NIO']],
   ['setup_fee','Configuración','number'],['recurring_fee','Cuota recurrente','number'],['next_renewal','Próxima renovación','date'],['notes','Notas','textarea']],
  transactions:[
   ['client_id','Cliente','client',true],['service_id','Servicio (opcional)','service'],['entry_type','Tipo','select',true,['ingreso','gasto']],
   ['concept','Concepto','text',true],['amount','Importe','number',true],['currency','Moneda','select',true,['USD','NIO']],
   ['status','Estado','select',true,['pendiente','pagado','cancelado']],['due_on','Vencimiento','date'],['paid_on','Fecha de pago','date']],
  cards:[
   ['serial','Código físico / serial','text',true],['client_id','Cliente (opcional)','client'],['service_id','Servicio (opcional)','service'],
   ['status','Estado','select',true,['inventario','asignada','suspendida','danada']],['linked_url','Enlace de tarjeta (opcional)','url'],['notes','Notas','textarea']],
  tickets:[
   ['client_id','Cliente','client',true],['service_id','Servicio (opcional)','service'],['subject','Asunto','text',true],
   ['priority','Prioridad','select',true,['baja','normal','alta','critica']],['status','Estado','select',true,['abierto','en_proceso','resuelto','cerrado']],['details','Descripción','textarea']]
};
const filters={clients:['prospecto','activo','pausado','archivado'],services:['preparacion','activo','pausado','finalizado'],transactions:['pendiente','pagado','cancelado'],cards:['inventario','asignada','suspendida','danada'],tickets:['abierto','en_proceso','resuelto','cerrado'],audit:['INSERT','UPDATE','DELETE']};
const state={section:'clients',editing:null,rows:{},loading:false};
let user=null;
function note(t,bad=false){$('notice').textContent=t;$('notice').classList.toggle('bad',bad)}
function session(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch{return null}}
async function refreshAuth(s){const r=await fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});if(!r.ok)throw Error('La sesión expiró. Volvé a iniciar sesión.');const v=await r.json();const next={...s,...v,expires_at:Math.floor(Date.now()/1000)+v.expires_in};sessionStorage.setItem(SESSION,JSON.stringify(next));return next}
async function api(path,method='GET',payload=null){
 let s=session();if(!s?.access_token||!s?.refresh_token)throw Error('Iniciá sesión en el dashboard BTS.');
 if((s.expires_at||0)*1000<Date.now()+45000)s=await refreshAuth(s);
 const headers={apikey:KEY,Authorization:'Bearer '+s.access_token,Accept:'application/json'};
 if(payload!==null){headers['Content-Type']='application/json';headers.Prefer='return=representation'}
 const response=await fetch(BASE+'/rest/v1/'+path,{method,headers,body:payload===null?undefined:JSON.stringify(payload),cache:'no-store'});
 if(!response.ok){let message='HTTP '+response.status;try{const v=await response.json();message=v.message||v.error||message}catch{}throw Error(message)}
 if(response.status===204)return [];
 const txt=await response.text();return txt?JSON.parse(txt):[];
}
const clean=v=>String(v??'').trim();
const curr=(v,c)=>new Intl.NumberFormat('es-NI',{style:'currency',currency:c||'USD',maximumFractionDigits:2}).format(Number(v||0));
const fmtDate=d=>d?new Date(d+'T12:00:00').toLocaleDateString('es-NI'):'—';
const clientName=id=>state.rows.clients?.find(c=>c.id===id)?.business_name||'Sin asignar';
const serviceName=id=>state.rows.services?.find(s=>s.id===id)?.name||'—';
const columns={
 clients:[['business_name','Negocio'],['contact_name','Contacto'],['client_type','Tipo'],['status','Estado']],
 services:[['name','Servicio'],['client_id','Cliente'],['service_type','Categoría'],['recurring_fee','Cuota'],['next_renewal','Renovación'],['status','Estado']],
 transactions:[['concept','Movimiento'],['client_id','Cliente'],['entry_type','Tipo'],['amount','Monto'],['due_on','Vence'],['status','Estado']],
 cards:[['serial','Tarjeta'],['client_id','Cliente'],['status','Estado'],['linked_url','URL asociada']],
 tickets:[['subject','Asunto'],['client_id','Cliente'],['priority','Prioridad'],['status','Estado']],
 audit:[['occurred_at','Fecha'],['table_name','Tabla'],['action','Operación'],['actor_id','Autor']]
};
const moneyPair=entries=>entries.filter(x=>x.status==='pendiente'&&x.entry_type==='ingreso').reduce((a,x)=>(a[x.currency]=(a[x.currency]||0)+Number(x.amount),a),{USD:0,NIO:0});
function metrics(){
 $('mClients').textContent=(state.rows.clients||[]).length;
 $('mServices').textContent=(state.rows.services||[]).filter(x=>x.status==='activo').length;
 const pending=moneyPair(state.rows.transactions||[]);
 $('mPending').textContent=curr(pending.USD,'USD');
 $('mPendingUnit').textContent=curr(pending.NIO,'NIO')+' adicionales';
 const now=new Date().toISOString().slice(0,10);const end=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 $('mRenewals').textContent=(state.rows.services||[]).filter(x=>x.status==='activo'&&x.next_renewal&&x.next_renewal>=now&&x.next_renewal<=end).length;
}
function cellValue(item,key){
 if(key==='client_id')return clientName(item[key]);
 if(key==='service_id')return serviceName(item[key]);
 if(key==='recurring_fee'||key==='amount')return curr(item[key],item.currency);
 if(key==='next_renewal'||key==='due_on')return fmtDate(item[key]);
 if(key==='occurred_at')return new Date(item[key]).toLocaleString('es-NI');
 if(key==='linked_url')return item.linked_url?'Configurada':'—';
 return String(item[key]??'—');
}
function render(){
 document.querySelectorAll('.tab').forEach(t=>{const active=t.dataset.section===state.section;t.classList.toggle('active',active);t.setAttribute('aria-current',active?'page':'false')});
 $('sectionTitle').textContent=names[state.section];
 $('sectionDesc').textContent=state.section==='audit'?'Movimientos de los registros ERP, con autor y fecha.':'Datos sincronizados con Supabase y visibles únicamente para administradores BTS.';
 $('add').hidden=state.section==='audit';$('add').textContent='+ '+(state.section==='clients'?'Nuevo cliente':state.section==='services'?'Nuevo servicio':state.section==='transactions'?'Nuevo movimiento':state.section==='cards'?'Nueva tarjeta':'Nuevo ticket');
 $('filter').replaceChildren(new Option('Todos los estados',''),...(filters[state.section]||[]).map(x=>new Option(x.replaceAll('_',' '),x)));
 $('search').value='';
 renderRows();metrics();
}
function renderRows(){
 const section=state.section,q=clean($('search').value).toLowerCase(),filter=$('filter').value;
 const all=state.rows[section]||[];
 const list=all.filter(v=>(!filter||v.status===filter||v.action===filter)&&(!q||Object.values(v).some(val=>typeof val==='string'&&val.toLowerCase().includes(q))));
 const thead=$('headers');thead.replaceChildren();const hr=document.createElement('tr');
 for(const [,label] of columns[section]){const th=document.createElement('th');th.textContent=label;hr.append(th)}
 if(section!=='audit'){const th=document.createElement('th');th.textContent='Acción';hr.append(th)}thead.append(hr);
 const body=$('rows');body.replaceChildren();
 for(const item of list){
   const tr=document.createElement('tr');
   for(const [key] of columns[section]){const td=document.createElement('td');
     if(key==='status'){const badge=document.createElement('span');badge.className='pill '+(['activo','pagado','asignada','resuelto'].includes(item.status)?'active':['pendiente','abierto'].includes(item.status)?'pending':'');badge.textContent=cellValue(item,key);td.append(badge)}
     else td.textContent=cellValue(item,key);
     tr.append(td);
   }
   if(section!=='audit'){const td=document.createElement('td'),b=document.createElement('button');b.className='btn';b.type='button';b.textContent='Editar';b.onclick=()=>editor(item);td.append(b);tr.append(td)}
   body.append(tr);
 }
 $('empty').hidden=list.length>0;$('empty').textContent=all.length?'No hay registros con esos filtros.':'Sin registros todavía. Creá el primero desde este panel.';
}
function fieldDef(def,item){
 const [key,label,type,required,choices]=def;
 const wrap=document.createElement('label');wrap.className='field '+(type==='textarea'?'wide':'');wrap.textContent=label+(required?' *':'');
 let el;
 if(type==='select'||type==='client'||type==='service'){
   el=document.createElement('select');el.append(new Option(required?'Seleccioná una opción':'Sin asignar',''));
   let opts=choices||[];
   if(type==='client')opts=(state.rows.clients||[]).map(c=>({value:c.id,label:c.business_name}));
   if(type==='service')opts=(state.rows.services||[]).map(s=>({value:s.id,label:s.name+' · '+clientName(s.client_id),client_id:s.client_id}));
   for(const v of opts)el.append(new Option(typeof v==='string'?v.replaceAll('_',' '):v.label,typeof v==='string'?v:v.value));
   if(type==='service')el.dataset.service='1';
 }else if(type==='textarea'){el=document.createElement('textarea');el.rows=3}
 else{el=document.createElement('input');el.type=type==='number'?'number':type; if(type==='number'){el.min='0';el.step='0.01'}}
 el.name=key;el.required=!!required;
 const defaults={status:state.section==='clients'?'prospecto':state.section==='services'?'preparacion':state.section==='transactions'?'pendiente':state.section==='cards'?'inventario':'abierto',client_type:'empresa',currency:'USD',billing_cycle:'ninguno',setup_fee:0,recurring_fee:0,entry_type:'ingreso',priority:'normal'};
 el.value=item?.[key]??defaults[key]??'';
 wrap.append(el);return wrap;
}
function editor(item=null){
 state.editing=item?.id||null;
 $('dialogTitle').textContent=(item?'Editar ':'Nuevo ')+names[state.section].toLowerCase().replace(/s$/,'');
 $('formFields').replaceChildren(...fields[state.section].map(f=>fieldDef(f,item)));
 if(['transactions','cards','tickets'].includes(state.section)){
  const client=$('form').elements.namedItem('client_id');const service=$('form').elements.namedItem('service_id');
  if(client&&service){
    const update=()=>{for(const o of service.options){if(!o.value)continue;const s=(state.rows.services||[]).find(v=>v.id===o.value);o.disabled=!!(client.value&&s?.client_id!==client.value)}if(service.selectedOptions[0]?.disabled)service.value=''};
    client.addEventListener('change',update);update();
  }
 }
 $('editor').showModal();
}
function payload(){
 const data={};for(const [key,,type,required] of fields[state.section]){
  const input=$('form').elements.namedItem(key);let value=clean(input.value);
  if(required&&!value)throw Error('Completá los campos obligatorios.');
  if(type==='number'){if(!value)value='0';const n=Number(value);if(!Number.isFinite(n)||n<0)throw Error('Revisá los importes.');data[key]=n}
  else data[key]=value||(['client','service','date'].includes(type)?null:'');
 }
 if(state.section==='cards'&&data.status==='asignada'&&!data.client_id)throw Error('Una tarjeta asignada necesita un cliente.');
 if(state.section==='services'&&data.billing_cycle==='ninguno')data.next_renewal=null;
 if(state.section==='transactions'&&data.service_id){const s=(state.rows.services||[]).find(x=>x.id===data.service_id);if(s?.client_id!==data.client_id)throw Error('El servicio no pertenece al cliente elegido.')}
 if(state.section==='cards'&&data.linked_url&&!/^https:\/\//i.test(data.linked_url))throw Error('La URL de tarjeta debe comenzar con https://');
 return data;
}
async function save(e){
 e.preventDefault();const b=$('save');b.disabled=true;
 try{const data=payload();const table=tableNames[state.section];const url=state.editing?table+'?id=eq.'+encodeURIComponent(state.editing):table;
 await api(url,state.editing?'PATCH':'POST',data);
 $('editor').close();note('Registro guardado correctamente.');await load();
 }catch(err){note(err.message,true)}finally{b.disabled=false}
}
async function load(){
 if(state.loading)return;state.loading=true;$('refresh').disabled=true;
 try{
  const collections=await Promise.all(Object.entries(tableNames).map(async ([key,t])=>{
    const selection=key==='audit'?'id,actor_id,table_name,record_id,action,occurred_at':'*';
    return [key,await api(t+'?select='+selection+'&order=created_at.desc&limit=500').catch(async err=>{
      if(key==='audit')return await api(t+'?select='+selection+'&order=occurred_at.desc&limit=500');
      throw err;
    })];
  }));
  for(const [k,v] of collections)state.rows[k]=v;
  render();note('Información actualizada desde BTS Studio.');
 }catch(err){note('No se pudo sincronizar: '+err.message,true)}
 finally{state.loading=false;$('refresh').disabled=false}
}
async function init(){
 try{
  const s=session();if(!s?.user?.id)throw Error('Iniciá sesión en el dashboard principal para usar el ERP.');
  user=s.user;
  const admins=await api('bts_admins?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id&limit=1');
  if(!admins.length)throw Error('No tenés permiso para gestionar los datos empresariales.');
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{state.section=b.dataset.section;render()}));
  $('refresh').onclick=load;$('search').oninput=renderRows;$('filter').onchange=renderRows;
  $('add').onclick=()=>editor();$('close').onclick=$('cancel').onclick=()=>$('editor').close();
  $('form').addEventListener('submit',save);
  await load();
 }catch(err){note(err.message,true);$('add').disabled=true;$('refresh').disabled=true}
}
init();
})();