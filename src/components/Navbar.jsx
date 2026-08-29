import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import toast from 'react-hot-toast';

const navItems = [
  { to: '/',          icon: '🏠', label: 'Dashboard' },
  { to: '/saida',     icon: '📤', label: 'Registrar Saída', highlight: true },
  { to: '/entrada',   icon: '📥', label: 'Registrar Entrada' },
];

const managementItems = [
  { to: '/estoque',        icon: '📦', label: 'Estoque' },
  { to: '/estoque-morto',  icon: '🏷️', label: 'Estoque Morto / Venda' },
  { to: '/historico',      icon: '📋', label: 'Histórico' },
  { to: '/produtos',       icon: '🗂️', label: 'Produtos' },
  { to: '/imprimir',       icon: '🖨️', label: 'Imprimir Ficha' },
  { to: '/importar',       icon: '⬆️', label: 'Importar Dados' },
  { to: '/relatorios',     icon: '📊', label: 'Relatórios & KPIs' },
];

const ALL_SYSTEM_USERS = [
  { name: 'EDUARDO', email: 'eduardo@controle-epi.gel' },
  { name: 'JOARLISON', email: 'joarlison@controle-epi.gel' },
  { name: 'CICERO', email: 'cicero@controle-epi.gel' },
  { name: 'EULLON', email: 'eullon@controle-epi.gel' },
];

function getInitials(email) {
  if (!email) return '?';
  return email.split('@')[0].slice(0, 2).toUpperCase();
}

