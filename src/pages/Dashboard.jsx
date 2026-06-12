import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function StatCard({ icon, label, value, color }) {
  return (
    <div className="card stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, baixoEstoque: 0, entradasHoje: 0, saidasHoje: 0, valorTotalEstoque: 0 });
  const [alertas, setAlertas] = useState([]);
  const [recentes, setRecentes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Produtos
        const prodSnap = await getDocs(collection(db, 'produtos'));
        const produtos = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const baixoEstoque = produtos.filter(p => p.estoqueAtual <= p.estoqueMin);
        const valorTotalEstoque = produtos.reduce((acc, p) => acc + ((p.estoqueAtual ?? 0) * (p.valorUnitario ?? 0)), 0);

        // Movimentações de hoje
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const amanha = new Date(hoje);
        amanha.setDate(amanha.getDate() + 1);

        const movSnap = await getDocs(
          query(
            collection(db, 'movimentacoes'),
            where('criadoEm', '>=', Timestamp.fromDate(hoje)),
            where('criadoEm', '<', Timestamp.fromDate(amanha))
          )
        );
        const movs = movSnap.docs.map(d => d.data());
        const entradasHoje = movs.filter(m => m.tipo === 'ENTRADA').reduce((a, m) => a + m.quantidade, 0);
        const saidasHoje = movs.filter(m => m.tipo === 'SAIDA').reduce((a, m) => a + m.quantidade, 0);

        // Recentes (últimos 10)
        const recentSnap = await getDocs(
          query(collection(db, 'movimentacoes'), orderBy('criadoEm', 'desc'))
        );
        setRecentes(recentSnap.docs.slice(0, 8).map(d => ({ id: d.id, ...d.data() })));

        setStats({ total: produtos.length, baixoEstoque: baixoEstoque.length, entradasHoje, saidasHoje, valorTotalEstoque });
        setAlertas(baixoEstoque.slice(0, 5));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const today = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });

  if (loading) return <div className="loading-center"><div className="loading-spin" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{today}</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon="📦" label="Produtos Cadastrados" value={stats.total} color="blue" />
        <StatCard icon="💰" label="Custo do Estoque" value={stats.valorTotalEstoque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} color="green" />
        <StatCard icon="🔴" label="Estoque Baixo" value={stats.baixoEstoque} color="red" />
        <StatCard icon="📥" label="Unidades Entrada Hoje" value={stats.entradasHoje} color="green" />
        <StatCard icon="📤" label="Unidades Saída Hoje" value={stats.saidasHoje} color="yellow" />
      </div>

      {alertas.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div className="section-title">⚠️ Produtos com Estoque Baixo</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {alertas.map(p => (
              <div key={p.id} className="alert-banner danger">
                <span>🔴</span>
                <span style={{ flex: 1 }}>
                  <strong>Cód. {p.codigo}</strong> — {p.descricao}
                </span>
                <span style={{ fontSize: '0.8125rem', opacity: 0.85 }}>
                  Atual: <strong>{p.estoqueAtual}</strong> / Mín: {p.estoqueMin} {p.unidade}
                </span>
              </div>
            ))}
            {stats.baixoEstoque > 5 && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.25rem 0.25rem' }}>
                + {stats.baixoEstoque - 5} outros com estoque baixo. Veja em <a href="#/estoque" style={{ color: 'var(--accent-blue-light)' }}>Estoque</a>.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <div className="section-title">🕐 Últimas Movimentações</div>
        </div>
        {recentes.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <div className="empty-title">Nenhuma movimentação ainda</div>
              <div className="empty-desc">Registre entradas e saídas de EPIs para vê-las aqui.</div>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Produto</th>
                  <th>Qtd</th>
                  <th>Funcionário</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map(m => (
                  <tr key={m.id}>
                    <td>
                      <span className={`badge ${m.tipo === 'ENTRADA' ? 'badge-green' : 'badge-red'}`}>
                        {m.tipo === 'ENTRADA' ? '📥' : '📤'} {m.tipo}
                      </span>
                    </td>
                    <td style={{ maxWidth: 240 }}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.produtoDescricao}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cód. {m.produtoCodigo}</div>
                    </td>
                    <td><strong>{m.quantidade}</strong></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      {m.funcionario || m.fornecedor || '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {m.criadoEm?.toDate
                        ? format(m.criadoEm.toDate(), 'dd/MM/yy HH:mm')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
