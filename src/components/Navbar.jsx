import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/',          icon: '🏠', label: 'Dashboard' },
  { to: '/saida',     icon: '📤', label: 'Registrar Saída', highlight: true },
  { to: '/entrada',   icon: '📥', label: 'Registrar Entrada' },
];

const managementItems = [
  { to: '/estoque',   icon: '📦', label: 'Estoque' },
  { to: '/historico', icon: '📋', label: 'Histórico' },
  { to: '/produtos',  icon: '🗂️', label: 'Produtos' },
  { to: '/imprimir',  icon: '🖨️', label: 'Imprimir Ficha' },
  { to: '/importar',  icon: '⬆️', label: 'Importar Dados' },
];

function getInitials(email) {
  if (!email) return '?';
  return email.split('@')[0].slice(0, 2).toUpperCase();
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (e) => setIsInstalled(e.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  async function handleInstallApp() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success('App instalado com sucesso!');
        setDeferredPrompt(null);
      }
    } else {
      if (isInstalled) {
        toast.success('O app já está instalado e rodando!');
      } else {
        setShowModal(true);
      }
    }
  }

  async function handleLogout() {
    try {
      await logout();
      navigate('/login');
      toast.success('Sessão encerrada');
    } catch {
      toast.error('Erro ao sair');
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <div className="logo-badge">
          <div className="logo-icon">🪖</div>
          <div className="logo-text">
            <div className="logo-title">CONTROLE DE EPI</div>
            <div className="logo-sub">GEL Engenharia</div>
          </div>
        </div>
      </div>

      <div className="navbar-nav">
        <div className="nav-section-label">Operações</div>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="nav-section-label">Gestão</div>
        {managementItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        {!isInstalled && (
          <button
            onClick={handleInstallApp}
            className="nav-item"
            style={{
              marginTop: '1.5rem',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.15))',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#60a5fa',
              fontWeight: '600',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(59, 130, 246, 0.15)'
            }}
            id="btn-instalar-app"
          >
            <span className="nav-icon">💻</span>
            Baixar App no PC
          </button>
        )}
      </div>

      <div className="navbar-footer">
        <div className="user-card">
          <div className="user-avatar">{getInitials(user?.email)}</div>
          <div className="user-info">
            <div className="user-name">{user?.email?.split('@')[0]}</div>
            <div className="user-role">Usuário</div>
          </div>
          <button
            className="btn-logout"
            onClick={handleLogout}
            title="Sair"
            id="btn-logout"
          >
            ⏏
          </button>
        </div>
      </div>

      {showModal && (
        <div className="install-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="install-modal" onClick={(e) => e.stopPropagation()}>
            <div className="install-modal-header">
              <h3>💻 Baixar App no PC / Celular</h3>
              <button onClick={() => setShowModal(false)} className="install-modal-close">×</button>
            </div>
            <div className="install-modal-body">
              <p>Você pode instalar o <strong>Controle de EPI GEL</strong> como um aplicativo dedicado no seu computador ou celular. Ele funcionará como um programa normal!</p>
              
              <div className="install-instruction-section">
                <h4>🖥️ No Computador (Google Chrome ou Microsoft Edge)</h4>
                <ol>
                  <li>Olhe para a <strong>barra de endereços</strong> do navegador (onde fica o link da página, lá em cima).</li>
                  <li>No lado direito da barra, clique no ícone de <strong>Instalar</strong> (computador com uma setinha para baixo ⤓ ou símbolo de "+").</li>
                  <li>Confirme clicando em <strong>Instalar</strong>.</li>
                </ol>
              </div>

              <div className="install-instruction-section" style={{ marginTop: '1rem' }}>
                <h4>📱 No Celular (Android ou iPhone)</h4>
                <ul>
                  <li><strong>Android (Chrome):</strong> Clique nos 3 pontinhos no canto superior direito e selecione <strong>"Adicionar à tela inicial"</strong> ou <strong>"Instalar aplicativo"</strong>.</li>
                  <li><strong>iPhone (Safari):</strong> Clique no botão de <strong>Compartilhar</strong> (quadrado com seta para cima) e selecione <strong>"Adicionar à Tela de Início"</strong>.</li>
                </ul>
              </div>
            </div>
            <div className="install-modal-footer">
              <button onClick={() => setShowModal(false)} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
