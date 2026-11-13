/* BTS Studio: representación consistente de tarjetas VIP y fidelización. */
(()=>{'use strict';
const BASE='https://xwehejgwufwhpkpzjzyt.supabase.co';
const bucket='bts-nfc-media';
const defaults={card_gradient_enabled:false,card_gradient_from:'#22242f',card_gradient_to:'#16171f',card_gradient_angle:145,card_logo_path:null,card_logo_opacity:.16,card_logo_scale:72,card_text_color:'light'};
const pathPattern=/^businesses\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-f0-9]{32}\.(?:png|jpg|jpeg|webp)$/;
const hex=/^#[a-f0-9]{6}$/i;
const clamp=(num,lower,upper,backup)=>Number.isFinite(Number(num))?Math.min(upper,Math.max(lower,Number(num))):backup;
function normalize(source={}){
 const d={...defaults,...source};
 return {
  card_gradient_enabled:d.card_gradient_enabled===true||d.card_gradient_enabled==='true',
  card_gradient_from:hex.test(d.card_gradient_from)?d.card_gradient_from:defaults.card_gradient_from,
  card_gradient_to:hex.test(d.card_gradient_to)?d.card_gradient_to:defaults.card_gradient_to,
  card_gradient_angle:Math.round(clamp(d.card_gradient_angle,0,360,145)),
  card_logo_path:typeof d.card_logo_path==='string'&&pathPattern.test(d.card_logo_path)?d.card_logo_path:null,
  card_logo_opacity:clamp(d.card_logo_opacity,.05,.40,.16),
  card_logo_scale:Math.round(clamp(d.card_logo_scale,30,95,72)),
  card_text_color:d.card_text_color==='dark'?'dark':'light'
 };
}
function imageURL(path){
 if(!pathPattern.test(String(path||'')))return null;
 return BASE+'/storage/v1/object/public/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/');
}
function apply(card,design){
 if(!card)return;
 const d=normalize(design),mark=card.querySelector('.bts-card-watermark');
 if(d.card_gradient_enabled){
  card.style.background='linear-gradient('+d.card_gradient_angle+'deg,'+d.card_gradient_from+','+d.card_gradient_to+')';
  card.style.color=d.card_text_color==='light'?'#ffffff':'#171822';
  card.classList.add('bts-card-custom');
 }else{
  card.style.removeProperty('background');card.style.removeProperty('color');
  card.classList.remove('bts-card-custom');
 }
 if(mark)mark.remove();
 const url=imageURL(d.card_logo_path);
 if(url){
  const overlay=document.createElement('div');overlay.className='bts-card-watermark';overlay.setAttribute('aria-hidden','true');
  overlay.style.backgroundImage='url("'+url+'")';
  overlay.style.backgroundSize=d.card_logo_scale+'% auto';
  overlay.style.opacity=String(d.card_logo_opacity);
  card.prepend(overlay);
 }
}
function designFieldsFromForm(prefix,program){
 const get=id=>document.getElementById(prefix+id);
 return {
 card_gradient_enabled:get('Enabled').checked,
 card_gradient_from:get('From').value,
 card_gradient_to:get('To').value,
 card_gradient_angle:Number(get('Angle').value),
 card_logo_path:program?.card_logo_path||null,
 card_logo_opacity:Number(get('Opacity').value),
 card_logo_scale:Number(get('Scale').value),
 card_text_color:get('Text').value
 };
}
function fillForm(prefix,design){
 const d=normalize(design),get=id=>document.getElementById(prefix+id);
 for(const [id,value] of [['Enabled',d.card_gradient_enabled],['From',d.card_gradient_from],['To',d.card_gradient_to],['Angle',d.card_gradient_angle],['Opacity',d.card_logo_opacity],['Scale',d.card_logo_scale],['Text',d.card_text_color]]){
  if(get(id)){if(id==='Enabled')get(id).checked=value;else get(id).value=value}
 }
}
async function upload({file,businessId,accessToken,userId}){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Elegí PNG, JPG o WEBP para el logo.');
 if(file.size<1||file.size>4*1024*1024)throw Error('El logo debe pesar menos de 4 MB.');
 if(!/^[0-9a-f-]{36}$/.test(businessId)||!/^[0-9a-f-]{36}$/.test(userId))throw Error('La empresa o sesión no es válida.');
 const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
 const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
 const nonce=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const path='businesses/'+businessId+'/'+userId+'/'+nonce+'.'+ext;
 const r=await fetch(BASE+'/storage/v1/object/'+bucket+'/'+path,{
  method:'POST',headers:{Authorization:'Bearer '+accessToken,apikey:'sb_publishable_0LR-LUDY7NjJaK5K3qtxPg_1aLupDVz','Content-Type':file.type,'x-upsert':'false'},
  body:file,cache:'no-store'});
 if(!r.ok){const data=await r.json().catch(()=>({}));throw Error(data.message||data.error||'No se pudo subir el logo.')}
 return path;
}
window.BTSCardDesign=Object.freeze({defaults,normalize,apply,imageURL,fillForm,designFieldsFromForm,upload});
})();
