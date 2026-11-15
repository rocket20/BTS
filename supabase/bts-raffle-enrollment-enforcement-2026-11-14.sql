-- En modo rifa, toda inscripción nueva debe entrar al sorteo aunque el navegador mantenga una versión anterior en caché.
create or replace function public.bts_stamp_business_contact_raffle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
 v_enabled boolean := false;
begin
 select r.id,
  (n.theme_options->>'contactFormEnabled')='true'
  and coalesce(n.theme_options->>'contactFormLabel','') ~* 'rifa|sorteo|t[oó]mbola|particip'
 into new.raffle_campaign_id,v_enabled
 from public.bts_business_raffle_campaigns r
 join public.bts_nfc_cards n on n.id=r.company_id
 where r.company_id=new.company_id
   and r.company_slug=new.company_slug
   and r.ended_at is null
 limit 1;

 -- Solo los formularios empresariales configurados como rifa pueden inscribir participantes.
 new.raffle_opt_in := coalesce(new.raffle_campaign_id is not null and v_enabled,false);
 return new;
end;
$$;
revoke all on function public.bts_stamp_business_contact_raffle() from public,anon,authenticated;
