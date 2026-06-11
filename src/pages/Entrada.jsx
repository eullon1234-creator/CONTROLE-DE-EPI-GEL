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

export default function Entrada() {
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    quantidade: '',
    valorUnitario: '',
    fornecedor: '',
    nfNumero: '',
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
          where('tipo', '==', 'ENTRADA'),
          where('criadoEm', '>=', Timestamp.fromDate(hoje)),
          orderBy('criadoEm', 'desc')
        )
      );
      setRecentes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      try {
        const snap = await getDocs(
          query(collection(db, 'movimentacoes'), where('tipo', '==', 'ENTRADA'), orderBy('criadoEm', 'desc'))
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

    setLoading(true);
    try {
      const valorUnit = parseFloat(form.valorUnitario) || 0;
      await addDoc(collection(db, 'movimentacoes'), {
        tipo: 'ENTRADA',
        data: form.data,
        produtoId: selected.id,
        produtoCodigo: selected.codigo,
        produtoDescricao: selected.descricao,
        unidade: selected.unidade,
        quantidade: qty,
        valorUnitario: valorUnit || null,
        custo: valorUnit ? valorUnit * qty : null,
        fornecedor: form.fornecedor || null,
        nfNumero: form.nfNumero || null,
        observacao: form.observacao || null,
        registradoPor: user.uid,
        registradoPorEmail: user.email,
        criadoEm: serverTimestamp(),
      });

      await updateDoc(doc(db, 'produtos', selected.id), {
        estoqueAtual: increment(qty),
      });

      toast.success(`Entrada de ${qty} ${selected.unidade} registrada!`);
      setForm(f => ({ ...f, quantidade: '', valorUnitario: '', fornecedor: '', nfNumero: '', observacao: '' }));
      setSelected(null);
      loadRecentes();
    } catch (err) {
      toast.error('Erro ao registrar entrada');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📥 Registrar Entrada</h1>
          <p className="page-subtitle">Adicione EPIs ao estoque com nota fiscal e fornecedor</p>
        </div>
      </div>

      <div className="quick-entry-card" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(5,150,105,0.04))', borderColor: 'rgba(16,185,129,0.2)' }}>
        <h2>📥 Nova Entrada de EPI</h2>
        <form onSubmit={handleSubmit} id="form-entrada">
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Data</label>
              <input type="date" name="data" className="form-input" value={form.data} onChange={handleField} required />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Produto *</label>
              <ProductSearch onSelect={p => setSelected(p)} onChange={() => setSelected(null)} placeholder="Buscar por nome ou código..." />
              {selected && (
                <div style={{ marginTop: '0.5rem', padding: '0.625rem 0.875rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>{selected.descricao}</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Cód. {selected.codigo}</span>
                  <span className="badge badge-blue">Estoque Atual: {selected.estoqueAtual} {selected.unidade}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Quantidade *</label>
              <input type="number" name="quantidade" className="form-input" placeholder="0" min="1" value={form.quantidade} onChange={handleField} required id="input-quantidade-entrada" />
            </div>

            <div className="form-group">
              <label className="form-label">Valor Unitário (R$) <span>(opcional)</span></label>
              <input type="number" name="valorUnitario" className="form-input" placeholder="0,00" min="0" step="0.01" value={form.valorUnitario} onChange={handleField} id="input-valor-unitario" />
            </div>

            <div className="form-group">
              <label className="form-label">Fornecedor <span>(opcional)</span></label>
              <input type="text" name="fornecedor" className="form-input" placeholder="Nome do fornecedor" value={form.fornecedor} onChange={handleField} id="input-fornecedor" />
            </div>

            <div className="form-group">
              <label className="form-label">Nº Nota Fiscal <span>(opcional)</span></label>
              <input type="text" name="nfNumero" className="form-input" placeholder="Ex: 001234" value={form.nfNumero} onChange={handleField} id="input-nf" />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Observação <span>(opcional)</span></label>
              <textarea name="observacao" className="form-textarea" placeholder="Observações adicionais..." value={form.observacao} onChange={handleField} rows={2} id="input-obs-entrada" />
            </div>
          </div>

          <button type="submit" className="btn btn-success btn-lg" disabled={loading} id="btn-confirmar-entrada">
            {loading ? (
              <><div className="loading-spin" style={{ width: 16, height: 16 }} /> Registrando...</>
            ) : (
              <>📥 Confirmar Entrada</>
            )}
          </button>
        </form>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title">🕐 Entradas de Hoje</div>
          <span className="badge badge-green">{recentes.length}</span>
        </div>
        {recentes.length === 0 ? (
          <div className="card"><div className="empty-state"><div className="empty-icon">📥</div><div className="empty-title">Nenhuma entrada registrada hoje</div></div></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Produto</th><th>Qtd</th><th>Valor Unit.</th><th>Custo Total</th><th>Fornecedor</th><th>NF</th><th>Horário</th></tr>
              </thead>
              <tbody>
                {recentes.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.produtoDescricao}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cód. {m.produtoCodigo}</div>
                    </td>
                    <td><strong>{m.quantidade}</strong> {m.unidade}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      {m.valorUnitario ? `R$ ${m.valorUnitario.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ color: 'var(--accent-green)', fontSize: '0.8125rem', fontWeight: 600 }}>
                      {m.custo ? `R$ ${m.custo.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{m.fornecedor || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{m.nfNumero || '—'}</td>
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
