drop trigger if exists emergency_access_expiry_sweep on emergency_access_grant;
drop function if exists expire_emergency_access_grants();
