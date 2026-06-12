import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { filterProdutos } from '../utils/search';

export default function Imprimir() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [somenteEmEstoque, setSomenteEmEstoque] = useState(false);
  const [dataFicha, setDataFicha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [titulo, setTitulo] = useState('FICHA DE SAÍDA DE EPI');
  const [local, setLocal] = useState('');

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

  const filtered = filterProdutos(produtos, search)
    .filter(p => !somenteEmEstoque || p.estoqueAtual > 0);

  const dataFormatada = dataFicha
    ? format(new Date(dataFicha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : '';

  if (loading) return <div className="loading-center"><div className="loading-spin" /></div>;

  return (
    <>
      {/* ── Controles — não aparecem na impressão ── */}
      <div className="no-print">
        <div className="page-header">
          <div>
            <h1 className="page-title">🖨️ Imprimir Ficha de Saída</h1>
            <p className="page-subtitle">Marque as quantidades manualmente durante o dia — dê baixa no app ao final</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => window.print()} id="btn-imprimir">
            🖨️ Imprimir Agora
          </button>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>⚙️ Configurar Ficha</h3>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Título da Ficha</label>
              <input type="text" className="form-input" value={titulo} onChange={e => setTitulo(e.target.value)} id="input-titulo-ficha" />
            </div>
            <div className="form-group">
              <label className="form-label">Data da Ficha</label>
              <input type="date" className="form-input" value={dataFicha} onChange={e => setDataFicha(e.target.value)} id="input-data-ficha" />
            </div>
            <div className="form-group">
              <label className="form-label">Local / Frente de Obra <span>(opcional)</span></label>
              <input type="text" className="form-input" placeholder="Ex: Frente A — Barragem" value={local} onChange={e => setLocal(e.target.value)} id="input-local-ficha" />
            </div>
            <div className="form-group">
              <label className="form-label">Filtrar produtos <span>(vazio = todos os {produtos.length})</span></label>
              <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input type="text" className="form-input" placeholder="Buscar por nome ou código..." value={search} onChange={e => setSearch(e.target.value)} id="input-filtro-imprimir" />
              </div>
            </div>

            {/* Toggle — somente em estoque */}
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="button"
                id="btn-toggle-estoque"
                onClick={() => setSomenteEmEstoque(v => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid',
                  borderColor: somenteEmEstoque ? 'var(--accent-green)' : 'var(--border)',
                  background: somenteEmEstoque ? 'rgba(16,185,129,0.12)' : 'var(--bg-input)',
                  color: somenteEmEstoque ? 'var(--accent-green)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  width: '100%',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '1rem' }}>{somenteEmEstoque ? '✅' : '📦'}</span>
                {somenteEmEstoque ? 'Somente em estoque (ativo)' : 'Somente em estoque'}
              </button>
            </div>
          </div>
          <p style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            📄 <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> produto(s) serão impressos
            {somenteEmEstoque && <span style={{ color: 'var(--accent-green)', marginLeft: '0.35rem' }}>· somente com estoque &gt; 0</span>}.
          </p>
        </div>
      </div>

      {/* ── Área de impressão ── */}
      <div className="print-area">

        {/* Cabeçalho */}
        <div className="ph">
          <div className="ph-left">
            <span className="ph-icon">🪖</span>
            <div>
              <div className="ph-company">GEL ENGENHARIA</div>
              <div className="ph-system">Sistema de Controle de EPI</div>
            </div>
          </div>
          <div className="ph-right">
            <div className="ph-title">{titulo}</div>
            <div className="ph-date">Data: {dataFormatada}</div>
            {local && <div className="ph-date">Local: {local}</div>}
          </div>
        </div>

        <div className="pd" />

        {/* Tabela */}
        <table className="pt">
          <thead>
            <tr>
              <th className="c-cod">CÓD.</th>
              <th className="c-desc">DESCRIÇÃO DO EPI</th>
              <th className="c-ca">CA</th>
              <th className="c-un">UN.</th>
              <th className="c-loc">LOC.</th>
              <th className="c-est">EST.<br/>ATUAL</th>
              <th className="c-marc">QUANTIDADE SAÍDA &nbsp;—&nbsp; Anote os números ao longo do dia &nbsp;(ex: 1, 1, 2, 1 ... total no final)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} className={i % 2 === 0 ? 're' : 'ro'}>
                <td className="c-cod tc">{p.codigo}</td>
                <td className="c-desc td">{p.descricao}</td>
                <td className="c-ca tc">{p.ca && p.ca !== 'N/A' ? p.ca : '—'}</td>
                <td className="c-un tc">{p.unidade}</td>
                <td className="c-loc tc">{p.localizacao || '—'}</td>
                <td className="c-est tc">{p.estoqueAtual}</td>
                <td className="c-marc"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Rodapé */}
        <div className="pf">
          <div>Responsável: ___________________________________ &nbsp;&nbsp; Assinatura: _______________</div>
          <div>Total de itens: {filtered.length} &nbsp;|&nbsp; Emissão: {format(new Date(), 'dd/MM/yyyy HH:mm')} &nbsp;|&nbsp; CONTROLE DE EPI GEL</div>
        </div>
      </div>

      <style>{`
        .print-area {
          background: white;
          color: #111;
          padding: 1.25rem 1.5rem;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          font-family: 'Inter', Arial, sans-serif;
          font-size: 10px;
        }

        /* header */
        .ph { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:.4rem; }
        .ph-left { display:flex; align-items:center; gap:.5rem; }
        .ph-icon { font-size:1.6rem; line-height:1; }
        .ph-company { font-size:13px; font-weight:800; color:#1a1a2e; letter-spacing:.05em; }
        .ph-system  { font-size:9px; color:#555; margin-top:1px; }
        .ph-right   { text-align:right; }
        .ph-title   { font-size:14px; font-weight:800; color:#1a1a2e; text-transform:uppercase; letter-spacing:.04em; }
        .ph-date    { font-size:9.5px; color:#444; margin-top:2px; text-transform:capitalize; }

        .pd { border:none; border-top:2.5px solid #1a1a2e; margin:.35rem 0; }

        /* tabela */
        .pt { width:100%; border-collapse:collapse; font-size:10.5px; }
        .pt thead tr { background:#1a1a2e !important; }
        .pt thead th {
          color:white; padding:6px 6px; text-align:center;
          font-size:9px; font-weight:700; text-transform:uppercase;
          letter-spacing:.03em; border:1px solid #1a1a2e; line-height:1.3;
          white-space:nowrap;
        }
        .pt thead th.c-marc {
          text-align:left; padding-left:10px;
          font-size:8.5px; font-weight:600;
          letter-spacing:.02em; font-style:italic;
          white-space:normal;
        }
        .pt tbody td { padding:7px 6px; border:1px solid #ccc; vertical-align:middle; color: #111 !important; }
        .re { background:#f4f5f8; }
        .ro { background:#ffffff; }
        .pt tbody tr.re:hover { background: #e9ebf0 !important; }
        .pt tbody tr.ro:hover { background: #f5f6f9 !important; }

        /* colunas */
        .c-cod  { width:40px;  text-align:center; }
        .c-desc { }            /* sem width fixo — expande livre */
        .c-ca   { width:60px;  text-align:center; white-space:nowrap; }
        .c-un   { width:36px;  text-align:center; }
        .c-loc  { width:42px;  text-align:center; }
        .c-est  { width:40px;  text-align:center; }
        .c-marc { width:35%;  }  /* campo de marcação — 40% da largura total */

        .tc { text-align:center; }
        .td { font-weight:700; font-size:11px; line-height:1.4; }

        /* rodapé */
        .pf {
          display:flex; justify-content:space-between;
          margin-top:1rem; padding-top:.5rem;
          border-top:1px solid #bbb;
          font-size:8.5px; color:#444;
        }

        /* ── IMPRESSÃO A4 ── */
        @media print {
          @page { size:A4 portrait; margin:8mm 10mm 10mm 10mm; }
          * { -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }

          .no-print { display:none !important; }
          .navbar   { display:none !important; }
          .app-layout { display:block !important; }
          .app-main { margin:0 !important; padding:0 !important; }

          .print-area {
            border:none !important; padding:0 !important;
            border-radius:0 !important; box-shadow:none !important;
          }
          .pt { page-break-inside:auto; }
          .pt tr { page-break-inside:avoid; }
          .pt thead { display:table-header-group; }
          .pf { page-break-inside:avoid; }
        }
      `}</style>
    </>
  );
}
