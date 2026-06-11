import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Bem-vindo ao sistema!');
      navigate('/');
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential'
        ? 'E-mail ou senha incorretos.'
        : err.code === 'auth/user-not-found'
        ? 'Usuário não encontrado.'
        : 'Erro ao entrar. Verifique seus dados.';
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
          <h1>CONTROLE DE EPI</h1>
          <p>GEL Engenharia — Acesso ao Sistema</p>
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
                Entrando...
              </>
            ) : (
              <>🔐 Entrar</>
            )}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Acesso restrito. Solicite ao administrador caso não tenha conta.
        </p>
      </div>
    </div>
  );
}
