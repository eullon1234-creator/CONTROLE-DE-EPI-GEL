import { useState } from 'react';
import { seedProducts } from '../firebase/seed';

export default function Importar() {
  const [status, setStatus] = useState('idle'); // idle | running | done | skipped | error
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [importarSaldos, setImportarSaldos] = useState(true);
  const [importarPrecos, setImportarPrecos] = useState(true);

  async function handleImport() {
    if (!confirm('Isso vai cadastrar 252 produtos no banco de dados.\nContinuar?')) return;
    setStatus('running');
    setProgress({ done: 0, total: 252 });

    try {
      const res = await seedProducts({ importarSaldos, importarPrecos }, (done, total) => {
        setProgress({ done, total });
      });

      if (res.skipped) {
        setStatus('skipped');
        setResult(res);
      } else {
        setStatus('done');
        setResult(res);
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  }

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📥 Importar Produtos</h1>
          <p className="page-subtitle">Carregue os 252 EPIs da planilha original para o banco de dados</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
          🗂️ Importação Inicial da Planilha
        </h3>
        <p style={{ marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          Este processo vai cadastrar automaticamente todos os <strong style={{ color: 'var(--text-primary)' }}>252 produtos</strong> da planilha
          <em> CONTROLE EPI ESTRELA.xlsx</em> no banco de dados, com:
        </p>

        <ul style={{ paddingLeft: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <li>✅ Código do produto</li>
          <li>✅ Descrição completa</li>
          <li>✅ CA (Certificado de Aprovação)</li>
          <li>✅ Validade do CA</li>
          <li>✅ Unidade de medida (UND, PAR, CONJ...)</li>
          <li>✅ Estoque mínimo e máximo</li>
          <li>{importarSaldos ? '✅ Saldo de estoque inicial da planilha' : '⚠️ Estoque atual = 0 (você controla pelo app)'}</li>
          <li>{importarPrecos ? '✅ Valor Unitário (preços originais da planilha)' : '⚠️ Sem preços unitários cadastrados'}</li>
        </ul>

        {status === 'idle' && (
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={importarSaldos}
                onChange={e => setImportarSaldos(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>Importar estoque atual (saldos originais da planilha)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={importarPrecos}
                onChange={e => setImportarPrecos(e.target.checked)}
                style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
              />
              <span>Importar preços unitários (valores originais da planilha)</span>
            </label>
          </div>
        )}

        {status === 'idle' && (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleImport}
            id="btn-importar"
          >
            🚀 Iniciar Importação dos 252 Produtos
          </button>
        )}

        {status === 'running' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="loading-spin" />
              <span style={{ color: 'var(--text-secondary)' }}>
                Importando... {progress.done} de {progress.total} produtos
              </span>
            </div>
            <div style={{ background: 'var(--bg-input)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: 'linear-gradient(90deg, var(--accent-blue), #6366f1)',
                borderRadius: 999,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{pct}% concluído</span>
          </div>
        )}

        {status === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="alert-banner" style={{ background: 'var(--accent-green-dim)', borderColor: 'rgba(16,185,129,0.3)', color: 'var(--accent-green)' }}>
              ✅ Importação concluída! <strong>{result?.count} produtos</strong> cadastrados com sucesso.
            </div>
            <p style={{ fontSize: '0.875rem' }}>
              Agora vá para <a href="#/estoque" style={{ color: 'var(--accent-blue-light)' }}>Estoque</a> ou
              <a href="#/produtos" style={{ color: 'var(--accent-blue-light)', marginLeft: '0.25rem' }}>Produtos</a> para ver todos os itens.
            </p>
          </div>
        )}

        {status === 'skipped' && (
          <div className="alert-banner warning">
            ⚠️ O banco já possui <strong>{result?.count} produtos</strong> cadastrados. Importação cancelada para evitar duplicatas.
          </div>
        )}

        {status === 'error' && (
          <div className="alert-banner danger">
            ❌ Erro ao importar. Verifique se o Firestore está configurado e as regras de segurança estão corretas. Tente novamente.
          </div>
        )}
      </div>
    </div>
  );
}
