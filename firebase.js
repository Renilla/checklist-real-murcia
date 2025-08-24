// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDEWxXIHlD8ezQTdklpvys2FNjFu5bqd2s",
  authDomain: "checklist-real-murcia.firebaseapp.com",
  databaseURL: "https://checklist-real-murcia-default-rtdb.firebaseio.com",
  projectId: "checklist-real-murcia",
  storageBucket: "checklist-real-murcia.firebasestorage.app",
  messagingSenderId: "760418626321",
  appId: "1:760418626321:web:5aa01ddfd53e9be79bbab0",
  measurementId: "G-DWVT87PSEZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const provider = new GoogleAuthProvider();

export function auth() {
  const auth = getAuth();

  try {
    singInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;
    const user = result.user;

  } catch (error) {
    
  }
}