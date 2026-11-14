/* BTS Studio · cinematic intro with original transparent animated logo */
(()=>{
 "use strict";
 const loader=document.getElementById("btsIntroLoader");
 if(!loader)return;
 loader.classList.add("bts-cinematic-loader");
 const rings=document.createElement("div");
 rings.className="bts-cine-orbits";
 rings.setAttribute("aria-hidden","true");
 ["outer","main","inner"].forEach(t=>{
  const e=document.createElement("div");
  e.className="bts-cine-ring bts-cine-ring--"+t;
  rings.appendChild(e);
 });
 loader.prepend(rings);
 const stage=loader.querySelector(".bts-loader-stage");
 const label=document.createElement("span");
 label.className="bts-cine-loading-label";
 label.textContent="Cargando experiencia...";
 stage?.appendChild(label);
 const bird=loader.querySelector(".bts-loader-bird");
 if(bird){
  const gif=new Image();
  gif.alt="";
  gif.setAttribute("aria-hidden","true");
  gif.draggable=false;
  gif.decoding="async";
  gif.onload=()=>{if(loader.isConnected)bird.replaceChildren(gif);};
  gif.src="assets/colibri_origami_vuelo_2x.gif?v=original-transparente-20261114";
 }
 const skip=document.getElementById("btsIntroSkip");
 const html=document.documentElement;
 let closed=false;
 let timer=null;
 function finish(){
  if(closed)return;
  closed=true;
  clearTimeout(timer);
  loader.classList.add("is-dismissing");
  loader.setAttribute("aria-hidden","true");
  html.classList.remove("bts-preloading");
  setTimeout(()=>loader.remove(),950);
 }
 skip?.addEventListener("click",finish,{once:true});
 const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
 const admin=location.hash.startsWith("#panel")||location.hash.startsWith("#admin");
 const duration=reduced||admin?250:3050;
 function start(){if(!closed&&timer===null)timer=setTimeout(finish,duration);}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
 window.addEventListener("load",start,{once:true});
 setTimeout(finish,5200);
})();
