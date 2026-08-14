import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import toast from 'react-hot-toast';

// Configura persistência na sessão do navegador
setPersistence(auth, browserSessionPersistence).catch((err) => {
  console.error("Erro ao configurar persistência:", err);
});

const AuthContext = createContext(null);

const STORAGE_USER_KEY = 'controle_epi_user_session';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        const userObj = {
          uid: u.uid,
          email: u.email,
          displayName: u.displayName || u.email?.split('@')[0]?.toUpperCase(),
        };
        setUser(userObj);
        sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj));
      } else {
        const saved = sessionStorage.getItem(STORAGE_USER_KEY);
        if (saved) {
          try {
            setUser(JSON.parse(saved));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Login com verificação inteligente (Firestore credenciais sincronizadas + Firebase Auth)
  const login = async (email, password) => {
    const emailKey = email.toLowerCase().trim();
    
    // 1. Tenta verificar se há credencial customizada/redefinida no Firestore
    try {
      const credDoc = await getDoc(doc(db, 'usuarios_credenciais', emailKey));
      if (credDoc.exists()) {
        const data = credDoc.data();
        if (data.password === password) {
          // Senha bate com o registro do Firestore!
          const userObj = {
            uid: emailKey,
            email: emailKey,
            displayName: data.userName || emailKey.split('@')[0].toUpperCase(),
          };
          setUser(userObj);
          sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj));
          
          // Tenta logar no Firebase Auth em segundo plano se possível
          signInWithEmailAndPassword(auth, emailKey, password).catch(() => {});
          return userObj;
        } else {
          // Senha errada registrada no Firestore
          const err = new Error('Senha incorreta.');
          err.code = 'auth/wrong-password';
          throw err;
        }
      }
    } catch (err) {
      if (err.code === 'auth/wrong-password') throw err;
      console.warn("Verificação no Firestore não retornou credencial, tentando Firebase Auth:", err);
    }

    // 2. Fallback padrão: Firebase Auth
    const res = await signInWithEmailAndPassword(auth, emailKey, password);
    const userObj = {
      uid: res.user.uid,
      email: res.user.email,
      displayName: res.user.displayName || res.user.email?.split('@')[0]?.toUpperCase(),
    };
    setUser(userObj);
    sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj));

    // Salva/sincroniza no Firestore para garantir recuperação futura
    try {
      await setDoc(doc(db, 'usuarios_credenciais', emailKey), {
        email: emailKey,
        userName: emailKey.split('@')[0].toUpperCase(),
        password: password,
        atualizadoEm: serverTimestamp()
      }, { merge: true });
    } catch (_) {}

    return userObj;
  };

  // Cadastro / Criação de senha inicial
  const signup = async (email, password) => {
    const emailKey = email.toLowerCase().trim();
    const userName = emailKey.split('@')[0].toUpperCase();

    // Salva no Firestore
    await setDoc(doc(db, 'usuarios_credenciais', emailKey), {
      email: emailKey,
      userName: userName,
      password: password,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    // Tenta registrar no Firebase Auth
    try {
      const res = await createUserWithEmailAndPassword(auth, emailKey, password);
      const userObj = {
        uid: res.user.uid,
        email: res.user.email,
        displayName: userName,
      };
      setUser(userObj);
      sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj));
      return userObj;
    } catch (err) {
      // Se já existia no Firebase Auth mas o Firestore foi atualizado, define sessão
      if (err.code === 'auth/email-already-in-use') {
        const userObj = {
          uid: emailKey,
          email: emailKey,
          displayName: userName,
        };
        setUser(userObj);
        sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userObj));
        return userObj;
      }
      throw err;
    }
  };

  // Solicitar código de redefinição de senha para o líder Eullon
  const requestPasswordReset = async (userObj) => {
    const emailKey = userObj.email.toLowerCase().trim();
    // Gera código numérico de 6 dígitos aleatório
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await setDoc(doc(db, 'solicitacoes_senha', emailKey), {
      email: emailKey,
      userName: userObj.name,
      code: code,
      status: 'pendente',
      solicitadoEm: serverTimestamp()
    });

    return code;
  };

  // Redefinir senha usando o código de 6 dígitos fornecido pelo líder
  const resetPasswordWithCode = async (email, code, newPassword) => {
    const emailKey = email.toLowerCase().trim();
    const reqDoc = await getDoc(doc(db, 'solicitacoes_senha', emailKey));

    if (!reqDoc.exists()) {
      throw new Error('Nenhuma solicitação de redefinição encontrada para este usuário.');
    }

    const data = reqDoc.data();
    if (data.status !== 'pendente') {
      throw new Error('Este código já foi utilizado ou expirou. Solicite um novo.');
    }

    if (data.code !== code.trim()) {
      throw new Error('Código de 6 dígitos incorreto. Verifique com o líder EULLON.');
    }

    // Código válido! Atualiza a credencial
    await setDoc(doc(db, 'usuarios_credenciais', emailKey), {
      email: emailKey,
      userName: data.userName || emailKey.split('@')[0].toUpperCase(),
      password: newPassword,
      atualizadoEm: serverTimestamp(),
      redefinidoPor: 'CODIGO_LIDER'
    }, { merge: true });

    // Marca a solicitação como concluída
    await updateDoc(doc(db, 'solicitacoes_senha', emailKey), {
      status: 'concluido',
      concluidoEm: serverTimestamp()
    });

    return true;
  };

  // Redefinição direta feita pelo próprio Líder Eullon no painel
  const directResetPasswordByLeader = async (email, newPassword) => {
    const emailKey = email.toLowerCase().trim();
    const userName = emailKey.split('@')[0].toUpperCase();

    await setDoc(doc(db, 'usuarios_credenciais', emailKey), {
      email: emailKey,
      userName: userName,
      password: newPassword,
      atualizadoEm: serverTimestamp(),
      redefinidoPor: 'PAINEL_LIDER_EULLON'
    }, { merge: true });

    // Se houver solicitação pendente, finaliza
    try {
      await updateDoc(doc(db, 'solicitacoes_senha', emailKey), {
        status: 'concluido',
        concluidoEm: serverTimestamp()
      });
    } catch (_) {}

    return true;
  };

  // Excluir solicitação de redefinição
  const cancelResetRequest = async (email) => {
    const emailKey = email.toLowerCase().trim();
    await deleteDoc(doc(db, 'solicitacoes_senha', emailKey));
  };

  const logout = async () => {
    sessionStorage.removeItem(STORAGE_USER_KEY);
    setUser(null);
    try {
      await signOut(auth);
    } catch (_) {}
  };

  // Auto-logout por inatividade (5 minutos)
  useEffect(() => {
    if (!user) return;

    let timeout;
    const INACTIVITY_TIME = 5 * 60 * 1000; // 5 minutos

    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        logout();
        toast('Sessão encerrada por inatividade', { icon: '⏰' });
      }, INACTIVITY_TIME);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timeout);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  const isLeader = user?.email?.toLowerCase().includes('eullon');

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      signup,
      logout,
      isLeader,
      requestPasswordReset,
      resetPasswordWithCode,
      directResetPasswordByLeader,
      cancelResetRequest
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

