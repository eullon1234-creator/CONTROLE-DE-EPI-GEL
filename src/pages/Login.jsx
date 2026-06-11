import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    
    if (isRegistering && password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        await register(email, password);
        toast.success('Cadastro realizado com sucesso! Bem-vindo.');
      } else {
        await login(email, password);
        toast.success('Bem-vindo ao sistema!');
      }
      navigate('/');
    } catch (err) {
      let msg = '';
      if (isRegistering) {
        msg = err.code === 'auth/email-already-in-use'
          ? 'Este e-mail já está cadastrado.'
          : err.code === 'auth/invalid-email'
          ? 'E-mail inválido.'
          : err.code === 'auth/weak-password'
          ? 'A senha deve ter pelo menos 6 caracteres.'
          : 'Erro ao cadastrar. Verifique seus dados.';
      } else {
        msg = err.code === 'auth/invalid-credential'
          ? 'E-mail ou senha incorretos.'
          : err.code === 'auth/user-not-found'
          ? 'Usuário não encontrado.'
          : 'Erro ao entrar. Verifique seus dados.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-glow" />

      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle">🪖</div>
          <h1>{isRegistering ? 'CRIAR CONTA' : 'CONTROLE DE EPI'}</h1>
          <p>
            {isRegistering
              ? 'GEL Engenharia — Cadastre seu usuário'
              : 'GEL Engenharia — Acesso ao Sistema'}
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} id="login-form">
          {error && (
            <div className="login-error">
              ⚠️ {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {isRegistering && (
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
            style={{ marginTop: '0.5rem', justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <div className="loading-spin" style={{ width: 16, height: 16 }} />
                {isRegistering ? 'Cadastrando...' : 'Entrando...'}
              </>
            ) : (
              <>{isRegistering ? '📝 Cadastrar' : '🔐 Entrar'}</>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setPassword('');
              setConfirmPassword('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent-blue-light)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              textDecoration: 'underline',
              fontFamily: 'inherit',
              fontWeight: 500
            }}
          >
            {isRegistering ? 'Já tem uma conta? Faça Login' : 'Novo por aqui? Cadastre-se'}
          </button>

          {!isRegistering && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Acesso restrito. Solicite ao administrador caso não tenha conta.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
