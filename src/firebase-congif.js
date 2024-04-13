import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Import getStorage

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDx9f_iIwwM5wouSTT3QntFlwHcbNEqirA",
  authDomain: "conectado-33186.firebaseapp.com",
  projectId: "conectado-33186",
  storageBucket: "conectado-33186.appspot.com",
  messagingSenderId: "239868035366",
  appId: "1:239868035366:web:62488feeeb1231890481e7",
  measurementId: "G-902KJ2QKXM"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Initialize Firestore
const storage = getStorage(app); // Initialize Firebase Storage
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

export { app, db, auth, storage }; // Export both app and db and auth