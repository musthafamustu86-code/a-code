-- All batches share the caller's PostgreSQL transaction.
create or replace function public.command(p_action text,p jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare batch jsonb;
begin
 if not private.is_staff() then raise exception 'Staff access required' using errcode='42501'; end if;
 if p_action <> 'students.import' then return private.command(p_action,p); end if;
 if jsonb_typeof(p->'rows') is distinct from 'array' or jsonb_array_length(p->'rows')=0 then raise exception 'Select a CSV with student rows'; end if;
 for batch in select jsonb_agg(row_data order by ord) from jsonb_array_elements(p->'rows') with ordinality as input(row_data,ord)
  group by ((ord-1)/500) order by ((ord-1)/500)
 loop
  perform private.command(p_action,jsonb_set(p,'{rows}',batch));
 end loop;
 return jsonb_build_object('imported',jsonb_array_length(p->'rows'));
end $$;
