import assert from "node:assert/strict";
import test, {beforeEach} from "node:test";
import {fileURLToPath} from "node:url";
import {runnerImport} from "vite";
const fixture=fileURLToPath(new URL("./helpers/read-boundary.mjs",import.meta.url));
const {module:{getDashboardData,getOptionalActor,resolveViewActor,entriesRoute,historyRoute,signInRoute,reportsRoute,adminRoute,boundary,getAllReportRows}}=await runnerImport("./tests/helpers/read-harness.ts",{
  configFile:false,envDir:false,resolve:{alias:["./supabase","./supabase-auth","../../../db/supabase","../../../../../db/supabase","../../../../db/supabase","../../../../db/supabase-auth"].map(find=>({find,replacement:fixture}))},
});
const rh={id:"test-rh",authUserId:"auth-rh",organizationId:"test-org",organizationName:"Fictícia",name:"RH",email:"rh@example.com",role:"RH"};
const reportFilters={kind:"history",from:"2026-08-01",to:"2026-09-30",page:1,pageSize:50,personId:null,sectorId:null,category:null,actorId:null};
beforeEach(()=>boundary.reset());
test("dashboard consultation performs no persistence",async()=>{
  await getDashboardData(rh,{year:2026,month:8});
  assert.equal(boundary.writes,0);assert.equal(boundary.rpcCalls,0);
});
test("dashboard projects the organization-scoped current sector without changing time data",async()=>{
  boundary.tables.sectors.push({id:"sector-engineering",organization_id:"test-org",name:"Engenharia",status:"ACTIVE"});
  boundary.tables.users.find(user=>user.id==="person-0000").sector_id="sector-engineering";
  const before=structuredClone(boundary.tables.time_entries);
  const data=await getDashboardData(rh,{year:2026,month:8});
  assert.deepEqual(data.contractors.find(person=>person.id==="person-0000")?.sectorId,"sector-engineering");
  assert.deepEqual(data.contractors.find(person=>person.id==="person-0000")?.sectorName,"Engenharia");
  assert.equal(data.contractors.find(person=>person.id==="person-0001")?.sectorName,"Sem setor definido");
  assert.deepEqual(boundary.tables.time_entries,before);assert.equal(boundary.writes,0);
});
test("dashboard includes every row beyond service cap and retains inactive history",async()=>{
  const data=await getDashboardData(rh,{year:2026,month:8});
  assert.equal(data.entries.length,1105);assert.equal(data.contractors.length,1105);
  assert.equal(data.monthlyTimesheets.length,1105);assert.equal(data.authorizations.length,1105);
  assert.equal(data.metrics.workedMinutes,66300);assert.equal(data.metrics.activeContractors,1104);
  assert.equal(data.contractors.find(p=>p.id==="person-1104").status,"INACTIVE");
});
test("incomplete later page fails the consultation instead of returning partial totals",async()=>{
  boundary.failTable="time_entries";boundary.failAfter=500;
  await assert.rejects(()=>getDashboardData(rh,{year:2026,month:8}));
});
test("expired credit is displayed as expired without rewriting stored lots",async()=>{
  boundary.tables.hour_balance_lots=[{id:"expired-lot",organization_id:"test-org",contractor_id:"person-0000",type:"CREDIT",original_minutes:60,remaining_minutes:60,reserved_minutes:0,origin_date:"2000-01-01",deadline_date:"2000-04-01",status:"AVAILABLE"}];
  const before=structuredClone(boundary.tables.hour_balance_lots);
  const data=await getDashboardData(rh,{year:2026,month:8});
  assert.equal(data.balanceLots[0].status,"EXPIRED");
  assert.equal(data.metrics.positiveBalanceMinutes,0);
  assert.deepEqual(boundary.tables.hour_balance_lots,before);
});
test("PJ consultation stays scoped across every page and DEV simulation remains read-only",async()=>{
  const actor=await resolveViewActor({...rh,role:"DEV"},"person-1104");
  const data=await getDashboardData(actor,{year:2026,month:8});
  assert.deepEqual(data.contractors.map(p=>p.id),["person-1104"]);
  assert.equal(data.entries.length,1);assert.equal(data.authorizations.length,1);assert.equal(boundary.writes,0);
});
test("an existing unbound identity can consult without binding or rewriting the user",async()=>{
  boundary.tables.users.find(u=>u.id==="test-rh").auth_user_id=null;
  const before=structuredClone(boundary.tables);
  assert.equal((await getOptionalActor()).id,"test-rh");
  assert.deepEqual(boundary.tables,before);assert.equal(boundary.writes,0);
});
test("unknown identity cannot bootstrap an organization during a read",async()=>{
  boundary.tables.users=boundary.tables.users.filter(u=>u.id!=="test-rh");
  boundary.authEmail="britojoaomarco@gmail.com";
  await assert.rejects(()=>getOptionalActor());
  assert.equal(boundary.writes,0);
});
test("daily entry endpoint and history return complete arrays, never silently truncated",async()=>{
  const response=await entriesRoute.GET(new Request("http://127.0.0.1:4175/api/time-entries"));
  assert.equal(response.status,200);assert.equal((await response.json()).entries.length,1105);
  boundary.tables.time_entry_versions=Array.from({length:1105},(_,n)=>({id:"version-"+n,time_entry_id:"entry-person-0000",version_number:n+1,previous_data:{},new_data:{},changed_by:"test-rh",change_reason:"Fictício",changed_at:"2026-08-04T12:00:00Z"}));
  const history=await historyRoute.GET(new Request("http://127.0.0.1:4175"),{params:Promise.resolve({id:"entry-person-0000"})});
  assert.equal(history.status,200);assert.equal((await history.json()).versions.length,1105);
});
test("explicit successful sign-in binds an existing user only after authentication",async()=>{
  boundary.tables.users.find(u=>u.id==="test-rh").auth_user_id=null;
  boundary.allowWrites=true;
  const response=await signInRoute.POST(new Request("http://127.0.0.1:4175/api/auth/sign-in",{method:"POST",headers:{origin:"http://127.0.0.1:4175","content-type":"application/json"},body:JSON.stringify({email:"rh@example.com",password:"synthetic-only"})}));
  assert.equal(response.status,200);
  assert.equal(boundary.tables.users.find(u=>u.id==="test-rh").auth_user_id,"auth-rh");
  assert.equal(boundary.writes,1);
});
test("failed sign-in cannot bootstrap data before checking the password",async()=>{
  boundary.tables.users=[];boundary.authError={message:"Synthetic invalid password"};
  const previous=console.error;console.error=()=>{};
  try{
    const response=await signInRoute.POST(new Request("http://127.0.0.1:4175/api/auth/sign-in",{method:"POST",headers:{origin:"http://127.0.0.1:4175","content-type":"application/json"},body:JSON.stringify({email:"britojoaomarco@gmail.com",password:"synthetic-only"})}));
    assert.equal(response.status,401);assert.equal(boundary.writes,0);
  }finally{console.error=previous;}
});
test("export and DEV user list include all records beyond the service cap",async()=>{
  const csv=await reportsRoute.GET(new Request("http://127.0.0.1:4175/api/reports/export?type=entries&from=2026-08-01&to=2026-08-31"));
  assert.equal(csv.status,200);assert.equal((await csv.text()).split("\r\n").length,1106);
  boundary.tables.users.find(u=>u.id==="test-rh").role="DEV";
  const response=await adminRoute.GET();
  assert.equal(response.status,200);assert.equal((await response.json()).users.length,1106);
});
test("complete report reads reject a changed exact count instead of exporting a partial history",async()=>{
  boundary.reportCountOffsetAfter=500;
  await assert.rejects(()=>getAllReportRows(rh,reportFilters),/History changed during read/);
  assert.equal(boundary.writes,0);assert.equal(boundary.rpcCalls,0);
});
test("complete report reads reject duplicate IDs instead of exporting an ambiguous history",async()=>{
  boundary.tables.audit_logs.push({...boundary.tables.audit_logs[0]});
  await assert.rejects(()=>getAllReportRows(rh,reportFilters),/History changed during read/);
  assert.equal(boundary.writes,0);assert.equal(boundary.rpcCalls,0);
});
