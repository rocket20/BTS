-- El token solo lo emite BTS vía funciones autorizadas, nunca INSERT directo del navegador.
create or replace function bts_private.reject_direct_nfc_member_issuance()
returns trigger language plpgsql security invoker set search_path='' as $guard_issue$
begin
 if current_user in ('authenticated','anon') then
   raise exception 'Los códigos NFC solo pueden emitirse mediante un lote autorizado de BTS';
 end if;
 return new;
end $guard_issue$;
revoke all on function bts_private.reject_direct_nfc_member_issuance() from public,anon,authenticated;
create trigger bts_nfc_member_no_direct_issue before insert on public.bts_reward_members
 for each row execute function bts_private.reject_direct_nfc_member_issuance();
