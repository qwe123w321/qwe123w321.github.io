// firebase-config.js - 使用 ES 模組方式 (CDN 版本)

// 引入需要的 Firebase 套件 (使用 CDN)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
import { getAuth, setPersistence, browserSessionPersistence, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js';
import { 
    initializeAppCheck, 
    ReCaptchaV3Provider,
    getToken
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app-check.js';

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

// 啟用 App Check 偵錯模式 (僅用於開發環境)
if (window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.includes('192.168.')) {
    console.log('啟用 App Check 偵錯模式');
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// 初始化 App Check
const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6Lf0pfMqAAAAAPWeK67sgdduOfMbWeB5w0-0bG6G'),
    isTokenAutoRefreshEnabled: true
});

// 打印 App Check 狀態函數
async function printAppCheckStatus() {
    console.log('App Check 狀態檢查開始');
    
    try {
        console.log('App Check 物件狀態:', appCheck);
        
        // 嘗試獲取令牌
        console.log('嘗試獲取 App Check 令牌...');
        const tokenResult = await getToken(appCheck, /* forceRefresh */ true);
        
        console.log('App Check 令牌獲取成功！');
        console.log('令牌詳情:', {
            token: tokenResult.token.substring(0, 10) + '...[已隱藏]', // 只顯示令牌前10個字符
            expireTimeMillis: new Date(tokenResult.expireTimeMillis).toLocaleString(),
            isValid: !!tokenResult.token
        });
        
        return {
            success: true,
            token: tokenResult.token,
            expireTimeMillis: tokenResult.expireTimeMillis
        };
    } catch (error) {
        console.error('App Check 令牌獲取失敗:', error);
        console.log('錯誤詳情:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        // 檢查常見的 App Check 錯誤
        if (error.code === 'app-check/throttled') {
            console.log('提示: App Check 請求被限流，請稍後再試');
        } else if (error.code === 'app-check/invalid-recaptcha-token') {
            console.log('提示: reCAPTCHA 令牌無效，可能需要檢查 reCAPTCHA 站點密鑰');
        } else if (error.code === 'app-check/internal-error') {
            console.log('提示: App Check 內部錯誤，可能需要檢查網絡連接或更新 Firebase SDK');
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

// 獲取並附加 App Check 令牌的輔助函數
async function getAndAttachAppCheckToken() {
    try {
        const tokenResult = await getToken(appCheck);
        console.log('成功獲取 App Check 令牌，可用於請求');
        return `Bearer ${tokenResult.token}`; // 需要的格式
    } catch (error) {
        console.error("獲取 App Check 令牌時發生錯誤:", error);
        return null;  // 或適當地處理錯誤
    }
}

// 使用 App Check 令牌進行請求的示例函數
async function fetchDataWithAppCheck(url, options = {}) {
    const appCheckToken = await getAndAttachAppCheckToken();
    
    if (appCheckToken) {
        // 合併標頭
        const headers = {
            'Authorization': appCheckToken,
            ...options.headers
        };
        
        // 發送請求
        try {
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP 錯誤! 狀態: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('使用 App Check 令牌發送請求失敗:', error);
            throw error;
        }
    } else {
        console.error('App Check 令牌獲取失敗，無法發送請求');
        throw new Error('App Check 驗證失敗');
    }
}

// 初始化服務
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 設置安全性選項
auth.useDeviceLanguage();
setPersistence(auth, browserSessionPersistence);

// 立即執行 App Check 狀態檢查 (用於調試)
console.log('正在初始化 Firebase 服務...');
setTimeout(() => {
    console.log('Firebase 服務初始化完成，正在檢查 App Check 狀態...');
    printAppCheckStatus().then(result => {
        console.log('App Check 狀態檢查完成:', result.success ? '成功' : '失敗');
    });
}, 2000);

// 導出服務以便其他模組使用
export { 
    auth, 
    db, 
    storage, 
    appCheck, 
    onAuthStateChanged, 
    doc, 
    getDoc, 
    collection, 
    printAppCheckStatus, 
    getAndAttachAppCheckToken,
    fetchDataWithAppCheck
};