
/* BTS Studio · carrusel de productos corporativos */
(()=>{
"use strict";
const root=document.getElementById("productos-corporativos");
if(!root)return;
const track=root.querySelector("#bpsTrack"),count=root.querySelector("#bpsCounter"),prev=root.querySelector("#bpsPrev"),next=root.querySelector("#bpsNext"),dots=root.querySelector("#bpsDots");
const slides=[
 {type:"vip",className:"vip",number:"01 / 03",title:"Tarjetas VIP<br>para tu empresa.",description:"Dale a tus clientes una experiencia exclusiva. Diseñá membresías y beneficios con una presentación profesional, personalizada con tu marca.",pills:["Beneficios exclusivos","Diseño de ambas caras","Tecnología NFC"],art:'<img class="bps-banner-image" src="assets/banners/vip.png?v=original-20261114" decoding="async" alt="Diseño original BTS Studio de tarjeta VIP" loading="lazy">'},
 {type:"fidelizacion",className:"loyalty",number:"02 / 03",title:"Fidelización que<br>hace regresar.",description:"Convertí cada compra en una oportunidad para premiar la preferencia de tus clientes, con progresos y recompensas que tu empresa controla.",pills:["Metas de compras o puntos","Recompensas","Registro digital"],art:'<img class="bps-banner-image" src="assets/banners/fidelizacion.png?v=original-20261114" decoding="async" alt="Diseño original BTS Studio de tarjeta de fidelización" loading="lazy">'},
 {type:"gafete",className:"badge",number:"03 / 03",title:"Gafetes<br>corporativos.",description:"Identificá a tu equipo con credenciales elegantes para eventos, producción y empresas. Cada gafete puede llevar nombre, cargo, fotografía e identidad visual.",pills:["Personalizado por ejecutivo","Frente y reverso","Opciones NFC / QR"],art:'<img class="bps-banner-image" src="assets/banners/gafetes.png?v=original-20261114" decoding="async" alt="Diseño original BTS Studio de gafetes corporativos" loading="lazy">'}
];
let active=0, timer=null;
slides.forEach((item,index)=>{
 const el=document.createElement("article");el.className="bps-slide bps-slide--"+item.className;el.setAttribute("aria-roledescription","diapositiva");el.setAttribute("aria-label",item.number);
 el.innerHTML='<div class="bps-slide-copy"><h3>'+item.title+'</h3><p>'+item.description+'</p><div class="bps-actions"><a class="bps-btn" href="cotizar-tarjeta/?tipo='+item.type+'">Solicitar cotización ↗</a><a class="bps-btn ghost" href="mockup/?tipo='+item.type+'">Ver demo ↗</a></div></div><div class="bps-art bps-art--'+item.className+'" aria-label="Representación visual de '+item.type+'">'+item.art+'</div>';
 track.appendChild(el);
 const dot=document.createElement("button");dot.type="button";dot.className="bps-dot";dot.setAttribute("aria-label","Ver producto "+(index+1));dot.addEventListener("click",()=>go(index));dots.appendChild(dot);
});
function go(index){active=(index+slides.length)%slides.length;track.style.transform="translateX(-"+(active*100)+"%)";count.textContent=String(active+1).padStart(2,"0")+" / 03";prev.disabled=active===0;next.disabled=active===slides.length-1;[...dots.children].forEach((dot,i)=>dot.setAttribute("aria-current",String(i===active)));[...track.children].forEach((slide,i)=>slide.setAttribute("aria-hidden",String(i!==active)));restart();}
function restart(){clearInterval(timer);if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;timer=setInterval(()=>{if(document.hidden||root.matches(":hover")||root.contains(document.activeElement))return;go((active+1)%slides.length);},7200);}
prev.addEventListener("click",()=>go(active-1));next.addEventListener("click",()=>go(active+1));root.addEventListener("keydown",e=>{if(!root.contains(document.activeElement))return;if(e.key==="ArrowRight"){e.preventDefault();go(Math.min(slides.length-1,active+1));}if(e.key==="ArrowLeft"){e.preventDefault();go(Math.max(0,active-1));}});go(0);
})();
