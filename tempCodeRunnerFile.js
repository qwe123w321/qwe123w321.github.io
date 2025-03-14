import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, setPersistence, browserSessionPersistence, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyDslE4rgN8ZiUam3MCT_bJiSfusUxZS-wU",
    authDomain: "test1-b1d68.firebaseapp.com",
    databaseURL: "https://test1-b1d68-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "test1-b1d68",
    storageBucket: "test1-b1d68.appspot.com",
    messagingSenderId: "1010412789448",
    appId: "1:1010412789448:web:2843afa459b3644d118ffd",
    measurementId: "G-X7RQ8DRZ7P"
  };

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化 App Check
const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6Lf0pfMqAAAAAPWeK67sgdduOfMbWeB5w0-0bG6G'),
    isTokenAutoRefreshEnabled: true
});

// 初始化服務
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 設置安全性選項
auth.useDeviceLanguage();
setPersistence(auth, browserSessionPersistence);

// 導出服務以便其他模組使用
export { auth, db, storage, appCheck, onAuthStateChanged, doc, getDoc, collection };