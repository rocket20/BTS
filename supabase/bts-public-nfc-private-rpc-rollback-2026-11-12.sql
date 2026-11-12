-- BTS Studio · Reversion si la tarjeta NFC no responde tras el cambio.
-- Restaura los 3 SECURITY DEFINER originales en public; es solo rollback de emergencia.

CREATE OR REPLACE FUNCTION public.bts_nfc_public_executive(p_company_slug text, p_card_code text)
 RETURNS TABLE(id uuid, full_name text, job_title text, whatsapp_number text, phone_number text, email text, avatar_url text, extra_links jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select e.id,e.full_name,e.job_title,e.whatsapp_number,e.phone_number,e.email,e.avatar_url,e.extra_links
  from public.bts_nfc_executives e
  join public.bts_nfc_cards c on c.id=e.company_id
  where c.slug=p_company_slug and c.is_active and e.card_code=p_card_code and e.is_active
  limit 1
$function$
revoke all on function public.bts_nfc_public_executive(text, text) from public,anon,authenticated;
grant execute on function public.bts_nfc_public_executive(text, text) to anon,authenticated;

CREATE OR REPLACE FUNCTION public.bts_reward_public_card(p_card_code text)
 RETURNS TABLE(member_name text, card_label text, kind text, brand_name text, program_title text, program_description text, card_theme text, accent_color text, goal_units integer, unit_name text, reward_label text, current_units integer, lifetime_units integer, redeemed_count integer, vip_tier text, vip_benefits text, expires_at date, member_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select m.full_name,m.card_label,p.kind,b.business_name,p.title,p.description,p.card_theme,p.accent_color,
        p.goal_units,p.unit_name,coalesce(nullif(inv.benefit_label,''),p.reward_label),m.current_units,
        m.lifetime_units,m.redeemed_count,m.vip_tier,
        case when p.kind='vip' then coalesce(nullif(inv.benefit_label,''),p.vip_benefits) else p.vip_benefits end,
        m.expires_at,m.is_active
 from public.bts_reward_members m
 join public.bts_reward_programs p on p.id=m.program_id
 join public.bts_nfc_cards b on b.id=p.business_id
 left join public.bts_nfc_inventory inv on inv.member_id=m.id
 where p_card_code ~ '^[a-f0-9]{20}$'
   and m.card_code=p_card_code and p.is_active and b.is_active
   and (inv.id is null or inv.status='assigned')
 limit 1
$function$
revoke all on function public.bts_reward_public_card(text) from public,anon,authenticated;
grant execute on function public.bts_reward_public_card(text) to anon,authenticated;

CREATE OR REPLACE FUNCTION public.bts_reward_public_notices(p_card_code text)
 RETURNS TABLE(notice_type text, notice_title text, notice_message text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select n.notice_type,n.title,n.message
 from public.bts_reward_members m
 join public.bts_reward_programs p on p.id=m.program_id and p.is_active
 join public.bts_nfc_cards b on b.id=p.business_id and b.is_active
 join public.bts_nfc_inventory inv on inv.member_id=m.id and inv.status='assigned'
 join public.bts_nfc_batches bat on bat.id=inv.batch_id and bat.released_at is not null
 join public.bts_nfc_card_notices n on n.program_id=p.id and n.business_id=b.id
   and (n.member_id is null or n.member_id=m.id)
 where p_card_code ~ '^[a-f0-9]{20}$' and m.card_code=p_card_code and m.is_active
   and n.is_active and (n.starts_on is null or n.starts_on<=current_date)
   and (n.ends_on is null or n.ends_on>=current_date)
 order by n.created_at desc limit 5
$function$
revoke all on function public.bts_reward_public_notices(text) from public,anon,authenticated;
grant execute on function public.bts_reward_public_notices(text) to anon,authenticated;
drop function if exists bts_scan_impl.bts_nfc_public_executive(text,text);
drop function if exists bts_scan_impl.bts_reward_public_card(text);
drop function if exists bts_scan_impl.bts_reward_public_notices(text);
drop schema if exists bts_scan_impl restrict;
