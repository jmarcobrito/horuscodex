import { useState } from "react";
import { createRoot } from "react-dom/client";
import { HorusApp } from "../../app/HorusApp";
import { createWorkflowServer, type TestRole, type TestScenario } from "../helpers/workflow-server";
import "../../app/globals.css";
import "./preview.css";
function Harness() {
  const [role, setRole] = useState<TestRole>("rh");
  const [scenario, setScenario] = useState<TestScenario>("normal");
  const [run, setRun] = useState(() => ({ id: 0, role: "rh" as TestRole, server: createWorkflowServer() }));
  const [report, setReport] = useState("");
  const [realDisconnected, setRealDisconnected] = useState(false);
  const { server } = run;
  function reset() { setRun({ id: run.id + 1, role, server: createWorkflowServer(role, scenario) }); setReport(""); }
  return <>
    <div className="fixture-banner"><strong>TESTE LOCAL — dados fictícios; sem Supabase</strong>
      <details><summary>Controles do ensaio</summary><div className="fixture-controls" key={run.id}>
        <label>Perfil de teste<select value={role} onChange={e => setRole(e.target.value as TestRole)}><option value="rh">RH</option><option value="pj">Colaborador</option><option value="dev">DEV</option></select></label>
        <label>Cenário<select value={scenario} onChange={e => setScenario(e.target.value as TestScenario)}><option value="normal">Normal</option><option value="pending">Pendência</option><option value="empty">Mês sem lançamentos</option><option value="closed">Mês fechado</option><option value="unknown">Metadados indisponíveis</option><option value="range">Intervalo parcial inicial</option></select></label>
        <button onClick={reset}>Reiniciar ensaio</button>
        <button onClick={() => { server.configure({ failDashboard: true }); setReport("Próxima consulta falhará"); }}>Falhar próxima consulta</button>
        <label><input type="checkbox" onChange={e => { server.configure({ delayAugust: e.target.checked }); }} />Atrasar agosto</label>
        <label><input type="checkbox" onChange={e => { server.configure({ failRefreshAfterSave: e.target.checked }); }} />Falhar consulta após salvar</label>
        <label>Histórico fictício<select onChange={e => { server.configure({ historyMode: e.target.value as typeof server.controls.historyMode }); }}><option value="normal">Versões</option><option value="empty">Vazio</option><option value="error">Erro</option><option value="slow">Lento</option></select></label>
        <label>Resultado fictício<select onChange={e => { server.configure({ closingMode: e.target.value as typeof server.controls.closingMode }); }}><option value="normal">Sucesso</option><option value="partial">Falha parcial</option><option value="uncertain">Incerto</option><option value="slow">Lento</option></select></label>
        <label><input type="checkbox" checked={realDisconnected} onChange={e => setRealDisconnected(e.target.checked)} />Fechamento desativado no servidor</label>
        <button onClick={() => setReport(JSON.stringify({ calls: server.calls, closingCalls: server.closingCalls }, null, 2))}>Mostrar chamadas fictícias</button>
        <button onClick={() => setReport(JSON.stringify(server.snapshot(), null, 2))}>Mostrar dias e versões fictícios</button>
        <output><pre>{report}</pre></output>
      </div></details>
    </div>
    <HorusApp key={run.id} accountRole={run.role} user={{ name: run.role === "pj" ? "Ana Exemplo" : "Usuário de teste", email: "test@example.com" }} organizationName="Empresa fictícia" initialDashboard={server.initialDashboard} request={server.request} closingEnabled={!realDisconnected} closingTestMode />
  </>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
