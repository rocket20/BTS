-- Repetir la tómbola sin eliminar ni modificar participantes.
ALTER TABLE public.bts_business_raffle_draws
 ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
 ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
 ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id);
ALTER TABLE public.bts_business_raffle_draws DROP CONSTRAINT IF EXISTS bts_raffle_draw_status_valid;
ALTER TABLE public.bts_business_raffle_draws ADD CONSTRAINT bts_raffle_draw_status_valid CHECK (status IN ('pending','no_show','confirmed'));
CREATE UNIQUE INDEX IF NOT EXISTS bts_raffle_one_pending_per_campaign ON public.bts_business_raffle_draws(campaign_id) WHERE campaign_id IS NOT NULL AND status='pending';
CREATE OR REPLACE FUNCTION public.bts_draw_business_raffle(p_company_slug text, p_include_all boolean DEFAULT false, p_exclude_previous boolean DEFAULT true)
 RETURNS TABLE(draw_id uuid, winner_contact_id uuid, full_name text, email text, phone text, participant_count integer, drawn_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_admin uuid := auth.uid();
 v_company uuid;
 v_campaign uuid;
 v_contact uuid;
 v_key text;
 v_name text;
 v_email text;
 v_phone text;
 v_total integer;
 v_draw uuid;
 v_time timestamptz;
begin
 if v_admin is null or not exists (
  select 1 from public.bts_admins adm where adm.user_id = v_admin
 ) then
  raise exception 'No tenés permisos para sortear.' using errcode='42501';
 end if;

 select business.id into v_company
 from public.bts_nfc_cards business
 where business.slug = btrim(coalesce(p_company_slug,''))
   and business.is_active = true;

 if v_company is null then
  raise exception 'Empresa no encontrada o inactiva.';
 end if;

 -- Serializes draws for each active campaign to avoid duplicate winners.
 select campaign.id into v_campaign
 from public.bts_business_raffle_campaigns campaign
 where campaign.company_id = v_company and campaign.ended_at is null
 for update;

 if v_campaign is null then
  raise exception 'Iniciá una nueva rifa antes de sortear.';
 end if;

 if exists (select 1 from public.bts_business_raffle_draws d where d.campaign_id=v_campaign and d.status='confirmed')
 then raise exception 'Esta ronda ya tiene un ganador confirmado. Creá otra ronda para un nuevo premio.'; end if;
 if exists (select 1 from public.bts_business_raffle_draws d where d.campaign_id=v_campaign and d.status='pending')
 then raise exception 'Hay un ganador pendiente. Confirmalo o elegí Volver a tirar si no aparece.'; end if;

 with eligible as (
  select
   contact.id as contact_id,
   contact.full_name as participant_name,
   contact.email as participant_email,
   contact.phone as participant_phone,
   contact.created_at as enrollment_time,
   case
    when length(regexp_replace(coalesce(contact.phone,''),'[^0-9]','','g')) >= 8
    then 'p:' || right(regexp_replace(contact.phone,'[^0-9]','','g'),8)
    when btrim(coalesce(contact.email,'')) <> ''
    then 'e:' || lower(btrim(contact.email))
    else 'i:' || contact.id::text
   end as participant_identity
  from public.bts_business_contacts contact
  where contact.company_id = v_company
    and contact.raffle_campaign_id = v_campaign
    and contact.raffle_opt_in = true
 ),
 single_entry as (
  select distinct on (entry.participant_identity)
   entry.contact_id,entry.participant_name,entry.participant_email,
   entry.participant_phone,entry.participant_identity
  from eligible entry
  order by entry.participant_identity,entry.enrollment_time,entry.contact_id
 ),
 available as (
  select participant.*
  from single_entry participant
  where not coalesce(p_exclude_previous,true)
     or not exists (
      select 1 from public.bts_business_raffle_draws previous
      where previous.campaign_id = v_campaign
        and previous.winner_identity = participant.participant_identity
     )
 )
 select chosen.contact_id,chosen.participant_identity,chosen.participant_name,
        chosen.participant_email,chosen.participant_phone,
        (select count(*)::integer from available)
 into v_contact,v_key,v_name,v_email,v_phone,v_total
 from available chosen
 order by gen_random_uuid()
 limit 1;

 if v_contact is null then
  raise exception 'No hay nuevas inscripciones disponibles para esta rifa.';
 end if;

 insert into public.bts_business_raffle_draws (
  campaign_id,company_id,company_slug,winner_contact_id,winner_identity,
  winner_name,winner_email,winner_phone,participant_count,scope,created_by
 ) values (
  v_campaign,v_company,btrim(p_company_slug),v_contact,v_key,v_name,
  coalesce(v_email,''),coalesce(v_phone,''),v_total,'raffle',v_admin
 )
 returning id,created_at into v_draw,v_time;

 return query select v_draw,v_contact,v_name,v_email,v_phone,v_total,v_time;
end;
$function$
;
REVOKE ALL ON FUNCTION public.bts_draw_business_raffle(text,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_draw_business_raffle(text,boolean,boolean) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.bts_redraw_business_raffle(p_company_slug text,p_prior_draw_id uuid)
RETURNS TABLE(draw_id uuid,winner_contact_id uuid,full_name text,email text,phone text,participant_count integer,drawn_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $redraw$
DECLARE v_admin uuid:=auth.uid();v_company uuid;v_campaign uuid;v_previous uuid;
BEGIN
 IF v_admin IS NULL OR NOT EXISTS (SELECT 1 FROM public.bts_admins a WHERE a.user_id=v_admin)
 THEN RAISE EXCEPTION 'No tenés permisos para repetir la tómbola.' USING errcode='42501'; END IF;
 SELECT c.id INTO v_company FROM public.bts_nfc_cards c WHERE c.slug=btrim(coalesce(p_company_slug,'')) AND c.is_active=true;
 IF v_company IS NULL THEN RAISE EXCEPTION 'Empresa no encontrada o inactiva.'; END IF;
 SELECT r.id INTO v_campaign FROM public.bts_business_raffle_campaigns r WHERE r.company_id=v_company AND r.ended_at IS NULL FOR UPDATE;
 IF v_campaign IS NULL THEN RAISE EXCEPTION 'La rifa ya no está activa.'; END IF;
 UPDATE public.bts_business_raffle_draws d SET status='no_show',resolved_at=now(),resolved_by=v_admin
 WHERE d.id=p_prior_draw_id AND d.campaign_id=v_campaign AND d.status='pending' RETURNING d.id INTO v_previous;
 IF v_previous IS NULL THEN RAISE EXCEPTION 'El ganador cambió o ya fue confirmado. Actualizá la tómbola.'; END IF;
 RETURN QUERY SELECT next_draw.* FROM public.bts_draw_business_raffle(btrim(p_company_slug),false,true) next_draw;
END;
$redraw$;
REVOKE ALL ON FUNCTION public.bts_redraw_business_raffle(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_redraw_business_raffle(text,uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.bts_confirm_business_raffle(p_company_slug text,p_draw_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $confirm$
DECLARE v_admin uuid:=auth.uid();v_company uuid;v_campaign uuid;v_confirmed uuid;
BEGIN
 IF v_admin IS NULL OR NOT EXISTS (SELECT 1 FROM public.bts_admins a WHERE a.user_id=v_admin)
 THEN RAISE EXCEPTION 'No tenés permisos para confirmar ganadores.' USING errcode='42501'; END IF;
 SELECT c.id INTO v_company FROM public.bts_nfc_cards c WHERE c.slug=btrim(coalesce(p_company_slug,'')) AND c.is_active=true;
 IF v_company IS NULL THEN RAISE EXCEPTION 'Empresa no encontrada o inactiva.'; END IF;
 SELECT r.id INTO v_campaign FROM public.bts_business_raffle_campaigns r WHERE r.company_id=v_company AND r.ended_at IS NULL FOR UPDATE;
 IF v_campaign IS NULL THEN RAISE EXCEPTION 'La rifa ya no está activa.'; END IF;
 UPDATE public.bts_business_raffle_draws d SET status='confirmed',resolved_at=now(),resolved_by=v_admin
 WHERE d.id=p_draw_id AND d.campaign_id=v_campaign AND d.status='pending' RETURNING d.id INTO v_confirmed;
 IF v_confirmed IS NULL THEN RAISE EXCEPTION 'El ganador ya fue resuelto. Actualizá la tómbola.'; END IF;
 RETURN v_confirmed;
END;
$confirm$;
REVOKE ALL ON FUNCTION public.bts_confirm_business_raffle(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bts_confirm_business_raffle(text,uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';