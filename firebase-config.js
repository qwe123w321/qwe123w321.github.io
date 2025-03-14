import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
import { 
    getAuth, 
    setPersistence, 
    browserSessionPersistence,
    onAuthStateChanged,
    connectAuthEmulator // 用於本地測試
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    collection,
    connectFirestoreEmulator // 用於本地測試
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js';
import { 
    initializeAppCheck, 
    ReCaptchaV3Provider,
    getToken,
    setTokenAutoRefreshEnabled // 確保令牌自動刷新
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app-check.js';

// 檢測是否為開發環境
const isDevelopment = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('192.168.');

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
console.log('初始化 Firebase 應用...');
const app = initializeApp(firebaseConfig);

// 重要: 在初始化任何服務之前設置 App Check
console.log('初始化 App Check...');

// 在開發環境中啟用 App Check 調試模式
if (isDevelopment) {
    console.log('開發環境檢測到: 啟用 App Check 調試模式');
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// 初始化 App Check
let appCheck = null;
try {
    // 使用 reCAPTCHA v3
    appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6Lf0pfMqAAAAAPWeK67sgdduOfMbWeB5w0-0bG6G'),
        isTokenAutoRefreshEnabled: true
    });
    
    // 確保令牌自動刷新
    setTokenAutoRefreshEnabled(appCheck, true);
    
    console.log('App Check 初始化成功');
} catch (error) {
    console.error('App Check 初始化失敗:', error);
    
    // 在開發環境中可以選擇繼續而不使用 App Check
    if (isDevelopment) {
        console.log('在開發環境中繼續而不使用 App Check');
    } else {
        // 在生產環境中可以顯示錯誤訊息給用戶
        alert('應用驗證初始化失敗，某些功能可能無法正常使用。請刷新頁面或稍後再試。');
    }
}

// 只有在 App Check 初始化成功後才初始化其他服務
console.log('初始化 Firebase 服務 (Auth, Firestore, Storage)...');

// 初始化 Auth 服務
const auth = getAuth(app);

// 初始化 Firestore 服務
const db = getFirestore(app);

// 初始化 Storage 服務
const storage = getStorage(app);

// 設置安全性選項
auth.useDeviceLanguage();

// 根據是否勾選"記住我"設置持久性
async function setAuthPersistence(rememberMe = false) {
    try {
        // 如果勾選了"記住我"，使用 browserLocalPersistence
        // 否則使用 browserSessionPersistence
        const { browserLocalPersistence } = await import('https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js');
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        console.log(`已設置身份驗證持久性: ${rememberMe ? 'local' : 'session'}`);
    } catch (error) {
        console.error('設置持久性失敗:', error);
    }
}

// 等待 App Check 初始化完成，然後預先獲取令牌
async function ensureAppCheckTokenIsReady() {
    if (!appCheck) {
        console.log('App Check 未初始化，無法獲取令牌');
        return null;
    }
    
    try {
        console.log('預先獲取 App Check 令牌...');
        const tokenResult = await getToken(appCheck, /* forceRefresh */ true);
        console.log('App Check 令牌預先獲取成功，有效期至:', new Date(tokenResult.expireTimeMillis).toLocaleString());
        return tokenResult.token;
    } catch (error) {
        console.error('預先獲取 App Check 令牌失敗:', error);
        return null;
    }
}

// 獲取並附加 App Check 令牌的輔助函數
async function getAndAttachAppCheckToken() {
    if (!appCheck) {
        console.log('App Check 未初始化，無法獲取令牌');
        return null;
    }
    
    try {
        const tokenResult = await getToken(appCheck);
        console.log('成功獲取 App Check 令牌，可用於請求');
        return tokenResult.token;
    } catch (error) {
        console.error("獲取 App Check 令牌時發生錯誤:", error);
        return null;
    }
}

// 將 App Check 令牌添加到發送請求的函數
async function fetchWithAppCheck(url, options = {}) {
    const token = await getAndAttachAppCheckToken();
    if (!token) {
        console.warn('無法獲取 App Check 令牌，請求將繼續但可能被拒絕');
    }
    
    const headers = {
        ...options.headers,
        ...(token && { 'X-Firebase-AppCheck': token })
    };
    
    return fetch(url, {
        ...options,
        headers
    });
}

// 調用預先獲取令牌函數
ensureAppCheckTokenIsReady().then(token => {
    if (token) {
        console.log('App Check 令牌已預先獲取，應用已準備好進行驗證請求');
        
        // 將令牌保存在全局變量中，以便其他模塊可以使用
        window._appCheckToken = token;
        
        // 設置一個 XHR 攔截器，自動為所有 Firebase 身份驗證請求添加令牌
        setupXHRInterceptor(token);
    }
});

// 設置 XHR 攔截器來添加 App Check 令牌
function setupXHRInterceptor(token) {
    if (!token) return;
    
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function() {
        const result = originalXHROpen.apply(this, arguments);
        
        // 獲取 URL (第二個參數)
        const url = arguments[1];
        
        // 檢查是否是 Firebase Auth 請求
        if (url && (
            url.includes('identitytoolkit.googleapis.com') || 
            url.includes('securetoken.googleapis.com')
        )) {
            // 為 readystatechange 添加一個處理器
            this.addEventListener('readystatechange', function() {
                if (this.readyState === 1) { // OPENED
                    // 添加 App Check 令牌到請求頭
                    this.setRequestHeader('X-Firebase-AppCheck', token);
                    console.log('為身份驗證請求添加了 App Check 令牌');
                }
            });
        }
        
        return result;
    };
    
    console.log('已設置 XHR 攔截器來添加 App Check 令牌到身份驗證請求');
}

// 導出服務以便其他模組使用
export { 
    app, 
    auth, 
    db, 
    storage, 
    appCheck, 
    onAuthStateChanged, 
    doc, 
    getDoc, 
    collection, 
    ensureAppCheckTokenIsReady,
    getAndAttachAppCheckToken,
    fetchWithAppCheck,
    setAuthPersistence
};