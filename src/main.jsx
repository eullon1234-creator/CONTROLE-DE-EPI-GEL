import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = import.meta.env.DEV ? '/sw.js' : '/CONTROLE-DE-EPI-GEL/sw.js';
    navigator.serviceWorker.register(swPath)
      .then(reg => console.log('Service Worker registrado:', reg.scope))
      .catch(err => console.log('Erro ao registrar Service Worker:', err));
  });
}
