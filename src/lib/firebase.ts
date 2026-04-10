import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAw7GKyo_FxSL0EiapGNYJoOsfXF2Jvqf0",
  authDomain: "goat-db.firebaseapp.com",
  databaseURL: "https://goat-db-default-rtdb.firebaseio.com",
  projectId: "goat-db",
  storageBucket: "goat-db.firebasestorage.app",
  messagingSenderId: "107746273734",
  appId: "1:107746273734:web:1f60c66f2f3c476c5c6ac7",
  measurementId: "G-2DV6X1DCW0",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
