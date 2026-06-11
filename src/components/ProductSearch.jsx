import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function ProductSearch({ value, onChange, onSelect, placeholder = 'Buscar produto...' }) {
  const [query_text, setQueryText] = useState(value || '');
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const q = query(collection(db, 'produtos'), orderBy('descricao'));
        const snap = await getDocs(q);
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      }
    }
    fetchProducts();
  }, []);

  useEffect(() => {
    if (!query_text.trim()) { setFiltered([]); return; }
    const lower = query_text.toLowerCase();
    setFiltered(
      products
        .filter(p =>
          p.descricao?.toLowerCase().includes(lower) ||
          String(p.codigo).includes(lower)
        )
        .slice(0, 10)
    );
  }, [query_text, products]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(e) {
    setQueryText(e.target.value);
    onChange && onChange(e.target.value);
    setOpen(true);
  }

  function handleSelect(product) {
    setQueryText(product.descricao);
    setOpen(false);
    onSelect && onSelect(product);
  }

  return (
    <div className="product-search-wrapper" ref={ref}>
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="form-input"
          value={query_text}
          onChange={handleChange}
          onFocus={() => query_text && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="product-dropdown">
          {filtered.map(p => (
            <div
              key={p.id}
              className="product-option"
              onMouseDown={() => handleSelect(p)}
            >
              <div>
                <div className="product-option-name">{p.descricao}</div>
                <div className="product-option-code">Cód. {p.codigo} · {p.unidade}</div>
              </div>
              <span className={`badge ${p.estoqueAtual <= p.estoqueMin ? 'badge-red' : 'badge-green'}`}>
                {p.estoqueAtual} {p.unidade}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
