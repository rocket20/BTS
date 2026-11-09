/* BTS Studio NFC empresarial
 * Previews web (900px) y teléfono (360px), usando el renderizador real de /nfc/.
 * Se alimentan de datos de la empresa y sus ejecutivos; no publican ni cobran.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const selector=$('designFor'),desktop=$('designDesktopFrame'),mobile=$('designMobileFrame');
if(!selector||!desktop||!mobile)return;
const SAMPLE_COMPANY={
 slug:'empresa-ejemplo',business_name:'Grupo Ejemplo',
 tagline:'Soluciones profesionales para personas y empresas.',
 avatar_url:'',background_url:'',background_color:'#111315',accent_color:'#7a858f',
 button_bg_color:'#1d2226',button_text_color:'#f5f7f9',button_border_color:'#343c41',
 template_id:'business',theme_options:{font:'modern',shape:'soft',align:'left',icons:'mono',textColor:'#f5f6f8',surfaceColor:'#1b1f22',role:'Empresa',location:'Nicaragua'},
 links:[{type:'website',label:'Sitio web corporativo',url:'https://example.com'},
 {type:'whatsapp',label:'Contacto comercial',url:'https://example.com/contacto'}]
};
const EXAMPLE_PERSON={full_name:'María López',job_title:'Asesora comercial',whatsapp_number:'',phone_number:'',email:'',avatar_url:'',extra_links:[]};
let ready=new Set();
function getData(){try{return window.BTSNFCPreviewData?.()||{};}catch{return {};}}
function cardBase(company){
 const c=company||SAMPLE_COMPANY;
 const opt=c.theme_options&&typeof c.theme_options==='object'&&!Array.isArray(c.theme_options)?c.theme_options:{};
 return {...SAMPLE_COMPANY,...c,template_id:'business',theme_options:{...SAMPLE_COMPANY.theme_options,...opt}};
}
function cardForExecutive(company,employee){
 const c=cardBase(company),p=employee||EXAMPLE_PERSON;
 const filtered=(Array.isArray(c.links)?c.links:[]).filter(l=>l.type!=='whatsapp');
 const individual=Array.isArray(p.extra_links)?p.extra_links:[];
 const phone=String(p.whatsapp_number||'').replace(/\D/g,'');
 const whatsapp={type:'whatsapp',label:'WhatsApp de '+p.full_name,url:phone?'https://wa.me/'+phone:'https://example.com/contacto'};
 const opt=c.theme_options||{};
 return {...c,
 business_name:p.full_name,
 tagline:[p.job_title,c.business_name].filter(Boolean).join(' · '),
 avatar_url:p.avatar_url||'',is_executive:true,
 links:[whatsapp,...individual,...filtered].slice(0,15),
 theme_options:{...opt,role:p.job_title||'Asesor comercial',phone:p.phone_number||p.whatsapp_number||'',email:p.email||'',tags:opt.tags||''}
 };
}
function resizeFrames(){
 for(const [container,iframe,viewportWidth,viewportHeight] of [
  [$('designDesktop'),desktop,900,770],
  [$('designMobile'),mobile,360,800]
 ]){
  if(!container||!iframe)return;
  const availableWidth=Math.max(180,container.clientWidth-12);
  const scale=Math.min(1,availableWidth/viewportWidth);
  iframe.style.transform='scale('+scale.toFixed(5)+')';
  container.style.height=Math.ceil(viewportHeight*scale+12)+'px';
 }
}
function sync(){
 const {company,people=[],pricing,draftExecutive}=getData();
 const options=[{value:'company',text:'Empresa principal'}];
 if(!people.length)options.push({value:'sample',text:'Ejecutivo de ejemplo'});
 if(draftExecutive)options.push({value:'draft',text:'Edición actual · '+(draftExecutive.full_name||'Ejecutivo')});
 else for(const p of people)options.push({value:p.id,text:p.full_name+(p.is_active?'':' (suspendido)')});
 const prev=selector.value;
 selector.replaceChildren();
 for(const option of options){const el=document.createElement('option');el.value=option.value;el.textContent=option.text;selector.append(el);}
 selector.value=options.some(o=>o.value===prev)?prev:'company';
 $('designStatus').textContent=company
  ?'Datos reales de '+company.business_name+'. Seleccioná un ejecutivo para comprobar su diseño.'
  :'Ejemplo visual ficticio. Todavía no hay una empresa seleccionada.';
 const original=cardBase(company);
 const selected=selector.value==='draft'?draftExecutive:people.find(p=>p.id===selector.value);
 const card=selector.value==='company'?original:cardForExecutive(company,selected||EXAMPLE_PERSON);
 resizeFrames();
 for(const frame of [desktop,mobile]){
  if(frame.contentWindow)frame.contentWindow.postMessage({source:'bts-nfc-editor-preview',card},location.origin);
 }
 // Tarifas se leen de la configuración persistida y no representan facturas emitidas.
 const sum=$('nfcEstimatedTotal'),detail=$('nfcEstimateDetail');
 if(!pricing){
  sum.textContent='Sin tarifas guardadas';
  detail.textContent='Registrá el precio del diseño y de cada NFC para mostrar el presupuesto orientativo.';
 }else{
  const currency=pricing.currency==='NIO'?'C$':'$';
  const design=Number(pricing.design_fee)||0,unit=Number(pricing.price_per_card)||0;
  const n=people.length,total=design+n*unit;
  const format=amount=>new Intl.NumberFormat('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2}).format(amount);
  sum.textContent=currency+format(total);
  detail.textContent=currency+format(design)+' diseño + '+n+' NFC × '+currency+format(unit);
 }
}
selector.addEventListener('change',sync);
window.addEventListener('bts-nfc-corporate-data',sync);
window.addEventListener('bts-nfc-executive-portrait-changed',()=>{
 if(getData().draftExecutive)selector.value='draft';
 sync();
});
for(const frame of [desktop,mobile]){
 frame.addEventListener('load',()=>{ready.add(frame);sync();});
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.data?.source!=='bts-nfc-preview-ready')return;
 if([desktop,mobile].some(f=>f.contentWindow===event.source))sync();
});
if(typeof ResizeObserver!=='undefined'){
 const observer=new ResizeObserver(resizeFrames);
 observer.observe($('designDesktop'));observer.observe($('designMobile'));
}
sync();
})();