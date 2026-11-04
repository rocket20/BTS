/* BTS Studio — cotizaciones online dentro del dashboard existente.
   Esta sección requiere una cuenta Supabase autorizada en bts_admins. */
(() => {
'use strict';
const $=id=>document.getElementById(id);
const config=window.BTS_SUPABASE_CONFIG||{};
const valid=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.url||'') &&
  /^sb_publishable_(?!REEMPLAZAR)/.test(config.publishableKey||'');
const labels={
  nueva:'Nueva',en_revision:'En revisión',contactada:'Contactada',
  propuesta_enviada:'Propuesta enviada',aceptada:'Aceptada',cerrada:'Cerrada'
};
const sel=$('btsOnlinePanel');
if(!sel) return;
let db=null, authorized=false, rows=[];
const note=msg=>{$('btsOnlineMessage').textContent=msg;};
const node=(tag,content)=>{
  const x=document.createElement(tag);
  if(content!==undefined)x.textContent=String(content);
  return x;
};
const hide=(id,isHidden)=>$(id).hidden=!!isHidden;
const getClient=()=>db||(db=window.supabase.createClient(config.url,config.publishableKey));
const esc=val=>String(val||'');
async function loginCheck(){
  if(!valid||!window.supabase?.createClient){
    hide('btsOnlineLogin',true);
    hide('btsOnlineWorkspace',true);
    note('La conexión Supabase está pendiente de configurar. Las cotizaciones locales permanecen disponibles.');
    return;
  }
  const api=getClient();
  const {data:{user},error:e}=await api.auth.getUser();
  if(e||!user){authorized=false;hide('btsOnlineLogin',false);hide('btsOnlineWorkspace',true);
    note('Iniciá sesión para ver las cotizaciones recibidas desde la web.');return;}
  const {data,error}=await api.from('bts_admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if(error||!data){authorized=false;hide('btsOnlineLogin',false);hide('btsOnlineWorkspace',true);
    note('Tu cuenta no tiene acceso a cotizaciones. Autorizala en bts_admins desde Supabase.');return;}
  authorized=true;hide('btsOnlineLogin',true);hide('btsOnlineWorkspace',false);
  await load();
}
async function load(){
  if(!authorized)return;
  note('Actualizando cotizaciones…');
  const {data,error}=await getClient().from('bts_quotes').select('*').order('created_at',{ascending:false}).limit(500);
  if(error){note('No fue posible consultar cotizaciones: '+error.message);return;}
  rows=data||[];
  const visible=rows.filter(x=>{
    const f=$('btsOnlineFilter').value;
    const s=$('btsOnlineSearch').value.toLowerCase().trim();
    return (!f||x.estado===f) && (!s||[x.nombre,x.empresa,x.email,x.evento].join(' ').toLowerCase().includes(s));
  });
  const body=$('btsOnlineRows');body.replaceChildren();
  for(const q of visible){
    const tr=node('tr');
    const date=node('td',new Date(q.created_at).toLocaleDateString('es-NI'));
    const nm=node('td');nm.append(node('strong',q.nombre),node('br'),node('small',q.empresa||q.email));
    const event=node('td',q.evento);
    const pack=node('td',q.paquete);
    const state=node('td',labels[q.estado]||q.estado);
    const actions=node('td');const b=node('button','Ver detalles');
    b.type='button';b.className='link-button';b.addEventListener('click',()=>showDetails(q));
    actions.append(b);tr.append(date,nm,event,pack,state,actions);body.append(tr);
  }
  if(!visible.length){const tr=node('tr'),td=node('td','No hay cotizaciones con esos filtros.');td.colSpan=6;tr.append(td);body.append(tr);}
  $('btsOnlineStats').textContent=rows.length+' solicitudes recibidas · '+rows.filter(x=>x.estado==='nueva').length+' nuevas · '+rows.filter(x=>!['aceptada','cerrada'].includes(x.estado)).length+' en seguimiento';
  note('Cotizaciones actualizadas. Mostrando hasta las 500 más recientes.');
}
function showDetails(q){
  const box=$('btsOnlineDetails');box.replaceChildren();
  box.append(node('h3',q.nombre+' — '+q.evento),
    node('p','Correo: '+q.email+' · Teléfono: '+(q.telefono||'No indicado')),
    node('p','Evento: '+(q.fecha_evento||'Sin fecha')+' · Origen: '+q.origen));
  const details=node('pre',Object.entries(q.detalles||{}).map(([k,v])=>k+': '+esc(v)).join('\n'));
  details.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:300px;overflow:auto;background:#13141a;border-radius:10px;padding:14px';
  box.append(details);
  const label=node('label','Estado de seguimiento');
  const status=node('select');status.className='input';
  for(const [key,value] of Object.entries(labels)){
    const option=node('option',value);option.value=key;option.selected=q.estado===key;status.append(option);
  }
  const noteLabel=node('label','Notas privadas');
  const comments=node('textarea');comments.className='input';comments.rows=3;comments.value=q.notas_internas||'';
  const save=node('button','Guardar estado y notas');save.type='button';save.className='btn btn-primary';
  const message=node('span','');
  save.addEventListener('click',async()=>{
    save.disabled=true;
    const {error}=await getClient().from('bts_quotes')
      .update({estado:status.value,notas_internas:comments.value}).eq('id',q.id);
    save.disabled=false;
    message.textContent=error?'No se guardó: '+error.message:'Cambios guardados.';
    if(!error)await load();
  });
  box.append(label,status,noteLabel,comments,save,message);
}
$('btsOnlineLoginForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!valid||!window.supabase?.createClient)return;
  note('Iniciando sesión…');
  const {error}=await getClient().auth.signInWithPassword({
    email:$('btsOnlineEmail').value,
    password:$('btsOnlinePassword').value
  });
  $('btsOnlinePassword').value='';
  if(error){note('No se pudo iniciar sesión: '+error.message);return;}
  await loginCheck();
});
$('btsOnlineLogout').addEventListener('click',async()=>{
  await getClient().auth.signOut();authorized=false;
  hide('btsOnlineLogin',false);hide('btsOnlineWorkspace',true);note('Sesión cerrada.');
});
$('btsOnlineRefresh').addEventListener('click',load);
$('btsOnlineFilter').addEventListener('change',load);
$('btsOnlineSearch').addEventListener('input',()=>{
  clearTimeout(window.__btsOnlineSearchTimer);
  window.__btsOnlineSearchTimer=setTimeout(load,250);
});
loginCheck();
})();
