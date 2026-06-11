// Script para limpar o campo validadeCa de todos os produtos no Firestore
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAAzzQyzRnGhMmUQtlbSqOm1yVs-s-haP4",
  authDomain: "controle-de-epi-pro.firebaseapp.com",
  projectId: "controle-de-epi-pro",
  storageBucket: "controle-de-epi-pro.firebasestorage.app",
  messagingSenderId: "486036426921",
  appId: "1:486036426921:web:209b04ca084b73d7c319b8",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearValidadeCa() {
  console.log('Buscando todos os produtos...');
  const snap = await getDocs(collection(db, 'produtos'));
  console.log('Total de produtos:', snap.size);

  // Firestore permite até 500 operações por batch
  const BATCH_SIZE = 400;
  const docs = snap.docs;
  let updated = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = docs.slice(i, i + BATCH_SIZE);

    for (const d of chunk) {
      batch.update(doc(db, 'produtos', d.id), { validadeCa: '' });
      updated++;
    }

    await batch.commit();
    process.stdout.write('\r  Atualizando... ' + updated + '/' + docs.length);
  }

  console.log('\n\nPronto! validadeCa limpo em', updated, 'produtos.');
  process.exit(0);
}

clearValidadeCa().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
