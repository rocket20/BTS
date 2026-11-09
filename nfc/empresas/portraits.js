/* Fotografía corporativa individual: crop client-side + subida autenticada a Supabase Storage. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const MIME=new Set(['image/jpeg','image/png','image/webp']);
let img=null,objectUrl='',hasSelection=false,removeRequested=false,existingUrl='',workingFile=null;
const fields=['portraitX','portraitY','portraitZoom'];
function state(s){$('portraitStatus').textContent=s;}
function initialForName(name){const parts=String(name||'').trim().split(/\s+/).filter(Boolean);return parts.slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'EX';}
function showExisting(url){
 $('portraitExisting').hidden=!url;$('portraitCanvas').hidden=true;
 if(url){$('portraitExisting').src=url;$('portraitInitials').hidden=true;}
 else{$('portraitExisting').removeAttribute('src');$('portraitInitials').hidden=false;}
 $('portraitAdjustments').hidden=true;
}
function renderCrop(){
 if(!img)return;
 const canvas=$('portraitCanvas'),ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)return;
 const x=Number($('portraitX').value),y=Number($('portraitY').value),zoom=Number($('portraitZoom').value)/100;
 const w=canvas.width,h=canvas.height;
 // Imagen centrada, cubriendo el lienzo, con desplazamiento progresivo sin dejar huecos.
 const base=Math.max(w/img.naturalWidth,h/img.naturalHeight),scale=base*zoom;
 const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
 const dx=-(dw-w)*x/100,dy=-(dh-h)*y/100;
 ctx.clearRect(0,0,w,h);ctx.drawImage(img,dx,dy,dw,dh);
 $('portraitCanvas').hidden=false;$('portraitExisting').hidden=true;$('portraitInitials').hidden=true;
 for(const [id,out] of [['portraitX','portraitXValue'],['portraitY','portraitYValue'],['portraitZoom','portraitZoomValue']])$(out).textContent=$(id).value+'%';
 window.dispatchEvent(new Event('bts-nfc-executive-portrait-changed'));
}
function previewUrl(){
 if(!hasSelection||!img)return removeRequested?'':existingUrl;
 return $('portraitCanvas').toDataURL('image/jpeg',.9);
}
async function loadPhoto(file){
 if(!file)return;
 if(!MIME.has(file.type)||file.size>4*1024*1024){state('Seleccioná una foto JPG, PNG o WEBP de hasta 4 MB.');$('portraitFile').value='';return;}
 if(objectUrl)URL.revokeObjectURL(objectUrl);
 objectUrl=URL.createObjectURL(file);
 const loaded=new Image();
 try{await new Promise((resolve,reject)=>{loaded.onload=resolve;loaded.onerror=reject;loaded.src=objectUrl;});}
 catch{state('No se pudo leer la imagen seleccionada.');return;}
 img=loaded;workingFile=file;hasSelection=true;removeRequested=false;
 $('portraitX').value=50;$('portraitY').value=50;$('portraitZoom').value=100;
 $('portraitAdjustments').hidden=false;state('Ajustá el rostro y guardá el ejecutivo para publicar la foto.');
 renderCrop();
}
function resetPortrait(url='',name=''){
 if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
 img=null;workingFile=null;hasSelection=false;removeRequested=false;existingUrl=url||'';
 $('portraitFile').value='';$('portraitX').value=50;$('portraitY').value=50;$('portraitZoom').value=100;
 $('portraitInitials').textContent=initialForName(name||$('fullName').value);$('portraitInitials').hidden=!!existingUrl;
 showExisting(existingUrl);
 state(existingUrl?'Fotografía actual · podés reemplazarla o quitarla.':'JPG, PNG o WEBP · máximo 4 MB');
 window.dispatchEvent(new Event('bts-nfc-executive-portrait-changed'));
}
function removePortrait(){
 if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl='';}
 img=null;workingFile=null;hasSelection=false;removeRequested=true;existingUrl='';
 $('portraitFile').value='';$('avatar').value='';showExisting('');
 $('portraitInitials').textContent=initialForName($('fullName').value);
 state('La foto se quitará cuando guardés los cambios.');
 window.dispatchEvent(new Event('bts-nfc-executive-portrait-changed'));
}
function renderFile(){
 return new Promise((resolve,reject)=>{
  $('portraitCanvas').toBlob(blob=>blob?resolve(blob):reject(Error('No se pudo generar la fotografía.')),'image/jpeg',.88);
 });
}
async function upload(getSession,refresh,base,key){
 if(!hasSelection)return removeRequested?'':existingUrl;
 let s=getSession();if(!s?.user?.id||!s?.access_token)throw Error('Sesión administrativa no disponible.');
 if((s.expires_at||0)*1000<Date.now()+60000){s=await refresh(s);}
 const blob=await renderFile();
 const path=encodeURIComponent(s.user.id)+'/'+crypto.randomUUID()+'-ejecutivo.jpg';
 const response=await fetch(base+'/storage/v1/object/bts-nfc-media/'+path,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+s.access_token,'Content-Type':'image/jpeg','x-upsert':'false'},body:blob});
 if(!response.ok){const err=await response.json().catch(()=>({}));throw Error(err.message||err.error||'No se pudo subir la foto ('+response.status+')')}
 return base+'/storage/v1/object/public/bts-nfc-media/'+path;
}
$('portraitFile').addEventListener('change',()=>loadPhoto($('portraitFile').files?.[0]));
$('portraitRemove').addEventListener('click',removePortrait);
for(const id of fields)$(id).addEventListener('input',renderCrop);
$('fullName').addEventListener('input',()=>{
 if(!img&&!existingUrl)$('portraitInitials').textContent=initialForName($('fullName').value);
 window.dispatchEvent(new Event('bts-nfc-executive-portrait-changed'));
});
window.BTSExecutivePortrait={reset:resetPortrait,remove:removePortrait,previewUrl,upload,hasPending:()=>hasSelection||removeRequested};
resetPortrait();
})();
