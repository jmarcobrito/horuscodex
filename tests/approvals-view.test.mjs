import assert from "node:assert/strict";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {runnerImport} from "vite";
import {makeWorkflowDashboard} from "./fixtures/monthly-workflow.mjs";
const {module:v}=await runnerImport("./app/HorusViews.tsx",{configFile:false,envDir:false});
const actions={onNewLeave(){},onNewOccurrence(){},onNewAuthorization(){},onDecision(){}};
function data() {
  const d=makeWorkflowDashboard();
  d.requests=[{id:"leave",contractorId:"person-1",contractorName:"Ana Exemplo",startDate:"2026-08-12",endDate:"2026-08-12",requestedMinutes:60,reservedMinutes:0,status:"APPROVED",reason:"Folga aprovada",requestedAt:"2026-08-01",decisionNotes:""}];
  d.occurrences=[{id:"occ",contractorId:"person-2",contractorName:"Bruno Teste",type:"OTHER",startDate:"2026-08-12",endDate:"2026-08-12",minutes:60,status:"REQUESTED",calculationEffect:"DOES_NOT_CREDIT",description:"Ocorrência pendente",createdAt:"2026-08-01",decisionNotes:""}];
  d.authorizations=[{id:"auth",contractorId:"person-1",contractorName:"Ana Exemplo",workDate:"2026-08-12",estimatedMinutes:60,approvedMinutes:null,status:"NEEDS_ADJUSTMENT",reason:"Autorização com ajuste",requestedAt:"2026-08-01",decisionNotes:""}];
  return d;
}
test("approvals start with pending decisions and adjustments, not already approved requests",()=>{
  const html=renderToStaticMarkup(createElement(v.RequestsView,{data:data(),role:"rh",...actions}));
  assert.match(html,/Ocorrência pendente/); assert.match(html,/Autorização com ajuste/);
  assert.doesNotMatch(html,/Folga aprovada/);
  assert.match(html,/Aguardando decisão do RH/); assert.match(html,/Aguardando ajuste/);
});
test("person, type and situation filters intersect without hiding utilization in all situations",()=>{
  const html=renderToStaticMarkup(createElement(v.RequestsView,{data:data(),role:"rh",filters:{scope:"all",status:"all",kind:"leave",personId:"person-1"},...actions}));
  assert.match(html,/Folga aprovada/); assert.match(html,/Marcar utilizada/);
  assert.doesNotMatch(html,/Ocorrência pendente|Autorização com ajuste/);
  const empty=renderToStaticMarkup(createElement(v.RequestsView,{data:data(),role:"rh",filters:{scope:"all",status:"pending",kind:"all",personId:"unavailable"},...actions}));
  assert.match(empty,/Nenhuma pendência com estes filtros/);
  assert.doesNotMatch(empty,/Ocorrência pendente|Autorização com ajuste/);
});
