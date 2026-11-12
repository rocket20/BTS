/* BTS Studio: control de grabación/entrega NFC separado del módulo de accesos. */
(()=>{'use strict';
const BASE='https://xwehejgwufwhpkpzjzyt.supabase.co',KEY='sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz',SESSION='bts-admin-sb-session-v1';
const $=id=>document.getElementById(id),node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const labels={generated:'Generada',encoded:'Grabada',verified:'Verificada',delivered:'Entregada'};
let companies=[],batches=[],cards=[];
function status(message,bad=false){const el=$('notice');el.textContent=message;el.classList.toggle('bad',bad)}
function session(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch{return null}}
async function api(endpoint,method='GET',body){
 let s=session();if(!s?.access_token||!s?.refresh_token)throw Error('Iniciá sesión en el dashboard BTS.');
 if((s.expires_at||0)*1000<Date.now()+45000){
  const r=await fetch(BASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});
  const data=await r.json();if(!r.ok)throw Error('La sesión administrativa expiró.');
  s={...s,...data,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in};
  sessionStorage.setItem(SESSION,JSON.stringify(s));
 }
 const headers={apikey:KEY,Authorization:'Bearer '+s.access_token,Accept:'application/json'};
 if(body!==undefined){headers['Content-Type']='application/json';headers.Prefer='return=representation'}
 const r=await fetch(BASE+'/rest/v1/'+endpoint,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.message||data.error||'Error '+r.status)}
 return r.status===204?[]:await r.json();
}
function renderBatchFilter(){
 const sel=$('productionBatch'),previous=sel.value,company=$('productionBusiness').value;sel.replaceChildren(new Option('Todos los lotes',''));
 for(const b of batches.filter(b=>!company||b.business_id===company)){
  sel.add(new Option('Lote '+b.id.slice(0,8)+' · '+b.quantity+' tarjetas',b.id));
 }
 if([...sel.options].some(o=>o.value===previous))sel.value=previous;
 render();
}
function render(){
 const body=$('productionRows');body.replaceChildren();
 const company=$('productionBusiness').value,batch=$('productionBatch').value,q=$('productionSearch').value.trim().toLowerCase();
 const items=cards.filter(c=>(!company||c.business_id===company)&&(!batch||c.batch_id===batch)&&(!q||c.reference.toLowerCase().includes(q)));
 if(!items.length){const tr=node('tr'),td=node('td','No hay tarjetas para mostrar.');td.colSpan=4;tr.append(td);body.append(tr);return}
 for(const card of items){
  const tr=node('tr'),ref=node('td',card.reference),stage=node('td',labels[card.production_stage]||card.production_stage),
  assign=node('td',card.status==='available'?'Disponible':card.status==='assigned'?'Asignada':'Suspendida'),act=node('td');
  const transitions={generated:'encoded',encoded:'verified',verified:'delivered'};
  if(card.status==='available'&&transitions[card.production_stage]){
   const next=transitions[card.production_stage],b=node('button',next==='encoded'?'Confirmar grabación':next==='verified'?'Marcar verificada':'Registrar entrega');
   b.type='button';b.className='btn';b.onclick=()=>change(card,next,b);act.append(b);
  }
  if(card.status==='available'&&card.production_stage==='verified'){
   const b=node('button','Repetir grabación');b.type='button';b.className='btn warning';b.style.marginLeft='6px';b.onclick=()=>change(card,'encoded',b);act.append(b);
  }
  if(!act.childNodes.length)act.append(node('small','Sin cambios pendientes'));
  tr.append(ref,stage,assign,act);body.append(tr);
 }
}
async function change(card,next,b){
 let note='';
 if(card.production_stage==='verified'&&next==='encoded'){
  const input=prompt('Motivo para repetir la grabación (mínimo 5 caracteres):');
  if(input===null)return;note=input.trim();if(note.length<5)return status('Ingresá un motivo de al menos cinco caracteres.',true);
 }else if(!confirm('¿Cambiar '+card.reference+' de '+labels[card.production_stage]+' a '+labels[next]+'?'))return;
 b.disabled=true;
 try{
  const answer=await api('rpc/bts_admin_mark_nfc_production','POST',{p_slot_id:card.id,p_next_stage:next,p_note:note});
  if(!answer?.length)throw Error('No hay confirmación de la operación.');
  await load();status('Estado actualizado: '+card.reference+' · '+labels[next]);
 }catch(e){status(e.message,true)}finally{b.disabled=false}
}
async function load(){
 try{
  const [b,bat,inv]=await Promise.all([
   api('bts_nfc_cards?select=id,business_name&order=business_name.asc&limit=500'),
   api('bts_nfc_batches?select=id,business_id,quantity&order=created_at.desc&limit=500'),
   api('bts_nfc_inventory?select=id,batch_id,business_id,reference,status,production_stage&order=created_at.asc&limit=2000')
  ]);
  companies=b||[];batches=bat||[];cards=inv||[];
  const sel=$('productionBusiness'),old=sel.value;sel.replaceChildren(new Option('Todas las empresas',''));
  for(const c of companies)sel.add(new Option(c.business_name,c.id));
  if([...sel.options].some(x=>x.value===old))sel.value=old;
  renderBatchFilter();
 }catch(e){status('Producción no disponible: '+e.message,true)}
}
$('productionBusiness').onchange=renderBatchFilter;
$('productionBatch').onchange=render;
$('productionSearch').oninput=render;
$('productionRefresh').onclick=load;
load();
})();