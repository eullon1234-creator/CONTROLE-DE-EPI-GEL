import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const USERS = [
  { name: 'EULLON', email: 'eullon@controle-epi.gel', avatarClass: 'avatar-eullon', initials: 'EU', isLeader: true },
  { name: 'EDUARDO', email: 'eduardo@controle-epi.gel', avatarClass: 'avatar-eduardo', initials: 'ED' },
  { name: 'JOARLISON', email: 'joarlison@controle-epi.gel', avatarClass: 'avatar-joarlison', initials: 'JO' },
  { name: 'CICERO', email: 'cicero@controle-epi.gel', avatarClass: 'avatar-cicero', initials: 'CI' },
];

export default function Login() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'reset'
  const [loading, setLoading] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [codeGenerated, setCodeGenerated] = useState(false);
  const [error, setError] = useState('');
  
  const { login, signup, requestPasswordReset, resetPasswordWithCode } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!selectedUser) {
      setError('Por favor, selecione um usuário.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    // Modo REDEFINIR SENHA com código do líder
    if (mode === 'reset') {
      if (!resetCode || resetCode.trim().length < 6) {
        setError('Por favor, insira o código de 6 dígitos fornecido pelo líder EULLON.');
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas digitadas não coincidem.');
        return;
      }

      setLoading(true);
      try {
        await resetPasswordWithCode(selectedUser.email, resetCode, password);
        toast.success('Senha redefinida com sucesso! Fazendo login...');
        await login(selectedUser.email, password);
        navigate('/');
      } catch (err) {
        console.error(err);
        setError(err.message || 'Erro ao redefinir senha.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Modo CADASTRO (Primeiro Acesso)
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('As senhas não coincidem.');
        return;
      }

      setLoading(true);
      try {
        await signup(selectedUser.email, password);
        toast.success('Senha criada! Bem-vindo ao sistema!');
        navigate('/');
      } catch (err) {
        console.error(err);
        let msg = 'Erro ao cadastrar senha. Tente novamente.';
        if (err.code === 'auth/email-already-in-use') {
          msg = 'Este usuário já possui uma senha cadastrada. Faça login ou solicite redefinição ao líder EULLON.';
        } else if (err.code === 'auth/weak-password') {
          msg = 'A senha fornecida é muito fraca. Digite pelo menos 6 caracteres.';
        }
        setError(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Modo LOGIN normal
    setLoading(true);
    try {
      await login(selectedUser.email, password);
      toast.success('Bem-vindo de volta!');
      navigate('/');
    } catch (err) {
      console.error(err);
      let msg = 'Erro ao realizar login. Verifique sua senha.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Senha incorreta. Se esqueceu sua senha, use a aba "🔑 Redefinir Senha".';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'Usuário sem senha cadastrada. Use a aba "✨ Criar Senha".';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartReset() {
    setError('');
    setRequestingCode(true);
    try {
      await requestPasswordReset(selectedUser);
      setCodeGenerated(true);
      setMode('reset');
      setPassword('');
      setConfirmPassword('');
      setResetCode('');
      toast.success(`Código gerado e enviado para o líder EULLON!`, { duration: 6000, icon: '🔔' });
    } catch (err) {
      console.error(err);
      setError('Erro ao solicitar código. Tente novamente.');
      toast.error('Erro ao gerar solicitação');
    } finally {
      setRequestingCode(false);
    }
  }

  function handleSelectUser(user) {
    setSelectedUser(user);
    setPassword('');
    setConfirmPassword('');
    setResetCode('');
    setMode('login');
    setCodeGenerated(false);
    setError('');
  }

  function handleBackToUsers() {
    setSelectedUser(null);
    setPassword('');
    setConfirmPassword('');
    setResetCode('');
    setMode('login');
    setCodeGenerated(false);
    setError('');
  }

  return (
    <div className="login-page">
      <div className="login-bg-glow" />

      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle">🪖</div>
          <h1>CONTROLE DE EPI</h1>
          <p>GEL Engenharia — Acesso ao Sistema</p>
        </div>

        {error && (
          <div className="login-error" style={{ marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        {!selectedUser ? (
          <div>
            <p style={{ textAlign: 'center', marginBottom: '1.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Selecione quem você é para continuar:
            </p>
            <div className="user-select-grid">
              {USERS.map(user => (
                <div
                  key={user.name}
                  className="user-select-card"
                  onClick={() => handleSelectUser(user)}
                >
                  <div className={`user-select-avatar ${user.avatarClass}`}>
                    {user.initials}
                  </div>
                  <div className="user-select-name">
                    {user.name}
                    {user.isLeader && (
                      <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--accent-yellow)', fontWeight: 600, marginTop: '2px' }}>
                        👑 LÍDER
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Cada usuário possui sua própria senha individual no sistema.
            </p>
          </div>
        ) : (
          <div className="login-form-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Usuário Selecionado</span>
              <button
                type="button"
                className="btn-back-user"
                onClick={handleBackToUsers}
              >
                ← Trocar Usuário
              </button>
            </div>

            <div className="selected-user-summary">
              <div className={`user-select-avatar ${selectedUser.avatarClass}`}>
                {selectedUser.initials}
              </div>
              <div className="selected-user-summary-info">
                <div className="selected-user-summary-name">
                  {selectedUser.name}
                  {selectedUser.isLeader && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--accent-yellow)' }}>👑 Líder</span>}
                </div>
                <div className="selected-user-summary-label">
                  {selectedUser.email}
                </div>
              </div>
            </div>

            {/* ABAS DE NAVEGAÇÃO SUPER VISÍVEIS */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              margin: '1rem 0',
              gap: '4px',
              border: '1px solid var(--border)'
            }}>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.25rem',
                  fontSize: '0.8125rem',
                  fontWeight: mode === 'login' ? 700 : 500,
                  background: mode === 'login' ? 'var(--accent-blue)' : 'transparent',
                  color: mode === 'login' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <span>🔐</span> Entrar
              </button>

              <button
                type="button"
                onClick={() => { setMode('reset'); setError(''); }}
                style={{
                  flex: 1.2,
                  padding: '0.5rem 0.25rem',
                  fontSize: '0.8125rem',
                  fontWeight: mode === 'reset' ? 700 : 500,
                  background: mode === 'reset' ? 'linear-gradient(135deg, #d97706, #f59e0b)' : 'transparent',
                  color: mode === 'reset' ? '#ffffff' : '#fbbf24',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <span>🔑</span> Esqueci a Senha
              </button>

              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.25rem',
                  fontSize: '0.8125rem',
                  fontWeight: mode === 'register' ? 700 : 500,
                  background: mode === 'register' ? 'var(--accent-green)' : 'transparent',
                  color: mode === 'register' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <span>✨</span> 1º Acesso
              </button>
            </div>

            {/* CONTEÚDO DA ABA: ESQUECI A SENHA (REDEFINIÇÃO) */}
            {mode === 'reset' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.875rem 1rem',
                  fontSize: '0.8125rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.45
                }}>
                  <div style={{ fontWeight: 700, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span>🛡️</span> Como Redefinir a Senha com o Líder EULLON:
                  </div>
                  <div>
                    1. Clique no botão amarelo abaixo para <strong>gerar e enviar o código</strong> para o painel do Líder EULLON.<br/>
                    2. Peça os <strong>6 dígitos</strong> para o Eullon.<br/>
                    3. Digite o código e sua nova senha para redefinir na hora!
                  </div>
                </div>

                {!codeGenerated ? (
                  <button
                    type="button"
                    onClick={handleStartReset}
                    disabled={requestingCode}
                    className="btn btn-lg"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#ffffff',
                      fontWeight: 700,
                      justifyContent: 'center',
                      boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
                      padding: '0.875rem'
                    }}
                  >
                    {requestingCode ? (
                      <>
                        <div className="loading-spin" style={{ width: 16, height: 16 }} />
                        Enviando código ao Líder Eullon...
                      </>
                    ) : (
                      <>📩 Gerar e Enviar Código ao Líder EULLON</>
                    )}
                  </button>
                ) : (
                  <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label" htmlFor="reset-code" style={{ color: '#fbbf24', fontWeight: 600 }}>
                          Código de 6 Dígitos (do Líder)
                        </label>
                        <button
                          type="button"
                          onClick={handleStartReset}
                          disabled={requestingCode}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-blue-light)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          🔄 Reenviar Código
                        </button>
                      </div>
                      <input
                        id="reset-code"
                        type="text"
                        maxLength={6}
                        className="form-input"
                        placeholder="Ex: 839201"
                        value={resetCode}
                        onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
                        style={{
                          letterSpacing: '5px',
                          fontSize: '1.35rem',
                          textAlign: 'center',
                          fontWeight: 800,
                          color: '#fbbf24',
                          background: 'rgba(245, 158, 11, 0.06)',
                          borderColor: 'rgba(245, 158, 11, 0.5)'
                        }}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="new-password">Nova Senha</label>
                      <input
                        id="new-password"
                        type="password"
                        className="form-input"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="confirm-new-password">Confirmar Nova Senha</label>
                      <input
                        id="confirm-new-password"
                        type="password"
                        className="form-input"
                        placeholder="Repita a nova senha"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary btn-lg"
                      disabled={loading}
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        width: '100%',
                        justifyContent: 'center',
                        fontWeight: 700,
                        marginTop: '0.5rem'
                      }}
                    >
                      {loading ? 'Salvando...' : '✅ Confirmar e Salvar Nova Senha'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* CONTEÚDO DA ABA: LOGIN NORMAL */}
            {mode === 'login' && (
              <form className="login-form" onSubmit={handleSubmit} id="login-form">
                <div className="form-group" style={{ marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label" htmlFor="password">Senha</label>
                    <button
                      type="button"
                      onClick={() => { setMode('reset'); setError(''); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#fbbf24',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <button
                  id="btn-login"
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={loading}
                  style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
                >
                  {loading ? (
                    <>
                      <div className="loading-spin" style={{ width: 16, height: 16 }} />
                      Entrando...
                    </>
                  ) : (
                    <>🔐 Entrar</>
                  )}
                </button>

                {/* Botão de destaque para redefinição */}
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(''); }}
                  className="btn btn-block"
                  style={{
                    marginTop: '0.75rem',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#fbbf24',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    justifyContent: 'center'
                  }}
                >
                  🔑 Esqueceu a Senha? Redefinir com o Líder
                </button>
              </form>
            )}

            {/* CONTEÚDO DA ABA: PRIMEIRO ACESSO / CADASTRAR */}
            {mode === 'register' && (
              <form className="login-form" onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginTop: '0.25rem' }}>
                  <label className="form-label" htmlFor="register-password">
                    Criar Senha (mínimo 6 caracteres)
                  </label>
                  <input
                    id="register-password"
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirm-reg-password">Confirmar Senha</label>
                  <input
                    id="confirm-reg-password"
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    marginTop: '0.75rem',
                    width: '100%',
                    justifyContent: 'center'
                  }}
                >
                  {loading ? 'Cadastrando...' : '✨ Criar Senha e Entrar'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


