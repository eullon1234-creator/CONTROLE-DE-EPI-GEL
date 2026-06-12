import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import { filterProdutos } from '../utils/search';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import XLSX from 'xlsx-js-style';

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
      // ── Fetch movimentacoes ──────────────────────────────────────────────
      const movsSnap = await getDocs(
        query(collection(db, 'movimentacoes'), orderBy('criadoEm', 'desc'))
      );
      const allMovs  = movsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const entradas = allMovs.filter(m => m.tipo === 'ENTRADA');
      const saidas   = allMovs.filter(m => m.tipo === 'SAIDA');
      const now      = format(new Date(), "dd/MM/yyyy 'às' HH:mm");
      
      const totalValuation = produtos.reduce((sum, p) => sum + ((p.estoqueAtual ?? 0) * (p.valorUnitario ?? 0)), 0);

      // ── Colour palette ───────────────────────────────────────────────────
      const C = {
        azulEscuro : '1E3A5F',
        azulMedio  : '2563A8',
        azulClaro  : 'DBEAFE',
        branco     : 'FFFFFF',
        cinzaLinha : 'F8FAFC',
        cinzaBorda : 'CBD5E1',
        verdeCl    : 'DCFCE7',
        verdeTxt   : '166534',
        vermCl     : 'FEE2E2',
        vermTxt    : '991B1B',
        amarCl     : 'FEF9C3',
        amarTxt    : '854D0E',
      };

      // ── Shared style factories ───────────────────────────────────────────
      const border = (color = C.cinzaBorda) => ({
        top   : { style: 'thin', color: { rgb: color } },
        bottom: { style: 'thin', color: { rgb: color } },
        left  : { style: 'thin', color: { rgb: color } },
        right : { style: 'thin', color: { rgb: color } },
      });

      const sColHeader = {
        font     : { bold: true, sz: 10, color: { rgb: C.branco }, name: 'Calibri' },
        fill     : { patternType: 'solid', fgColor: { rgb: C.azulMedio } },
        border   : border(C.azulEscuro),
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      };

      const sNormal = (ri, fillOverride) => ({
        font     : { sz: 9, name: 'Calibri' },
        fill     : { patternType: 'solid', fgColor: { rgb: fillOverride || (ri % 2 === 0 ? C.branco : C.cinzaLinha) } },
        border   : border(),
        alignment: { horizontal: 'left', vertical: 'center' },
      });

      const sCenter = (ri, fillOverride, fontExtra = {}) => ({
        font     : { sz: 9, name: 'Calibri', ...fontExtra },
        fill     : { patternType: 'solid', fgColor: { rgb: fillOverride || (ri % 2 === 0 ? C.branco : C.cinzaLinha) } },
        border   : border(),
        alignment: { horizontal: 'center', vertical: 'center' },
      });

      // ── Build sheet helper ───────────────────────────────────────────────
      function buildSheet(headers, rows, colWidths, getRowMeta) {
        const ws = {};
        const maxR = rows.length;
        const maxC = headers.length - 1;

        // Header row
        headers.forEach((h, ci) => {
          ws[XLSX.utils.encode_cell({ r: 0, c: ci })] = { v: h, t: 's', s: sColHeader };
        });

        // Data rows
        rows.forEach((row, ri) => {
          const meta = getRowMeta ? getRowMeta(row, ri) : {};
          const fill = meta.fill || null;
          const fontExtra = {};
          if (meta.textColor) fontExtra.color = { rgb: meta.textColor };
          if (meta.bold)      fontExtra.bold = true;

          row.forEach((v, ci) => {
            const isNum = typeof v === 'number';
            ws[XLSX.utils.encode_cell({ r: ri + 1, c: ci })] = {
              v : v ?? '',
              t : isNum ? 'n' : 's',
              s : isNum
                ? sCenter(ri, fill, fontExtra)
                : { ...sNormal(ri, fill), font: { sz: 9, name: 'Calibri', ...fontExtra } },
            };
          });
        });

        ws['!ref']  = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: maxC, r: maxR } });
        ws['!cols'] = colWidths.map(w => ({ wch: w }));
        ws['!rows'] = [{ hpt: 28 }, ...rows.map(() => ({ hpt: 17 }))];
        return ws;
      }

      // ── Sheet 1 — RESUMO / CAPA ──────────────────────────────────────────
      const wsCapa = {};

      // Title block
      const titleRows = [
        { text: 'CONTROLE DE EPI — GEL ENGENHARIA', style: {
          font     : { bold: true, sz: 22, color: { rgb: C.branco }, name: 'Calibri' },
          fill     : { patternType: 'solid', fgColor: { rgb: C.azulEscuro } },
          alignment: { horizontal: 'center', vertical: 'center' },
        }, hpt: 48 },
        { text: 'Relatório de Estoque e Movimentações', style: {
          font     : { sz: 14, color: { rgb: C.azulClaro }, name: 'Calibri' },
          fill     : { patternType: 'solid', fgColor: { rgb: C.azulEscuro } },
          alignment: { horizontal: 'center', vertical: 'center' },
        }, hpt: 30 },
        { text: `Gerado em: ${now}`, style: {
          font     : { sz: 10, italic: true, color: { rgb: '6B7280' }, name: 'Calibri' },
          fill     : { patternType: 'solid', fgColor: { rgb: C.cinzaLinha } },
          alignment: { horizontal: 'center', vertical: 'center' },
        }, hpt: 20 },
        { text: '', style: {}, hpt: 10 }, // spacer
      ];

      // Summary sections
      const secHeaderStyle = {
        font     : { bold: true, sz: 11, color: { rgb: C.branco }, name: 'Calibri' },
        fill     : { patternType: 'solid', fgColor: { rgb: C.azulMedio } },
        alignment: { horizontal: 'left', vertical: 'center' },
      };

      const summaryRows = [
        { label: 'RESUMO DO ESTOQUE', isSection: true },
        { label: 'Total de Produtos Cadastrados', value: produtos.length, fill: C.branco },
        { label: 'Produtos com Estoque Baixo',    value: produtos.filter(p => p.estoqueAtual <= p.estoqueMin).length,   fill: C.vermCl,  txtColor: C.vermTxt },
        { label: 'Produtos com Estoque Normal',   value: produtos.filter(p => p.estoqueAtual > p.estoqueMin && p.estoqueAtual < p.estoqueMax).length, fill: C.verdeCl, txtColor: C.verdeTxt },
        { label: 'Produtos com Estoque Alto',     value: produtos.filter(p => p.estoqueAtual >= p.estoqueMax).length,   fill: C.amarCl,  txtColor: C.amarTxt },
        { label: 'Valor Total Financeiro do Estoque', value: totalValuation, fill: C.azulClaro, txtColor: C.azulEscuro, isCurrency: true },
        { label: '', isBlank: true },
        { label: 'MOVIMENTAÇÕES', isSection: true },
        { label: 'Total de Entradas Registradas', value: entradas.length, fill: C.verdeCl, txtColor: C.verdeTxt },
        { label: 'Total de Saídas Registradas',   value: saidas.length,   fill: C.vermCl,  txtColor: C.vermTxt },
        { label: 'Total de Movimentações',         value: allMovs.length,  fill: C.branco },
      ];

      let rowIdx = 0;
      const capaRowHeights = [];

      titleRows.forEach(({ text, style, hpt }) => {
        const isBlank = text === '' && Object.keys(style).length === 0;
        if (!isBlank) {
          wsCapa[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: text, t: 's', s: style };
        }
        capaRowHeights.push({ hpt: hpt || 20 });
        rowIdx++;
      });

      summaryRows.forEach(({ label, value, isSection, isBlank, fill, txtColor, isCurrency }) => {
        if (isBlank) {
          capaRowHeights.push({ hpt: 10 });
          rowIdx++;
          return;
        }
        if (isSection) {
          wsCapa[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = { v: label, t: 's', s: secHeaderStyle };
          capaRowHeights.push({ hpt: 24 });
          rowIdx++;
          return;
        }
        const rowFill = { patternType: 'solid', fgColor: { rgb: fill || C.branco } };
        wsCapa[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })] = {
          v: label, t: 's',
          s: { font: { sz: 10, name: 'Calibri' }, fill: rowFill, border: border(), alignment: { horizontal: 'left', vertical: 'center' } },
        };
        wsCapa[XLSX.utils.encode_cell({ r: rowIdx, c: 1 })] = {
          v: value, t: 'n',
          z: isCurrency ? '"R$ "#,##0.00' : undefined,
          s: { font: { bold: true, sz: 13, name: 'Calibri', color: { rgb: txtColor || C.azulEscuro } }, fill: rowFill, border: border(), alignment: { horizontal: isCurrency ? 'right' : 'center', vertical: 'center' } },
        };
        capaRowHeights.push({ hpt: 22 });
        rowIdx++;
      });

      // Merges for title rows + section headers
      wsCapa['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
        { s: { r: 10, c: 0 }, e: { r: 10, c: 1 } },
      ];
      wsCapa['!ref']  = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 1, r: rowIdx - 1 } });
      wsCapa['!cols'] = [{ wch: 42 }, { wch: 18 }];
      wsCapa['!rows'] = capaRowHeights;

      // ── Sheet 2 — ESTOQUE ATUAL ──────────────────────────────────────────
      const estoqueHeaders = [
        'Código', 'Descrição do EPI', 'Grupo / Categoria', 'Unid.',
        'Nº CA', 'Validade CA', 'Localização',
        'Est. Mínimo', 'Est. Máximo', 'Valor Unitário', 'Valor Total', 'Est. Atual', 'Status',
      ];
      const estoqueRows = produtos.map(p => {
        let status = 'NORMAL';
        if (p.estoqueAtual <= p.estoqueMin)  status = 'ESTOQUE BAIXO';
        else if (p.estoqueAtual >= p.estoqueMax) status = 'ESTOQUE ALTO';
        
        const vUnit = p.valorUnitario ?? 0;
        const vTotal = (p.estoqueAtual ?? 0) * vUnit;

        return [
          p.codigo      || '',
          p.descricao   || '',
          p.grupo       || '',
          p.unidade     || '',
          p.ca          || '',
          p.validadeCa  || '',
          p.localizacao || '',
          p.estoqueMin  ?? 0,
          p.estoqueMax  ?? 0,
          vUnit,
          vTotal,
          p.estoqueAtual ?? 0,
          status,
        ];
      });

      const estoqueRowMeta = (row) => {
        const status = row[12];
        if (status === 'ESTOQUE BAIXO') return { fill: C.vermCl, textColor: C.vermTxt };
        if (status === 'ESTOQUE ALTO')  return { fill: C.amarCl, textColor: C.amarTxt };
        return {};
      };

      const wsEstoque = buildSheet(
        estoqueHeaders, estoqueRows,
        [10, 42, 20, 7, 10, 13, 14, 11, 11, 14, 14, 12, 16],
        estoqueRowMeta
      );

      // Override status column to be centered + bold pill style
      estoqueRows.forEach((row, ri) => {
        const status  = row[12];
        const isLow   = status === 'ESTOQUE BAIXO';
        const isHigh  = status === 'ESTOQUE ALTO';
        const fillClr = isLow ? C.vermCl : isHigh ? C.amarCl : C.verdeCl;
        const txtClr  = isLow ? C.vermTxt : isHigh ? C.amarTxt : C.verdeTxt;
        
        // Status Column (index 12)
        wsEstoque[XLSX.utils.encode_cell({ r: ri + 1, c: 12 })] = {
          v: status, t: 's',
          s: { font: { bold: true, sz: 9, name: 'Calibri', color: { rgb: txtClr } },
               fill: { patternType: 'solid', fgColor: { rgb: fillClr } },
               border: border(),
               alignment: { horizontal: 'center', vertical: 'center' } },
        };

        // Valor Unitário (index 9)
        const vUnitAddr = XLSX.utils.encode_cell({ r: ri + 1, c: 9 });
        wsEstoque[vUnitAddr] = {
          v: row[9], t: 'n', z: '"R$ "#,##0.00',
          s: { font: { sz: 9, name: 'Calibri', color: { rgb: isLow ? C.vermTxt : (isHigh ? C.amarTxt : '000000') } },
               fill: { patternType: 'solid', fgColor: { rgb: isLow ? C.vermCl : (isHigh ? C.amarCl : (ri % 2 === 0 ? C.branco : C.cinzaLinha)) } },
               border: border(), alignment: { horizontal: 'right', vertical: 'center' } }
        };

        // Valor Total (index 10)
        const vTotalAddr = XLSX.utils.encode_cell({ r: ri + 1, c: 10 });
        wsEstoque[vTotalAddr] = {
          v: row[10], t: 'n', z: '"R$ "#,##0.00',
          s: { font: { bold: true, sz: 10, name: 'Calibri', color: { rgb: isLow ? C.vermTxt : (isHigh ? C.amarTxt : '000000') } },
               fill: { patternType: 'solid', fgColor: { rgb: isLow ? C.vermCl : (isHigh ? C.amarCl : (ri % 2 === 0 ? C.branco : C.cinzaLinha)) } },
               border: border(), alignment: { horizontal: 'right', vertical: 'center' } }
        };

        // Est. Atual (index 11): bold + colored
        const estAtualAddr = XLSX.utils.encode_cell({ r: ri + 1, c: 11 });
        wsEstoque[estAtualAddr].s = {
          ...wsEstoque[estAtualAddr].s,
          font: { bold: true, sz: 11, name: 'Calibri', color: { rgb: isLow ? C.vermTxt : C.verdeTxt } },
        };
      });

      wsEstoque['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

      // ── Sheet 3 — ENTRADAS ───────────────────────────────────────────────
      const entHeaders = [
        'Data', 'Código', 'Descrição do EPI', 'Qtd.', 'Unid.',
        'Valor Unitário', 'Custo Total', 'Fornecedor', 'Nº Nota Fiscal', 'Observação', 'Registrado por',
      ];
      const entRows = entradas.map(m => {
        const d = m.data || (m.criadoEm?.toDate ? format(m.criadoEm.toDate(), 'dd/MM/yyyy') : '—');
        return [
          d,
          m.produtoCodigo   || '',
          m.produtoDescricao || '',
          m.quantidade       ?? 0,
          m.unidade          || '',
          m.valorUnitario    ?? 0,
          m.custo            ?? 0,
          m.fornecedor       || '—',
          m.nfNumero         || '—',
          m.observacao       || '—',
          m.registradoPorEmail || '—',
        ];
      });
      const wsEntradas = buildSheet(entHeaders, entRows, [13, 10, 44, 7, 7, 14, 14, 30, 14, 30, 24], null);
      
      entRows.forEach((row, ri) => {
        // Valor Unitário (index 5)
        const vUnitAddr = XLSX.utils.encode_cell({ r: ri + 1, c: 5 });
        wsEntradas[vUnitAddr] = {
          v: row[5], t: 'n', z: '"R$ "#,##0.00',
          s: { font: { sz: 9, name: 'Calibri' }, fill: { patternType: 'solid', fgColor: { rgb: ri % 2 === 0 ? C.branco : C.cinzaLinha } }, border: border(), alignment: { horizontal: 'right', vertical: 'center' } }
        };
        // Custo Total (index 6)
        const vCustoAddr = XLSX.utils.encode_cell({ r: ri + 1, c: 6 });
        wsEntradas[vCustoAddr] = {
          v: row[6], t: 'n', z: '"R$ "#,##0.00',
          s: { font: { bold: true, sz: 9, name: 'Calibri' }, fill: { patternType: 'solid', fgColor: { rgb: ri % 2 === 0 ? C.branco : C.cinzaLinha } }, border: border(), alignment: { horizontal: 'right', vertical: 'center' } }
        };
      });

      wsEntradas['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

      // ── Sheet 4 — SAÍDAS ─────────────────────────────────────────────────
      const saidHeaders = [
        'Data', 'Código', 'Descrição do EPI', 'Qtd.', 'Unid.',
        'Funcionário', 'Empresa / Setor', 'Observação', 'Registrado por',
      ];
      const saidRows = saidas.map(m => {
        const d = m.data || (m.criadoEm?.toDate ? format(m.criadoEm.toDate(), 'dd/MM/yyyy') : '—');
        return [
          d,
          m.produtoCodigo    || '',
          m.produtoDescricao || '',
          m.quantidade        ?? 0,
          m.unidade           || '',
          m.funcionario       || '—',
          m.empresa           || '—',
          m.observacao        || '—',
          m.registradoPorEmail || '—',
        ];
      });
      const wsSaidas = buildSheet(saidHeaders, saidRows, [13, 10, 44, 7, 7, 28, 22, 30, 24], null);
      wsSaidas['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

      // ── Workbook ─────────────────────────────────────────────────────────
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsCapa,     'Resumo');
      XLSX.utils.book_append_sheet(wb, wsEstoque,  'Estoque Atual');
      XLSX.utils.book_append_sheet(wb, wsEntradas, 'Entradas');
      XLSX.utils.book_append_sheet(wb, wsSaidas,   'Saidas');

      XLSX.writeFile(wb, `Relatorio_EPI_GEL_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
      toast.success('Planilha profissional exportada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar planilha. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  const totalSaldos = produtos.reduce((acc, p) => acc + (p.estoqueAtual ?? 0), 0);
  const valorTotalEstoque = produtos.reduce((acc, p) => acc + ((p.estoqueAtual ?? 0) * (p.valorUnitario ?? 0)), 0);
  const totalAlerta = produtos.filter(p => p.estoqueAtual <= p.estoqueMin).length;

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
              <>📊 Exportar Planilha</>
            )}
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/produtos')} id="btn-novo-produto">
            + Novo Produto
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card stat-card">
          <div className="stat-icon blue">📦</div>
          <div>
            <div className="stat-value">{totalSaldos}</div>
            <div className="stat-label">Saldo de Itens</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon green">💰</div>
          <div>
            <div className="stat-value">
              {valorTotalEstoque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <div className="stat-label">Valor do Estoque</div>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon red">🚨</div>
          <div>
            <div className="stat-value">{totalAlerta}</div>
            <div className="stat-label">Produtos em Alerta</div>
          </div>
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
                <th>Valor Unit.</th>
                <th>Valor Total</th>
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
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                    {p.valorUnitario ? `R$ ${p.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'R$ 0,00'}
                  </td>
                  <td style={{ color: 'var(--text-primary)', fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {((p.estoqueAtual ?? 0) * (p.valorUnitario ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
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
