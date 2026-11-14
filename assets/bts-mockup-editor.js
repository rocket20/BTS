/* BTS Studio · editor de tarjetas en navegador, sin subir imágenes */
(()=>{
"use strict";
const $=id=>document.getElementById(id),types=["vip","fidelizacion","gafete"];
const typeSelect=$("type");const initial=new URLSearchParams(location.search).get("tipo");
typeSelect.value=types.includes(initial)?initial:"vip";
let type=typeSelect.value,face="front",selected=null,drag=null,serial=0;
const images=new Map(),cards={},buttons={front:$("frontCanvas"),back:$("backCanvas")};
const DPR=1,BASE_W=1000,BASE_H=630;
const isBadge=()=>type==="gafete";
const safeHex=x=>/^#[0-9a-f]{6}$/i.test(x)?x:"#ffffff";
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const uid=()=>++serial;
function size(){return isBadge()?[630,1000]:[BASE_W,BASE_H]}
function defaultLayers(side){
const [w,h]=size();
if(side==="front")return [
{id:uid(),kind:"text",text:"BTS STUDIO",x:Math.round(w*.09),y:Math.round(h*.16),size:isBadge()?65:77,font:"Inter",weight:900,color:"#ffffff",opacity:100,rotation:0,width:Math.round(w*.8),height:104},
{id:uid(),kind:"text",text:type==="vip"?"TARJETA VIP":type==="fidelizacion"?"FIDELIZACIÓN":"GAFETE CORPORATIVO",x:Math.round(w*.09),y:Math.round(h*.73),size:isBadge()?28:37,font:"Inter",weight:600,color:"#f44367",opacity:100,rotation:0,width:Math.round(w*.8),height:65}
];
return [{id:uid(),kind:"text",text:type==="vip"?"BENEFICIOS EXCLUSIVOS":type==="fidelizacion"?"ACUMULÁ PUNTOS":"IDENTIFICACIÓN",x:Math.round(w*.09),y:Math.round(h*.18),size:isBadge()?36:42,font:"Inter",weight:800,color:"#ffffff",opacity:100,rotation:0,width:Math.round(w*.8),height:74},
{id:uid(),kind:"text",text:"DISEÑO PERSONALIZADO",x:Math.round(w*.09),y:Math.round(h*.71),size:isBadge()?23:32,font:"Inter",weight:400,color:"#f7a5b8",opacity:100,rotation:0,width:Math.round(w*.8),height:58}];
}
function createFace(side){return {start:"#222025",end:"#540c22",angle:140,corner:32,zoom:100,mode:"cover",bgUrl:null,layers:defaultLayers(side)}}
function reset(){cards.front=createFace("front");cards.back=createFace("back");selected=null;syncControls();renderAll();}
function current(){return cards[face]}
function currentLayer(){return current().layers.find(l=>l.id===selected)||null}
function revoke(url){if(url&&url.startsWith("blob:"))URL.revokeObjectURL(url)}
function cleanup(){for(const side of ["front","back"]){if(cards[side]){revoke(cards[side].bgUrl);for(const l of cards[side].layers)if(l.url)revoke(l.url)}}}
function notice(s){$("previewNotice").textContent=s}
function hexToRgb(hex){const m=safeHex(hex).match(/[0-9a-f]{2}/ig);return m?m.map(n=>parseInt(n,16)):[255,255,255]}
function rounded(ctx,w,h,r){r=clamp(r,0,Math.min(w,h)/2);ctx.beginPath();ctx.moveTo(r,0);ctx.lineTo(w-r,0);ctx.quadraticCurveTo(w,0,w,r);ctx.lineTo(w,h-r);ctx.quadraticCurveTo(w,h,w-r,h);ctx.lineTo(r,h);ctx.quadraticCurveTo(0,h,0,h-r);ctx.lineTo(0,r);ctx.quadraticCurveTo(0,0,r,0);ctx.closePath()}
function gradient(ctx,card,w,h){const rad=card.angle*Math.PI/180,dx=Math.cos(rad)*w*.5,dy=Math.sin(rad)*h*.5,g=ctx.createLinearGradient(w/2-dx,h/2-dy,w/2+dx,h/2+dy);g.addColorStop(0,card.start);g.addColorStop(1,card.end);return g}
function drawImg(ctx,url,x,y,w,h,mode="cover",zoom=100){const im=images.get(url);if(!im||!im.complete||!im.naturalWidth)return;const scale=(mode==="contain"?Math.min(w/im.naturalWidth,h/im.naturalHeight):Math.max(w/im.naturalWidth,h/im.naturalHeight))*(zoom/100);const iw=im.naturalWidth*scale,ih=im.naturalHeight*scale;ctx.drawImage(im,x+(w-iw)/2,y+(h-ih)/2,iw,ih)}
function drawText(ctx,l){ctx.textBaseline="top";ctx.textAlign="left";ctx.fillStyle=l.color;ctx.font=(l.weight||600)+" "+(l.size||35)+"px "+(l.font==="Georgia"?"Georgia,serif":l.font==="monospace"?"monospace":l.font==="Arial"?"Arial,sans-serif":"Inter,Arial,sans-serif");
const maxWidth=Math.max(10,l.width||400),height=Math.max(10,l.height||100),lineHeight=(l.size||35)*1.15,words=String(l.text||"").split("\n");let lines=[];for(const para of words){if(!para){lines.push("");continue}let line="";for(const word of para.split(/\s+/)){let next=line?line+" "+word:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word}else line=next}lines.push(line)}const limit=Math.floor(height/lineHeight);lines.slice(0,Math.max(1,limit)).forEach((t,i)=>ctx.fillText(t,0,i*lineHeight,maxWidth))}
function drawLayer(ctx,l){ctx.save();ctx.globalAlpha=clamp(l.opacity,0,100)/100;ctx.translate(l.x,l.y);ctx.rotate(l.rotation*Math.PI/180);if(l.kind==="text")drawText(ctx,l);else if(l.kind==="shape"){ctx.fillStyle=l.color;ctx.fillRect(0,0,l.width,l.height)}else if(l.kind==="image")drawImg(ctx,l.url,0,0,l.width,l.height,"contain",100);ctx.restore()}
function renderSide(side,forExport=false){const c=buttons[side],cfg=cards[side],ctx=c.getContext("2d");if(!ctx)return;const [w,h]=size();if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;c.classList.toggle("vertical",isBadge());ctx.clearRect(0,0,w,h);ctx.save();rounded(ctx,w,h,cfg.corner);ctx.clip();ctx.fillStyle=gradient(ctx,cfg,w,h);ctx.fillRect(0,0,w,h);if(cfg.bgUrl)drawImg(ctx,cfg.bgUrl,0,0,w,h,cfg.mode,cfg.zoom);for(const layer of cfg.layers)drawLayer(ctx,layer);ctx.restore();
if(!forExport&&side===face&&selected){const l=currentLayer();if(l){ctx.save();ctx.translate(l.x,l.y);ctx.rotate(l.rotation*Math.PI/180);ctx.strokeStyle="#fa83a1";ctx.lineWidth=3;ctx.setLineDash([10,7]);ctx.strokeRect(-4,-4,Math.max(10,l.width)+8,Math.max(10,l.height)+8);ctx.restore()}}
}
function renderAll(){renderSide("front");renderSide("back");document.querySelectorAll(".face-wrap").forEach(x=>x.classList.toggle("is-active",x.dataset.face===face));}
function layersUI(){const container=$("layers");container.replaceChildren();for(const l of [...current().layers].reverse()){const b=document.createElement("button");b.type="button";b.className="layer";b.dataset.selected=String(l.id===selected);const span=document.createElement("span");span.textContent=(l.kind==="text"?"T · ":"")+(l.kind==="shape"?"Forma":l.kind==="image"?"Logo / imagen":(l.text||"Texto"));const marker=document.createElement("small");marker.textContent=l.kind==="image"?"▧":l.kind==="shape"?"■":"T";b.append(span,marker);b.addEventListener("click",()=>{selected=l.id;syncInspector();renderAll()});container.append(b)}}
function syncInspector(){layersUI();const layer=currentLayer();$("inspector").hidden=!layer;const active=Boolean(layer);["moveUp","moveDown","deleteLayer"].forEach(id=>$(id).disabled=!active);if(!layer)return;
$("textField").hidden=layer.kind!=="text";$("fontField").hidden=layer.kind!=="text";$("weightField").hidden=layer.kind!=="text";
$("layerText").value=layer.text||"";$("layerFont").value=layer.font||"Inter";$("layerWeight").value=String(layer.weight||600);
$("layerColor").value=safeHex(layer.color);$("layerSize").value=layer.size||35;$("layerOpacity").value=layer.opacity;$("layerRotation").value=layer.rotation;$("layerWidth").value=layer.width;$("layerHeight").value=layer.height;
}
function syncControls(){const cfg=current();$("bgStart").value=cfg.start;$("bgEnd").value=cfg.end;$("bgAngle").value=cfg.angle;$("corner").value=cfg.corner;$("bgZoom").value=cfg.zoom;$("bgMode").value=cfg.mode;$("bgImage").value="";$("addImage").value="";
document.querySelectorAll(".face-tab,.preview-tab").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.face===face)));syncInspector();renderAll();}
function changeFace(side){face=side;selected=null;syncControls()}
function addLayer(kind,extras={}){const [w,h]=size();const l={id:uid(),kind,text:kind==="text"?"Tu texto":"",x:Math.round(w*.27),y:Math.round(h*.4),size:52,font:"Inter",weight:800,color:"#ffffff",opacity:100,rotation:0,width:Math.round(w*.48),height:90,...extras};current().layers.push(l);selected=l.id;syncInspector();renderAll()}
function listen(id,key,read){$(id).addEventListener("input",()=>{const l=currentLayer();if(!l)return;l[key]=read?read($(id).value):$(id).value;renderAll();if(key==="text")layersUI()})}
function loadImage(file,callback){if(!file)return;if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>8*1024*1024){notice("Seleccioná PNG, JPG o WebP de hasta 8 MB.");return}const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{images.set(url,im);callback(url,im);renderAll();notice("Imagen cargada. Ya podés editarla.")};im.onerror=()=>{revoke(url);notice("No pudimos abrir esa imagen.")};im.src=url}
function faceCanvas(side){const canvas=buttons[side];canvas.addEventListener("pointerdown",e=>{if(face!==side)changeFace(side);const box=canvas.getBoundingClientRect(),[w,h]=size(),x=(e.clientX-box.left)/box.width*w,y=(e.clientY-box.top)/box.height*h;const layers=current().layers;let hit=null;for(let i=layers.length-1;i>=0;i--){const l=layers[i],dx=x-l.x,dy=y-l.y,rad=-(l.rotation*Math.PI/180),lx=dx*Math.cos(rad)-dy*Math.sin(rad),ly=dx*Math.sin(rad)+dy*Math.cos(rad);if(lx>=-4&&ly>=-4&&lx<=l.width+4&&ly<=l.height+4){hit=l;break}}selected=hit?.id||null;drag=hit?{pointerId:e.pointerId,layerId:hit.id,startX:x,startY:y,x:hit.x,y:hit.y}:null;syncInspector();renderAll();if(hit)canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointermove",e=>{if(!drag||drag.pointerId!==e.pointerId||face!==side)return;const box=canvas.getBoundingClientRect(),[w,h]=size(),x=(e.clientX-box.left)/box.width*w,y=(e.clientY-box.top)/box.height*h;const l=currentLayer();if(!l||l.id!==drag.layerId)return;l.x=clamp(Math.round(drag.x+x-drag.startX),-l.width+15,w-15);l.y=clamp(Math.round(drag.y+y-drag.startY),-l.height+15,h-15);renderAll()});const end=()=>{drag=null};canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",end);canvas.addEventListener("lostpointercapture",end)}
function download(side){renderSide(side,true);const c=buttons[side];c.toBlob(blob=>{if(!blob){notice("No se pudo exportar la imagen.");return}const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="BTS-Demo-"+type+"-"+(side==="front"?"frente":"reverso")+".png";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);renderAll()},"image/png")}
document.querySelectorAll(".face-tab,.preview-tab").forEach(b=>b.addEventListener("click",()=>changeFace(b.dataset.face)));
typeSelect.addEventListener("change",()=>{cleanup();type=typeSelect.value;const url=new URL(location.href);url.searchParams.set("tipo",type);history.replaceState(null,"",url.pathname+url.search);$("quote").href="../cotizar-tarjeta/?tipo="+type;reset()});
for(const [id,key,coerce] of [["bgStart","start",String],["bgEnd","end",String],["bgAngle","angle",Number],["corner","corner",Number],["bgZoom","zoom",Number],["bgMode","mode",String]])$(id).addEventListener("input",()=>{current()[key]=coerce($(id).value);renderAll()});
$("bgImage").addEventListener("change",e=>loadImage(e.target.files[0],url=>{revoke(current().bgUrl);current().bgUrl=url;}));
$("addImage").addEventListener("change",e=>loadImage(e.target.files[0],(url,im)=>{const [w,h]=size();const a=im.naturalWidth/im.naturalHeight;let ww=Math.min(w*.45,500),hh=ww/a;if(hh>h*.45){hh=h*.45;ww=hh*a}addLayer("image",{url,width:Math.round(ww),height:Math.round(hh),x:Math.round((w-ww)/2),y:Math.round((h-hh)/2)})}));
$("removeBg").addEventListener("click",()=>{revoke(current().bgUrl);current().bgUrl=null;$("bgImage").value="";renderAll()});
$("addTitle").addEventListener("click",()=>addLayer("text",{text:"TU MARCA",size:70,color:"#ffffff"}));
$("addSubtitle").addEventListener("click",()=>addLayer("text",{text:"Tu mensaje",size:39,weight:400}));
$("addShape").addEventListener("click",()=>addLayer("shape",{color:"#d61742",width:260,height:12}));
for(const [id,key,read] of [["layerText","text",String],["layerFont","font",String],["layerWeight","weight",Number],["layerColor","color",String],["layerSize","size",Number],["layerOpacity","opacity",Number],["layerRotation","rotation",Number],["layerWidth","width",Number],["layerHeight","height",Number]])listen(id,key,read);
$("deleteLayer").addEventListener("click",()=>{if(!currentLayer())return;const l=currentLayer();if(l.url)revoke(l.url);current().layers=current().layers.filter(v=>v.id!==selected);selected=null;syncInspector();renderAll()});
$("moveUp").addEventListener("click",()=>{const a=current().layers,i=a.findIndex(x=>x.id===selected);if(i>=0&&i<a.length-1){[a[i],a[i+1]]=[a[i+1],a[i]];syncInspector();renderAll()}});
$("moveDown").addEventListener("click",()=>{const a=current().layers,i=a.findIndex(x=>x.id===selected);if(i>0){[a[i-1],a[i]]=[a[i],a[i-1]];syncInspector();renderAll()}});
$("resetSide").addEventListener("click",()=>{const c=current();revoke(c.bgUrl);for(const l of c.layers)if(l.url)revoke(l.url);cards[face]=createFace(face);selected=null;syncControls()});
$("resetAll").addEventListener("click",()=>{cleanup();reset()});
$("downloadFront").addEventListener("click",()=>download("front"));$("downloadBack").addEventListener("click",()=>download("back"));
["front","back"].forEach(faceCanvas);window.addEventListener("pagehide",cleanup);reset();$("quote").href="../cotizar-tarjeta/?tipo="+type;
})();