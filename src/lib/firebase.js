// src/lib/firebase.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ▼▼▼▼▼ วาง firebaseConfig ที่คัดลอกมาจาก Firebase Console ตรงนี้ ▼▼▼▼▼
const firebaseConfig = {
 apiKey: "AIzaSyBKcAMd-xREM_27308G2bfFWVhe-8ycBlo",
  authDomain: "check68-final.firebaseapp.com",
  projectId: "check68-final",
  storageBucket: "check68-final.firebasestorage.app",
  messagingSenderId: "537745898240",
  appId: "1:537745898240:web:d5c081712e509c1d4391e5"
};
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const auth = getAuth(app);
export const db = getFirestore(app);