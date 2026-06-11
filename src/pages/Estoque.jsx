import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useNavigate } from 'react-router-dom';

function getStatusBadge(produto) {
  const { estoqueAtual, estoqueMin, estoqueMax } = produto;
  if (estoqueAtual <= estoqueMin) return <span className="badge badge-red">🔴 Estoque Baixo</span>;
  if (estoqueAtual >= estoqueMax) return <span className="badge badge-yellow">🟡 Estoque Alto</span>;
  return <span className="badge badge-green">🟢 Normal</span>;
}

export default function Estoque() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, 'produtos'), orderBy('descricao')));
        setProdutos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = produtos.filter(p => {
    const matchSearch =
      !search ||
      p.descricao?.toLowerCase().includes(search.toLowerCase()) ||
      String(p.codigo).includes(search);
    const matchFilter =
      filter === 'todos' ||
      (filter === 'baixo' && p.estoqueAtual <= p.estoqueMin) ||
      (filter === 'normal' && p.estoqueAtual > p.estoqueMin && p.estoqueAtual < p.estoqueMax) ||
      (filter === 'alto' && p.estoqueAtual >= p.estoqueMax);
    return matchSearch && matchFilter;
  });

  if (loading) return <div className="loading-center"><div className="loading-spin" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Estoque</h1>
          <p className="page-subtitle">{produtos.length} produtos cadastrados · {filtered.length} exibidos</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/produtos')} id="btn-novo-produto">
          + Novo Produto
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-bar" style={{ flex: 2, minWidth: 200 }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="input-buscar-estoque"
          />
        </div>
        <select
          className="form-select"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          id="select-filtro-status"
          style={{ minWidth: 160 }}
        >
          <option value="todos">Todos os status</option>
          <option value="baixo">🔴 Estoque Baixo</option>
          <option value="normal">🟢 Normal</option>
          <option value="alto">🟡 Estoque Alto</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📦</div>
            <div className="empty-title">Nenhum produto encontrado</div>
            <div className="empty-desc">Tente outra busca ou cadastre um novo produto.</div>
            <button className="btn btn-primary" onClick={() => navigate('/produtos')}>+ Cadastrar Produto</button>
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Cód.</th>
                <th>Descrição</th>
                <th>Unid.</th>
                <th>CA</th>
                <th>Validade CA</th>
                <th>Local.</th>
                <th>Est. Mín</th>
                <th>Est. Máx</th>
                <th>Est. Atual</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr
                  key={p.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/produtos?edit=${p.id}`)}
                >
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{p.codigo}</td>
                  <td style={{ fontWeight: 500, maxWidth: 280 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.descricao}
                    </div>
                    {p.grupo && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.grupo}</div>}
                  </td>
                  <td><span className="badge badge-gray">{p.unidade}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{p.ca || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {p.validadeCa || '—'}
                  </td>
                  <td>{p.localizacao ? <span className="badge badge-yellow">{p.localizacao}</span> : '—'}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.estoqueMin}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.estoqueMax}</td>
                  <td style={{ fontWeight: 700, color: p.estoqueAtual <= p.estoqueMin ? 'var(--accent-red)' : 'var(--accent-green)', fontSize: '1rem' }}>
                    {p.estoqueAtual}
                  </td>
                  <td>{getStatusBadge(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
