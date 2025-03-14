// app-check-module.js - 統一管理 App Check 相關功能

// 先導入 Firebase 和 App Check 相關模組
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
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

// 初始化 Firebase App（如果尚未初始化）
let app;
try {
    // 嘗試獲取已存在的 app
    app = firebase.app();
} catch (e) {
    // 如果不存在，初始化新的 app
    app = initializeApp(firebaseConfig);
}

// 啟用 App Check 偵錯模式（僅開發環境）
if (window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.includes('192.168.')) {
    console.log('【AppCheckModule】啟用 App Check 偵錯模式');
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

// 初始化 App Check
let appCheck;
try {
    appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6Lf0pfMqAAAAAPWeK67sgdduOfMbWeB5w0-0bG6G'),
        isTokenAutoRefreshEnabled: true
    });
    console.log('【AppCheckModule】成功初始化 App Check');
} catch (error) {
    console.error('【AppCheckModule】初始化 App Check 失敗:', error);
}

// 檢查 App Check 狀態，並返回狀態信息
async function checkAppCheckStatus() {
    console.log('【AppCheckModule】檢查 App Check 狀態開始');
    
    if (!appCheck) {
        console.error('【AppCheckModule】App Check 物件未初始化');
        return { success: false, error: 'App Check 物件未初始化' };
    }
    
    try {
        // 嘗試獲取令牌
        console.log('【AppCheckModule】嘗試獲取 App Check 令牌...');
        const tokenResult = await getToken(appCheck, /* forceRefresh */ true);
        
        console.log('【AppCheckModule】App Check 令牌獲取成功！');
        console.log('【AppCheckModule】令牌詳情:', {
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
        console.error('【AppCheckModule】App Check 令牌獲取失敗:', error);
        console.log('【AppCheckModule】錯誤詳情:', {
            code: error.code,
            message: error.message,
            stack: error.stack
        });
        
        return {
            success: false,
            error: error.message
        };
    }
}

// 獲取 App Check 令牌
async function getAppCheckToken() {
    if (!appCheck) {
        console.error('【AppCheckModule】App Check 物件未初始化');
        return null;
    }
    
    try {
        const tokenResult = await getToken(appCheck);
        console.log('【AppCheckModule】成功獲取 App Check 令牌');
        return tokenResult.token;
    } catch (error) {
        console.error('【AppCheckModule】獲取 App Check 令牌時發生錯誤:', error);
        return null;
    }
}

// 安裝 XHR 攔截器
function installXHRInterceptor() {
    // 確保不會重複安裝
    if (window._appCheckXHRInstalled) {
        console.log('【AppCheckModule】XHR 攔截器已安裝，跳過');
        return;
    }
    
    console.log('【AppCheckModule】安裝全局 XHR 攔截器');
    
    // 保存原始的 XHR 開啟方法
    const originalXHROpen = XMLHttpRequest.prototype.open;
    
    // 替換為我們的版本
    XMLHttpRequest.prototype.open = function() {
        const originalSend = this.send;
        const url = arguments[1];
        const xhr = this;
        
        // 如果是 Firebase 相關 URL，添加攔截
        if (url && (
            url.includes('identitytoolkit.googleapis.com') || 
            url.includes('securetoken.googleapis.com') ||
            url.includes('firebaseapp.com')
        )) {
            // 替換 send 方法來注入 App Check 令牌
            this.send = async function() {
                const sendArguments = arguments;
                
                try {
                    // 獲取令牌
                    const token = await getAppCheckToken();
                    
                    if (token) {
                        // 在請求發送前添加 App Check 令牌
                        xhr.setRequestHeader('X-Firebase-AppCheck', token);
                        console.log('【AppCheckModule】已為請求添加 App Check 令牌:', url);
                    } else {
                        console.warn('【AppCheckModule】無法獲取 App Check 令牌，請求將繼續但可能被拒絕:', url);
                    }
                } catch (error) {
                    console.error('【AppCheckModule】獲取 App Check 令牌失敗:', error);
                }
                
                // 調用原始的 send 方法
                return originalSend.apply(this, sendArguments);
            };
        }
        
        // 調用原始的 open 方法
        return originalXHROpen.apply(this, arguments);
    };
    
    // 標記已安裝
    window._appCheckXHRInstalled = true;
    
    console.log('【AppCheckModule】XHR 攔截器安裝完成');
}

// 安裝 fetch 攔截器
function installFetchInterceptor() {
    // 確保不會重複安裝
    if (window._appCheckFetchInstalled) {
        console.log('【AppCheckModule】fetch 攔截器已安裝，跳過');
        return;
    }
    
    console.log('【AppCheckModule】安裝全局 fetch 攔截器');
    
    // 保存原始的 fetch 函數
    const originalFetch = window.fetch;
    
    // 使用新版本替換
    window.fetch = async function(resource, options = {}) {
        // 檢查是否是 Firebase 請求
        let isFirebaseRequest = false;
        let url = '';
        
        if (typeof resource === 'string') {
            url = resource;
            isFirebaseRequest = url.includes('firebaseapp') || 
                                url.includes('identitytoolkit') ||
                                url.includes('securetoken') ||
                                url.includes('googleapis.com');
        } else if (resource instanceof Request) {
            url = resource.url;
            isFirebaseRequest = url.includes('firebaseapp') || 
                                url.includes('identitytoolkit') ||
                                url.includes('securetoken') ||
                                url.includes('googleapis.com');
        }
        
        // 如果是 Firebase 請求，添加 App Check 令牌
        if (isFirebaseRequest) {
            console.log('【AppCheckModule】檢測到 Firebase fetch 請求，嘗試添加 App Check 令牌:', url);
            
            try {
                // 獲取 App Check 令牌
                const token = await getAppCheckToken();
                
                if (token) {
                    console.log('【AppCheckModule】成功獲取 App Check 令牌，將添加到 fetch 請求中');
                    
                    // 準備新的請求選項，包括 App Check 令牌
                    const newOptions = { ...options };
                    newOptions.headers = { ...(options.headers || {}) };
                    
                    // 添加 App Check 令牌到請求頭
                    newOptions.headers['X-Firebase-AppCheck'] = token;
                    
                    // 使用新選項調用原始 fetch
                    return originalFetch(resource, newOptions);
                }
            } catch (error) {
                console.error('【AppCheckModule】處理 App Check 令牌時發生錯誤:', error);
            }
        }
        
        // 對於非 Firebase 請求或處理錯誤的情況，使用原始 fetch
        return originalFetch(resource, options);
    };
    
    // 標記已安裝
    window._appCheckFetchInstalled = true;
    
    console.log('【AppCheckModule】fetch 攔截器安裝完成');
}

// 立即安裝攔截器
installXHRInterceptor();
installFetchInterceptor();

// 檢查 App Check 狀態並添加診斷信息到頁面
function addDiagnosticsPanel() {
    // 創建診斷面板
    const panel = document.createElement('div');
    panel.id = 'appCheckDiagnostics';
    panel.style.position = 'fixed';
    panel.style.bottom = '20px';
    panel.style.right = '20px';
    panel.style.backgroundColor = 'white';
    panel.style.padding = '15px';
    panel.style.borderRadius = '8px';
    panel.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    panel.style.zIndex = '9999';
    panel.style.maxWidth = '300px';
    panel.style.fontSize = '14px';
    
    panel.innerHTML = `
        <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <strong>App Check 診斷</strong>
            <button id="closeAppCheckPanel" style="background: none; border: none; cursor: pointer; font-size: 16px;">✕</button>
        </div>
        <div id="appCheckStatus">檢查中...</div>
        <div style="margin-top: 10px;">
            <button id="checkAppCheck" style="padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 5px;">檢查狀態</button>
            <button id="installInterceptors" style="padding: 5px 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">安裝攔截器</button>
        </div>
    `;
    
    // 添加到頁面
    document.body.appendChild(panel);
    
    // 添加事件處理
    document.getElementById('closeAppCheckPanel').addEventListener('click', () => {
        panel.remove();
    });
    
    document.getElementById('checkAppCheck').addEventListener('click', async () => {
        const statusDiv = document.getElementById('appCheckStatus');
        statusDiv.textContent = '檢查中...';
        
        try {
            const result = await checkAppCheckStatus();
            if (result.success) {
                statusDiv.innerHTML = `
                    <div style="color: green;">✅ 令牌獲取成功</div>
                    <div>有效期至: ${new Date(result.expireTimeMillis).toLocaleString()}</div>
                    <div>令牌: ${result.token.substring(0, 10)}...</div>
                `;
            } else {
                statusDiv.innerHTML = `
                    <div style="color: red;">❌ 令牌獲取失敗</div>
                    <div>${result.error}</div>
                `;
            }
        } catch (error) {
            statusDiv.innerHTML = `
                <div style="color: red;">❌ 檢查時發生錯誤</div>
                <div>${error.message}</div>
            `;
        }
    });
    
    document.getElementById('installInterceptors').addEventListener('click', () => {
        installXHRInterceptor();
        installFetchInterceptor();
        document.getElementById('appCheckStatus').innerHTML = `
            <div style="color: green;">✅ 攔截器已重新安裝</div>
        `;
    });
    
    // 自動檢查狀態
    document.getElementById('checkAppCheck').click();
}

// 自動檢查 App Check 狀態
setTimeout(async () => {
    console.log('【AppCheckModule】自動檢查 App Check 狀態');
    const result = await checkAppCheckStatus();
    console.log('【AppCheckModule】自動檢查結果:', result.success ? '成功' : '失敗');
}, 1000);

// 導出所有函數和對象
export {
    appCheck,
    checkAppCheckStatus,
    getAppCheckToken,
    installXHRInterceptor,
    installFetchInterceptor,
    addDiagnosticsPanel
};

// 打印模塊初始化完成消息
console.log('【AppCheckModule】App Check 模塊已加載，可通過 import 使用其功能');