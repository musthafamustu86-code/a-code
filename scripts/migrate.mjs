import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';

// This runner targets the inspected institution database. The baseline already exists
// there even though its original creation was not entered in migration history.
const connectionString=process.env.SUPABASE_DB_URL;
if(!connectionString){
 console.error('Add SUPABASE_DB_URL to .env.local using the direct PostgreSQL URI for this project.');
 process.exit(1);
}
let uri;
try{uri=new URL(connectionString)}catch{console.error('SUPABASE_DB_URL must be a valid PostgreSQL URI.');process.exit(1)}
if(!['postgresql:','postgres:'].includes(uri.protocol)||uri.hostname!=='db.kjmrgjvxlblgbadaxfks.supabase.co'||uri.pathname!=='/postgres'||!uri.password||uri.search){
 console.error('Use this project’s direct database URI, with a URL-encoded password and no query parameters.');
 process.exit(1);
}
const client=new pg.Client({connectionString,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:12000});
let connected=false;
try{
 await client.connect();connected=true;
 await client.query('begin');
 await client.query('select pg_advisory_xact_lock(781325)');
 const existing=await client.query("select to_regclass('public.attendance_sessions') is_present,to_regprocedure('public.reporting_summary(uuid,date,date)') summary");
 if(!existing.rows[0].is_present||!existing.rows[0].summary)throw Error('baseline');
 const directory='supabase/migrations/';
 for(const file of (await readdir(directory)).filter(f=>f.endsWith('.sql')&&f>'20261118160327_reporting_summary.sql').sort()){
  const [version,...name]=file.slice(0,-4).split('_');
  const prior=await client.query('select name from supabase_migrations.schema_migrations where version=$1',[version]);
  if(prior.rows.length){if(prior.rows[0].name!==name.join('_'))throw Error('version conflict');continue;}
  if(name.join('_')==='attendance_snapshot_and_recognition'){
   const signatures=await client.query("select p.proname,md5(replace(p.prosrc,chr(13)||chr(10),chr(10))) signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname,p.proname) in (('private','recognize'),('public','overview'),('private','command'))");
   const expected=new Set(['83de5edefb2f930015dea456ef37e83e','4f58a49f89afd78e75623e64b6b68806','a9070fa47f1a5281afd5d731ce15498a']);
   if(signatures.rows.length!==3||!signatures.rows.every(row=>expected.has(row.signature)))throw Error('schema drift');
  }
  const sql=await readFile(directory+file,'utf8');
  await client.query(sql);
  await client.query('insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)',[version,name.join('_'),[sql]]);
  console.log('Prepared '+file);
 }
 const schedule=await client.query("select active from cron.job where jobname='star-system-recognition'");
 if(!schedule.rows.some(r=>r.active))throw Error('scheduler verification');
 await client.query('commit');
 console.log('Committed migrations and verified the recognition schedule.');
}catch(error){
 if(connected)await client.query('rollback').catch(()=>{});
 console.error('Migration stopped. Verify the direct URI, trusted TLS certificate, baseline schema and pg_cron availability. Diagnostic code:',error.code||'preflight');
 process.exitCode=1;
}finally{await client.end().catch(()=>{})}

