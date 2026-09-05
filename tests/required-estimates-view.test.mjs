import assert from "node:assert/strict";
import test from "node:test";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {runnerImport} from "vite";
import {makeWorkflowDashboard} from "./fixtures/monthly-workflow.mjs";
const {module:v}=await runnerImport("./app/HorusViews.tsx",{configFile:false,envDir:false});
const {module:o}=await runnerImport("./app/Overview.tsx",{configFile:false,envDir:false});
const overviewProps = { filters: { personId:null,sectorId:null,status:"all" }, busy:false, receivedAt:null, onFiltersChange(){}, onPeriodChange(){}, onRefresh(){}, onIntent(){} };
const notice = /Inclui estimativa para meses sem registro mensal/;
const render = (view,props) => renderToStaticMarkup(createElement(view,props));

test("dashboard labels estimated monthly requirements only when present",()=>{
  const data=makeWorkflowDashboard();
  assert.doesNotMatch(render(o.Overview,{data,...overviewProps}),notice);
  data.metrics.estimatedRequiredPersonMonths=2;
  assert.match(render(o.Overview,{data,...overviewProps}),notice);
});

test("entries estimate notice follows the selected person and stays out of daily review",()=>{
  const data=makeWorkflowDashboard();
  data.metrics.estimatedRequiredPersonMonths=1;
  data.contractors[0].estimatedRequiredMonths=0;
  data.contractors[2].estimatedRequiredMonths=1;
  const props={data,role:"rh",onNew(){},onEdit(){},onHistory(){}};
  assert.match(render(v.EntriesView,props),notice);
  assert.doesNotMatch(render(v.EntriesView,{...props,contractorId:"person-1"}),notice);
  assert.match(render(v.EntriesView,{...props,contractorId:"person-3"}),notice);
  assert.doesNotMatch(render(v.EntriesView,{...props,displayMode:"day"}),notice);
  assert.doesNotMatch(render(v.EntriesView,{...props,role:"pj"}),notice);
});
