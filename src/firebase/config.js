import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAAzzQyzRnGhMmUQtlbSqOm1yVs-s-haP4",
  authDomain: "controle-de-epi-pro.firebaseapp.com",
  databaseURL: "https://controle-de-epi-pro-default-rtdb.firebaseio.com",
  projectId: "controle-de-epi-pro",
  storageBucket: "controle-de-epi-pro.firebasestorage.app",
  messagingSenderId: "486036426921",
  appId: "1:486036426921:web:209b04ca084b73d7c319b8",
  measurementId: "G-LBLMRGK770"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
