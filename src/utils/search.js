/**
 * Normaliza uma string para busca:
 * - converte para minúsculas
 * - remove acentos (á→a, ç→c, ã→a, etc.)
 * - remove espaços extras
 */
export function normalize(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove marcas de acento
    .trim();
}

/**
 * Retorna true se o texto contém o termo buscado (sem acento, sem case).
 */
export function matchSearch(text, term) {
  if (!term) return true;
  return normalize(text).includes(normalize(term));
}

/**
 * Filtra uma lista de produtos pelo termo de busca.
 * Busca em: descricao, codigo, grupo, ca, localizacao.
 */
export function filterProdutos(produtos, term) {
  if (!term || !term.trim()) return produtos;
  const t = normalize(term);
  return produtos.filter(p =>
    normalize(p.descricao).includes(t) ||
    normalize(String(p.codigo)).includes(t) ||
    normalize(p.grupo).includes(t) ||
    normalize(p.ca).includes(t) ||
    normalize(p.localizacao).includes(t)
  );
}
