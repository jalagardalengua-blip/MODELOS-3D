import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Studio } from './pages/Studio';
import { useStudio } from './store';

function App() {
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
