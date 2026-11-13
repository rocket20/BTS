/* Editor de marca de las tarjetas BTS, reutilizable en admin y mini panel. */
(()=>{'use strict';
const lib=window.BTSCardDesign;
if(!lib)throw Error('Cargá shared-card-design.js antes del editor.');
const fields=[
 ['From','Color inicial','color'],['To','Color final','color'],
 ['Angle','Ángulo del degradado','range'],['Opacity','Transparencia del logo','range'],['Scale','Tamaño del logo','range']
];
function el(tag,text,cls){
 const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;
}
function mount(elementId,handlers){
 const host=document.getElementById(elementId);
 if(!host)throw Error('Contenedor del editor BTS inexistente');
 host.replaceChildren();
 const shell=el('section',undefined,'bts-editor');
 const title=el('h2','Personalización de tarjetas');
 const help=el('p','Configurá los colores y el logo que verá tu cliente al escanear. No cambia las compras, puntos ni los beneficios.','bts-design-muted');
 const selector=el('label','Programa de tarjetas','bts-design-control');
 const select=el('select');select.id=elementId+'Programs';selector.append(select);
 const form=el('form',undefined,'bts-design-grid');form.id=elementId+'Form';
 const toggleLabel=el('label','Degradado personalizado','bts-design-control bts-design-wide');
 const enabled=el('input');enabled.type='checkbox';enabled.id=elementId+'Enabled';toggleLabel.append(enabled);form.append(toggleLabel);
 const control={Enabled:enabled};
 for(const [id,text,type] of fields){
  const wrap=el('label',text,'bts-design-control'),inp=el('input');inp.type=type;inp.id=elementId+id;
  if(type==='range'){
   inp.min=id==='Angle'?'0':id==='Opacity'?'0.05':'30';
   inp.max=id==='Angle'?'360':id==='Opacity'?'0.40':'95';
   inp.step=id==='Angle'||id==='Scale'?'1':'0.01';
  }
  const value=el('small','', 'bts-design-muted');
  wrap.append(inp,value);form.append(wrap);control[id]=inp;
  if(type==='range')inp.addEventListener('input',()=>{value.textContent=inp.value+(id==='Angle'?'°':id==='Scale'?'%':'')});
 }
 const color=el('label','Color del texto','bts-design-control');
 const textSelect=el('select');textSelect.id=elementId+'Text';
 for(const [value,label] of [['light','Texto blanco'],['dark','Texto oscuro']])textSelect.add(new Option(label,value));
 color.append(textSelect);form.append(color);control.Text=textSelect;
 const logoWrap=el('label','Logo de la empresa (PNG, JPG o WebP · máximo 4 MB)','bts-design-control bts-design-wide');
 const file=el('input');file.type='file';file.accept='.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';
 logoWrap.append(file);form.append(logoWrap);
 const previewTitle=el('p','Vista previa en vivo · el logo se verá como marca de agua','bts-design-muted');
 const preview=el('div',undefined,'bts-design-preview');
 preview.append(Object.assign(el('div','TU NEGOCIO · NFC','preview-top'),{id:elementId+'PreviewBrand'}));
 const center=el('div',undefined,'preview-mid');center.append(el('span','MEMBRESÍA / FIDELIZACIÓN'),el('strong','NOMBRE DEL CLIENTE'),el('span','Tu marca, tus beneficios'));
 preview.append(center,el('div','TARJETA DIGITAL · BTS STUDIO','preview-bottom'));
 const buttons=el('div',undefined,'bts-design-actions bts-design-wide'),save=el('button','Guardar diseño','btn primary'),remove=el('button','Quitar logo','btn');
 save.type='submit';remove.type='button';buttons.append(save,remove);form.append(buttons);
 const status=el('p','Seleccioná un programa para personalizarlo.','bts-design-muted');
 status.setAttribute('role','status');
 shell.append(title,help,selector,form,previewTitle,preview,status);host.append(shell);
 let programs=[],selected=null,removeLogo=false,objectURL=null;
 function clearBlob(){if(objectURL){URL.revokeObjectURL(objectURL);objectURL=null}}
 function read(){
  return lib.normalize({
   card_gradient_enabled:enabled.checked,
   card_gradient_from:control.From.value,card_gradient_to:control.To.value,
   card_gradient_angle:Number(control.Angle.value),
   card_logo_path:removeLogo?null:selected?.card_logo_path,
   card_logo_opacity:Number(control.Opacity.value),card_logo_scale:Number(control.Scale.value),
   card_text_color:control.Text.value
  });
 }
 function draw(){
  const design=read();
  lib.apply(preview,design);
  if(file.files?.[0]){
   clearBlob();objectURL=URL.createObjectURL(file.files[0]);
   const existing=preview.querySelector('.bts-card-watermark');
   if(existing)existing.remove();
   const mark=el('div',undefined,'bts-card-watermark');
   mark.style.backgroundImage='url("'+objectURL+'")';
   mark.style.backgroundSize=design.card_logo_scale+'% auto';
   mark.style.opacity=String(design.card_logo_opacity);preview.prepend(mark);
  }
  preview.querySelector('.preview-top').textContent=selected?.business_name||'TU NEGOCIO · NFC';
 }
 function selectProgram(){
  selected=programs.find(p=>p.id===select.value)||null;
  removeLogo=false;file.value='';clearBlob();
  lib.fillForm(elementId,selected||{});
  save.disabled=!selected;remove.disabled=!selected;
  status.textContent=selected?'Editando: '+selected.title:'Seleccioná un programa válido.';
  draw();
 }
 function setPrograms(list=[]){
  const previous=selected?.id||select.value;programs=list.filter(x=>x?.id);
  select.replaceChildren();
  for(const item of programs)select.add(new Option(item.title+' · '+(item.card_category||item.kind||'Programa'),item.id));
  if(programs.some(x=>x.id===previous))select.value=previous;
  selected=programs.find(p=>p.id===select.value)||null;
  selectProgram();
 }
 for(const key of ['Enabled','From','To','Angle','Opacity','Scale','Text'])control[key].addEventListener('input',draw);
 file.addEventListener('change',()=>{
  const f=file.files?.[0];if(f&&(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>4194304)){
    status.textContent='Elegí un archivo PNG, JPG o WebP de hasta 4 MB.';file.value='';
  }
  draw();
 });
 select.addEventListener('change',selectProgram);
 remove.addEventListener('click',()=>{file.value='';removeLogo=true;clearBlob();draw();status.textContent='El logo se quitará cuando guardés el diseño.'});
 form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!selected)return;
  save.disabled=true;remove.disabled=true;
  const selectedBefore=selected.id,design=read();
  status.textContent='Guardando diseño...';
  try{
   const user=await handlers.getUser();
   if(!user?.id||!user?.token)throw Error('La sesión terminó. Iniciá sesión nuevamente.');
   if(file.files?.[0]){
    status.textContent='Subiendo logo al almacenamiento BTS...';
    design.card_logo_path=await lib.upload({file:file.files[0],businessId:selected.business_id,userId:user.id,accessToken:user.token});
   }
   await handlers.save(selectedBefore,design);
   selected={...selected,...design};programs=programs.map(p=>p.id===selectedBefore?selected:p);
   removeLogo=false;file.value='';clearBlob();draw();
   status.textContent='Diseño guardado correctamente. Las tarjetas digitales de este programa usarán el nuevo estilo.';
   handlers.onSaved?.(selectedBefore,design);
  }catch(err){status.textContent='No se pudo guardar: '+(err?.message||String(err))}
  finally{save.disabled=false;remove.disabled=false}
 });
 setPrograms([]);
 return {setPrograms,preview,refresh:draw};
}
window.BTSCardEditor=Object.freeze({mount});
})();
