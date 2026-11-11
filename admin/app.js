/* BTS Studio Admin — static GitHub Pages CMS. Real analytics and incoming leads require a backend. */
(() => {
'use strict';
const $=(s,p=document)=>p.querySelector(s), $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
const LS_DRAFT='bts-admin-content-v1',LS_LEADS='bts-admin-leads-v1',LS_REPO='bts-admin-repo-v1';
const copy=o=>JSON.parse(JSON.stringify(o));
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const uid=()=>('bts'+Date.now().toString(36)+Math.random().toString(36).slice(2,7));
const safeImg=v=>/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(v||'') || /^(?:assets\/uploads\/[\w.\-]+|https:\/\/[^\s"'<>]+)$/.test(v||'');
const safeLink=v=>/^https:\/\/[^\s"'<>]+$/.test(v||'');
const pathImage=v=>safeImg(v)?((v||'').startsWith('assets/')?'../'+v:v):'';
const blank={version:1,updatedAt:null,brand:{studioName:'BTS Studio',heroTitle:'',heroSubtitle:'',contactEmail:'',whatsapp:'',instagram:'',analyticsId:''},events:[],brands:[],packages:[],services:[],testimonials:[]};
const GA_REPORT_URL='https://xwehejgwufwhpkpzjzyt.supabase.co/functions/v1/bts-ga4-report';
const GA_KEY='sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz';
let googleReport=null, googleReportStatus='pending', googleError='', whatsappClicks=null;
const pretty=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('es-NI'):'—';
function authSession(){try{return JSON.parse(sessionStorage.getItem('bts-admin-sb-session-v1')||'null')}catch{return null}}
async function updateWhatsappClicks(){
 const session=authSession();if(!session?.access_token)return;
 try{
  const since=new Date(Date.now()-30*86400000).toISOString();
  const response=await fetch('https://xwehejgwufwhpkpzjzyt.supabase.co/rest/v1/bts_events?select=id&kind=eq.whatsapp_click&created_at=gte.'+encodeURIComponent(since)+'&limit=10000',{
    headers:{apikey:GA_KEY,Authorization:'Bearer '+session.access_token,Prefer:'count=exact'},cache:'no-store'
  });
  if(!response.ok)throw Error('Supabase respondió '+response.status);
  const rows=await response.json(),contentRange=response.headers.get('content-range')||'';
  const total=contentRange.includes('/')?Number(contentRange.split('/').pop()):NaN;
  whatsappClicks=Number.isFinite(total)?total:rows.length;
  renderKpis();
 }catch(e){console.warn('WhatsApp analytics unavailable',e);whatsappClicks=null;}
}
async function updateGoogleMetrics(){
 const session=authSession();if(!session?.access_token)return;
 googleReportStatus='loading';googleError='';renderKpis();renderChart();
 try{
  const control=new AbortController();const timeout=setTimeout(()=>control.abort(),14500);
  let response;
  try{response=await fetch(GA_REPORT_URL,{headers:{apikey:GA_KEY,Authorization:'Bearer '+session.access_token},cache:'no-store',signal:control.signal});}
  finally{clearTimeout(timeout);}
  const body=await response.json();
  if(!response.ok)throw Error(body.error||'No se pudo consultar GA4 ('+response.status+')');
  if(!body.configured)throw Error(body.error||'Falta autorizar GA4');
  googleReport=body;googleReportStatus='ready';googleError='';
 }catch(e){googleReport=null;googleReportStatus='pending';googleError=e?.message||'No se pudieron obtener métricas.';}
 const gaNote=document.getElementById('gaLiveNotice');
 if(gaNote)gaNote.textContent=googleReportStatus==='ready'?
  'Datos reales de Google Analytics 4: propiedad 562792478 · últimos 30 días.':
  'Reportes GA4 pendientes: '+(googleError||'Falta autorizar la lectura de datos desde Supabase')+'. El seguimiento G-LY7K0LHLTC ya está configurado en la web.';
 renderKpis();renderChart();status();
}

let content=copy(blank), leads=[], token='', repo={owner:'rocket20',name:'BTS',branch:'main'}, page='resumen', modalType='', modalId='',modalImageData='',modalGalleryData=[],activeToast;
const labels={resumen:'Resumen',trafico:'Analítica web',cotizaciones:'Cotizaciones',eventos:'Eventos y proyectos',marcas:'Marcas y aliados',paquetes:'Paquetes',servicios:'Servicios',contenido:'Página y contacto',configuracion:'Configuración',nfc:'Tarjetas NFC',erp:'Centro de operaciones',accesos:'Accesos empresariales',usuarios:'Usuarios y roles',historial:'Historial de movimientos'};
function notify(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(activeToast);activeToast=setTimeout(()=>el.classList.remove('show'),4000);}
function localGet(key,fallback){try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch{return fallback;}}
function localSet(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{notify('No hay espacio disponible para este borrador. Exportá el JSON para respaldarlo.');return false;}}
function normalize(x){const d=copy(blank);if(!x||typeof x!=='object')return d;d.brand={...d.brand,...(x.brand||{})};for(const k of ['events','brands','packages','services','testimonials'])d[k]=Array.isArray(x[k])?x[k]:[];d.updatedAt=x.updatedAt||null;return d;}
function storeDraft(){localSet(LS_DRAFT,content);notify('Borrador guardado en este navegador. Usá Publicar en GitHub para hacerlo visible a todos.');}
async function reloadLeads(){leads=await BTSLeads.load();renderOverview();renderLeads();await updateGoogleMetrics();}
function storeLeads(){renderOverview();renderLeads();}
const NFC_FOLDERS=[
  {name:'normal',tab:'nfcTabNormal',panel:'nfcFolderNormal',frame:'btsNfcModuleFrame'},
  {name:'corporate',tab:'nfcTabCorporate',panel:'nfcFolderCorporate',frame:'btsNfcEnterpriseFrame'},
  {name:'loyalty',tab:'nfcTabLoyalty',panel:'nfcFolderLoyalty',frame:'btsNfcLoyaltyFrame'},
  {name:'vip',tab:'nfcTabVip',panel:'nfcFolderVip',frame:'btsNfcVipFrame'}
];
let currentNfcFolder='normal';
function selectNfcFolder(folder){
 const found=NFC_FOLDERS.find(f=>f.name===folder)||NFC_FOLDERS[0];
 currentNfcFolder=found.name;
 for(const x of NFC_FOLDERS){
  const active=x.name===found.name,t=$('#'+x.tab),p=$('#'+x.panel);
  if(!t||!p)continue;
  t.classList.toggle('active',active);t.setAttribute('aria-selected',String(active));
  t.tabIndex=active?0:-1;p.hidden=!active;
 }
 const frame=$('#'+found.frame);
 if(frame&&!frame.getAttribute('src'))frame.src=frame.dataset.src;
}
for(const [i,folder] of NFC_FOLDERS.entries()){
 const tab=$('#'+folder.tab);if(!tab)continue;
 tab.addEventListener('click',()=>selectNfcFolder(folder.name));
 tab.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();
  let pos=e.key==='Home'?0:e.key==='End'?NFC_FOLDERS.length-1:
    (NFC_FOLDERS.findIndex(x=>x.name===currentNfcFolder)+(e.key==='ArrowRight'?1:-1)+NFC_FOLDERS.length)%NFC_FOLDERS.length;
  selectNfcFolder(NFC_FOLDERS[pos].name);$('#'+NFC_FOLDERS[pos].tab).focus();
 });
}
function navigate(name){if(!labels[name])return;page=name;$$('.page').forEach(el=>el.classList.toggle('active',el.id==='page-'+name));$$('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===name));$('#breadcrumb').textContent=labels[name];$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'instant'});if(name==='contenido')fillContent();if(name==='configuracion')fillRepo();if(name==='nfc')selectNfcFolder(currentNfcFolder);if(name==='erp'){const f=$('#btsErpFrame');if(f&&!f.getAttribute('src'))f.src=f.dataset.src;}if(name==='accesos'){const f=$('#btsAccessFrame');if(f&&!f.getAttribute('src'))f.src=f.dataset.src;}window.BTSAdminAudit?.open(name);}
function status(){const configured=true,connected=!!window.BTSLeads?.invokePublisher;$('#modePill').textContent=connected?'● SUPABASE CONFIGURADO':'● MODO BORRADOR';$('#modePill').style.color=connected?'#72daa5':'';$('#connectionLabel').textContent=connected?'Supabase protege la publicación':'Modo de preparación';$('#repoStatus').textContent=connected?'Verificar función':'No conectado';$('#cmsStatus').textContent=connected?'Pendiente de prueba':'Pendiente';$('#gaStatus').textContent=googleReportStatus==='ready'?'GA4 conectado':content.brand.analyticsId?'ID configurado · informes pendientes':'Sin ID';$('#navLeadCount').textContent=leads.filter(l=>l.status==='Pendiente').length;}
function renderKpis(){
 const icon=(name)=>'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><use href="icons/lucide-'+(name==='users-round'||name==='eye'?'ui':'content')+'.svg#'+name+'"></use></svg>';
 const ready=googleReportStatus==='ready'&&googleReport;
 const pendingFoot=googleReportStatus==='loading'?'Consultando Google Analytics':'Pendiente de autorización GA4';
 const items=[
  ['Vistas de página',ready?pretty(googleReport.pageViews):'—','eye',ready?'Últimos 30 días · GA4':pendingFoot,ready?'ga':'pending'],
  ['Visitantes únicos',ready?pretty(googleReport.users):'—','users-round',ready?'Últimos 30 días · GA4':pendingFoot,ready?'ga':'pending'],
  ['Solicitudes registradas',String(leads.length),'clipboard-list','Registros en Supabase','cloud'],
  ['Clics a WhatsApp',whatsappClicks!==null?pretty(whatsappClicks):ready?pretty(googleReport.whatsappClicks):'—','message-circle',whatsappClicks!==null?'Supabase · últimos 30 días':ready?'Eventos GA4 · 30 días':'Sin datos de eventos',whatsappClicks!==null?'cloud':ready?'ga':'pending']
 ];
 const overview=$('#overviewKpis');
 const key=items.map(x=>x[0]).join('|');
 if(overview.dataset.metricLayout!==key||overview.children.length!==items.length){
  overview.innerHTML=items.map(([title,value,ico,foot,type])=>`<article class="kpi-card"><div class="kpi-top"><span class="kpi-label">${esc(title)}</span><span class="kpi-icon">${icon(ico)}</span></div><div class="kpi-value">${esc(value)}</div><div class="kpi-foot"><span class="${type==='pending'?'pending':''}">${type==='cloud'?'NUBE':type==='ga'?'GA4':'PENDIENTE'}</span> ${esc(foot)}</div></article>`).join('');
  overview.dataset.metricLayout=key;
 }else{
  const existing=new Map(Array.from(overview.querySelectorAll('.kpi-card')).map(card=>[card.querySelector('.kpi-label')?.textContent,card]));
  items.forEach(([title,value,ico,foot,type])=>{
   const card=existing.get(title);if(!card)return;
   const valueNode=card.querySelector('.kpi-value'),footNode=card.querySelector('.kpi-foot');
   if(valueNode&&valueNode.textContent!==value)valueNode.textContent=value;
   if(footNode)footNode.innerHTML=`<span class="${type==='pending'?'pending':''}">${type==='cloud'?'NUBE':type==='ga'?'GA4':'PENDIENTE'}</span> ${esc(foot)}`;
  });
 }
 const sessions=ready?Number(googleReport.sessions||0):null;
 const conv=ready&&sessions>0?(Number(googleReport.quoteSubmissions||0)*100/sessions).toFixed(2)+'%':ready?'0%':'—';
 const other=[
  ['Visitantes',ready?pretty(googleReport.users):'—','users-round',ready?'Google Analytics 4':pendingFoot],
  ['Sesiones',ready?pretty(googleReport.sessions):'—','eye',ready?'Últimos 30 días · GA4':pendingFoot],
  ['Clics WhatsApp',whatsappClicks!==null?pretty(whatsappClicks):ready?pretty(googleReport.whatsappClicks):'—','message-circle',whatsappClicks!==null?'Supabase · 30 días':ready?'Eventos GA4':pendingFoot],
  ['Tasa de conversión',conv,'percent',ready?'Solicitudes GA4 / sesiones':pendingFoot]
 ];
 const traffic=$('#trafficKpis');
 traffic.innerHTML=other.map(([label,value,ico,foot])=>`<article class="kpi-card"><div class="kpi-top"><span class="kpi-label">${esc(label)}</span><span class="kpi-icon">${icon(ico)}</span></div><div class="kpi-value">${esc(value)}</div><div class="kpi-foot">${ready?'GA4':'PENDIENTE'} · ${esc(foot)}</div></article>`).join('');
 const statusNote=$('#gaLiveNotice');
 if(statusNote){
  statusNote.textContent=ready?'Conectado con Google Analytics 4 · propiedad '+googleReport.propertyId+' · '+googleReport.period+'.':googleReportStatus==='loading'?'Consultando el informe de Google Analytics 4…':(googleError||'Pendiente: autorizar la cuenta de servicio para leer GA4 de forma segura desde Supabase.');
 }
}
function renderChart(){
 const chart=$('#trafficChart'),source=$('#sourceBars'),funnel=$('#funnel');
 const ready=googleReportStatus==='ready'&&googleReport;
 if(!ready){
  chart.innerHTML='<div class="ghost-placeholder" style="min-height:210px"><strong>Esperando métricas de Google Analytics 4</strong><span>No se mostrarán gráficas de demostración como si fueran datos reales.</span></div>';
  source.innerHTML='<p class="tiny-note">Las fuentes de tráfico se mostrarán cuando se autorice la conexión de Google Analytics.</p>';
  funnel.innerHTML='<p class="tiny-note">El embudo aparecerá con datos verificables de Google Analytics cuando estén disponibles.</p>';
  $('#chartMode').textContent='GA4 pendiente';$('#chartSub').textContent='sin datos simulados';return;
 }
 $('#chartMode').textContent='GA4 · 7 días';$('#chartSub').textContent='datos GA4';
 const daily=Array.isArray(googleReport.daily)?googleReport.daily:[],W=700,H=218,l=40,r=16,t=14,b=38;
 const max=Math.max(1,...daily.map(x=>Number(x.views)||0));
 const x=i=>l+i*(W-l-r)/Math.max(1,daily.length-1);
 const y=n=>H-b-(Math.max(0,Number(n)||0)/max)*(H-t-b);
 const points=daily.map((d,i)=>[x(i),y(d.views)]);
 const poly=points.map(p=>p.join(',')).join(' ');
 const area=points.length?l+','+(H-b)+' '+poly+' '+(W-r)+','+(H-b):'';
 chart.innerHTML=daily.length?`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Vistas diarias reales de Google Analytics"><defs><linearGradient id="gradBTS" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff0037" stop-opacity=".25"/><stop offset="100%" stop-color="#ff0037" stop-opacity="0"/></linearGradient></defs><polygon points="${area}" fill="url(#gradBTS)"/><polyline points="${poly}" fill="none" stroke="#ff2857" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${points.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#ff0037"/><text x="${p[0]}" y="${H-13}" text-anchor="middle" font-size="10" fill="#9c9eac">${esc(String(daily[i].date||'').slice(4,8))}</text>`).join('')}</svg>`:'<div class="ghost-placeholder">GA4 no registró visitas durante los últimos siete días.</div>';
 const channels=Array.isArray(googleReport.channels)?googleReport.channels:[],total=channels.reduce((sum,a)=>sum+(Number(a.sessions)||0),0);
 source.innerHTML=total?channels.slice(0,6).map(c=>{const pct=Math.min(100,Math.max(0,Math.round(100*(Number(c.sessions)||0)/total)));return `<div class="source-row"><div class="source-name"><span>${esc(c.name)}</span><strong>${pct}%</strong></div><div class="bar"><span style="width:${pct}%"></span></div></div>`}).join(''):'<p class="tiny-note">Sin sesiones atribuidas a canales durante este período.</p>';
 const sessions=Math.max(0,Number(googleReport.sessions||0)),quotes=Math.max(0,Number(googleReport.quoteSubmissions||0)),wa=Math.max(0,Number(googleReport.whatsappClicks||0));
 const steps=[['Sesiones',sessions],['Solicitudes web (evento GA4)',quotes],['Clics a WhatsApp',wa]];
 funnel.innerHTML=steps.map(([label,n])=>{const pct=sessions?Math.min(100,Math.round(n/sessions*100)):0;return `<div class="funnel-step"><div class="source-name"><span>${esc(label)}</span><b>${pretty(n)} · ${pct}%</b></div><div class="bar"><span style="width:${pct}%"></span></div></div>`}).join('');
}
function renderOverview(){renderKpis();$('#contentCounts').innerHTML=`<div class="quick-stat"><b>${content.events.filter(x=>x.active!==false).length}</b><span>Proyectos</span></div><div class="quick-stat"><b>${content.brands.filter(x=>x.active!==false).length}</b><span>Marcas</span></div><div class="quick-stat"><b>${content.packages.filter(x=>x.active!==false).length}</b><span>Paquetes</span></div>`;
const out=$('#recentLeads');out.innerHTML=leads.length?leads.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,4).map(l=>`<div class="mini-lead"><span class="mini-avatar">${esc((l.name||'C').trim().slice(0,1).toUpperCase())}</span><div class="mini-name"><b>${esc(l.name)}</b><small>${esc(l.service||'Servicio no indicado')}</small></div><span class="badge ${esc(l.status)}">${esc(l.status)}</span></div>`).join(''):'<div class="ghost-placeholder" style="min-height:125px"><strong>Sin solicitudes registradas</strong><span>Usá Agregar solicitud o importá CSV para comenzar.</span></div>';
status();}
function renderEvents(){const c=$('#eventCards');const items=content.events;
c.innerHTML=items.map(e=>`<article class="item-card"><div class="item-media">${safeImg(e.image)?`<img src="${esc(pathImage(e.image))}" alt="${esc(e.title)}">` :'<svg class="bts-placeholder-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons/lucide-content.svg#image"></use></svg>'}</div><div class="item-content"><span class="item-overline">${esc(e.category||'EVENTO')}</span><h3>${esc(e.title)}</h3><p>${esc(e.description||'Sin descripción')}</p><div class="item-bottom"><span class="badge ${e.active===false?'Rechazado':'Aprobado'}">${e.active===false?'Oculto':'Visible'}</span><button class="link-button edit-item" data-type="event" data-id="${esc(e.id)}">Editar ↗</button></div></div></article>`).join('');
if(!items.length)c.innerHTML='<div class="ghost-placeholder"><span class="symbol"><svg class="bts-placeholder-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons/lucide-content.svg#image"></use></svg></span><strong>Tu portafolio comienza aquí</strong><span>Agregá proyectos reales, sus fotografías y detalles para publicarlos en la web.</span></div>';
c.insertAdjacentHTML('beforeend','<button class="ghost-placeholder" data-new="event" type="button"><span class="symbol">+</span><strong>Agregar proyecto</strong><span>Imagen, categoría, fecha y descripción</span></button>');}
function renderBrands(){const c=$('#brandCards');c.innerHTML=content.brands.map(b=>`<article class="item-card"><div class="item-media">${safeImg(b.image)?`<img src="${esc(pathImage(b.image))}" alt="${esc(b.name)}">` :'<svg class="bts-placeholder-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="icons/lucide-nav.svg#badge-check"></use></svg>'}</div><div class="item-content"><span class="item-overline">MARCA / ALIADO</span><h3>${esc(b.name)}</h3><p>${esc(b.website||'Sin enlace asociado')}</p><div class="item-bottom"><span class="badge ${b.active===false?'Rechazado':'Aprobado'}">${b.active===false?'Oculta':'Visible'}</span><button class="link-button edit-item" data-type="brand" data-id="${esc(b.id)}">Editar ↗</button></div></div></article>`).join('');c.insertAdjacentHTML('beforeend','<button class="ghost-placeholder" data-new="brand" type="button"><span class="symbol">+</span><strong>Agregar una marca</strong><span>Subí el logo PNG o WebP y su sitio web</span></button>');}
function renderServices(){const c=$('#serviceCards');c.innerHTML=content.services.map((p,i)=>`<article class="item-card"><div class="item-content"><span class="item-overline">SERVICIO / ${String(i+1).padStart(2,'0')}</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><div class="item-bottom"><span class="badge Aprobado">Visible</span><button class="link-button edit-item" data-type="service" data-id="${esc(p.id)}">Editar ↗</button></div></div></article>`).join('');}
function renderPackages(){const c=$('#packageCards');c.innerHTML=content.packages.map((p,i)=>`<article class="item-card"><div class="item-content"><span class="item-overline">PAQUETE / ${String(i+1).padStart(2,'0')}</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><ul class="feature-list">${(p.features||[]).slice(0,7).map(f=>`<li>${esc(f)}</li>`).join('')}</ul><div class="item-bottom"><span class="badge ${p.active===false?'Rechazado':'Aprobado'}">${p.active===false?'Oculto':'Activo'}</span><button class="link-button edit-item" data-type="package" data-id="${esc(p.id)}">Editar ↗</button></div></div></article>`).join('');}
function fillContent(){const b=content.brand;$('#brandHeroTitle').value=b.heroTitle||'';$('#brandHeroSubtitle').value=b.heroSubtitle||'';$('#brandEmail').value=b.contactEmail||'';$('#brandWhatsapp').value=b.whatsapp||'';$('#brandInstagram').value=b.instagram||'';$('#brandAnalytics').value=b.analyticsId||'';}
function fillRepo(){$('#repoOwner').value=repo.owner;$('#repoName').value=repo.name;$('#repoBranch').value=repo.branch;status();}
function renderLeads(){const q=$('#leadSearch').value.toLowerCase(),filter=$('#leadFilter').value;const matches=leads.filter(l=>{const text=[l.name,l.company,l.service,l.email,l.phone].join(' ').toLowerCase();return text.includes(q)&&(filter==='all'||l.status===filter);});$('#leadsTable').innerHTML=matches.map(l=>`<tr><td><strong>${esc(l.name)}</strong><small>${esc(l.company||l.email||'Sin empresa')}</small></td><td>${esc(l.service||'—')}</td><td>${esc(l.date||'—')}</td><td><span class="badge ${esc(l.status)}">${esc(l.status)}</span></td><td><button class="link-button edit-item" data-type="lead" data-id="${esc(l.id)}">Editar ↗</button></td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:35px">No hay solicitudes que coincidan. Podés agregar una manualmente.</td></tr>';$('#leadFoot').textContent=`${matches.length} solicitudes visibles · ${leads.length} registros de Supabase`;status();}
function renderAll(){renderOverview();renderEvents();renderBrands();renderServices();renderPackages();renderLeads();renderChart();fillContent();status();}
const input=(id,title,value='',type='text',required=false)=>`<div class="field"><label for="m-${id}">${title}</label><input id="m-${id}" name="${id}" type="${type}" value="${esc(value)}" ${required?'required':''}></div>`;
const area=(id,title,value='',rows=3)=>`<div class="field"><label for="m-${id}">${title}</label><textarea id="m-${id}" name="${id}" rows="${rows}">${esc(value)}</textarea></div>`;
function openModal(type,id=''){
modalType=type;modalId=id;modalImageData='';modalGalleryData=[];const plural={event:'events',brand:'brands',package:'packages',service:'services'};const item=type==='lead'?(leads.find(x=>x.id===id)||{}):((content[plural[type]]||[]).find(x=>x.id===id)||{});
$('#modalEyebrow').textContent={event:'PORTAFOLIO',brand:'MARCAS',package:'PAQUETES',service:'SERVICIOS',lead:'SOLICITUDES'}[type];$('#modalTitle').textContent=(id?'Editar ':'Nuevo ')+({event:'proyecto',brand:'aliado',package:'paquete',service:'servicio',lead:'registro de cliente'}[type]);$('#modalDelete').hidden=!id;
const check=`<label class="checkbox-row"><input type="checkbox" name="active" ${item.active!==false?'checked':''}> Publicar / mostrar en la web</label>`;
const image=`<div class="field"><label>Fotografía / logotipo</label><div class="file-preview" id="filePreview">${safeImg(item.image)?`<img src="${esc(pathImage(item.image))}" alt="Vista previa">`:'<span>Seleccioná una imagen para la portada</span>'}</div><input type="file" id="imageUpload" accept="image/png,image/jpeg,image/webp"><span class="file-help">Se optimiza automáticamente como WebP. Recomendado: hasta 4 MB de archivo original. En modo GitHub se sube al repositorio.</span></div>`;
let fields='';
if(type==='service')fields=input('title','Nombre del servicio',item.title||'','text',true)+area('description','Descripción del servicio',item.description||'',4);
if(type==='event')fields=input('title','Título del evento',item.title||'','text',true)+input('category','Categoría (eventos, audiovisual, estudio)',item.category||'eventos')+input('date','Fecha del evento',item.date||'','date')+area('description','Descripción del proyecto',item.description||'',4)+image+`<div class="field"><label>Galería complementaria</label><input type="file" id="galleryUpload" accept="image/png,image/jpeg,image/webp" multiple><small>Podés elegir varias imágenes. Se comprimen y se suben al publicar.</small><div id="galleryPreview" class="gallery-preview"></div></div>`+check;
if(type==='brand')fields=input('name','Nombre de la marca',item.name||'','text',true)+input('website','Sitio web (https://)',item.website||'','url')+image+check;
if(type==='package')fields=input('title','Nombre del paquete',item.title||'','text',true)+area('description','Descripción comercial',item.description||'')+area('features','Beneficios (uno por línea)',(item.features||[]).join('\n'),7)+check;
if(type==='lead')fields=input('name','Nombre del contacto',item.name||'','text',true)+input('company','Empresa',item.company||'')+input('service','Servicio solicitado',item.service||'')+input('email','Correo',item.email||'','email')+input('phone','Teléfono',item.phone||'')+input('date','Fecha',item.date||new Date().toISOString().slice(0,10),'date')+`<div class="field"><label>Estado</label><select name="status">${['Pendiente','Contactado','Cotizado','Aprobado','Rechazado'].map(s=>`<option ${item.status===s?'selected':''}>${s}</option>`).join('')}</select></div>`+area('notes','Notas privadas de seguimiento',item.notes||'');
$('#modalFields').innerHTML=fields;$('#modalOverlay').classList.add('open');$('#modalOverlay').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';setTimeout(()=>$('#modalFields input:not([type="file"])')?.focus(),30);
if(type==='event') {$('#galleryPreview').innerHTML=(item.gallery||[]).filter(safeImg).map(image=>`<img src="${esc(pathImage(image))}" alt="Foto de galería">`).join('');$('#galleryUpload').addEventListener('change',async e=>{const files=Array.from(e.target.files||[]).slice(0,12);try{modalGalleryData=await Promise.all(files.map(compressImage));$('#galleryPreview').innerHTML=[...(item.gallery||[]),...modalGalleryData].filter(safeImg).map(image=>`<img src="${esc(pathImage(image))}" alt="Foto de galería">`).join('');notify(`${files.length} fotos preparadas para publicar.`);}catch(error){notify(error.message)}});}
if(type==='event'||type==='brand') $('#imageUpload').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{modalImageData=await compressImage(file);$('#filePreview').innerHTML=`<img src="${modalImageData}" alt="Imagen a publicar">`;notify('Imagen preparada. Guardá el borrador y después publicalo en GitHub.');}catch(error){notify(error.message||'No pudimos procesar esta imagen');}});
}
function closeModal(){$('#modalOverlay').classList.remove('open');$('#modalOverlay').setAttribute('aria-hidden','true');document.body.style.overflow='';}
function compressImage(file){return new Promise((resolve,reject)=>{if(!/^image\/(jpeg|png|webp)$/.test(file.type))return reject(Error('Usá imágenes JPG, PNG o WebP.'));if(file.size>5*1024*1024)return reject(Error('La imagen supera 5 MB.'));const reader=new FileReader();reader.onerror=()=>reject(Error('No se pudo leer la imagen'));reader.onload=()=>{const im=new Image();im.onerror=()=>reject(Error('Imagen incompatible'));im.onload=()=>{const ratio=Math.min(1,1600/Math.max(im.width,im.height));const can=document.createElement('canvas');can.width=Math.max(1,Math.round(im.width*ratio));can.height=Math.max(1,Math.round(im.height*ratio));can.getContext('2d').drawImage(im,0,0,can.width,can.height);const data=can.toDataURL('image/webp',.82);if(data.length>2.7e6)return reject(Error('La imagen comprimida es muy grande. Usá otra de menor tamaño.'));resolve(data);};im.src=reader.result;};reader.readAsDataURL(file);});}
async function saveModal(e){e.preventDefault();const vals=Object.fromEntries(new FormData($('#modalForm')).entries()), pl={...vals};const existing=modalType==='lead'?leads.find(x=>x.id===modalId):(content[{event:'events',brand:'brands',package:'packages',service:'services'}[modalType]]||[]).find(x=>x.id===modalId);
const obj={...(existing||{}),id:existing?.id||uid()};if(modalType==='event'){obj.title=pl.title.trim();obj.category=(pl.category||'eventos').trim().toLowerCase();obj.date=pl.date;obj.description=pl.description||'';obj.active=pl.active==='on';obj.image=modalImageData||existing?.image||'';obj.gallery=[...(existing?.gallery||[]),...modalGalleryData];if(!['eventos','audiovisual','estudio'].includes(obj.category)){notify('Usá eventos, audiovisual o estudio como categoría.');return;}}
if(modalType==='brand'){obj.name=pl.name.trim();obj.website=pl.website||'';obj.active=pl.active==='on';obj.image=modalImageData||existing?.image||'';if(obj.website&&!safeLink(obj.website)){notify('Usá una URL HTTPS para la marca.');return;}}
if(modalType==='service'){obj.title=pl.title.trim();obj.description=pl.description||'';obj.active=true;}
if(modalType==='package'){obj.title=pl.title.trim();obj.description=pl.description||'';obj.features=(pl.features||'').split('\n').map(x=>x.trim()).filter(Boolean);obj.active=pl.active==='on';}
if(modalType==='lead'){for(const k of ['name','company','service','email','phone','date','status','notes'])obj[k]=pl[k]||'';}
if(modalType==='lead'){try{await BTSLeads.save(obj,existing?.id||null);await reloadLeads();closeModal();notify('Solicitud guardada en Supabase.');}catch(error){notify('No se pudo guardar: '+error.message);}return;}
else{const group=content[{event:'events',brand:'brands',package:'packages',service:'services'}[modalType]];const idx=group.findIndex(x=>x.id===obj.id);if(idx>=0)group[idx]=obj;else group.unshift(obj);localSet(LS_DRAFT,content);renderAll();}
closeModal();notify('Cambios guardados como borrador. Para mostrarlos a los visitantes, publicá en GitHub.');}
async function deleteModal(){if(!modalId||!confirm('¿Eliminar este registro del panel?'))return;if(modalType==='lead'){try{await BTSLeads.remove(modalId);await reloadLeads();closeModal();notify('Solicitud eliminada de Supabase.');}catch(error){notify('No se pudo eliminar: '+error.message);}return;}else{const k={event:'events',brand:'brands',package:'packages',service:'services'}[modalType];content[k]=content[k].filter(x=>x.id!==modalId);localSet(LS_DRAFT,content);renderAll();}closeModal();notify('Elemento eliminado del borrador.');}
function csvEscape(v){return '"'+String(v||'').replace(/"/g,'""')+'"';}
function download(name,body,type='application/json'){const blob=new Blob([body],{type:type+';charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function parseCSV(txt){const rows=[],r=[],data=txt.replace(/^\uFEFF/,'');const delimiter=(data.split(/\r?\n/)[0].match(/;/g)||[]).length>(data.split(/\r?\n/)[0].match(/,/g)||[]).length?';':',';let cell='',inside=false;for(let i=0;i<data.length;i++){let c=data[i];if(c==='"'){if(inside&&data[i+1]==='"'){cell+='"';i++;}else inside=!inside;}else if(c===delimiter&&!inside){r.push(cell);cell='';}else if((c==='\r'||c==='\n')&&!inside){if(c==='\r'&&data[i+1]==='\n')i++;r.push(cell);cell='';if(r.some(x=>x.trim()))rows.push(r.splice(0));else r.length=0;}else cell+=c;}r.push(cell);if(r.some(x=>x.trim()))rows.push(r);return rows;}
async function importLeads(file){const rows=parseCSV(await file.text());if(rows.length<2)throw Error('El archivo CSV no contiene filas de datos.');const hdr=rows.shift().map(x=>x.trim().toLowerCase());const data=rows.map(r=>{const obj={};hdr.forEach((x,i)=>obj[x]=r[i]||'');return obj;}).map(o=>({id:uid(),name:o.nombre||o.name||'',company:o.empresa||o.company||'',service:o.servicio||o.service||'',email:o.correo||o.email||'',phone:o.telefono||o.phone||'',date:o.fecha||o.date||new Date().toISOString().slice(0,10),status:['Pendiente','Contactado','Cotizado','Aprobado','Rechazado'].includes(o.estado||o.status)?o.estado||o.status:'Pendiente',notes:o.notas||o.notes||''})).filter(x=>x.name);await BTSLeads.importRows(data);await reloadLeads();notify(`Importados ${data.length} contactos en Supabase.`);}
// --- GitHub Contents API. Token is held ONLY in JS memory while this tab is open. ---
function repoFields(){repo={owner:'rocket20',name:'BTS',branch:'main'};status();}
function checkRepo(){if(!/^[a-z\d-]{1,39}$/i.test(repo.owner)||!/^[a-z\d_.-]{1,100}$/i.test(repo.name)||!repo.branch||repo.branch.includes('..'))throw Error('Completá el usuario, repositorio y rama correctamente.');if(!token)throw Error('Para publicar desde este panel debés ingresar un token de GitHub con permiso Contents: Read and write para rocket20/BTS. Supabase no autoriza la publicación en GitHub.');}
const ghUrl=p=>`https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/contents/${p.split('/').map(encodeURIComponent).join('/')}`;
async function githubRequest(url,method='GET',body){const res=await fetch(url,{method,headers:{'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Authorization':'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const text=await res.text();let json={};try{json=JSON.parse(text)}catch{}if(!res.ok){let why=json.message||('HTTP '+res.status);if(res.status===401)why='Token inválido o expirado';if(res.status===403)why='Token sin permiso o límite de GitHub';if(res.status===404)why='Repositorio/rama no encontrados o sin permisos';throw Error(why);}return json;}
async function getSha(path){try{const r=await githubRequest(ghUrl(path)+'?ref='+encodeURIComponent(repo.branch));return r.sha||null;}catch(err){if(/not found|no encontrados|HTTP 404/i.test(err.message))return null;throw err;}}
function toBase64Unicode(value){const bytes=new TextEncoder().encode(value);let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(binary);}
function fromBase64Unicode(value){const binary=atob(value.replace(/\s/g,''));const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes);}
async function putGitHubFile(path,base64,message){return await BTSLeads.invokePublisher({action:'put_file',path,content:base64,message});}
async function testConnection(){repoFields();$('#testRepo').disabled=true;try{const meta=await BTSLeads.invokePublisher({action:'status'});notify('Conexión segura con '+meta.repo+' lista para publicar.');$('#repoStatus').textContent='Conectado';}finally{$('#testRepo').disabled=false;status();}}
async function publish(){repoFields();
const button=$('#publishTop'),prev=button.textContent;button.disabled=true;button.textContent='Publicando...';try{
const next=copy(content);for(const group of ['events','brands'])for(const obj of next[group])if(obj.image&&obj.image.startsWith('data:image/')){
const m=obj.image.match(/^data:image\/(webp|jpeg|png);base64,(.+)$/);if(!m)throw Error('Imagen no compatible en '+(obj.title||obj.name));
const id=String(obj.id||uid()).replace(/[^\w-]/g,'');const extension=m[1]==='jpeg'?'jpg':m[1];const path=`assets/uploads/${group}-${id}-${Date.now()}.${extension}`;
await putGitHubFile(path,m[2],`BTS Studio: imagen ${obj.title||obj.name}`);obj.image=path;
}
for(const obj of next.events){if(!Array.isArray(obj.gallery))continue;for(let i=0;i<obj.gallery.length;i++){const data=obj.gallery[i];if(!data||!data.startsWith('data:image/'))continue;const m=data.match(/^data:image\/(webp|jpeg|png);base64,(.+)$/);if(!m)throw Error('Foto de galería incompatible');const ext=m[1]==='jpeg'?'jpg':m[1];const filename=`assets/uploads/galeria-${String(obj.id).replace(/[^\w-]/g,'')}-${Date.now()}-${i}.${ext}`;await putGitHubFile(filename,m[2],`BTS Studio: galería ${obj.title}`);obj.gallery[i]=filename;}}
next.updatedAt=new Date().toISOString();next.version=1;
await putGitHubFile('data/bts-content.json',toBase64Unicode(JSON.stringify(next,null,2)),'BTS Studio: publicar contenido del dashboard');
content=next;localSet(LS_DRAFT,content);renderAll();notify('¡Contenido enviado a GitHub! Pages podría tardar unos instantes en mostrar los cambios.');
}catch(e){console.error(e);notify('No se pudo publicar: '+e.message);}finally{button.disabled=false;button.textContent=prev;}}
async function loadPublished(){try{let d;{const r=await fetch('../data/bts-content.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Archivo público no disponible');d=await r.json();}if(localStorage.getItem(LS_DRAFT)&&!confirm('Esto sustituirá tu borrador local por el contenido publicado. ¿Continuar?'))return;content=normalize(d);localSet(LS_DRAFT,content);renderAll();notify('Contenido publicado cargado.');}catch(e){notify('Error cargando el sitio: '+e.message);}}
function bind(){
$('.sidebar nav').addEventListener('click',e=>{const n=e.target.closest('.nav-item');if(n)navigate(n.dataset.page);});$$('[data-goto]').forEach(n=>n.addEventListener('click',()=>navigate(n.dataset.goto)));
$('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#saveDraftTop').addEventListener('click',storeDraft);$('#publishTop').addEventListener('click',publish);$('#publishSettings').addEventListener('click',publish);$('#testRepo').addEventListener('click',()=>testConnection().catch(e=>notify('Conexión fallida: '+e.message)));

$('#newEvent').addEventListener('click',()=>openModal('event'));$('#newBrand').addEventListener('click',()=>openModal('brand'));$('#newLead').addEventListener('click',()=>openModal('lead'));
document.addEventListener('click',e=>{const target=e.target.closest('.edit-item,[data-new]');if(target)openModal(target.dataset.type||target.dataset.new,target.dataset.id||'');});
$('#modalClose').addEventListener('click',closeModal);$('#modalCancel').addEventListener('click',closeModal);$('#modalDelete').addEventListener('click',deleteModal);$('#modalOverlay').addEventListener('click',e=>{if(e.target===$('#modalOverlay'))closeModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});$('#modalForm').addEventListener('submit',saveModal);
$('#leadSearch').addEventListener('input',renderLeads);$('#leadFilter').addEventListener('change',renderLeads);
$('#exportLeads').addEventListener('click',()=>{const heads=['nombre','empresa','servicio','correo','telefono','fecha','estado','notas'],keys=['name','company','service','email','phone','date','status','notes'];download('BTS_Studio_Clientes.csv','\uFEFF'+[heads.join(','),...leads.map(l=>keys.map(k=>csvEscape(l[k])).join(','))].join('\r\n'),'text/csv');});
$('#csvInput').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{await importLeads(f)}catch(err){notify(err.message)}e.target.value='';});
$('#contentForm').addEventListener('submit',e=>{e.preventDefault();const brand={...content.brand,heroTitle:$('#brandHeroTitle').value,heroSubtitle:$('#brandHeroSubtitle').value,contactEmail:$('#brandEmail').value.trim(),whatsapp:$('#brandWhatsapp').value.replace(/\D/g,''),instagram:$('#brandInstagram').value.trim(),analyticsId:$('#brandAnalytics').value.trim().toUpperCase()};if(brand.analyticsId&&!/^G-[A-Z0-9]{5,20}$/.test(brand.analyticsId)){notify('El ID de Analytics debe tener formato G-XXXXXXXXXX');return;}if(brand.instagram&&!safeLink(brand.instagram)){notify('Instagram debe empezar con https://');return;}content.brand=brand;storeDraft();status();});
$('#exportContent').addEventListener('click',()=>download('BTS_Studio_Contenido.json',JSON.stringify(content,null,2)));
$('#importContent').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{content=normalize(JSON.parse(await f.text()));storeDraft();renderAll();notify('JSON importado correctamente.');}catch{notify('No se pudo importar el JSON. Verificá el archivo.')}e.target.value='';});
$('#resetDraft').addEventListener('click',async()=>{if(!confirm('¿Descartar los cambios locales sin publicar?'))return;localStorage.removeItem(LS_DRAFT);try{const r=await fetch('../data/bts-content.json?t='+Date.now());content=normalize(await r.json());}catch{content=copy(blank)}renderAll();notify('Borrador local descartado.');});
$('#loadPublished').addEventListener('click',loadPublished);
}
async function init(){repo=localGet(LS_REPO,repo);if(!repo.owner&&!repo.name)repo={owner:'rocket20',name:'BTS',branch:'main'};leads=[];const draft=localGet(LS_DRAFT,null);if(draft){content=normalize(draft);}else{try{const r=await fetch('../data/bts-content.json?t='+Date.now(),{cache:'no-store'});if(r.ok)content=normalize(await r.json());}catch{content=normalize(blank);}}
bind();$('#todayLabel').textContent=new Intl.DateTimeFormat('es-NI',{dateStyle:'long'}).format(new Date());renderAll();fillRepo();await BTSLeads.bootstrap(reloadLeads);await Promise.allSettled([updateGoogleMetrics(),updateWhatsappClicks()]);}
init();
})();
