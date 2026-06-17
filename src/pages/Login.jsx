import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const USERS = [
  { name: 'EULLON', email: 'eullon@controle-epi.gel', avatarClass: 'avatar-eullon', initials: 'EU' },
  { name: 'EDUARDO', email: 'eduardo@controle-epi.gel', avatarClass: 'avatar-eduardo', initials: 'ED' },
  { name: 'JOARLISON', email: 'joarlison@controle-epi.gel', avatarClass: 'avatar-joarlison', initials: 'JO' },
  { name: 'CICERO', email: 'cicero@controle-epi.gel', avatarClass: 'avatar-cicero', initials: 'CI' },
];

export default function Login() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, signup } = useAuth();
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

    if (isRegisterMode && password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      if (isRegisterMode) {
        await signup(selectedUser.email, password);
        toast.success('Senha criada! Bem-vindo ao sistema!');
      } else {
        await login(selectedUser.email, password);
        toast.success('Bem-vindo de volta!');
      }
      navigate('/');
    } catch (err) {
      console.error(err);
      let msg = 'Erro ao realizar a operação. Verifique seus dados.';
      
      if (isRegisterMode) {
        if (err.code === 'auth/email-already-in-use') {
          msg = 'Este usuário já possui uma senha cadastrada. Faça login ou solicite alteração ao administrador.';
        } else if (err.code === 'auth/weak-password') {
          msg = 'A senha fornecida é muito fraca. Digite pelo menos 6 caracteres.';
        }
      } else {
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
          msg = 'Senha incorreta. Se for seu primeiro acesso, clique em "Criar Senha" abaixo.';
        } else if (err.code === 'auth/user-not-found') {
          msg = 'Usuário sem senha cadastrada. Se for seu primeiro acesso, clique em "Criar Senha" abaixo.';
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectUser(user) {
    setSelectedUser(user);
    setPassword('');
    setConfirmPassword('');
    setIsRegisterMode(false);
    setError('');
  }

  function handleBackToUsers() {
    setSelectedUser(null);
    setPassword('');
    setConfirmPassword('');
    setIsRegisterMode(false);
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
                  <div className="user-select-name">{user.name}</div>
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Cada usuário terá que criar sua própria senha no primeiro acesso.
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
                <div className="selected-user-summary-name">{selectedUser.name}</div>
                <div className="selected-user-summary-label">
                  {isRegisterMode ? 'Cadastro de Novo Acesso' : 'Entrada Autorizada'}
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="form-label" htmlFor="password">
                {isRegisterMode ? 'Criar Senha (mínimo 6 caracteres)' : 'Senha'}
              </label>
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

            {isRegisterMode && (
              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">Confirmar Senha</label>
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
              disabled={loading}
              style={{ marginTop: '0.5rem' }}
            >
              {loading ? (
                <>
                  <div className="loading-spin" style={{ width: 16, height: 16 }} />
                  {isRegisterMode ? 'Cadastrando...' : 'Entrando...'}
                </>
              ) : (
                <>🔐 {isRegisterMode ? 'Criar Senha' : 'Entrar'}</>
              )}
            </button>

            <div className="login-flow-toggle">
              {isRegisterMode ? (
                <span>
                  Já cadastrou a sua senha?{' '}
                  <button type="button" onClick={() => { setIsRegisterMode(false); setError(''); }}>
                    Fazer Login
                  </button>
                </span>
              ) : (
                <span>
                  Primeiro acesso de {selectedUser.name.charAt(0) + selectedUser.name.slice(1).toLowerCase()}?{' '}
                  <button type="button" onClick={() => { setIsRegisterMode(true); setError(''); }}>
                    Criar Senha
                  </button>
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
