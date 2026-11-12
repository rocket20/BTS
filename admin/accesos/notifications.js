/* BTS Studio — confirmaciones accesibles y notificaciones sin ventanas del navegador. */
(()=>{
 'use strict';
 let modal=null,stack=null,modalQueue=Promise.resolve();
 const glyph={warning:'!',danger:'!',success:'✓',info:'i'};
 function element(tag,className,text){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined&&text!==null)el.textContent=String(text);
  return el;
 }
 function getStack(){
  if(!stack){stack=element('div','bts-toast-stack');stack.setAttribute('aria-label','Notificaciones BTS');document.body.append(stack)}
  return stack;
 }
 function toast({title='BTS Studio',message='',type='info',duration=5000}={}){
  type=['success','error','info'].includes(type)?type:'info';
  const parent=getStack(),item=element('div','bts-toast bts-toast--'+type);
  item.setAttribute('role',type==='error'?'alert':'status');
  const mark=element('div','bts-toast-icon',glyph[type]),body=element('div','bts-toast-content');
  body.append(element('p','bts-toast-title',title));
  if(message)body.append(element('p','bts-toast-message',message));
  const close=element('button','bts-toast-close','×');
  close.type='button';close.setAttribute('aria-label','Cerrar notificación');
  let timer=null;
  const remove=()=>{if(timer!==null)clearTimeout(timer);item.remove()};
  close.addEventListener('click',remove);item.append(mark,body,close);parent.prepend(item);
  while(parent.childElementCount>3)parent.lastElementChild.remove();
  if(duration>0)timer=setTimeout(remove,Math.max(1500,Math.min(15000,duration)));
  return remove;
 }
 function openConfirm(opts={}){
  if(!('HTMLDialogElement' in window))return Promise.resolve(false);
  const {
   title='Confirmar acción',message='',details=[],note='',
   confirmText='Confirmar',cancelText='Cancelar',type='warning'
  }=opts;
  const variant=['warning','danger','success','info'].includes(type)?type:'warning';
  return new Promise(resolve=>{
   modal=element('dialog','bts-dialog bts-dialog--'+variant);
   modal.setAttribute('aria-labelledby','bts-dialog-title');
   modal.setAttribute('aria-describedby','bts-dialog-description');
   const inner=element('div','bts-dialog-inner'),head=element('div','bts-dialog-head');
   head.append(element('div','bts-dialog-icon',glyph[variant]));
   const main=element('div','bts-dialog-text');
   main.append(element('p','bts-dialog-eyebrow',variant==='danger'?'Acción importante':variant==='warning'?'Confirmación BTS':'BTS Studio'));
   main.append(element('h2','bts-dialog-title',title));
   main.lastElementChild.id='bts-dialog-title';
   const desc=element('p','bts-dialog-message',message);desc.id='bts-dialog-description';main.append(desc);head.append(main);inner.append(head);
   if(Array.isArray(details)&&details.length){
    const list=element('div','bts-dialog-details');
    for(const detail of details){
     const row=element('div','bts-dialog-detail');
     if(typeof detail==='string')row.append(element('span','bts-dialog-detail-value',detail));
     else if(detail&&typeof detail==='object'){
      row.append(element('span','bts-dialog-detail-label',detail.label||'Detalle'));
      row.append(element('span','bts-dialog-detail-value',detail.value??'—'));
     }
     if(row.childElementCount)list.append(row);
    }
    if(list.childElementCount)inner.append(list);
   }
   if(note)inner.append(element('p','bts-dialog-note',note));
   const actions=element('div','bts-dialog-actions');
   const cancel=element('button','bts-dialog-button',cancelText);
   const approve=element('button','bts-dialog-button bts-dialog-button--primary',confirmText);
   cancel.type=approve.type='button';
   actions.append(cancel,approve);inner.append(actions);modal.append(inner);
   document.body.append(modal);
   const previous=document.activeElement;
   let finished=false;
   function finish(approved){
    if(finished)return;finished=true;
    modal?.close();modal?.remove();modal=null;
    if(previous?.isConnected&&typeof previous.focus==='function')previous.focus({preventScroll:true});
    resolve(approved);
   }
   cancel.addEventListener('click',()=>finish(false));
   approve.addEventListener('click',()=>finish(true));
   modal.addEventListener('cancel',e=>{e.preventDefault();finish(false)});
   modal.addEventListener('click',e=>{if(e.target===modal)finish(false)});
   modal.showModal();cancel.focus();
  });
 }
 function confirm(options){
  const pending=modalQueue.then(()=>openConfirm(options));
  modalQueue=pending.then(()=>{},()=>{});
  return pending;
 }
 window.BTSNotify=Object.freeze({confirm,toast});
})();
