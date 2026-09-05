// Only the external database/auth boundaries are replaced. Real readers/handlers run.
export const boundary = {
  tables: {}, failTable: null, failAfter: 0, writes: 0, rpcCalls: 0, rpcLog: [], rpcResult: null, readRpcCalls: {}, readRpcLog: [],
  maxRows: 1000, reportCountOffsetAfter: null, readsByTable: {}, rangeCallsByTable: {}, authId: "auth-rh", authEmail: "rh@example.com", allowWrites: false, authError: null,
  reset() {
    this.writes = 0; this.rpcCalls = 0; this.rpcLog = []; this.rpcResult = null; this.readRpcCalls = {}; this.readRpcLog = []; this.failTable = null; this.failAfter = 0; this.authorReads = [];
    this.maxRows = 1000; this.reportCountOffsetAfter = null; this.readsByTable = {}; this.rangeCallsByTable = {}; this.authId = "auth-rh"; this.authEmail = "rh@example.com";
    this.allowWrites = false; this.authError = null;
    this.tables = Object.fromEntries(["users","sectors","time_entries","monthly_timesheets","hour_balance_lots","hour_balance_transactions","leave_requests","occurrences","non_business_day_authorizations","audit_logs","organization_policies","time_entry_versions","organizations"].map(t => [t, []]));
    this.tables.organizations.push({id:"test-org",timezone:"America/Sao_Paulo"});
    for (let n = 0; n < 1105; n++) {
      const id = "person-" + String(n).padStart(4,"0");
      this.tables.users.push({ id, organization_id:"test-org", name:id, email:id+"@example.com", role:"PJ", status:n===1104?"INACTIVE":"ACTIVE", auth_user_id:"auth-"+id, organizations:{name:"Fictícia",status:"ACTIVE"} });
      this.tables.time_entries.push({ id:"entry-"+id, organization_id:"test-org", contractor_id:id, work_date:"2026-08-03", start_time:"08:00:00", end_time:"09:00:00", break_minutes:0, calculated_minutes:60, eligible_minutes:60, non_business_day_status:"NOT_APPLICABLE", notes:"Fictício", created_at:"2026-08-03T12:00:00Z", updated_at:"2026-08-03T12:00:00Z" });
      this.tables.monthly_timesheets.push({id:"ts-"+id,organization_id:"test-org",contractor_id:id,year:2026,month:8,required_minutes:60,credited_minutes:0,worked_minutes:60,considered_minutes:60,status:"OPEN",closed_at:null,closed_by:null});
      this.tables.non_business_day_authorizations.push({id:"auth-"+id,organization_id:"test-org",contractor_id:id,work_date:"2026-08-09",estimated_minutes:60,approved_minutes:null,reason:"Fictício",status:"REQUESTED",requested_at:"2026-08-03T12:00:00Z",decision_notes:null});
    }
    this.tables.users.push({id:"test-rh",organization_id:"test-org",name:"RH",email:this.authEmail,role:"RH",status:"ACTIVE",auth_user_id:this.authId,organizations:{name:"Fictícia",status:"ACTIVE"}});
    this.tables.organization_policies.push({id:"test-policy",organization_id:"test-org",monthly_required_minutes:60,positive_balance_after_deadline_policy:"BLOCK_AFTER_DEADLINE",minimum_leave_notice_days:0,retroactive_batch_threshold:3});
    this.tables.audit_logs=Array.from({length:1105},(_,n)=>({ id:"audit-"+String(n).padStart(4,"0"), organization_id:"test-org", user_id:"test-rh", action:"TIME_ENTRY_CREATED", entity_type:"TimeEntry", entity_id:"entry-person-"+String(n).padStart(4,"0"), reason:"Fictício", created_at:"2026-08-04T12:00:00Z", affected_user_id:"person-"+String(n).padStart(4,"0"), related_date:"2026-08-03", category:"entries" }));
    this.tables.users.push({id:"person-other-org",organization_id:"other-org",name:"Outra pessoa",email:"other@example.com",role:"PJ",status:"ACTIVE"});
    this.tables.hour_balance_lots.push({id:"lot-credit",organization_id:"test-org",contractor_id:"person-0000",type:"CREDIT",original_minutes:60,remaining_minutes:60,reserved_minutes:0,origin_date:"2026-08-03",deadline_date:"2026-11-01",status:"AVAILABLE",created_at:"2026-08-03T12:00:00Z"});
    this.tables.hour_balance_transactions.push({id:"transaction-credit",organization_id:"test-org",contractor_id:"person-0000",lot_id:"lot-credit",type:"CREDIT",minutes:60,description:"Crédito fictício",created_at:"2026-08-03T12:00:00Z"});
  },
};
function rowsFor(table) {
  if (!table.startsWith("report_")) return boundary.tables[table] ?? [];
  const users = boundary.tables.users;
  const user = (id, organizationId) => users.find(row => row.id === id && row.organization_id === organizationId) ?? null;
  const sector = (row) => row?.sector_id ? boundary.tables.sectors.find(item => item.id === row.sector_id && item.organization_id === row.organization_id) ?? null : null;
  if (table === "report_time_entries") return boundary.tables.time_entries.map(entry => {
    const person=user(entry.contractor_id,entry.organization_id), currentSector=sector(person);
    return {id:entry.id,organization_id:entry.organization_id,person_id:entry.contractor_id,person_name:person?.name??null,person_email:person?.email??null,sector_id:person?.sector_id??null,sector_name:currentSector?.name??"Sem setor definido",work_date:entry.work_date,start_time:entry.start_time,end_time:entry.end_time,break_minutes:entry.break_minutes,calculated_minutes:entry.calculated_minutes,eligible_minutes:entry.eligible_minutes,non_business_day_status:entry.non_business_day_status,notes:entry.notes,created_at:entry.created_at,updated_at:entry.updated_at,is_retroactive:entry.created_at.slice(0,10)>entry.work_date,has_notes:Boolean(entry.notes?.trim())};
  });
  if (table === "report_balance_transactions") return boundary.tables.hour_balance_transactions.map(transaction => {
    const person=user(transaction.contractor_id,transaction.organization_id), currentSector=sector(person), lot=boundary.tables.hour_balance_lots.find(item=>item.id===transaction.lot_id&&item.organization_id===transaction.organization_id)??null;
    return {id:transaction.id,organization_id:transaction.organization_id,person_id:transaction.contractor_id,person_name:person?.name??null,person_email:person?.email??null,sector_id:person?.sector_id??null,sector_name:currentSector?.name??"Sem setor definido",lot_id:transaction.lot_id,lot_type:lot?.type??null,type:transaction.type,minutes:transaction.minutes,description:transaction.description,related_timesheet_id:transaction.related_timesheet_id??null,related_leave_request_id:transaction.related_leave_request_id??null,created_at:transaction.created_at,event_date:transaction.created_at.slice(0,10),lot_status:lot?.status??null};
  });
  if (table === "report_balance_lots") return boundary.tables.hour_balance_lots.map(lot => {
    const person=user(lot.contractor_id,lot.organization_id), currentSector=sector(person);
    return {id:lot.id,organization_id:lot.organization_id,person_id:lot.contractor_id,person_name:person?.name??null,person_email:person?.email??null,sector_id:person?.sector_id??null,sector_name:currentSector?.name??"Sem setor definido",type:lot.type,original_minutes:lot.original_minutes,remaining_minutes:lot.remaining_minutes,reserved_minutes:lot.reserved_minutes,origin_date:lot.origin_date,deadline_date:lot.deadline_date,status:lot.status,created_at:lot.created_at};
  });
  if (table === "report_audit_events") return boundary.tables.audit_logs.map(audit => {
    const affectedId=audit.affected_user_id??(audit.entity_type==="TimeEntry"?boundary.tables.time_entries.find(entry=>entry.id===audit.entity_id&&entry.organization_id===audit.organization_id)?.contractor_id:null), affected=user(affectedId,audit.organization_id), actor=user(audit.user_id,audit.organization_id), currentSector=sector(affected);
    return {id:audit.id,organization_id:audit.organization_id,actor_id:audit.user_id,action:audit.action,entity_type:audit.entity_type,entity_id:audit.entity_id,reason:audit.reason??null,previous_value:audit.previous_value??null,new_value:audit.new_value??null,created_at:audit.created_at,affected_user_id:affectedId??null,related_date:audit.related_date??null,category:audit.category??"entries",event_date:audit.created_at.slice(0,10),actor_name:actor?.name??null,affected_user_name:affected?.name??null,sector_id:affected?.sector_id??null,sector_name:affected?currentSector?.name??"Sem setor definido":"Não identificado"};
  });
  return [];
}

