// firebase-config.js - 使用 ES 模組方式 (CDN 版本)

// 引入需要的 Firebase 套件 (使用 CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
import { getAuth, setPersistence, browserSessionPersistence, onAuthStateChanged, signOut, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
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

// 確保 reCAPTCHA 腳本加載
function loadRecaptchaScript() {
    return new Promise((resolve, reject) => {
        // 檢查 reCAPTCHA 是否已加載
        if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.ready === 'function') {
            console.log('reCAPTCHA 已經加載，無需重新加載');
            resolve();
            return;
        }
        
        console.log('開始加載 reCAPTCHA 腳本...');
        // 創建腳本元素
        const script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/api.js?render=6Lf0pfMqAAAAAPWeK67sgdduOfMbWeB5w0-0bG6G';
        script.async = true;
        script.defer = true;
        
        // 成功加載
        script.onload = () => {
            console.log('reCAPTCHA 腳本加載成功!');
            setTimeout(() => {
                if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.ready === 'function') {
                    console.log('reCAPTCHA 對象初始化完成');
                    resolve();
                } else {
                    console.error('reCAPTCHA 腳本加載但對象未初始化');
                    reject(new Error('reCAPTCHA 加載後未初始化'));
                }
            }, 1000); // 給 reCAPTCHA 一些初始化時間
        };
        
        // 加載失敗
        script.onerror = () => {
            console.error('reCAPTCHA 腳本加載失敗');
            reject(new Error('reCAPTCHA 腳本加載失敗'));
        };
        
        // 將腳本添加到文檔
        document.head.appendChild(script);
    });
}

// 檢查 reCAPTCHA 腳本加載狀態
function checkRecaptchaLoaded() {
    console.log('檢查 reCAPTCHA 腳本加載狀態');
    if (typeof grecaptcha !== 'undefined' && typeof grecaptcha.ready === 'function') {
        console.log('reCAPTCHA 腳本已加載');
        return true;
    }
    console.warn('reCAPTCHA 腳本尚未加載');
    return false;
}

// 初始化 App Check
let appCheck = null;

// 檢查當前頁面是否為後台面板
const isDashboard = window.location.pathname.includes('dashboard');

// 異步初始化 App Check
async function initializeAppCheckAsync() {
    try {
        // 儀表板頁面不需要 App Check
        if (isDashboard) {
            console.log('檢測到儀表板頁面，使用模擬 App Check');
            
            // 設置一個假的 App Check，避免錯誤
            appCheck = { 
                getToken: () => Promise.resolve({ 
                    token: 'dashboard-mock-token',
                    expireTimeMillis: Date.now() + 3600000 // 1小時後過期
                }) 
            };
            window.appCheck = appCheck;
            return;
        }
        
        // 嘗試加載 reCAPTCHA 腳本
        try {
            await loadRecaptchaScript();
        } catch (error) {
            console.error('加載 reCAPTCHA 腳本失敗，使用降級 App Check:', error);
            // 設置降級 App Check
            appCheck = { 
                _isFallback: true,
                getToken: () => Promise.resolve({ 
                    token: 'fallback-token', 
                    expireTimeMillis: Date.now() + 300000 // 5分鐘後過期
                }) 
            };
            window.appCheck = appCheck;
            return;
        }
        
        // 嘗試初始化 App Check
        appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider('6Lf0pfMqAAAAAPWeK67sgdduOfMbWeB5w0-0bG6G'),
            isTokenAutoRefreshEnabled: true
        });
        
        window.appCheck = appCheck; // 存儲到全局以便模組訪問
        console.log('App Check 初始化成功');
    } catch (error) {
        console.error('App Check 初始化過程中發生錯誤:', error);
        console.error('錯誤詳情:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // 設置降級 App Check
        appCheck = { 
            _isFallback: true,
            getToken: () => Promise.resolve({ 
                token: 'error-fallback-token', 
                expireTimeMillis: Date.now() + 300000 // 5分鐘後過期
            }) 
        };
        window.appCheck = appCheck;
    }
}

// 啟動 App Check 初始化
initializeAppCheckAsync();

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
    collection,
    signOut,
    signInWithEmailAndPassword
};