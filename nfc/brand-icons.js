/* Logotipos originales de marcas: Simple Icons (SVG oficiales, sin íconos inventados). */
(()=>{'use strict';
const slugs={instagram:'instagram',facebook:'facebook',tiktok:'tiktok',whatsapp:'whatsapp',youtube:'youtube',linkedin:'linkedin',x:'x',telegram:'telegram',maps:'googlemaps',pinterest:'pinterest',spotify:'spotify',threads:'threads',snapchat:'snapchat',behance:'behance',github:'github',discord:'discord'};
const names={instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',whatsapp:'WhatsApp',youtube:'YouTube',linkedin:'LinkedIn',x:'X',telegram:'Telegram',maps:'Google Maps',pinterest:'Pinterest',spotify:'Spotify',threads:'Threads',snapchat:'Snapchat',behance:'Behance',github:'GitHub',discord:'Discord',website:'Sitio web',other:'Enlace'};
const fallback={website:'🌐',other:'↗'};
function set(container,type){
 const name=String(type||'other').toLowerCase();
 container.classList.add('nfc-brand');
 container.replaceChildren();
 const img=document.createElement('img');
 const slug=slugs[name]; 
 if(!slug){
  const label=document.createElement('span');label.textContent=fallback[name]||'↗';label.setAttribute('aria-hidden','true');container.append(label);return;
 }
 img.src='https://cdn.simpleicons.org/'+slug;
 img.alt='';img.loading='lazy';img.decoding='async';
 img.onerror=()=>{img.remove();const f=document.createElement('span');f.textContent=(names[name]||'↗').slice(0,2);f.setAttribute('aria-hidden','true');container.append(f);};
 container.append(img);
}
window.BTSIcons={set,names,types:Object.keys(slugs).concat(['website','other'])};
})();