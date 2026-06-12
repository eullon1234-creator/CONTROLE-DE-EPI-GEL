import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import { filterProdutos } from '../utils/search';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

function getStatusBadge(produto) {
  const { estoqueAtual, estoqueMin, estoqueMax } = produto;
  if (estoqueAtual <= estoqueMin) return <span className="badge badge-red">🔴 Estoque Baixo</span>;
  if (estoqueAtual >= estoqueMax) return <span className="badge badge-yellow">🟡 Estoque Alto</span>;
  return <span className="badge badge-green">🟢 Normal</span>;
}

export default function Estoque() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
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

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      // 1. Fetch movements on demand
      const movsSnap = await getDocs(
        query(collection(db, 'movimentacoes'), orderBy('criadoEm', 'desc'))
      );
      const allMovs = movsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Filter inputs and outputs
      const entradas = allMovs.filter(m => m.tipo === 'ENTRADA');
      const saidas = allMovs.filter(m => m.tipo === 'SAIDA');

      // 3. Format Estoque data
      const estoqueData = produtos.map(p => {
        let status = 'Normal';
        if (p.estoqueAtual <= p.estoqueMin) status = 'Estoque Baixo';
        else if (p.estoqueAtual >= p.estoqueMax) status = 'Estoque Alto';

        return {
          'Código': p.codigo || '',
          'Descrição': p.descricao || '',
          'Grupo': p.grupo || '',
          'Unidade': p.unidade || '',
          'CA': p.ca || '',
          'Validade CA': p.validadeCa || '',
          'Localização': p.localizacao || '',
          'Estoque Mínimo': p.estoqueMin ?? 0,
          'Estoque Máximo': p.estoqueMax ?? 0,
          'Estoque Atual': p.estoqueAtual ?? 0,
          'Status': status
        };
      });

      // 4. Format Entradas data
      const entradasData = entradas.map(m => {
        const dataFormatada = m.data || (m.criadoEm?.toDate ? format(m.criadoEm.toDate(), 'yyyy-MM-dd') : '—');
        return {
          'Data': dataFormatada,
          'Código do Produto': m.produtoCodigo || '',
          'Descrição do Produto': m.produtoDescricao || '',
          'Quantidade': m.quantidade ?? 0,
          'Unidade': m.unidade || '',
          'Fornecedor': m.fornecedor || '—',
          'Nº NF': m.nfNumero || '—',
          'Observação': m.observacao || '—',
          'Registrado por': m.registradoPorEmail || '—'
        };
      });

      // 5. Format Saídas data
      const saidasData = saidas.map(m => {
        const dataFormatada = m.data || (m.criadoEm?.toDate ? format(m.criadoEm.toDate(), 'yyyy-MM-dd') : '—');
        return {
          'Data': dataFormatada,
          'Código do Produto': m.produtoCodigo || '',
          'Descrição do Produto': m.produtoDescricao || '',
          'Quantidade': m.quantidade ?? 0,
          'Unidade': m.unidade || '',
          'Funcionário': m.funcionario || '—',
          'Empresa': m.empresa || '—',
          'Observação': m.observacao || '—',
          'Registrado por': m.registradoPorEmail || '—'
        };
      });

      // 6. Create Workbook
      const wb = XLSX.utils.book_new();

      // Convert arrays of objects to sheets
      const wsEstoque = XLSX.utils.json_to_sheet(estoqueData);
      const wsEntradas = XLSX.utils.json_to_sheet(entradasData);
      const wsSaidas = XLSX.utils.json_to_sheet(saidasData);

      // Append sheets to workbook
      XLSX.utils.book_append_sheet(wb, wsEstoque, 'Estoque Atual');
      XLSX.utils.book_append_sheet(wb, wsEntradas, 'Entradas');
      XLSX.utils.book_append_sheet(wb, wsSaidas, 'Saídas');

      // Write and download
      XLSX.writeFile(wb, `Relatorio_Controle_EPI_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
      toast.success('Planilha exportada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar planilha. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  const searchFiltered = filterProdutos(produtos, search);
  const filtered = searchFiltered.filter(p => {
    if (filter === 'todos') return true;
    if (filter === 'baixo') return p.estoqueAtual <= p.estoqueMin;
    if (filter === 'normal') return p.estoqueAtual > p.estoqueMin && p.estoqueAtual < p.estoqueMax;
    if (filter === 'alto') return p.estoqueAtual >= p.estoqueMax;
    return true;
  });

  if (loading) return <div className="loading-center"><div className="loading-spin" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Estoque</h1>
          <p className="page-subtitle">{produtos.length} produtos cadastrados · {filtered.length} exibidos</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-success"
            onClick={handleExportExcel}
            disabled={exporting}
            id="btn-exportar-excel"
          >
            {exporting ? (
              <>
                <div className="loading-spin" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
                Gerando Excel...
              </>
            ) : (
              <>🟢 Exportar Planilha</>
            )}
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/produtos')} id="btn-novo-produto">
            + Novo Produto
          </button>
        </div>
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
