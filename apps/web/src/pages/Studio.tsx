/**
 * Distribución principal del estudio:
 * barra superior · panel izquierdo · visor central · panel derecho · barra inferior.
 * En pantallas pequeñas los paneles laterales se abren como capas.
 */
import { useStudio } from '../store';
import { TopBar } from '../components/TopBar';
import { BottomBar } from '../components/BottomBar';
import { Tabs } from '../components/ui';
import { Viewport } from '../editor/Viewport';
import { LibraryPanel } from '../library/LibraryPanel';
import { GeneratorPanel } from '../generator/GeneratorPanel';
import { PropertiesPanel } from '../editor/PropertiesPanel';
import { MaterialsPanel } from '../editor/MaterialsPanel';
import { ValidationPanel } from '../editor/ValidationPanel';
import { EnginePanel } from '../settings/EnginePanel';

function LeftPanel() {
  const tab = useStudio((s) => s.leftTab);
  const setTab = useStudio((s) => s.setLeftTab);
  const count = useStudio((s) => s.assets.length);
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'biblioteca', label: 'Biblioteca', badge: <span className="text-[9px] text-zinc-500">{count}</span> },
          { id: 'generador', label: 'Generador' },
        ]}
      />
      {tab === 'biblioteca' ? <LibraryPanel /> : <GeneratorPanel />}
    </>
  );
}

function RightPanel() {
  const tab = useStudio((s) => s.rightTab);
  const setTab = useStudio((s) => s.setRightTab);
  const hasErrors = useStudio((s) => (s.loaded ? !s.loaded.validation.ok : false));
  return (
    <>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'propiedades', label: 'Propiedades' },
          { id: 'materiales', label: 'Materiales' },
          { id: 'validacion', label: 'GLB', badge: hasErrors ? <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> : undefined },
          { id: 'motor', label: 'Motor' },
        ]}
      />
      {tab === 'propiedades' && <PropertiesPanel />}
      {tab === 'materiales' && <MaterialsPanel />}
      {tab === 'validacion' && <ValidationPanel />}
      {tab === 'motor' && <EnginePanel />}
    </>
  );
}

const asideBase = 'flex min-h-0 flex-col bg-[var(--panel)]';

export function Studio() {
  const mobilePanel = useStudio((s) => s.mobilePanel);
  const setMobilePanel = useStudio((s) => s.setMobilePanel);

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        <aside className={`${asideBase} hidden w-72 shrink-0 border-r border-[var(--line)] lg:flex`}>
          <LeftPanel />
        </aside>

        <main className="relative min-w-0 flex-1">
          <Viewport />
        </main>

        <aside className={`${asideBase} hidden w-[22rem] shrink-0 border-l border-[var(--line)] lg:flex`}>
          <RightPanel />
        </aside>

        {mobilePanel && (
          <div className="absolute inset-0 z-20 flex lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobilePanel(null)} />
            <aside
              className={`${asideBase} relative z-10 w-[86%] max-w-sm shadow-2xl ${
                mobilePanel === 'left' ? 'border-r border-[var(--line)]' : 'ml-auto border-l border-[var(--line)]'
              }`}
            >
              {mobilePanel === 'left' ? <LeftPanel /> : <RightPanel />}
            </aside>
          </div>
        )}
      </div>
      <BottomBar />
    </div>
  );
}