function reportSummary(args) {
  const kind = args.p_kind;
  const table = kind === "entries" ? "report_time_entries" : kind === "balances" ? "report_balance_transactions" : "report_audit_events";
  const dateKey = kind === "entries" ? "work_date" : "event_date";
  const personKey = kind === "history" ? "affected_user_id" : "person_id";
  const rows = rowsFor(table).filter(row => {
    if (row.organization_id !== args.p_organization_id || row[dateKey] < args.p_from || row[dateKey] > args.p_to) return false;
    if (args.p_person_id && row[personKey] !== args.p_person_id) return false;
    if (args.p_sector_id === "UNASSIGNED" && (row.sector_id !== null || (kind === "history" && row.affected_user_id === null))) return false;
    if (args.p_sector_id && args.p_sector_id !== "UNASSIGNED" && row.sector_id !== args.p_sector_id) return false;
    if (kind === "entries") {
      if (args.p_category === "regular" && (row.is_retroactive || row.non_business_day_status !== "NOT_APPLICABLE")) return false;
      if (args.p_category === "retroactive" && !row.is_retroactive) return false;
      if (args.p_category === "non_business" && row.non_business_day_status === "NOT_APPLICABLE") return false;
      if (args.p_category === "with_notes" && !row.has_notes) return false;
    } else if (args.p_category && row[kind === "balances" ? "type" : "category"] !== args.p_category) return false;
    if (kind === "history" && args.p_actor_id && row.actor_id !== args.p_actor_id) return false;
    return true;
  });
  const timezone = boundary.tables.organizations.find(row => row.id === args.p_organization_id)?.timezone;
  if (kind === "entries") return {
    rowCount: rows.length, timezone,
    workedMinutes: rows.reduce((total, row) => total + row.calculated_minutes, 0),
    consideredMinutes: rows.reduce((total, row) => total + row.eligible_minutes, 0),
  };
  if (kind === "balances") return rows.reduce((summary, row) => {
    const credit = row.type === "CREDIT" || (row.type === "COMPENSATION" && row.lot_type === "DEBIT");
    const debit = ["DEBIT", "CONSUMPTION", "EXPIRATION"].includes(row.type) || (row.type === "COMPENSATION" && row.lot_type === "CREDIT");
    if (credit) summary.creditMinutes += row.minutes;
    if (debit) summary.debitMinutes += row.minutes;
    if (row.type === "RESERVATION") summary.reservationMinutes += row.minutes;
    if (row.type === "CONSUMPTION") summary.utilizationMinutes += row.minutes;
    return summary;
  }, { rowCount: rows.length, timezone, creditMinutes: 0, debitMinutes: 0, reservationMinutes: 0, utilizationMinutes: 0 });
  return { rowCount: rows.length, timezone, events: rows.length, affectedPeople: new Set(rows.map(row => row.affected_user_id).filter(Boolean)).size };
}
class Query {
  constructor(table) { this.table=table; boundary.readsByTable[table] = (boundary.readsByTable[table] ?? 0) + 1; this.filters=[]; this.orders=[]; this.from=0; this.to=Infinity; this.exact=false; this.selected=""; this.applied=false; }
  select(columns,options) {this.selected=columns;this.exact=options?.count==="exact";return this;}
  eq(key,value) {this.filters.push(row=>row[key]===value);return this;}
  in(key,values) {this.filters.push(row=>values.includes(row[key]));if(key==="id")this.selectedIds=[...values];return this;}
  is(key,value) {return this.eq(key,value);}
  neq(key,value) {this.filters.push(row=>row[key]!==value);return this;}
  not(key,operator,value) {if(operator==="is")this.filters.push(row=>value===null?row[key]!==null:row[key]!==value);return this;}
  gte(key,value) {this.filters.push(row=>row[key]>=value);return this;}
  lte(key,value) {this.filters.push(row=>row[key]<=value);return this;}
  order(key,options) {this.orders.push([key,options?.ascending!==false]);return this;}
  limit(n) {this.to=this.from+n-1;return this;}
  range(from,to) {this.from=from;this.to=to;boundary.rangeCallsByTable[this.table]=(boundary.rangeCallsByTable[this.table]??0)+1;return this;}
  insert(values) {boundary.writes++;if(!boundary.allowWrites)throw Error("Forbidden write during read");this.insertValues=Array.isArray(values)?values:[values];return this;}
  update(values) {boundary.writes++;if(!boundary.allowWrites)throw Error("Forbidden write during read");this.updateValues=values;return this;}
  upsert() {boundary.writes++;throw Error("Forbidden write during read");}
  async maybeSingle() {
    const result=this.result(); return {...result,data:result.data?.[0]??null};
  }
  result() {
    if(this.table==="users"&&this.selected==="id,name") boundary.authorReads.push({columns:this.selected,ids:this.selectedIds??null});
    if(boundary.failTable===this.table && this.from>=boundary.failAfter) return {data:null,count:null,error:{message:"Synthetic page failure"}};
    const rows=rowsFor(this.table).filter(row=>this.filters.every(f=>f(row)));
    if(!this.applied&&this.insertValues){boundary.tables[this.table].push(...structuredClone(this.insertValues));this.applied=true;}
    if(!this.applied&&this.updateValues){rows.forEach(row=>Object.assign(row,this.updateValues));this.applied=true;}
    rows.sort((a,b)=>{for(const [key,asc] of this.orders){const cmp=a[key]<b[key]?-1:a[key]>b[key]?1:0;if(cmp)return asc?cmp:-cmp;}return 0;});
    const data=structuredClone(rows.slice(this.from,Math.min(this.to+1,this.from+boundary.maxRows)));
    if(this.table==="users"&&this.selected.includes("sectors!users_sector_organization_fkey")) for(const user of data){
      const sector=boundary.tables.sectors.find(row=>row.id===user.sector_id&&row.organization_id===user.organization_id);
      user.sectors=sector?{name:sector.name}:null;
    }
    const offset = this.table.startsWith("report_") && boundary.reportCountOffsetAfter !== null && this.from >= boundary.reportCountOffsetAfter ? 1 : 0;
    return {data,count:this.exact?rows.length + offset:null,error:null};
  }
  then(resolve,reject) {return Promise.resolve(this.result()).then(resolve,reject);}
}
export class SupabaseConfigurationError extends Error {}
export function getSupabaseAdmin() {return {from:table=>new Query(table),rpc(name,args){
  if(name==="report_summary"){
    boundary.readRpcCalls[name]=(boundary.readRpcCalls[name]??0)+1;boundary.readRpcLog.push({name,args});
    return {data:reportSummary(args),error:null};
  }
  boundary.rpcCalls++;boundary.rpcLog.push({name,args});return boundary.rpcResult??{data:null,error:{message:"Forbidden RPC during read"}};
}};}
export async function createSupabaseServerClient() {
  return {auth:{
    getUser:async()=>({data:{user:{id:boundary.authId,email:boundary.authEmail}},error:null}),
    signInWithPassword:async()=>({data:{user:boundary.authError?null:{id:boundary.authId,email:boundary.authEmail}},error:boundary.authError}),
    signOut:async()=>({error:null}),
  }};
}
