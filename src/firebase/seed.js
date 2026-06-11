import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import seedData from './seed_data.json';

export async function seedProducts(onProgress) {
  // Check if already seeded
  const existing = await getDocs(collection(db, 'produtos'));
  if (existing.size > 0) {
    return { skipped: true, count: existing.size };
  }

  let count = 0;
  const total = seedData.length;

  for (const product of seedData) {
    await addDoc(collection(db, 'produtos'), {
      ...product,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    count++;
    if (onProgress) onProgress(count, total);
  }

  return { count, total };
}

