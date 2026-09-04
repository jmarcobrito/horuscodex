// Only the external database/auth boundaries are replaced. Real readers/handlers run.
export const boundary = {
  tables: {}, failTable: null, failAfter: 0, writes: 0, rpcCalls: 0,
  maxRows: 1000, authId: "auth-rh", authEmail: "rh@example.com", allowWrites: false, authError: null,
  reset() {
    this.writes = 0; this.rpcCalls = 0; this.failTable = null; this.failAfter = 0;
    this.maxRows = 1000; this.authId = "auth-rh"; this.authEmail = "rh@example.com";
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
  },
};
class Query {
  constructor(table) { this.table=table; this.filters=[]; this.orders=[]; this.from=0; this.to=Infinity; this.exact=false; this.selected=""; this.applied=false; }
  select(columns,options) {this.selected=columns;this.exact=options?.count==="exact";return this;}
  eq(key,value) {this.filters.push(row=>row[key]===value);return this;}
  is(key,value) {return this.eq(key,value);}
  gte(key,value) {this.filters.push(row=>row[key]>=value);return this;}
  lte(key,value) {this.filters.push(row=>row[key]<=value);return this;}
  order(key,options) {this.orders.push([key,options?.ascending!==false]);return this;}
  limit(n) {this.to=this.from+n-1;return this;}
  range(from,to) {this.from=from;this.to=to;return this;}
  insert(values) {boundary.writes++;if(!boundary.allowWrites)throw Error("Forbidden write during read");this.insertValues=Array.isArray(values)?values:[values];return this;}
  update(values) {boundary.writes++;if(!boundary.allowWrites)throw Error("Forbidden write during read");this.updateValues=values;return this;}
  upsert() {boundary.writes++;throw Error("Forbidden write during read");}
  async maybeSingle() {
    const result=this.result(); return {...result,data:result.data?.[0]??null};
  }
  result() {
    if(boundary.failTable===this.table && this.from>=boundary.failAfter) return {data:null,count:null,error:{message:"Synthetic page failure"}};
    const rows=boundary.tables[this.table].filter(row=>this.filters.every(f=>f(row)));
    if(!this.applied&&this.insertValues){boundary.tables[this.table].push(...structuredClone(this.insertValues));this.applied=true;}
    if(!this.applied&&this.updateValues){rows.forEach(row=>Object.assign(row,this.updateValues));this.applied=true;}
    rows.sort((a,b)=>{for(const [key,asc] of this.orders){const cmp=a[key]<b[key]?-1:a[key]>b[key]?1:0;if(cmp)return asc?cmp:-cmp;}return 0;});
    const data=structuredClone(rows.slice(this.from,Math.min(this.to+1,this.from+boundary.maxRows)));
    if(this.table==="users"&&this.selected.includes("sectors!users_sector_organization_fkey")) for(const user of data){
      const sector=boundary.tables.sectors.find(row=>row.id===user.sector_id&&row.organization_id===user.organization_id);
      user.sectors=sector?{name:sector.name}:null;
    }
    return {data,count:this.exact?rows.length:null,error:null};
  }
  then(resolve,reject) {return Promise.resolve(this.result()).then(resolve,reject);}
}
export class SupabaseConfigurationError extends Error {}
export function getSupabaseAdmin() {return {from:table=>new Query(table),rpc(){boundary.rpcCalls++;throw Error("Forbidden RPC during read");}};}
export async function createSupabaseServerClient() {
  return {auth:{
    getUser:async()=>({data:{user:{id:boundary.authId,email:boundary.authEmail}},error:null}),
    signInWithPassword:async()=>({data:{user:boundary.authError?null:{id:boundary.authId,email:boundary.authEmail}},error:boundary.authError}),
    signOut:async()=>({error:null}),
  }};
}
