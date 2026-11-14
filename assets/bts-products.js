
/* BTS Studio · carrusel de productos corporativos */
(()=>{
"use strict";
const root=document.getElementById("btsProductShowcase");
if(!root)return;
const track=root.querySelector("#bpsTrack"),count=root.querySelector("#bpsCounter"),prev=root.querySelector("#bpsPrev"),next=root.querySelector("#bpsNext"),dots=root.querySelector("#bpsDots");
const slides=[
 {type:"vip",className:"vip",number:"01 / 03",title:"Tarjetas VIP<br>para tu empresa.",description:"Dale a tus clientes una experiencia exclusiva. Diseñá membresías y beneficios con una presentación profesional, personalizada con tu marca.",pills:["Beneficios exclusivos","Diseño de ambas caras","Tecnología NFC"],art:'<div class="bps-card back"><span class="brand"><i class="bird"></i><span>BTS<small>STUDIO</small></span></span><span class="card-caption">Tarjeta VIP</span><span class="wire"></span></div><div class="bps-card front"><span class="brand"><i class="bird"></i><span>BTS<small>STUDIO</small></span></span><span class="card-caption">TARJETA <b>VIP</b></span><span class="wire"></span></div>'},
 {type:"fidelizacion",className:"loyalty",number:"02 / 03",title:"Fidelización que<br>hace regresar.",description:"Convertí cada compra en una oportunidad para premiar la preferencia de tus clientes, con progresos y recompensas que tu empresa controla.",pills:["Metas de compras o puntos","Recompensas","Registro digital"],art:'<div class="bps-card back"><span class="card-caption">ACUMULÁ PUNTOS</span><span class="loyalty-dots"><i>✦</i><i>✦</i><i>✦</i><i>✦</i><i>★</i></span><span class="card-caption">5 puntos = 1 recompensa</span></div><div class="bps-card front"><span class="brand"><i class="bird"></i><span>BTS<small>STUDIO</small></span></span><span class="card-caption">TARJETA DE FIDELIZACIÓN</span><span class="wire"></span></div>'},
 {type:"gafete",className:"badge",number:"03 / 03",title:"Gafetes<br>corporativos.",description:"Identificá a tu equipo con credenciales elegantes para eventos, producción y empresas. Cada gafete puede llevar nombre, cargo, fotografía e identidad visual.",pills:["Personalizado por ejecutivo","Frente y reverso","Opciones NFC / QR"],art:'<div class="bps-badge front"><div class="brand"><em>◀</em> BTS</div><div><span class="sub">Carlos Méndez</span><p class="sub">DIRECTOR CREATIVO</p></div><div class="vip">VIP ACCESS</div></div><div class="bps-badge back"><div class="brand"><em>◀</em> BTS</div><div class="sub">STUDIO · EVENTO<br>PRODUCCIÓN · EQUIPO</div></div>'}
];
let active=0, timer=null;
slides.forEach((item,index)=>{
 const el=document.createElement("article");el.className="bps-slide bps-slide--"+item.className;el.setAttribute("aria-roledescription","diapositiva");el.setAttribute("aria-label",item.number);
 el.innerHTML='<div class="bps-slide-copy"><span class="bps-slide-index">BTS STUDIO / '+item.number+'</span><h3>'+item.title+'</h3><p>'+item.description+'</p><div class="bps-pill-list">'+item.pills.map(p=>"<span>"+p+"</span>").join("")+'</div><div class="bps-actions"><a class="bps-btn" href="cotizar-tarjeta/?tipo='+item.type+'">Solicitar cotización ↗</a><a class="bps-btn ghost" href="mockup/?tipo='+item.type+'">Ver demo ↗</a></div></div><div class="bps-art bps-art--'+item.className+'" aria-label="Representación visual de '+item.type+'">'+item.art+'</div>';
 track.appendChild(el);
 const dot=document.createElement("button");dot.type="button";dot.className="bps-dot";dot.setAttribute("aria-label","Ver producto "+(index+1));dot.addEventListener("click",()=>go(index));dots.appendChild(dot);
});
function go(index){active=(index+slides.length)%slides.length;track.style.transform="translateX(-"+(active*100)+"%)";count.textContent=String(active+1).padStart(2,"0")+" / 03";prev.disabled=active===0;next.disabled=active===slides.length-1;[...dots.children].forEach((dot,i)=>dot.setAttribute("aria-current",String(i===active)));[...track.children].forEach((slide,i)=>slide.setAttribute("aria-hidden",String(i!==active)));restart();}
function restart(){clearInterval(timer);if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;timer=setInterval(()=>{if(document.hidden||root.matches(":hover")||root.contains(document.activeElement))return;go((active+1)%slides.length);},7200);}
prev.addEventListener("click",()=>go(active-1));next.addEventListener("click",()=>go(active+1));root.addEventListener("keydown",e=>{if(!root.contains(document.activeElement))return;if(e.key==="ArrowRight"){e.preventDefault();go(Math.min(slides.length-1,active+1));}if(e.key==="ArrowLeft"){e.preventDefault();go(Math.max(0,active-1));}});go(0);
})();
