import { useState, useEffect, useMemo } from 'react';
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, increment,
  serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import XLSX from 'xlsx-js-style';

const TIPOS_DESTINO = [
  { id: 'OBRA', label: '🏢 Transferência para Outra Obra', color: 'badge-blue' },
  { id: 'VENDA', label: '💰 Venda / Desmobilização', color: 'badge-green' },
  { id: 'MORTO', label: '⚠️ Estoque Morto / Obsoleto', color: 'badge-yellow' },
  { id: 'AVARIADO', label: '🛠️ Avariado / Quarentena', color: 'badge-red' },
];

export default function EstoqueMorto() {
  const { user } = useAuth();
  const [itens, setItens] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [filtroStatus, setFiltroStatus] = useState('TODOS');

  // Modais
  const [showNovoModal, setShowNovoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConcluirModal, setShowConcluirModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Form para Novo Item Manual
  const [novoForm, setNovoForm] = useState({
    produtoId: '',
    produtoCodigo: '',
    produtoDescricao: '',
    unidade: 'UN',
    ca: '',
    quantidade: '',
    tipoDestino: 'OBRA',
    destinoNome: '', // Nome da Obra ou do Comprador
    localizacao: 'Box Almoxarifado Separado',
    valorUnitario: '',
    observacao: '',
    data: format(new Date(), 'yyyy-MM-dd')
  });

  // Form para Edição
  const [editForm, setEditForm] = useState({
    destinoNome: '',
    localizacao: '',
    valorUnitario: '',
    observacao: '',
    tipoDestino: 'OBRA'
  });

  // Form para Conclusão de Saída / Venda
  const [concluirForm, setConcluirForm] = useState({
    dataConclusao: format(new Date(), 'yyyy-MM-dd'),
    nfGuia: '',
    observacaoFinal: ''
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    try {
      // 1. Carregar Itens Separados
      const itensSnap = await getDocs(
        query(collection(db, 'estoque_morto'), orderBy('criadoEm', 'desc'))
      );
      const itensList = itensSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItens(itensList);

      // 2. Carregar Produtos para autocomplete se necessário
      const prodSnap = await getDocs(
        query(collection(db, 'produtos'), orderBy('descricao'))
      );
      setProdutos(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Erro ao carregar dados de estoque morto:', error);
      toast.error('Erro ao carregar dados do estoque separado.');
    } finally {
      setLoading(false);
    }
  }

  // Filtragem dos dados
  const itensFiltrados = useMemo(() => {
    return itens.filter(item => {
      const matchSearch =
        (item.produtoDescricao || '').toLowerCase().includes(search.toLowerCase()) ||
        String(item.produtoCodigo || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.destinoNome || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.localizacao || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.observacao || '').toLowerCase().includes(search.toLowerCase());

      const matchTipo = filtroTipo === 'TODOS' || item.tipoDestino === filtroTipo;
      const matchStatus = filtroStatus === 'TODOS' || item.status === filtroStatus;

      return matchSearch && matchTipo && matchStatus;
    });
  }, [itens, search, filtroTipo, filtroStatus]);

  // Métricas
  const totalSeparadosQtd = itens
    .filter(i => i.status === 'SEPARADO')
    .reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);

  const totalParaObra = itens
    .filter(i => i.status === 'SEPARADO' && i.tipoDestino === 'OBRA')
    .reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);

  const totalParaVenda = itens
    .filter(i => i.status === 'SEPARADO' && i.tipoDestino === 'VENDA')
    .reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);

  const totalMorto = itens
    .filter(i => i.status === 'SEPARADO' && (i.tipoDestino === 'MORTO' || i.tipoDestino === 'AVARIADO'))
    .reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);

  const valorTotalEstimado = itens
    .filter(i => i.status === 'SEPARADO')
    .reduce((acc, i) => acc + ((Number(i.quantidade) || 0) * (Number(i.valorUnitario) || 0)), 0);

  // Manipulação de Produto no Form Manual
  function handleSelectProduto(produtoId) {
    const prod = produtos.find(p => p.id === produtoId);
    if (prod) {
      setNovoForm(prev => ({
        ...prev,
        produtoId: prod.id,
        produtoCodigo: prod.codigo || '',
        produtoDescricao: prod.descricao || '',
        unidade: prod.unidade || 'UN',
        ca: prod.ca || '',
        valorUnitario: prod.preco || ''
      }));
    }
  }

  // Salvar Novo Item Manual
  async function handleSalvarNovo(e) {
    e.preventDefault();
    const qty = parseInt(novoForm.quantidade);
    if (!qty || qty <= 0) return toast.error('Informe uma quantidade válida.');
    if (!novoForm.produtoDescricao.trim()) return toast.error('Informe a descrição do produto.');

    setSaving(true);
    try {
      await addDoc(collection(db, 'estoque_morto'), {
        produtoId: novoForm.produtoId || null,
        produtoCodigo: novoForm.produtoCodigo || 'S/C',
        produtoDescricao: novoForm.produtoDescricao.trim(),
        unidade: novoForm.unidade || 'UN',
        ca: novoForm.ca || '',
        quantidade: qty,
        tipoDestino: novoForm.tipoDestino,
        destinoNome: novoForm.destinoNome.trim() || 'Almoxarifado Geral',
        localizacao: novoForm.localizacao.trim() || 'Separado no Almoxarifado',
        valorUnitario: parseFloat(novoForm.valorUnitario) || 0,
        observacao: novoForm.observacao.trim() || '',
        data: novoForm.data || format(new Date(), 'yyyy-MM-dd'),
        status: 'SEPARADO', // SEPARADO | CONCLUIDO | DEVOLVIDO
        criadoPor: user?.email || 'Sistema',
        criadoEm: serverTimestamp()
      });

      // Se foi selecionado um produto existente, decrementa do estoque principal
      if (novoForm.produtoId) {
        try {
          await updateDoc(doc(db, 'produtos', novoForm.produtoId), {
            estoqueAtual: increment(-qty)
          });
          await addDoc(collection(db, 'movimentacoes'), {
            tipo: 'TRANSFERENCIA',
            data: novoForm.data,
            produtoId: novoForm.produtoId,
            produtoCodigo: novoForm.produtoCodigo,
            produtoDescricao: novoForm.produtoDescricao,
            unidade: novoForm.unidade,
            quantidade: qty,
            observacao: `[ESTOQUE SEPARADO - ${novoForm.tipoDestino}] ${novoForm.destinoNome}: ${novoForm.observacao}`,
            registradoPor: user?.uid || 'Sistema',
            registradoPorEmail: user?.email || 'Sistema',
            criadoEm: serverTimestamp()
          });
        } catch (err) {
          console.warn('Erro ao atualizar estoque principal:', err);
        }
      }

      toast.success('Item adicionado ao Estoque Separado com sucesso!');
      setShowNovoModal(false);
      setNovoForm({
        produtoId: '',
        produtoCodigo: '',
        produtoDescricao: '',
        unidade: 'UN',
        ca: '',
        quantidade: '',
        tipoDestino: 'OBRA',
        destinoNome: '',
        localizacao: 'Box Almoxarifado Separado',
        valorUnitario: '',
        observacao: '',
        data: format(new Date(), 'yyyy-MM-dd')
      });
      carregarDados();
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      toast.error('Erro ao registrar item separado.');
    } finally {
      setSaving(false);
    }
  }

  // Devolver item ao Estoque Principal
  async function handleDevolverEstoque(item) {
    if (!window.confirm(`Deseja realmente devolver ${item.quantidade} ${item.unidade} de "${item.produtoDescricao}" de volta ao Estoque Principal?`)) {
      return;
    }

    const toastId = toast.loading('Processando devolução...');
    try {
      // 1. Atualiza o status em estoque_morto
      await updateDoc(doc(db, 'estoque_morto', item.id), {
        status: 'DEVOLVIDO',
        devolvidoEm: serverTimestamp(),
        devolvidoPor: user?.email || 'Sistema'
      });

      // 2. Se possuir produtoId correspondente, restaura o saldo em produtos
      if (item.produtoId) {
        await updateDoc(doc(db, 'produtos', item.produtoId), {
          estoqueAtual: increment(item.quantidade)
        });

        // 3. Registra movimentação de estorno
        await addDoc(collection(db, 'movimentacoes'), {
          tipo: 'ENTRADA',
          data: format(new Date(), 'yyyy-MM-dd'),
          produtoId: item.produtoId,
          produtoCodigo: item.produtoCodigo,
          produtoDescricao: item.produtoDescricao,
          unidade: item.unidade,
          quantidade: item.quantidade,
          observacao: `[ESTORNO DE ESTOQUE SEPARADO] Devolvido do almoxarifado separado (${item.destinoNome || 'Geral'})`,
          registradoPor: user?.uid || 'Sistema',
          registradoPorEmail: user?.email || 'Sistema',
          criadoEm: serverTimestamp()
        });
      }

      toast.success('Item devolvido com sucesso ao Estoque Principal!', { id: toastId });
      carregarDados();
    } catch (error) {
      console.error('Erro ao devolver item:', error);
      toast.error('Erro ao estornar item para o estoque.', { id: toastId });
    }
  }

  // Abrir Modal de Conclusão (Despacho / Venda Finalizada)
  function handleOpenConcluir(item) {
    setSelectedItem(item);
    setConcluirForm({
      dataConclusao: format(new Date(), 'yyyy-MM-dd'),
      nfGuia: '',
      observacaoFinal: ''
    });
    setShowConcluirModal(true);
  }

  // Confirmar Conclusão de Envio/Venda
  async function handleConfirmarConclusao(e) {
    e.preventDefault();
    if (!selectedItem) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'estoque_morto', selectedItem.id), {
        status: 'CONCLUIDO',
        dataConclusao: concluirForm.dataConclusao,
        nfGuia: concluirForm.nfGuia.trim(),
        observacaoFinal: concluirForm.observacaoFinal.trim(),
        concluidoPor: user?.email || 'Sistema',
        concluidoEm: serverTimestamp()
      });

      toast.success('Status atualizado para CONCLUÍDO (Enviado/Vendido)!', { icon: '✅' });
      setShowConcluirModal(false);
      setSelectedItem(null);
      carregarDados();
    } catch (error) {
      console.error('Erro ao concluir item:', error);
      toast.error('Erro ao finalizar saída.');
    } finally {
      setSaving(false);
    }
  }

  // Abrir Edição
  function handleOpenEdit(item) {
    setSelectedItem(item);
    setEditForm({
      destinoNome: item.destinoNome || '',
      localizacao: item.localizacao || '',
      valorUnitario: item.valorUnitario || '',
      observacao: item.observacao || '',
      tipoDestino: item.tipoDestino || 'OBRA'
    });
    setShowEditModal(true);
  }

  // Salvar Edição
  async function handleSalvarEdicao(e) {
    e.preventDefault();
    if (!selectedItem) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'estoque_morto', selectedItem.id), {
        destinoNome: editForm.destinoNome.trim(),
        localizacao: editForm.localizacao.trim(),
        valorUnitario: parseFloat(editForm.valorUnitario) || 0,
        observacao: editForm.observacao.trim(),
        tipoDestino: editForm.tipoDestino,
        atualizadoPor: user?.email || 'Sistema',
        atualizadoEm: serverTimestamp()
      });

      toast.success('Registro atualizado com sucesso!');
      setShowEditModal(false);
      setSelectedItem(null);
      carregarDados();
    } catch (error) {
      console.error('Erro ao editar item:', error);
      toast.error('Erro ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  }

  // Excluir Registro
  async function handleExcluir(item) {
    if (!window.confirm(`Atenção: Deseja realmente excluir este registro de "${item.produtoDescricao}"? Se este item não foi devolvido, a quantidade não retornará automaticamente ao estoque principal.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'estoque_morto', item.id));
      toast.success('Registro excluído com sucesso.');
      carregarDados();
    } catch (error) {
      console.error('Erro ao excluir:', error);
      toast.error('Erro ao excluir registro.');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EXPORTAÇÃO EXCEL COM FÓRMULAS E CABEÇALHO GEL
  // ══════════════════════════════════════════════════════════════════════════
  const handleExportarExcelComFormulas = async () => {
    setExporting(true);
    try {
      const now = format(new Date(), "dd/MM/yyyy 'às' HH:mm");

      // Paleta de Cores Corporativas GEL
      const C = {
        azulEscuro  : '0F172A', // Slate/Navy Dark 900
        azulGEL     : '1E3A8A', // Blue 900
        azulMedio   : '1E293B', // Slate 800
        azulClaro   : 'F1F5F9', // Slate 100
        branco      : 'FFFFFF',
        cinzaLinha  : 'F8FAFC',
        cinzaBorda  : 'CBD5E1',
        verdeDestaq : '047857',
        ouroDestaq  : 'B45309'
      };

      const borderThin = {
        top: { style: 'thin', color: { rgb: C.cinzaBorda } },
        bottom: { style: 'thin', color: { rgb: C.cinzaBorda } },
        left: { style: 'thin', color: { rgb: C.cinzaBorda } },
        right: { style: 'thin', color: { rgb: C.cinzaBorda } }
      };

      const borderDouble = {
        top: { style: 'thin', color: { rgb: C.cinzaBorda } },
        bottom: { style: 'double', color: { rgb: C.azulEscuro } },
        left: { style: 'thin', color: { rgb: C.cinzaBorda } },
        right: { style: 'thin', color: { rgb: C.cinzaBorda } }
      };

      const ws = {};

      // ── TÍTULO E CABEÇALHO ───────────────────────────────────────────────
      ws['A1'] = {
        v: 'CONTROLE DE ESTOQUE MORTO, VENDA & TRANSFERÊNCIA ENTRE OBRAS',
        t: 's',
        s: {
          font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: C.branco } },
          fill: { patternType: 'solid', fgColor: { rgb: C.azulEscuro } },
          alignment: { horizontal: 'center', vertical: 'center' }
        }
      };

      // Preenche linha 1 para mesclagem visual
      for (let c = 1; c <= 12; c++) {
        ws[XLSX.utils.encode_cell({ r: 0, c })] = {
          v: '',
          t: 's',
          s: { fill: { patternType: 'solid', fgColor: { rgb: C.azulEscuro } } }
        };
      }
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } }
      ];

      ws['A2'] = {
        v: `CONSTRUTORA GEL — Almoxarifado Central · Relatório com Fórmulas Gerado em: ${now}`,
        t: 's',
        s: {
          font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: 'CBD5E1' } },
          fill: { patternType: 'solid', fgColor: { rgb: C.azulMedio } },
          alignment: { horizontal: 'center', vertical: 'center' }
        }
      };
      for (let c = 1; c <= 12; c++) {
        ws[XLSX.utils.encode_cell({ r: 1, c })] = {
          v: '',
          t: 's',
          s: { fill: { patternType: 'solid', fgColor: { rgb: C.azulMedio } } }
        };
      }

      // ── CABEÇALHOS DAS COLUNAS ───────────────────────────────────────────
      const headers = [
        'DATA REGISTRO',       // A (Col 0)
        'CÓD',                 // B (Col 1)
        'DESCRIÇÃO DO ITEM',   // C (Col 2)
        'UNID',                // D (Col 3)
        'QUANTIDADE',          // E (Col 4)
        'VALOR UNIT. (R$)',    // F (Col 5)
        'VALOR TOTAL (R$)',    // G (Col 6) -> COM FÓRMULA =E*F
        'TIPO / DESTINO',      // H (Col 7)
        'OBRA / COMPRADOR',    // I (Col 8)
        'LOCAL NO ALMOX.',     // J (Col 9)
        'STATUS',              // K (Col 10)
        'OBSERVAÇÃO',          // L (Col 11)
        'REGISTRADO POR'       // M (Col 12)
      ];

      const rHeader = 3; // Linha 4 no Excel
      headers.forEach((h, ci) => {
        const addr = XLSX.utils.encode_cell({ r: rHeader, c: ci });
        ws[addr] = {
          v: h,
          t: 's',
          s: {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: C.branco } },
            fill: { patternType: 'solid', fgColor: { rgb: ci === 6 ? '047857' : C.azulGEL } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: borderThin
          }
        };
      });

      // ── DADOS COM FÓRMULAS ───────────────────────────────────────────────
      const sortedItens = [...itens].sort((a, b) => (b.data || '').localeCompare(a.data || ''));

      sortedItens.forEach((item, idx) => {
        const r = rHeader + 1 + idx;
        const rExcel = r + 1; // 1-based para fórmulas do Excel
        const isEven = idx % 2 === 0;
        const rowBg = isEven ? C.branco : C.cinzaLinha;

        const getTipoTexto = (tipo) => {
          if (tipo === 'OBRA') return 'Transf. Outra Obra';
          if (tipo === 'VENDA') return 'Venda / Desmobilização';
          if (tipo === 'MORTO') return 'Estoque Morto / Obsoleto';
          if (tipo === 'AVARIADO') return 'Avariado / Quarentena';
          return tipo || 'Geral';
        };

        const getStatusTexto = (st) => {
          if (st === 'SEPARADO') return 'SEPARADO NO ALMOX.';
          if (st === 'CONCLUIDO') return 'CONCLUÍDO / ENVIADO';
          if (st === 'DEVOLVIDO') return 'DEVOLVIDO AO ESTOQUE';
          return st || 'SEPARADO';
        };

        let dataFormatada = item.data || '';
        if (dataFormatada.includes('-')) {
          const [ano, mes, dia] = dataFormatada.split('-');
          dataFormatada = `${dia}/${mes}/${ano}`;
        }

        // A: Data
        ws[XLSX.utils.encode_cell({ r, c: 0 })] = {
          v: dataFormatada,
          t: 's',
          s: { font: { name: 'Calibri', sz: 9 }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: rowBg } }, border: borderThin }
        };

        // B: Código
        ws[XLSX.utils.encode_cell({ r, c: 1 })] = {
          v: Number(item.produtoCodigo) || item.produtoCodigo || '—',
          t: typeof item.produtoCodigo === 'number' ? 'n' : 's',
          s: { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: rowBg } }, border: borderThin }
        };

        // C: Descrição
        ws[XLSX.utils.encode_cell({ r, c: 2 })] = {
          v: item.produtoDescricao || '',
          t: 's',
          s: { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'center' }, fill: { fgColor: { rgb: rowBg } }, border: borderThin }
        };

        // D: Unidade
        ws[XLSX.utils.encode_cell({ r, c: 3 })] = {
          v: item.unidade || 'UN',
          t: 's',
          s: { font: { name: 'Calibri', sz: 9 }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: rowBg } }, border: borderThin }
        };

        // E: Quantidade (Numérico)
        ws[XLSX.utils.encode_cell({ r, c: 4 })] = {
          v: Number(item.quantidade) || 0,
          t: 'n',
          s: { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: rowBg } }, border: borderThin }
        };

        // F: Valor Unitário
        ws[XLSX.utils.encode_cell({ r, c: 5 })] = {
          v: Number(item.valorUnitario) || 0,
          t: 'n',
          z: '"R$ "#,##0.00',
          s: { font: { name: 'Calibri', sz: 9 }, alignment: { horizontal: 'right', vertical: 'center' }, fill: { fgColor: { rgb: rowBg } }, border: borderThin }
        };

        // G: VALOR TOTAL -> FÓRMULA EXCEL =E{linha}*F{linha}
        ws[XLSX.utils.encode_cell({ r, c: 6 })] = {
          f: `E${rExcel}*F${rExcel}`,
          t: 'n',
          z: '"R$ "#,##0.00',
          s: { font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: C.verdeDestaq } }, alignment: { horizontal: 'right', vertical: 'center' }, fill: { fgColor: { rgb: 'ECFDF5' } }, border: borderThin }
        };

        // H: Tipo / Destino
        ws[XLSX.utils.encode_cell({ r, c: 7 })] = {
          v: getTipoTexto(item.tipoDestino),
          t: 's',
          s: { font: { name: 'Calibri', sz: 9 }, alignment: { horizontal: 'left', vertical: 'center' }, fill: { fgColor: { rgb: rowBg } }, border: borderThin }
        };

        // I: Obra / Comprador
        ws[XLSX.utils.encode_cell({ r, c: 8 })] = {
          v: item.destinoNome || '—',
          t: 's',
          s: { font: { name: 'Calibri', sz: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'center' }, fill: { fgColor: { rgb: rowBg } }, border: borderThin }
        };

        // J: Local no Almoxarifado
        ws[XLSX.utils.encode_cell({ r, c: 9 })] = {
          v: item.localizacao || 'Almoxarifado Separado',
          t: 's',
          s: { font: { name: 'Calibri', sz: 9 }, alignment: { horizontal: 'left', vertical: 'center' }, fill: { fgColor: { rgb: rowBg } }, border: borderThin }
        };

        // K: Status
        ws[XLSX.utils.encode_cell({ r, c: 10 })] = {
          v: getStatusTexto(item.status),
          t: 's',
          s: {
            font: {
              name: 'Calibri',
              sz: 9,
              bold: true,
              color: { rgb: item.status === 'SEPARADO' ? 'B45309' : (item.status === 'CONCLUIDO' ? '047857' : '64748B') }
            },
            alignment: { horizontal: 'center', vertical: 'center' },
            fill: { fgColor: { rgb: rowBg } },
            border: borderThin
          }
        };

        // L: Observação
        ws[XLSX.utils.encode_cell({ r, c: 11 })] = {
          v: item.observacao || '—',
          t: 's',
          s: { font: { name: 'Calibri', sz: 9, italic: true }, alignment: { horizontal: 'left', vertical: 'center' }, fill: { fgColor: { rgb: rowBg } }, border: borderThin }
        };

        // M: Registrado Por
        ws[XLSX.utils.encode_cell({ r, c: 12 })] = {
          v: item.criadoPor || '—',
          t: 's',
          s: { font: { name: 'Calibri', sz: 8, color: { rgb: '64748B' } }, alignment: { horizontal: 'center', vertical: 'center' }, fill: { fgColor: { rgb: rowBg } }, border: borderThin }
        };
      });

      // ── LINHA DE TOTAIS GERAIS (COM FÓRMULA DE SOMA/SUBTOTAL) ─────────────
      const rTotal = rHeader + 1 + sortedItens.length;
      const rStart = rHeader + 2; // primeira linha de dados
      const rEnd = rTotal;        // última linha de dados

      ws[XLSX.utils.encode_cell({ r: rTotal, c: 0 })] = {
        v: 'TOTAL GERAL',
        t: 's',
        s: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: C.branco } }, fill: { fgColor: { rgb: C.azulEscuro } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderDouble }
      };

      for (let c = 1; c <= 3; c++) {
        ws[XLSX.utils.encode_cell({ r: rTotal, c })] = {
          v: '',
          t: 's',
          s: { fill: { fgColor: { rgb: C.azulEscuro } }, border: borderDouble }
        };
      }
      ws['!merges'].push({ s: { r: rTotal, c: 0 }, e: { r: rTotal, c: 3 } });

      // Fórmula de Soma para Quantidade (Coluna E)
      ws[XLSX.utils.encode_cell({ r: rTotal, c: 4 })] = {
        f: `SUM(E${rStart}:E${rEnd})`,
        t: 'n',
        s: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: C.branco } }, fill: { fgColor: { rgb: C.azulEscuro } }, alignment: { horizontal: 'center', vertical: 'center' }, border: borderDouble }
      };

      // F (Média ou texto indicador)
      ws[XLSX.utils.encode_cell({ r: rTotal, c: 5 })] = {
        v: 'VALOR TOTAL:',
        t: 's',
        s: { font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: C.branco } }, fill: { fgColor: { rgb: C.azulEscuro } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borderDouble }
      };

      // Fórmula de Soma para Valor Total (Coluna G)
      ws[XLSX.utils.encode_cell({ r: rTotal, c: 6 })] = {
        f: `SUM(G${rStart}:G${rEnd})`,
        t: 'n',
        z: '"R$ "#,##0.00',
        s: { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '6EE7B7' } }, fill: { fgColor: { rgb: C.azulEscuro } }, alignment: { horizontal: 'right', vertical: 'center' }, border: borderDouble }
      };

      for (let c = 7; c <= 12; c++) {
        ws[XLSX.utils.encode_cell({ r: rTotal, c })] = {
          v: '',
          t: 's',
          s: { fill: { fgColor: { rgb: C.azulEscuro } }, border: borderDouble }
        };
      }

      // Configuração de Larguras e Alturas
      ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 12, r: rTotal } });
      ws['!cols'] = [
        { wch: 14 }, // A: Data
        { wch: 10 }, // B: Cód
        { wch: 38 }, // C: Descrição
        { wch: 8 },  // D: Unid
        { wch: 13 }, // E: Quantidade
        { wch: 16 }, // F: Valor Unit.
        { wch: 18 }, // G: Valor Total (Fórmula)
        { wch: 24 }, // H: Tipo / Destino
        { wch: 28 }, // I: Obra / Comprador
        { wch: 25 }, // J: Local Almox
        { wch: 22 }, // K: Status
        { wch: 35 }, // L: Observação
        { wch: 20 }  // M: Registrado Por
      ];
      ws['!rows'] = [
        { hpt: 32 },
        { hpt: 20 },
        { hpt: 10 }, // spacer
        { hpt: 24 }, // header
        ...sortedItens.map(() => ({ hpt: 18 })),
        { hpt: 24 }  // total
      ];
      ws['!freeze'] = { xSplit: 0, ySplit: 4, topLeftCell: 'A5', activePane: 'bottomLeft', state: 'frozen' };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ESTOQUE_SEPARADO');

      XLSX.writeFile(wb, `CONTROLE_ESTOQUE_MORTO_VENDA_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
      toast.success('Planilha com fórmulas gerada e baixada com sucesso!', { icon: '📊' });
    } catch (error) {
      console.error('Erro ao gerar planilha Excel:', error);
      toast.error('Erro ao gerar planilha. Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="loading-center"><div className="loading-spin" /></div>;
  }

  return (
    <div className="page-enter">
      {/* ── HEADER DA PÁGINA ────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🏷️ Estoque Morto, Venda & Transferência</h1>
          <p className="page-subtitle">
            Controle de materiais separados no almoxarifado para outras obras, desmobilização ou descarte
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn btn-success"
            onClick={handleExportarExcelComFormulas}
            disabled={exporting}
            id="btn-baixar-planilha-formulas"
          >
            {exporting ? (
              <>
                <div className="loading-spin" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
                Gerando Planilha...
              </>
            ) : (
              <>📊 Baixar Planilha com Fórmulas</>
            )}
          </button>

          <button
            className="btn btn-primary"
            onClick={() => setShowNovoModal(true)}
            id="btn-novo-item-separado"
          >
            + Novo Item Separado
          </button>
        </div>
      </div>

      {/* ── CARDS DE MÉTRICAS ───────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="card stat-card">
          <div className="stat-icon blue">📦</div>
          <div>
            <div className="stat-value">{totalSeparadosQtd}</div>
            <div className="stat-label">Itens Separados Ativos</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon purple">🏢</div>
          <div>
            <div className="stat-value">{totalParaObra}</div>
            <div className="stat-label">Para Outras Obras</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon green">💰</div>
          <div>
            <div className="stat-value">{totalParaVenda}</div>
            <div className="stat-label">Para Venda</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon yellow">⚠️</div>
          <div>
            <div className="stat-value">{totalMorto}</div>
            <div className="stat-label">Estoque Morto / Avariado</div>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>💵</div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.25rem' }}>
              {valorTotalEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <div className="stat-label">Valor Total Estimado</div>
          </div>
        </div>
      </div>

      {/* ── BARRA DE FILTROS ────────────────────────────────────────────── */}
      <div className="filters-bar" style={{ marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 2, minWidth: 220 }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Buscar por descrição, código, obra, comprador ou observação..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            id="input-busca-estoque-morto"
          />
        </div>

        <select
          className="form-select"
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          id="select-filtro-tipo"
          style={{ minWidth: 190 }}
        >
          <option value="TODOS">Todos os Tipos de Destino</option>
          <option value="OBRA">🏢 Outra Obra</option>
          <option value="VENDA">💰 Venda</option>
          <option value="MORTO">⚠️ Estoque Morto / Obsoleto</option>
          <option value="AVARIADO">🛠️ Avariado / Quarentena</option>
        </select>

        <select
          className="form-select"
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
          id="select-filtro-status"
          style={{ minWidth: 180 }}
        >
          <option value="TODOS">Todos os Status</option>
          <option value="SEPARADO">🟡 Separado no Almoxarifado</option>
          <option value="CONCLUIDO">🟢 Concluído / Enviado / Vendido</option>
          <option value="DEVOLVIDO">↩️ Devolvido ao Estoque</option>
        </select>
      </div>

      {/* ── TABELA DE ITENS SEPARADOS ──────────────────────────────────── */}
      {itensFiltrados.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🏷️</div>
            <div className="empty-title">Nenhum item encontrado no estoque separado</div>
            <div className="empty-desc">
              Você pode transferir itens diretamente pela aba <strong>Estoque</strong> ou cadastrar um novo item separado usando o botão acima.
            </div>
            <button className="btn btn-primary" onClick={() => setShowNovoModal(true)}>
              + Adicionar Item Separado
            </button>
          </div>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="sticky-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cód.</th>
                <th>Descrição do Item</th>
                <th>Quant.</th>
                <th>Tipo / Destino</th>
                <th>Obra / Comprador</th>
                <th>Local Almox.</th>
                <th>Valor Unit.</th>
                <th>Valor Total</th>
                <th>Status</th>
                <th>Observação</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map(item => {
                const totalItem = (Number(item.quantidade) || 0) * (Number(item.valorUnitario) || 0);
                const isSeparado = item.status === 'SEPARADO';

                return (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {item.data ? format(new Date(item.data + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {item.produtoCodigo || '—'}
                    </td>
                    <td style={{ fontWeight: 600, maxWidth: 240 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.produtoDescricao}
                      </div>
                      {item.ca && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CA: {item.ca}</div>}
                    </td>
                    <td>
                      <span className="badge badge-blue" style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                        {item.quantidade} {item.unidade}
                      </span>
                    </td>
                    <td>
                      {item.tipoDestino === 'OBRA' && <span className="badge badge-blue">🏢 Outra Obra</span>}
                      {item.tipoDestino === 'VENDA' && <span className="badge badge-green">💰 Venda</span>}
                      {item.tipoDestino === 'MORTO' && <span className="badge badge-yellow">⚠️ Estoque Morto</span>}
                      {item.tipoDestino === 'AVARIADO' && <span className="badge badge-red">🛠️ Avariado</span>}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {item.destinoNome || '—'}
                    </td>
                    <td>
                      <span className="badge badge-gray" style={{ fontSize: '0.75rem' }}>
                        📍 {item.localizacao || 'Almoxarifado'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      {item.valorUnitario ? Number(item.valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--accent-green)', fontSize: '0.875rem' }}>
                      {totalItem > 0 ? totalItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                    </td>
                    <td>
                      {item.status === 'SEPARADO' && <span className="badge badge-yellow">🟡 Separado</span>}
                      {item.status === 'CONCLUIDO' && <span className="badge badge-green">🟢 Concluído</span>}
                      {item.status === 'DEVOLVIDO' && <span className="badge badge-gray">↩️ Devolvido</span>}
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {item.observacao || '—'}
                      </div>
                      {item.nfGuia && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--accent-blue-light)', marginTop: 2 }}>
                          📄 NF/Guia: {item.nfGuia}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                        {isSeparado && (
                          <>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleOpenConcluir(item)}
                              title="Marcar como Concluído / Enviado / Vendido"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              ✅ Concluir
                            </button>

                            <button
                              className="btn btn-sm btn-outline"
                              onClick={() => handleDevolverEstoque(item)}
                              title="Devolver / Estornar ao Estoque Principal"
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--border)' }}
                            >
                              ↩️ Devolver
                            </button>
                          </>
                        )}

                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleOpenEdit(item)}
                          title="Editar Observação e Destino"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          ✏️
                        </button>

                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => handleExcluir(item)}
                          title="Excluir Registro"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: 'var(--accent-red)' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── MODAL: NOVO ITEM SEPARADO MANUAL ────────────────────────────── */}
      {showNovoModal && (
        <div className="install-modal-overlay" onClick={() => setShowNovoModal(false)}>
          <div className="install-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="install-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>📦</span>
                <h3 style={{ margin: 0 }}>Adicionar Item ao Estoque Separado</h3>
              </div>
              <button onClick={() => setShowNovoModal(false)} className="install-modal-close">×</button>
            </div>

            <form onSubmit={handleSalvarNovo}>
              <div className="install-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Selecionar Produto Existente (Opcional para preenchimento rápido) */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Selecionar Produto do Catálogo (Opcional)</label>
                  <select
                    className="form-select"
                    value={novoForm.produtoId}
                    onChange={e => handleSelectProduto(e.target.value)}
                  >
                    <option value="">-- Digitar manualmente ou escolher abaixo --</option>
                    {produtos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ''}{p.descricao} (Estoque: {p.estoqueAtual} {p.unidade})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Código</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: 158"
                      value={novoForm.produtoCodigo}
                      onChange={e => setNovoForm({ ...novoForm, produtoCodigo: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Descrição do Item *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: BOTA DE COURO COM BIQUEIRA"
                      value={novoForm.produtoDescricao}
                      onChange={e => setNovoForm({ ...novoForm, produtoDescricao: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Unidade</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="PAR, UN, PC"
                      value={novoForm.unidade}
                      onChange={e => setNovoForm({ ...novoForm, unidade: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Quantidade *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-input"
                      placeholder="Qtd"
                      value={novoForm.quantidade}
                      onChange={e => setNovoForm({ ...novoForm, quantidade: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Valor Unit. (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      placeholder="0.00"
                      value={novoForm.valorUnitario}
                      onChange={e => setNovoForm({ ...novoForm, valorUnitario: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Tipo de Destino *</label>
                    <select
                      className="form-select"
                      value={novoForm.tipoDestino}
                      onChange={e => setNovoForm({ ...novoForm, tipoDestino: e.target.value })}
                      required
                    >
                      <option value="OBRA">🏢 Transferência para Outra Obra</option>
                      <option value="VENDA">💰 Venda / Desmobilização</option>
                      <option value="MORTO">⚠️ Estoque Morto / Obsoleto</option>
                      <option value="AVARIADO">🛠️ Avariado / Quarentena</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nome da Obra / Comprador</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: Obra 015 - Santos / João Sucata"
                      value={novoForm.destinoNome}
                      onChange={e => setNovoForm({ ...novoForm, destinoNome: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Local no Almoxarifado (Separado)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: Box 3 - Palete A"
                      value={novoForm.localizacao}
                      onChange={e => setNovoForm({ ...novoForm, localizacao: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Data da Separação</label>
                    <input
                      type="date"
                      className="form-input"
                      value={novoForm.data}
                      onChange={e => setNovoForm({ ...novoForm, data: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label className="form-label">Observação / Motivo</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Descreva detalhes como estado do material, motivo do envio ou proposta de venda..."
                    value={novoForm.observacao}
                    onChange={e => setNovoForm({ ...novoForm, observacao: e.target.value })}
                  />
                </div>

                {novoForm.produtoId && (
                  <div style={{ padding: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', fontSize: '0.8125rem', color: '#93c5fd' }}>
                    ℹ️ <strong>Aviso:</strong> Ao salvar, a quantidade informada será descontada automaticamente do Estoque Principal e registrada no histórico.
                  </div>
                )}
              </div>

              <div className="install-modal-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowNovoModal(false)} className="btn btn-ghost">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Item Separado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: CONCLUIR SAÍDA / VENDA ───────────────────────────────── */}
      {showConcluirModal && selectedItem && (
        <div className="install-modal-overlay" onClick={() => setShowConcluirModal(false)}>
          <div className="install-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="install-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>✅</span>
                <h3 style={{ margin: 0 }}>Concluir Saída / Despacho / Venda</h3>
              </div>
              <button onClick={() => setShowConcluirModal(false)} className="install-modal-close">×</button>
            </div>

            <form onSubmit={handleConfirmarConclusao}>
              <div className="install-modal-body">
                <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {selectedItem.produtoDescricao}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Quantidade: <strong>{selectedItem.quantidade} {selectedItem.unidade}</strong> · Destino: <strong>{selectedItem.destinoNome || '—'}</strong>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Data da Saída / Despacho *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={concluirForm.dataConclusao}
                    onChange={e => setConcluirForm({ ...concluirForm, dataConclusao: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Nº da Nota Fiscal / Guia de Transferência / Recibo</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ex: NF 14502 / Guia Transf. 088"
                    value={concluirForm.nfGuia}
                    onChange={e => setConcluirForm({ ...concluirForm, nfGuia: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label className="form-label">Observação Final</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Ex: Coletado pela transportadora X / Entregue para o motorista Y..."
                    value={concluirForm.observacaoFinal}
                    onChange={e => setConcluirForm({ ...concluirForm, observacaoFinal: e.target.value })}
                  />
                </div>
              </div>

              <div className="install-modal-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowConcluirModal(false)} className="btn btn-ghost">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={saving}>
                  {saving ? 'Processando...' : 'Confirmar Conclusão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR REGISTRO ──────────────────────────────────────── */}
      {showEditModal && selectedItem && (
        <div className="install-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="install-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="install-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>✏️</span>
                <h3 style={{ margin: 0 }}>Editar Item do Estoque Separado</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="install-modal-close">×</button>
            </div>

            <form onSubmit={handleSalvarEdicao}>
              <div className="install-modal-body">
                <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700 }}>{selectedItem.produtoDescricao}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Qtd: <strong>{selectedItem.quantidade} {selectedItem.unidade}</strong>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Tipo de Destino</label>
                  <select
                    className="form-select"
                    value={editForm.tipoDestino}
                    onChange={e => setEditForm({ ...editForm, tipoDestino: e.target.value })}
                  >
                    <option value="OBRA">🏢 Transferência para Outra Obra</option>
                    <option value="VENDA">💰 Venda / Desmobilização</option>
                    <option value="MORTO">⚠️ Estoque Morto / Obsoleto</option>
                    <option value="AVARIADO">🛠️ Avariado / Quarentena</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <label className="form-label">Obra de Destino / Comprador</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.destinoNome}
                    onChange={e => setEditForm({ ...editForm, destinoNome: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Local no Almoxarifado</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.localizacao}
                      onChange={e => setEditForm({ ...editForm, localizacao: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Valor Unit. (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={editForm.valorUnitario}
                      onChange={e => setEditForm({ ...editForm, valorUnitario: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label className="form-label">Observação</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={editForm.observacao}
                    onChange={e => setEditForm({ ...editForm, observacao: e.target.value })}
                  />
                </div>
              </div>

              <div className="install-modal-footer" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-ghost">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