export default function Navbar() {
  const { user, logout, isLeader, directResetPasswordByLeader, cancelResetRequest } = useAuth();
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches
  );

  // Estados para troca direta de senha pelo líder
  const [targetUserEmail, setTargetUserEmail] = useState('eduardo@controle-epi.gel');
  const [newDirectPassword, setNewDirectPassword] = useState('');
  const [directResetLoading, setDirectResetLoading] = useState(false);

  // Escuta em tempo real solicitações de redefinição para o líder Eullon
  useEffect(() => {
    if (!isLeader) return;

    try {
      const q = query(
        collection(db, 'solicitacoes_senha'),
        where('status', '==', 'pendente')
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const reqs = [];
        snapshot.forEach(doc => {
          reqs.push({ id: doc.id, ...doc.data() });
        });
        setPendingRequests(reqs);
      }, (err) => {
        console.warn("Erro ao ouvir solicitações de senha:", err);
      });

      return unsub;
    } catch (e) {
      console.warn(e);
    }
  }, [isLeader]);

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

  function handleCopyCode(code, userName) {
    if (!navigator.clipboard) {
      toast.success(`Código de ${userName}: ${code}`);
      return;
    }
    navigator.clipboard.writeText(code);
    toast.success(`Código [ ${code} ] copiado! Passe para ${userName}.`, { icon: '📋' });
  }

  async function handleCancelRequest(email) {
    try {
      await cancelResetRequest(email);
      toast.success('Solicitação removida.');
    } catch (e) {
      toast.error('Erro ao cancelar solicitação');
    }
  }

  async function handleDirectPasswordSubmit(e) {
    e.preventDefault();
    if (newDirectPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setDirectResetLoading(true);
    try {
      await directResetPasswordByLeader(targetUserEmail, newDirectPassword);
      const userSelected = ALL_SYSTEM_USERS.find(u => u.email === targetUserEmail);
      toast.success(`Senha de ${userSelected?.name || targetUserEmail} alterada com sucesso!`, { icon: '✅' });
      setNewDirectPassword('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao alterar senha.');
    } finally {
      setDirectResetLoading(false);
    }
  }

  return (
    <>
      {/* Desktop Sidebar Navbar */}
      <nav className="navbar desktop-nav">
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

          {/* Botão de Gestão de Senhas exclusivo para o Líder Eullon */}
          {isLeader && (
            <button
              onClick={() => setShowPasswordModal(true)}
              className="nav-item"
              style={{
                marginTop: '0.75rem',
                background: pendingRequests.length > 0 
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(239, 68, 68, 0.2))'
                  : 'rgba(255, 255, 255, 0.04)',
                border: pendingRequests.length > 0
                  ? '1px solid rgba(245, 158, 11, 0.6)'
                  : '1px solid var(--border)',
                color: pendingRequests.length > 0 ? '#fbbf24' : 'var(--text-secondary)',
                fontWeight: 600,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: pendingRequests.length > 0 ? '0 0 15px rgba(245, 158, 11, 0.25)' : 'none'
              }}
              title="Gerenciar senhas dos usuários"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="nav-icon">🔑</span>
                <span>Senhas de Acesso</span>
              </div>
              {pendingRequests.length > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  borderRadius: '999px',
                  padding: '2px 7px',
                  lineHeight: 1.2,
                  animation: 'pulse 1.5s infinite'
                }}>
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}

          {!isInstalled && (
            <button
              onClick={handleInstallApp}
              className="nav-item"
              style={{
                marginTop: '1.25rem',
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
              <div className="user-name">
                {user?.email?.split('@')[0]?.toUpperCase()}
                {isLeader && <span style={{ marginLeft: 4, color: 'var(--accent-yellow)' }}>👑</span>}
              </div>
              <div className="user-role">{isLeader ? 'Líder / Admin' : 'Usuário'}</div>
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
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <div className="mobile-bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-icon">🏠</span>
          <span className="mobile-nav-label">Início</span>
        </NavLink>
        <NavLink to="/saida" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-icon">📤</span>
          <span className="mobile-nav-label">Saída</span>
        </NavLink>
        <NavLink to="/entrada" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-icon">📥</span>
          <span className="mobile-nav-label">Entrada</span>
        </NavLink>
        <NavLink to="/estoque" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <span className="mobile-nav-icon">📦</span>
          <span className="mobile-nav-label">Estoque</span>
        </NavLink>
        <button 
          onClick={() => setIsMobileMenuOpen(true)} 
          className={`mobile-nav-item ${isMobileMenuOpen ? 'active' : ''}`}
          style={{ position: 'relative' }}
        >
          <span className="mobile-nav-icon">☰</span>
          <span className="mobile-nav-label">Mais</span>
          {isLeader && pendingRequests.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '18px',
              background: '#ef4444',
              color: 'white',
              fontSize: '0.65rem',
              fontWeight: 700,
              borderRadius: '999px',
              padding: '1px 5px',
              lineHeight: 1
            }}>
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile Bottom Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="mobile-drawer-overlay" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div className="logo-badge">
                <div className="logo-icon" style={{ width: 30, height: 30, fontSize: '0.9rem' }}>🪖</div>
                <div className="logo-text">
                  <div className="logo-title" style={{ fontSize: '0.75rem' }}>CONTROLE DE EPI</div>
                  <div className="logo-sub" style={{ fontSize: '0.6rem' }}>GEL Engenharia</div>
                </div>
              </div>
              <button className="mobile-drawer-close" onClick={() => setIsMobileMenuOpen(false)}>×</button>
            </div>

            <div className="mobile-drawer-content">
              <div className="drawer-section">
                <div className="nav-section-label">Gestão</div>
                <NavLink to="/estoque-morto" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `drawer-item ${isActive ? 'active' : ''}`}>
                  <span className="drawer-icon">🏷️</span> Estoque Morto / Venda
                </NavLink>
                <NavLink to="/historico" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `drawer-item ${isActive ? 'active' : ''}`}>
                  <span className="drawer-icon">📋</span> Histórico
                </NavLink>
                <NavLink to="/produtos" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `drawer-item ${isActive ? 'active' : ''}`}>
                  <span className="drawer-icon">🗂️</span> Produtos
                </NavLink>
                <NavLink to="/imprimir" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `drawer-item ${isActive ? 'active' : ''}`}>
                  <span className="drawer-icon">🖨️</span> Imprimir Ficha
                </NavLink>
                <NavLink to="/importar" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `drawer-item ${isActive ? 'active' : ''}`}>
                  <span className="drawer-icon">⬆️</span> Importar Dados
                </NavLink>
                <NavLink to="/relatorios" onClick={() => setIsMobileMenuOpen(false)} className={({ isActive }) => `drawer-item ${isActive ? 'active' : ''}`}>
                  <span className="drawer-icon">📊</span> Relatórios & KPIs
                </NavLink>

                {isLeader && (
                  <button
                    onClick={() => { setIsMobileMenuOpen(false); setShowPasswordModal(true); }}
                    className="drawer-item"
                    style={{
                      background: pendingRequests.length > 0 ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                      color: pendingRequests.length > 0 ? '#fbbf24' : 'var(--text-secondary)',
                      fontWeight: 600,
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className="drawer-icon">🔑</span>
                      <span>Gerenciar Senhas</span>
                    </div>
                    {pendingRequests.length > 0 && (
                      <span style={{ background: '#ef4444', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '999px' }}>
                        {pendingRequests.length}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {!isInstalled && (
                <button
                  onClick={() => { setIsMobileMenuOpen(false); handleInstallApp(); }}
                  className="drawer-item install-btn"
                  style={{
                    marginTop: '1rem',
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.15))',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    color: '#60a5fa',
                    fontWeight: '600'
                  }}
                >
                  <span className="drawer-icon">📲</span> Instalar Aplicativo
                </button>
              )}

              <div className="drawer-footer-user" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div className="user-card" style={{ padding: 0, border: 'none', background: 'none' }}>
                  <div className="user-avatar">{getInitials(user?.email)}</div>
                  <div className="user-info" style={{ flex: 1, marginLeft: '0.75rem' }}>
                    <div className="user-name" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      {user?.email?.split('@')[0]?.toUpperCase()}
                      {isLeader && <span style={{ marginLeft: 4, color: 'var(--accent-yellow)' }}>👑</span>}
                    </div>
                    <div className="user-role" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {isLeader ? 'Líder / Admin' : 'Usuário'}
                    </div>
                  </div>
                  <button
                    className="btn btn-danger-outline btn-logout-mobile"
                    onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '8px' }}
                  >
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Senhas do Líder Eullon */}
      {showPasswordModal && (
        <div className="install-modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="install-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="install-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>👑</span>
                <h3 style={{ margin: 0 }}>Painel do Líder — Gerenciar Senhas</h3>
              </div>
              <button onClick={() => setShowPasswordModal(false)} className="install-modal-close">×</button>
            </div>

            <div className="install-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Seção 1: Solicitações de Redefinição com Código */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h4 style={{ color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>🔔</span> Solicitações de Redefinição ({pendingRequests.length})
                  </h4>
                </div>

                {pendingRequests.length === 0 ? (
                  <div style={{
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border)',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem'
                  }}>
                    ✅ Nenhuma solicitação pendente no momento.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {pendingRequests.map(req => (
                      <div
                        key={req.id}
                        style={{
                          background: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                              👤 {req.userName || req.email}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Solicitado para: {req.email}
                            </div>
                          </div>

                          <button
                            onClick={() => handleCancelRequest(req.email)}
                            className="btn btn-sm btn-ghost"
                            style={{ color: 'var(--accent-red)', padding: '2px 8px', fontSize: '0.75rem' }}
                            title="Remover solicitação"
                          >
                            ✕ Cancelar
                          </button>
                        </div>

                        {/* Código de 6 dígitos em destaque */}
                        <div style={{
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Código de Autorização:
                            </div>
                            <div style={{
                              fontSize: '1.5rem',
                              fontWeight: 800,
                              letterSpacing: '5px',
                              color: '#fbbf24',
                              fontFamily: 'monospace'
                            }}>
                              {req.code}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => handleCopyCode(req.code, req.userName || 'Usuário')}
                            style={{ gap: '4px' }}
                          >
                            📋 Copiar Código
                          </button>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          💡 <em>Informe este código de 6 dígitos para {req.userName} digitar na tela de redefinição de senha.</em>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Seção 2: Alterar Senha Diretamente */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem'
              }}>
                <h4 style={{ color: 'var(--accent-blue-light)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚙️</span> Alterar Senha de Qualquer Usuário Imediatamente
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Como líder, você pode definir a senha diretamente para qualquer usuário sem precisar de código:
                </p>

                <form onSubmit={handleDirectPasswordSubmit}>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Selecionar Usuário</label>
                    <select
                      className="form-select"
                      value={targetUserEmail}
                      onChange={(e) => setTargetUserEmail(e.target.value)}
                    >
                      {ALL_SYSTEM_USERS.map(u => (
                        <option key={u.email} value={u.email}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Nova Senha (mínimo 6 caracteres)</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Digite a nova senha para o usuário"
                      value={newDirectPassword}
                      onChange={(e) => setNewDirectPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={directResetLoading}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {directResetLoading ? 'Salvando...' : '💾 Salvar Nova Senha do Usuário'}
                  </button>
                </form>
              </div>
            </div>

            <div className="install-modal-footer">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Instalação do App */}
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
    </>
  );
}

