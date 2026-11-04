/* BTS Studio — enviar formulario de cotización a Supabase.
   Se carga después del cotizador original. No reemplaza la descarga PDF. */
(() => {
  'use strict';
  const cfg = window.BTS_SUPABASE_CONFIG || {};
  const valid = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(cfg.url || '') &&
    /^sb_publishable_(?!REEMPLAZAR)/.test(cfg.publishableKey || '');
  const q = id => (document.getElementById(id)?.value || '').trim();
  const form = document.getElementById('quoteForm');
  const bar = document.querySelector('.preview-actions');
  if (!form || !bar) return;
  let client, busy = false, lastSaved = '';
  const notice = msg => {
    const p = document.getElementById('quoteStatus');
    if (p) { p.textContent = msg; p.classList.add('show'); }
  };
  const keys = ['qEventName','qTime','qHours','qPeople','qPlace','qGoal','qDeliverables',
    'qChannel','qMustHave','qReference','qMessage','qContactPref'];
  const details = () => Object.fromEntries(keys.map(id => [id, q(id)]));
  const todayLocal = () => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  };
  const payload = origin => ({
    nombre:q('qName'),empresa:q('qCompany'),email:q('qEmail'),telefono:q('qPhone'),
    evento:q('qType'),fecha_evento:q('qDate') || null,paquete:q('qPackage'),
    detalles:details(),origen:origin
  });
  async function submit(origin='web') {
    if (busy) return false;
    if (!form.checkValidity()) {form.reportValidity();return false;}
    if (q('qDate') && q('qDate') < todayLocal()) {
      notice('Revisá la fecha del evento.');return false;
    }
    if (!valid || !window.supabase?.createClient) {
      notice('La recepción de cotizaciones está en configuración. Usá el PDF o el contacto comercial mientras tanto.');
      return false;
    }
    const data = payload(origin);
    const fingerprint = JSON.stringify({...data,origen:'web'});
    if (fingerprint === lastSaved) return true;
    busy = true;
    try {
      client ||= window.supabase.createClient(cfg.url,cfg.publishableKey);
      // No hacemos .select(): las personas visitantes no pueden leer solicitudes.
      const {error} = await client.from('bts_quotes').insert(data);
      if (error) throw error;
      lastSaved = fingerprint;
      notice('¡Solicitud registrada! El equipo de BTS Studio podrá verla en su dashboard.');
      window.BTSMetric?.('quote_submitted');
      if (typeof window.gtag === 'function') window.gtag('event','generate_lead',{form_name:'cotizacion_bts'});
      return true;
    } catch(err) {
      console.error('[BTS] Error guardando cotización:',err);
      notice('No pudimos registrar la cotización. Revisá la conexión e intentá nuevamente.');
      return false;
    } finally { busy = false; }
  }
  const btn = document.createElement('button');
  btn.type='button'; btn.className='btn btn-primary'; btn.id='submitBtsQuote';
  btn.textContent='Enviar cotización a BTS Studio ↗';
  bar.prepend(btn);
  btn.addEventListener('click',async()=>{
    btn.disabled=true;
    try { await submit(); } finally { btn.disabled=false; }
  });
  // Guardar antes de abrir WhatsApp. El envío final del mensaje lo confirma el cliente.
  document.addEventListener('click',async event=>{
    const wa=event.target.closest?.('#sendWhatsapp');
    if (!wa || !valid) return; // Si Supabase no está configurado, conservar comportamiento original.
    event.preventDefault();
    event.stopImmediatePropagation();
    const num=String(cfg.whatsapp || '').replace(/\D/g,'');
    if (!num) {notice('Falta configurar el WhatsApp comercial. Podés enviar el formulario al dashboard.');return;}
    if (!form.checkValidity()) {form.reportValidity();return;}
    // Abrir pestaña durante el gesto del usuario para evitar bloqueo de ventanas.
    const tab=window.open('about:blank','_blank');
    const ok=await submit('web_whatsapp');
    if (!ok) {tab?.close();return;}
    const message=[
      'SOLICITUD DE COTIZACIÓN — BTS STUDIO',
      'Nombre: '+q('qName'),'Empresa: '+q('qCompany'),'Correo: '+q('qEmail'),
      'Teléfono: '+q('qPhone'),'Evento: '+q('qType'),
      'Fecha: '+q('qDate'),'Lugar: '+q('qPlace'),'Paquete: '+q('qPackage'),
      'Detalles: '+q('qMessage')
    ].join('\n');
    const dest='https://wa.me/'+num+'?text='+encodeURIComponent(message);
    if(tab)tab.location.replace(dest);else window.location.href=dest;
  },true);
})();
