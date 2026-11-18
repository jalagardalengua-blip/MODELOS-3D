import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Studio } from './pages/Studio';
import { useStudio } from './store';
import { useEngineStatus, useJobWatcher } from './settings/useEngineStatus';

function App() {
  useEngineStatus();
  useJobWatcher();
  useEffect(() => {
    const { refreshLibrary, log } = useStudio.getState();
    void refreshLibrary().then(() => log('info', 'ALAGARDA 3D STUDIO iniciado. Biblioteca local cargada.'));
  }, []);
  return <Studio />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
