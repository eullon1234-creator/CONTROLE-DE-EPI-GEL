import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { filterProdutos } from '../utils/search';

export default function ProductSearch({ value, onChange, onSelect, placeholder = 'Buscar produto...' }) {
  const [queryText, setQueryText] = useState(value || '');
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [open, setOpen] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const ref = useRef(null);

  // Carrega produtos uma única vez
  useEffect(() => {
    async function fetchProducts() {
      try {
        const q = query(collection(db, 'produtos'), orderBy('descricao'));
        const snap = await getDocs(q);
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Erro ao carregar produtos:', e);
      } finally {
        setLoadingProducts(false);
      }
    }
    fetchProducts();
  }, []);

  // Filtra sempre que o texto ou lista de produtos mudar
  useEffect(() => {
    const term = queryText.trim();
    if (!term) {
      // Sem texto: mostra os 8 primeiros como sugestão (se dropdown estiver aberto)
      setFiltered(products.slice(0, 8));
    } else {
      const results = filterProdutos(products, term).slice(0, 12);
      setFiltered(results);
    }
  }, [queryText, products]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQueryText(val);
    onChange && onChange(val);
    setOpen(true);
  }

  function handleSelect(product) {
    setQueryText(product.descricao);
    setOpen(false);
    onSelect && onSelect(product);
  }

  function handleFocus() {
    setOpen(true);
  }

  function handleClear() {
    setQueryText('');
    onChange && onChange('');
    onSelect && onSelect(null);
    setOpen(true);
  }

  const showDropdown = open && filtered.length > 0;
  const noResults = open && queryText.trim() && !loadingProducts && filtered.length === 0;

  return (
    <div className="product-search-wrapper" ref={ref}>
      <div className="search-bar" style={{ position: 'relative' }}>
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="form-input"
          value={queryText}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={loadingProducts ? 'Carregando produtos...' : placeholder}
          autoComplete="off"
          disabled={loadingProducts}
          style={{ paddingRight: queryText ? '2.25rem' : undefined }}
        />
        {queryText && (
          <button
            type="button"
            onClick={handleClear}
            title="Limpar"
            style={{
              position: 'absolute',
              right: '0.625rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1rem',
              lineHeight: 1,
              padding: '0.125rem',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {showDropdown && (
        <div className="product-dropdown">
          {!queryText.trim() && (
            <div style={{
              padding: '0.375rem 0.875rem 0.25rem',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--border)'
            }}>
              Produtos recentes
            </div>
          )}
          {filtered.map(p => (
            <div
              key={p.id}
              className="product-option"
              onMouseDown={() => handleSelect(p)}
            >
              <div>
                <div className="product-option-name">{p.descricao}</div>
                <div className="product-option-code">
                  Cód. {p.codigo} · {p.unidade}
                  {p.localizacao && ` · ${p.localizacao}`}
                </div>
              </div>
              <span className={`badge ${p.estoqueAtual <= p.estoqueMin ? 'badge-red' : 'badge-green'}`}>
                {p.estoqueAtual} {p.unidade}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Nenhum resultado */}
      {noResults && (
        <div className="product-dropdown">
          <div style={{
            padding: '1rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.875rem'
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔍</div>
            Nenhum produto encontrado para "<strong>{queryText}</strong>"
          </div>
        </div>
      )}
    </div>
  );
}
