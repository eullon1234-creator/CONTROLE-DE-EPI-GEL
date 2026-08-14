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
        msg = 'Senha incorreta. Se esqueceu, clique em "Redefinir Senha com o Líder EULLON".';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'Usuário sem senha cadastrada. Clique em "Criar Senha" abaixo.';
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
      const code = await requestPasswordReset(selectedUser);
      setCodeGenerated(true);
      setMode('reset');
      setPassword('');
      setConfirmPassword('');
      setResetCode('');
      toast.success(`Código de redefinição enviado para o líder EULLON!`, { duration: 5000 });
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
          <form className="login-form" onSubmit={handleSubmit} id="login-form">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Identificação</span>
              <button
                type="button"
                className="btn-back-user"
                onClick={handleBackToUsers}
              >
                ← Voltar
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
                  {mode === 'register' && 'Cadastro de Novo Acesso'}
                  {mode === 'login' && 'Entrada Autorizada'}
                  {mode === 'reset' && 'Redefinição de Senha com Líder'}
                </div>
              </div>
            </div>

            {/* Aviso especial no modo de redefinição de senha */}
            {mode === 'reset' && (
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                marginTop: '0.75rem',
                fontSize: '0.8125rem',
                color: 'var(--text-primary)',
                lineHeight: 1.4
              }}>
                <div style={{ fontWeight: 600, color: 'var(--accent-blue-light)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span>🛡️</span> Código Solicitado ao Líder EULLON
                </div>
                <div>
                  Um código de <strong>6 dígitos</strong> chegou no painel do <strong>Líder EULLON</strong>. Peça o código a ele e digite abaixo junto com a sua nova senha:
                </div>
              </div>
            )}

            {/* Campo de Código de 6 Dígitos (somente no modo Reset) */}
            {mode === 'reset' && (
              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label" htmlFor="reset-code">
                  Código de 6 Dígitos (do Líder Eullon)
                </label>
                <input
                  id="reset-code"
                  type="text"
                  maxLength={6}
                  className="form-input"
                  placeholder="Ex: 839201"
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
                  style={{
                    letterSpacing: '4px',
                    fontSize: '1.25rem',
                    textAlign: 'center',
                    fontWeight: 700,
                    color: 'var(--accent-yellow)'
                  }}
                  required
                  autoFocus
                />
              </div>
            )}

            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="form-label" htmlFor="password">
                {mode === 'register' && 'Criar Senha (mínimo 6 caracteres)'}
                {mode === 'login' && 'Senha'}
                {mode === 'reset' && 'Nova Senha (mínimo 6 caracteres)'}
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus={mode !== 'reset'}
              />
            </div>

            {(mode === 'register' || mode === 'reset') && (
              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">Confirmar Nova Senha</label>
                <input
                  id="confirm-password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            )}

            <button
              id="btn-login"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading || requestingCode}
              style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'center' }}
            >
              {loading ? (
                <>
                  <div className="loading-spin" style={{ width: 16, height: 16 }} />
                  {mode === 'register' && 'Cadastrando...'}
                  {mode === 'login' && 'Entrando...'}
                  {mode === 'reset' && 'Atualizando Senha...'}
                </>
              ) : (
                <>
                  {mode === 'register' && '🔐 Criar Senha'}
                  {mode === 'login' && '🔐 Entrar'}
                  {mode === 'reset' && '✅ Confirmar e Atualizar Senha'}
                </>
              )}
            </button>

            {/* Ações de alternância de fluxo */}
            <div className="login-flow-toggle" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              {mode === 'login' && (
                <>
                  <div>
                    Primeiro acesso de {selectedUser.name.charAt(0) + selectedUser.name.slice(1).toLowerCase()}?{' '}
                    <button type="button" onClick={() => { setMode('register'); setError(''); }}>
                      Criar Senha
                    </button>
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={handleStartReset}
                      disabled={requestingCode}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-blue-light)',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        padding: '4px'
                      }}
                    >
                      {requestingCode ? '⏳ Solicitando ao Líder...' : '🔑 Esqueceu a senha? Solicitar código ao Líder EULLON'}
                    </button>
                  </div>
                </>
              )}

              {mode === 'register' && (
                <div>
                  Já cadastrou a sua senha?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError(''); }}>
                    Fazer Login
                  </button>
                </div>
              )}

              {mode === 'reset' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(''); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    ← Voltar ao Login
                  </button>

                  <button
                    type="button"
                    onClick={handleStartReset}
                    disabled={requestingCode}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-blue-light)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    🔄 Gerar Novo Código
                  </button>
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

