import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import seedData from './seed_data.json';

export async function seedProducts(optionsOrProgress, onProgressCallback) {
  let options = { importarSaldos: false };
  let onProgress = onProgressCallback;

  if (typeof optionsOrProgress === 'function') {
    onProgress = optionsOrProgress;
  } else if (optionsOrProgress) {
    options = { ...options, ...optionsOrProgress };
  }

  // Check if already seeded
  const existing = await getDocs(collection(db, 'produtos'));
  if (existing.size > 0) {
    return { skipped: true, count: existing.size };
  }

  let count = 0;
  const total = seedData.length;

  for (const product of seedData) {
    const finalProduct = {
      ...product,
      estoqueAtual: options.importarSaldos ? (product.estoqueAtual ?? 0) : 0,
    };

    await addDoc(collection(db, 'produtos'), {
      ...finalProduct,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    count++;
    if (onProgress) onProgress(count, total);
  }

  return { count, total };
}

