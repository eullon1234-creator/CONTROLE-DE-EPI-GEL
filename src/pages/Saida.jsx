import { useState, useEffect } from 'react';
import {
  collection, addDoc, doc, updateDoc, increment,
  serverTimestamp, query, orderBy, getDocs, where, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import ProductSearch from '../components/ProductSearch';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function Saida() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    quantidade: '',
    funcionario: '',
    empresa: '',
    observacao: '',
  });
  const [loading, setLoading] = useState(false);
  const [recentes, setRecentes] = useState([]);

  useEffect(() => { loadRecentes(); }, []);

  async function loadRecentes() {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const snap = await getDocs(
        query(
          collection(db, 'movimentacoes'),
          where('tipo', '==', 'SAIDA'),
          where('criadoEm', '>=', Timestamp.fromDate(hoje)),
          orderBy('criadoEm', 'desc')
        )
      );
      setRecentes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      // Fallback sem filtro de data (caso índice não exista ainda)
      try {
        const snap = await getDocs(
          query(collection(db, 'movimentacoes'), where('tipo', '==', 'SAIDA'), orderBy('criadoEm', 'desc'))
        );
        setRecentes(snap.docs.slice(0, 10).map(d => ({ id: d.id, ...d.data() })));
      } catch (_) {}
    }
  }

  function handleField(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selected) return toast.error('Selecione um produto');
    const qty = parseInt(form.quantidade);
    if (!qty || qty <= 0) return toast.error('Quantidade inválida');
    if (qty > selected.estoqueAtual) return toast.error(`Estoque insuficiente! Disponível: ${selected.estoqueAtual}`);

    setLoading(true);
    try {
      await addDoc(collection(db, 'movimentacoes'), {
        tipo: 'SAIDA',
        data: form.data,
        produtoId: selected.id,
        produtoCodigo: selected.codigo,
        produtoDescricao: selected.descricao,
        unidade: selected.unidade,
        quantidade: qty,
        funcionario: form.funcionario || null,
        empresa: form.empresa || null,
        observacao: form.observacao || null,
        registradoPor: user.uid,
        registradoPorEmail: user.email,
        criadoEm: serverTimestamp(),
      });

      // Atualiza estoque
      await updateDoc(doc(db, 'produtos', selected.id), {
        estoqueAtual: increment(-qty),
      });

      toast.success(`Saída de ${qty} ${selected.unidade} registrada!`);
      setForm(f => ({ ...f, quantidade: '', funcionario: '', empresa: '', observacao: '' }));
      setSelected(null);
      loadRecentes();
    } catch (err) {
      toast.error('Erro ao registrar saída');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">📤 Registrar Saída</h1>
          <p className="page-subtitle">Dê baixa em equipamentos de proteção individual</p>
        </div>
      </div>

      <div className="quick-entry-card">
        <h2>📤 Nova Baixa de EPI</h2>
        <form onSubmit={handleSubmit} id="form-saida">
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Data</label>
              <input
                type="date"
                name="data"
                className="form-input"
                value={form.data}
                onChange={handleField}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Produto *</label>
              <ProductSearch
                onSelect={p => setSelected(p)}
                onChange={() => setSelected(null)}
                placeholder="Buscar por nome ou código..."
              />
              {selected && (
                <div style={{ marginTop: '0.5rem', padding: '0.625rem 0.875rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>{selected.descricao}</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Cód. {selected.codigo}</span>
                  <span className={`badge ${selected.estoqueAtual <= selected.estoqueMin ? 'badge-red' : 'badge-green'}`}>
                    Estoque: {selected.estoqueAtual} {selected.unidade}
                  </span>
                  {selected.estoqueAtual <= selected.estoqueMin && (
                    <span className="badge badge-red">⚠️ Estoque Baixo</span>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Quantidade *</label>
              <input
                type="number"
                name="quantidade"
                className="form-input"
                placeholder="0"
                min="1"
                value={form.quantidade}
                onChange={handleField}
                required
                id="input-quantidade-saida"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Funcionário <span>(opcional)</span></label>
              <input
                type="text"
                name="funcionario"
                className="form-input"
                placeholder="Nome do funcionário"
                value={form.funcionario}
                onChange={handleField}
                id="input-funcionario"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Empresa <span>(opcional)</span></label>
              <input
                type="text"
                name="empresa"
                className="form-input"
                placeholder="Nome da empresa"
                value={form.empresa}
                onChange={handleField}
                id="input-empresa-saida"
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Observação <span>(opcional)</span></label>
              <textarea
                name="observacao"
                className="form-textarea"
                placeholder="Observações adicionais..."
                value={form.observacao}
                onChange={handleField}
                rows={2}
                id="input-obs-saida"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-danger btn-lg"
            disabled={loading}
            id="btn-confirmar-saida"
          >
            {loading ? (
              <><div className="loading-spin" style={{ width: 16, height: 16 }} /> Registrando...</>
            ) : (
              <>📤 Confirmar Saída</>
            )}
          </button>
        </form>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title">🕐 Saídas de Hoje</div>
          <span className="badge badge-red">{recentes.length}</span>
        </div>
        {recentes.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">📤</div>
              <div className="empty-title">Nenhuma saída registrada hoje</div>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Qtd</th>
                  <th>Funcionário</th>
                  <th>Empresa</th>
                  <th>Observação</th>
                  <th>Horário</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.produtoDescricao}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cód. {m.produtoCodigo}</div>
                    </td>
                    <td><strong>{m.quantidade}</strong> {m.unidade}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{m.funcionario || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{m.empresa || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', maxWidth: 160 }}>{m.observacao || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {m.criadoEm?.toDate ? format(m.criadoEm.toDate(), 'HH:mm') : '—'}
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
