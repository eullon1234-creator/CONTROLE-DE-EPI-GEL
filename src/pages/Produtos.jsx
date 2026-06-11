import { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  getDocs, query, orderBy, serverTimestamp, where
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';

const GRUPOS = ['CONSUMO', 'PERMANENTE'];
const UNIDADES = ['UND', 'PAR', 'CONJ', 'MTS', 'M'];

const EMPTY_FORM = {
  codigo: '', grupo: 'CONSUMO', descricao: '', ca: '',
  validadeCa: '', unidade: 'UND', estoqueMin: '', estoqueMax: '', estoqueAtual: '',
  localizacao: ''
};

export default function Produtos() {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [searchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    load();
    const editParam = searchParams.get('edit');
    if (editParam) {
      setShowForm(true);
    }
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [search]);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'produtos'), orderBy('descricao')));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProdutos(data);

      const editParam = searchParams.get('edit');
      if (editParam) {
        const produto = data.find(p => p.id === editParam);
        if (produto) startEdit(produto);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleField(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function startEdit(produto) {
    setForm({
      codigo: String(produto.codigo || ''),
      grupo: produto.grupo || 'CONSUMO',
      descricao: produto.descricao || '',
      ca: produto.ca || '',
      validadeCa: produto.validadeCa || '',
      unidade: produto.unidade || 'UND',
      estoqueMin: String(produto.estoqueMin || ''),
      estoqueMax: String(produto.estoqueMax || ''),
      estoqueAtual: String(produto.estoqueAtual || ''),
      localizacao: produto.localizacao || '',
    });
    setEditId(produto.id);
    setShowForm(true);
    window.scrollTo(0, 0);
  }

  function cancelForm() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const codigo = parseInt(form.codigo);
    if (!codigo) return toast.error('Código inválido');
    if (!form.descricao.trim()) return toast.error('Descrição obrigatória');

    // Check duplicate code
    if (!editId) {
      const dup = produtos.find(p => p.codigo === codigo);
      if (dup) return toast.error(`Código ${codigo} já cadastrado: ${dup.descricao}`);
    }

    setSaving(true);
    try {
      const data = {
        codigo,
        grupo: form.grupo,
        descricao: form.descricao.trim().toUpperCase(),
        ca: form.ca || null,
        validadeCa: form.validadeCa || null,
        unidade: form.unidade,
        estoqueMin: parseInt(form.estoqueMin) || 0,
        estoqueMax: parseInt(form.estoqueMax) || 0,
        estoqueAtual: parseInt(form.estoqueAtual) || 0,
        localizacao: form.localizacao || null,
        atualizadoEm: serverTimestamp(),
      };

      if (editId) {
        await updateDoc(doc(db, 'produtos', editId), data);
        toast.success('Produto atualizado!');
      } else {
        await addDoc(collection(db, 'produtos'), {
          ...data,
          criadoPor: user.uid,
          criadoEm: serverTimestamp(),
        });
        toast.success('Produto cadastrado!');
      }

      cancelForm();
      load();
    } catch (err) {
      toast.error('Erro ao salvar produto');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(produto) {
    if (!confirm(`Excluir "${produto.descricao}"?\nEsta ação não pode ser desfeita.`)) return;
    try {
      await deleteDoc(doc(db, 'produtos', produto.id));
      toast.success('Produto excluído');
      load();
    } catch {
      toast.error('Erro ao excluir');
    }
  }

  function handleSelectRow(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function handleSelectAll() {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(p => p.id));
    }
  }

  async function handleDeleteSelected() {
    if (!confirm(`Excluir ${selectedIds.length} produto(s) selecionado(s)?\nEsta ação não pode ser desfeita.`)) return;
    
    setLoading(true);
    try {
      await Promise.all(
        selectedIds.map(id => deleteDoc(doc(db, 'produtos', id)))
      );
      toast.success(`${selectedIds.length} produto(s) excluído(s)!`);
      setSelectedIds([]);
      load();
    } catch (err) {
      toast.error('Erro ao excluir produtos selecionados');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filtered = produtos.filter(p =>
    !search ||
    p.descricao?.toLowerCase().includes(search.toLowerCase()) ||
    String(p.codigo).includes(search)
  );

  if (loading) return <div className="loading-center"><div className="loading-spin" /></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🗂️ Cadastro de Produtos</h1>
          <p className="page-subtitle">{produtos.length} EPIs cadastrados</p>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)} id="btn-novo-epi">
            + Novo EPI
          </button>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1.75rem' }}>
          <h3 style={{ marginBottom: '1.25rem', color: 'var(--text-primary)' }}>
            {editId ? '✏️ Editar Produto' : '➕ Novo Produto'}
          </h3>
          <form onSubmit={handleSubmit} id="form-produto">
            <div className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Código *</label>
                <input type="number" name="codigo" className="form-input" placeholder="Ex: 001" value={form.codigo} onChange={handleField} required min="1" id="input-cod-produto" />
              </div>

              <div className="form-group">
                <label className="form-label">Grupo</label>
                <select name="grupo" className="form-select" value={form.grupo} onChange={handleField} id="select-grupo">
                  {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Descrição *</label>
                <input type="text" name="descricao" className="form-input" placeholder="Ex: LUVA DE VAQUETA MARROM" value={form.descricao} onChange={handleField} required id="input-desc-produto" />
              </div>

              <div className="form-group">
                <label className="form-label">CA <span>(Certif. Aprovação)</span></label>
                <input type="text" name="ca" className="form-input" placeholder="Ex: 12345" value={form.ca} onChange={handleField} id="input-ca" />
              </div>

              <div className="form-group">
                <label className="form-label">Validade do CA</label>
                <input type="date" name="validadeCa" className="form-input" value={form.validadeCa} onChange={handleField} id="input-validade-ca" />
              </div>

              <div className="form-group">
                <label className="form-label">Unidade</label>
                <select name="unidade" className="form-select" value={form.unidade} onChange={handleField} id="select-unidade">
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Localização</label>
                <select name="localizacao" className="form-select" value={form.localizacao} onChange={handleField} id="select-localizacao">
                  <option value="">Selecione...</option>
                  <option value="P1">P1</option>
                  <option value="P2">P2</option>
                  <option value="P3">P3</option>
                  <option value="P4">P4</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Estoque Mínimo</label>
                <input type="number" name="estoqueMin" className="form-input" placeholder="0" min="0" value={form.estoqueMin} onChange={handleField} id="input-est-min" />
              </div>

              <div className="form-group">
                <label className="form-label">Estoque Máximo</label>
                <input type="number" name="estoqueMax" className="form-input" placeholder="0" min="0" value={form.estoqueMax} onChange={handleField} id="input-est-max" />
              </div>

              <div className="form-group">
                <label className="form-label">Estoque Atual <span>(saldo inicial)</span></label>
                <input type="number" name="estoqueAtual" className="form-input" placeholder="0" min="0" value={form.estoqueAtual} onChange={handleField} id="input-est-atual" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving} id="btn-salvar-produto">
                {saving ? <><div className="loading-spin" style={{ width: 14, height: 14 }} /> Salvando...</> : (editId ? '💾 Atualizar' : '➕ Cadastrar')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={cancelForm} id="btn-cancelar-produto">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="filters-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <span className="search-icon">🔍</span>
          <input type="text" className="form-input" placeholder="Buscar produto..." value={search} onChange={e => setSearch(e.target.value)} id="input-buscar-produto" />
        </div>
        {selectedIds.length > 0 && (
          <button
            className="btn btn-danger"
            onClick={handleDeleteSelected}
            id="btn-excluir-selecionados"
            style={{ animation: 'fadeIn 0.2s ease' }}
          >
            🗑️ Excluir Selecionados ({selectedIds.length})
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🗂️</div>
            <div className="empty-title">Nenhum produto cadastrado</div>
            <div className="empty-desc">Clique em "Novo EPI" para começar.</div>
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                    id="checkbox-select-all"
                  />
                </th>
                <th>Cód.</th>
                <th>Descrição</th>
                <th>Grupo</th>
                <th>CA</th>
                <th>Validade CA</th>
                <th>Unid.</th>
                <th>Local.</th>
                <th>Mín</th>
                <th>Máx</th>
                <th>Atual</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isSelected = selectedIds.includes(p.id);
                return (
                  <tr key={p.id} style={{ backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.08)' : '' }}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(p.id)}
                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                        id={`checkbox-select-${p.id}`}
                      />
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{p.codigo}</td>
                    <td style={{ fontWeight: 500 }}>{p.descricao}</td>
                    <td><span className="badge badge-gray">{p.grupo}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{p.ca || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{p.validadeCa || '—'}</td>
                    <td><span className="badge badge-blue">{p.unidade}</span></td>
                    <td>{p.localizacao ? <span className="badge badge-yellow">{p.localizacao}</span> : '—'}</td>
                    <td>{p.estoqueMin}</td>
                    <td>{p.estoqueMax}</td>
                    <td style={{ fontWeight: 700, color: p.estoqueAtual <= p.estoqueMin ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                      {p.estoqueAtual}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => startEdit(p)} id={`btn-edit-${p.id}`}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)} id={`btn-del-${p.id}`}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
