
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbtzf7qjrZnJUTlhjP6nP3BDPxOTl9h7U",
  authDomain: "labtrack-6b531.firebaseapp.com",
  projectId: "labtrack-6b531",
  storageBucket: "labtrack-6b531.firebasestorage.app",
  messagingSenderId: "1036248566000",
  appId: "1:1036248566000:web:628e1ecf108915f49d9a35",
  measurementId: "G-JE09Y13ZYS"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
