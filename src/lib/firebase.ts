import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Login Error:", error);
    throw error;
  }
};

export const loginWithUsername = async (username: string, password: string) => {
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername) {
    throw new Error("Username tidak boleh kosong");
  }
  if (!password || password.length < 6) {
    throw new Error("Password minimal 6 karakter");
  }

  const email = cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@kasirku.local`;

  try {
    // Attempt normal login
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (!credential.user.displayName) {
      await updateProfile(credential.user, { displayName: username.trim() });
    }
    return credential.user;
  } catch (error: any) {
    const errorCode = error?.code || '';
    // If user does not exist yet in Firebase Auth, automatically create it for testing convenience
    if (
      errorCode === 'auth/user-not-found' || 
      errorCode === 'auth/invalid-credential' || 
      errorCode === 'auth/invalid-login-credentials'
    ) {
      try {
        const createResult = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(createResult.user, { displayName: username.trim() });
        return createResult.user;
      } catch (createError: any) {
        // If creating fails because email already exists, the password entered was wrong
        if (createError?.code === 'auth/email-already-in-use') {
          throw new Error("Password salah untuk username ini");
        }
        throw new Error(createError?.message || "Gagal masuk atau mendaftar");
      }
    } else if (errorCode === 'auth/wrong-password') {
      throw new Error("Password salah untuk username ini");
    } else {
      throw new Error(error?.message || "Gagal masuk dengan akun ini");
    }
  }
};

export const logout = () => signOut(auth);
