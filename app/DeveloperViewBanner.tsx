export function DeveloperViewBanner({ collaboratorName, onBack }: { collaboratorName: string; onBack: () => void }) {
  return <div className="dev-view-banner">
    <span>VISUALIZAÇÃO DEV</span>
    <div>
      <strong>Você está vendo o Horus como {collaboratorName}</strong>
      <p>Modo de visualização — somente leitura. Nenhuma ação será realizada em nome desta pessoa.</p>
    </div>
    <button onClick={onBack}>Voltar à visão RH</button>
  </div>;
}
