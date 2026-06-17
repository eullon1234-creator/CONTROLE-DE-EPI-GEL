import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format } from 'date-fns';
import { matchSearch } from '../utils/search';

export default function Historico() {
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    tipo: 'todos',
    dataInicio: '',
    dataFim: '',
    produto: '',
    responsavel: '',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'movimentacoes'), orderBy('criadoEm', 'desc'))
      );
      setMovs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setLoading(false);
    }
  }

  function handleFilter(e) {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  const filtered = movs.filter(m => {
    if (filters.tipo !== 'todos' && m.tipo !== filters.tipo) return false;
    if (filters.produto) {
      const matchProd =
        matchSearch(m.produtoDescricao, filters.produto) ||
        matchSearch(String(m.produtoCodigo), filters.produto);
      if (!matchProd) return false;
    }
    if (filters.responsavel) {
      const matchResp =
        matchSearch(m.funcionario, filters.responsavel) ||
        matchSearch(m.registradoPorEmail, filters.responsavel) ||
        matchSearch(m.fornecedor, filters.responsavel) ||
        matchSearch(m.empresa, filters.responsavel);
      if (!matchResp) return false;
    }
    if (filters.dataInicio && m.data < filters.dataInicio) return false;
    if (filters.dataFim && m.data > filters.dataFim) return false;
    return true;
  });

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Histórico</h1>
          <p className="page-subtitle">Todas as movimentações de entrada e saída</p>
        </div>
        <span className="badge badge-blue">{filtered.length} registros</span>
      </div>

      <div className="filters-bar">
        <select name="tipo" className="form-select" value={filters.tipo} onChange={handleFilter} id="select-tipo">
          <option value="todos">Todos os tipos</option>
          <option value="ENTRADA">📥 Entrada</option>
          <option value="SAIDA">📤 Saída</option>
        </select>

        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <input
            type="date"
            name="dataInicio"
            className="form-input"
            placeholder="Data início"
            value={filters.dataInicio}
            onChange={handleFilter}
            id="input-data-inicio"
            title="Data início"
          />
        </div>

        <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
          <input
            type="date"
            name="dataFim"
            className="form-input"
            placeholder="Data fim"
            value={filters.dataFim}
            onChange={handleFilter}
            id="input-data-fim"
            title="Data fim"
          />
        </div>

        <div className="search-bar" style={{ flex: 2, minWidth: 180 }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            name="produto"
            className="form-input"
            placeholder="Filtrar por produto..."
            value={filters.produto}
            onChange={handleFilter}
            id="input-filtro-produto"
          />
        </div>

        <div className="search-bar" style={{ flex: 1, minWidth: 160 }}>
          <span className="search-icon">👤</span>
          <input
            type="text"
            name="responsavel"
            className="form-input"
            placeholder="Funcionário / E-mail..."
            value={filters.responsavel}
            onChange={handleFilter}
            id="input-filtro-resp"
          />
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setFilters({ tipo: 'todos', dataInicio: '', dataFim: '', produto: '', responsavel: '' })}
          id="btn-limpar-filtros"
        >
          ✕ Limpar
        </button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="loading-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">Nenhuma movimentação encontrada</div>
            <div className="empty-desc">Ajuste os filtros ou registre novas entradas e saídas.</div>
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Data</th>
                <th>Produto</th>
                <th>Qtd</th>
                <th>Funcionário / Fornecedor</th>
                <th>Empresa / NF</th>
                <th>Observação</th>
                <th>Registrado por</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id}>
                  <td>
                    <span className={`badge ${m.tipo === 'ENTRADA' ? 'badge-green' : 'badge-red'}`}>
                      {m.tipo === 'ENTRADA' ? '📥' : '📤'} {m.tipo}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    {m.data || (m.criadoEm?.toDate ? format(m.criadoEm.toDate(), 'yyyy-MM-dd') : '—')}
                  </td>
                  <td style={{ maxWidth: 240 }}>
                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.produtoDescricao}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cód. {m.produtoCodigo}</div>
                  </td>
                  <td style={{ fontWeight: 700 }}>{m.quantidade} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.75rem' }}>{m.unidade}</span></td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                    {m.tipo === 'SAIDA' ? (m.funcionario || '—') : (m.fornecedor || '—')}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                    {m.tipo === 'SAIDA' ? (m.empresa || '—') : (m.nfNumero ? `NF ${m.nfNumero}` : '—')}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', maxWidth: 160 }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                      {m.observacao || '—'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {m.registradoPorEmail?.split('@')[0]?.toUpperCase() || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
