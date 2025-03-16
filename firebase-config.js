// firebase-config.js - 使用 ES 模組方式 (CDN 版本)

// 引入需要的 Firebase 套件 (使用 CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
import { getAuth, setPersistence, browserSessionPersistence, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app-check.js';

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

// 啟用 App Check 偵錯模式 (僅開發環境)
if (window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.includes('192.168.')) {
    console.log('啟用 App Check 偵錯模式');
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// 初始化 App Check
let appCheck;
try {
    // 添加 reCAPTCHA 超時處理
    const reCaptchaTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("reCAPTCHA初始化超時")), 5000);
    });
    
    // 嘗試初始化 App Check
    appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6Lf0pfMqAAAAAPWeK67sgdduOfMbWeB5w0-0bG6G'),
        isTokenAutoRefreshEnabled: true
    });
    
    console.log('App Check 初始化成功');
} catch (error) {
    console.error('App Check 初始化失敗:', error);
    // 如果初始化失敗，設置為 null
    appCheck = null;
}

// 初始化服務
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 設置安全性選項
auth.useDeviceLanguage();
setPersistence(auth, browserSessionPersistence);

// 導出服務以便其他模組使用
export { 
    auth, 
    db, 
    storage, 
    appCheck,  // 確保導出 appCheck
    onAuthStateChanged, 
    doc, 
    getDoc, 
    collection
};