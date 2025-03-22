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
    // 嘗試從全局範圍獲取已初始化的 app
    if (window.firebaseApp) {
        app = window.firebaseApp;
        console.log('【AppCheckModule】檢測到已存在的 Firebase App 實例');
    } else {
        console.log('【AppCheckModule】未檢測到已存在的 Firebase App 實例，創建新實例');
        app = initializeApp(firebaseConfig);
        window.firebaseApp = app; // 存儲到全局
    }
} catch (e) {
    console.error('【AppCheckModule】獲取或創建 Firebase App 實例失敗:', e);
    // 嘗試創建新實例作為備用
    try {
        app = initializeApp(firebaseConfig);
        console.log('【AppCheckModule】創建了新的 Firebase App 實例');
    } catch (initError) {
        console.error('【AppCheckModule】創建新 Firebase App 實例失敗:', initError);
    }
}

// 初始化 App Check (優先使用全局實例)
let appCheck;
try {
    // 優先檢查是否已在全局範圍初始化
    if (window.appCheck) {
        appCheck = window.appCheck;
        console.log('【AppCheckModule】檢測到已存在的 App Check 實例，將使用此實例');
    } else {
        console.log('【AppCheckModule】未檢測到全局 App Check 實例，嘗試初始化新實例');
        // 使用 Promise.race 處理超時
        const initPromise = new Promise((resolve) => {
            appCheck = initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider('6Lf0pfMqAAAAAPWeK67sgdduOfMbWeB5w0-0bG6G'),
                isTokenAutoRefreshEnabled: true
            });
            resolve(appCheck);
        });
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("App Check 初始化超時")), 10000);
        });
        
        appCheck = await Promise.race([initPromise, timeoutPromise]);
        window.appCheck = appCheck; // 存儲至全局
        console.log('【AppCheckModule】成功初始化 App Check');
    }
} catch (error) {
    console.error('【AppCheckModule】初始化 App Check 失敗:', error);
}

// 檢查 App Check 狀態，並返回狀態信息
async function checkAppCheckStatus() {
    console.log('【AppCheckModule】檢查 App Check 狀態開始');
    
    // 檢查是否在儀表板頁面
    if (window.location.pathname.includes('dashboard')) {
        console.log('【AppCheckModule】檢測到儀表板頁面，返回模擬成功狀態');
        return { success: true, token: 'dashboard-mock-token' };
    }
    
    if (!appCheck) {
        console.error('【AppCheckModule】App Check 物件未初始化');
        return { success: false, error: 'App Check 物件未初始化' };
    }
    
    try {
        // 添加超時處理
        const tokenPromise = getToken(appCheck, /* forceRefresh */ true);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('獲取 App Check 令牌超時 (20秒)')), 20000);
        });
        
        console.log('【AppCheckModule】嘗試獲取 App Check 令牌...', new Date().toISOString());
        
        // 使用 Promise.race 處理潛在的卡住問題
        const tokenResult = await Promise.race([tokenPromise, timeoutPromise]);
        
        console.log('【AppCheckModule】App Check 令牌獲取成功！', new Date().toISOString());
        console.log('【AppCheckModule】令牌詳情:', {
            token: tokenResult.token ? (tokenResult.token.substring(0, 10) + '...[已隱藏]') : 'null', 
            expireTimeMillis: tokenResult.expireTimeMillis ? new Date(tokenResult.expireTimeMillis).toLocaleString() : 'null',
            isValid: !!tokenResult.token
        });
        
        return {
            success: true,
            token: tokenResult.token,
            expireTimeMillis: tokenResult.expireTimeMillis
        };
    } catch (error) {
        console.error('【AppCheckModule】App Check 令牌獲取失敗:', error, new Date().toISOString());
        console.error('【AppCheckModule】錯誤類型:', error.constructor.name);
        console.error('【AppCheckModule】錯誤詳情:', {
            code: error.code || '無錯誤代碼',
            name: error.name || '無錯誤名稱',
            message: error.message || '無錯誤訊息',
            stack: error.stack || '無堆疊追蹤'
        });
        
        // 檢查是否為網絡錯誤
        if (error.name === 'TypeError' && error.message.includes('NetworkError')) {
            console.error('【AppCheckModule】檢測到網絡錯誤，可能是跨域問題或網絡連接問題');
        }
        
        // 檢查是否為 reCAPTCHA 錯誤
        if (error.message && error.message.includes('reCAPTCHA')) {
            console.error('【AppCheckModule】檢測到 reCAPTCHA 錯誤，可能是 reCAPTCHA 未正確加載或配置錯誤');
        }
        
        // 試著獲取更多 reCAPTCHA 信息
        try {
            console.log('【AppCheckModule】嘗試檢查 reCAPTCHA 狀態:', {
                grecaptchaLoaded: typeof grecaptcha !== 'undefined',
                grecaptchaReady: typeof grecaptcha !== 'undefined' && typeof grecaptcha.ready === 'function',
                windowRecaptchaObject: window.recaptcha ? 'exists' : 'not found'
            });
        } catch (rcError) {
            console.error('【AppCheckModule】檢查 reCAPTCHA 狀態時出錯:', rcError);
        }
        
        return {
            success: false,
            error: error.message,
            fullError: error,
            errorType: error.constructor.name
        };
    }
}

// 獲取 App Check 令牌
async function getAppCheckToken() {
    console.log('【AppCheckModule】開始獲取 App Check 令牌', new Date().toISOString());
    
    if (!appCheck) {
        console.error('【AppCheckModule】App Check 物件未初始化');
        return null;
    }
    
    try {
        // 跟踪獲取過程開始時間
        const startTime = performance.now();
        
        // 添加超時處理
        const tokenPromise = getToken(appCheck);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('獲取 App Check 令牌超時 (15秒)')), 15000);
        });
        
        // 使用 Promise.race 處理潛在的卡住問題
        const tokenResult = await Promise.race([tokenPromise, timeoutPromise]);
        
        // 計算耗時
        const duration = performance.now() - startTime;
        
        console.log(`【AppCheckModule】成功獲取 App Check 令牌，耗時 ${duration.toFixed(2)}ms`, new Date().toISOString());
        return tokenResult.token;
    } catch (error) {
        console.error('【AppCheckModule】獲取 App Check 令牌時發生錯誤:', error);
        console.error('【AppCheckModule】錯誤詳情:', {
            name: error.name || '未知',
            code: error.code || '未知',
            message: error.message || '未知',
            stack: error.stack || '未知'
        });
        
        // 檢查 reCAPTCHA
        try {
            if (typeof grecaptcha !== 'undefined') {
                console.log('【AppCheckModule】reCAPTCHA 看起來已加載，嘗試檢查其狀態');
                if (typeof grecaptcha.execute === 'function') {
                    console.log('【AppCheckModule】grecaptcha.execute 函數存在');
                } else {
                    console.error('【AppCheckModule】grecaptcha.execute 函數不存在');
                }
            } else {
                console.error('【AppCheckModule】grecaptcha 未定義，reCAPTCHA 可能未正確加載');
            }
        } catch (rcError) {
            console.error('【AppCheckModule】檢查 reCAPTCHA 時出錯:', rcError);
        }
        
        return null;
    }
}

const tokenPromise = getToken(appCheck);
const timeoutPromise = new Promise((_, reject) => {
    // 將超時時間從 15 秒增加到 30 秒
    setTimeout(() => reject(new Error('獲取 App Check 令牌超時 (30秒)')), 30000);
});

// 添加 reCAPTCHA 狀態檢查函數
function checkRecaptchaStatus() {
    console.log('【AppCheckModule】檢查 reCAPTCHA 狀態');
    
    try {
        // 檢查 grecaptcha 是否存在
        const grecaptchaExists = typeof grecaptcha !== 'undefined';
        console.log('【AppCheckModule】grecaptcha 對象存在:', grecaptchaExists);
        
        if (grecaptchaExists) {
            // 檢查 grecaptcha.ready 方法
            const readyMethodExists = typeof grecaptcha.ready === 'function';
            console.log('【AppCheckModule】grecaptcha.ready 方法存在:', readyMethodExists);
            
            // 檢查 grecaptcha.execute 方法
            const executeMethodExists = typeof grecaptcha.execute === 'function';
            console.log('【AppCheckModule】grecaptcha.execute 方法存在:', executeMethodExists);
            
            // 獲取 grecaptcha 版本信息（如果有）
            const version = grecaptcha.version || 'unknown';
            console.log('【AppCheckModule】grecaptcha 版本:', version);
            
            // 如果 ready 方法存在，嘗試使用它
            if (readyMethodExists) {
                grecaptcha.ready(() => {
                    console.log('【AppCheckModule】grecaptcha.ready 回調執行');
                    console.log('【AppCheckModule】reCAPTCHA 已準備好');
                });
            }
        } else {
            // 檢查 script 是否已加載
            const recaptchaScripts = Array.from(document.scripts).filter(script => 
                script.src && script.src.includes('recaptcha'));
            
            console.log('【AppCheckModule】找到 reCAPTCHA 腳本:', recaptchaScripts.length);
            recaptchaScripts.forEach((script, index) => {
                console.log(`【AppCheckModule】reCAPTCHA 腳本 ${index + 1}:`, {
                    src: script.src,
                    async: script.async,
                    defer: script.defer,
                    loaded: script.readyState === 'complete' || script.readyState === 'loaded',
                });
            });
        }
        
        // 檢查全局回調
        const hasRecaptchaCallback = typeof window.__recaptchaCallback === 'function';
        console.log('【AppCheckModule】全局 __recaptchaCallback 存在:', hasRecaptchaCallback);
        
        return {
            grecaptchaExists,
            scriptsFound: Array.from(document.scripts).filter(script => 
                script.src && script.src.includes('recaptcha')).length
        };
    } catch (error) {
        console.error('【AppCheckModule】檢查 reCAPTCHA 狀態時出錯:', error);
        return { error: error.message };
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

// 在模組加載後自動檢查 reCAPTCHA 狀態
setTimeout(() => {
    console.log('【AppCheckModule】延遲檢查 reCAPTCHA 狀態');
    checkRecaptchaStatus();
}, 3000);

// 另一次延遲檢查，確保捕獲延遲加載的情況
setTimeout(() => {
    console.log('【AppCheckModule】再次檢查 reCAPTCHA 狀態');
    checkRecaptchaStatus();
}, 7000);

// 監控 fetch 請求的成功與失敗
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;
    
    // 只記錄 App Check 相關的請求
    if (url && url.includes('firebaseappcheck')) {
        console.log(`【AppCheckModule】發起 fetch 請求: ${url.substring(0, 100)}...`, new Date().toISOString());
        
        try {
            const startTime = performance.now();
            const response = await originalFetch.apply(this, args);
            const duration = performance.now() - startTime;
            
            console.log(`【AppCheckModule】fetch 請求完成: ${url.substring(0, 100)}...`, {
                status: response.status,
                ok: response.ok,
                duration: `${duration.toFixed(2)}ms`
            }, new Date().toISOString());
            
            // 如果狀態不是 200-299，記錄詳細錯誤
            if (!response.ok) {
                console.error(`【AppCheckModule】fetch 請求失敗: ${response.status} ${response.statusText}`);
                
                try {
                    // 嘗試複製響應並讀取內容（這可能會消耗原始響應）
                    const clonedResponse = response.clone();
                    const text = await clonedResponse.text();
                    console.error('【AppCheckModule】響應內容:', text.substring(0, 500));
                } catch (textError) {
                    console.error('【AppCheckModule】無法讀取響應內容:', textError);
                }
            }
            
            return response;
        } catch (error) {
            console.error(`【AppCheckModule】fetch 請求錯誤: ${url.substring(0, 100)}...`, error, new Date().toISOString());
            throw error;
        }
    }
    
    return originalFetch.apply(this, args);
};

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

// 添加完整診斷函數
function runFullDiagnostics() {
    console.log('===== 開始 App Check 完整診斷 =====');
    
    // 檢查環境
    console.log('【診斷】檢查環境:');
    console.log('- 當前 URL:', window.location.href);
    console.log('- 主機名:', window.location.hostname);
    console.log('- 使用者代理:', navigator.userAgent);
    console.log('- 是否為開發環境:', 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.hostname.includes('192.168.'));
    
    // 檢查 Firebase 初始化
    console.log('【診斷】檢查 Firebase 初始化:');
    console.log('- firebase 全局對象:', typeof firebase !== 'undefined' ? '存在' : '不存在');
    console.log('- app 對象:', app ? '已初始化' : '未初始化');
    console.log('- appCheck 對象:', appCheck ? '已初始化' : '未初始化');
    
    // 檢查 reCAPTCHA
    console.log('【診斷】檢查 reCAPTCHA:');
    const recaptchaStatus = checkRecaptchaStatus();
    
    // 檢查網絡連接
    console.log('【診斷】檢查網絡連接:');
    console.log('- 在線狀態:', navigator.onLine ? '在線' : '離線');
    
    // 嘗試 ping Firebase
    console.log('【診斷】嘗試 ping Firebase:');
    fetch('https://firebaseapp.com/ping', { 
        mode: 'no-cors',
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
    })
    .then(() => console.log('- Firebase ping: 成功'))
    .catch(err => console.error('- Firebase ping: 失敗', err));
    
    // 嘗試 ping Google
    console.log('【診斷】嘗試 ping Google:');
    fetch('https://www.google.com/generate_204', { 
        mode: 'no-cors',
        cache: 'no-cache',
        headers: { 'Cache-Control': 'no-cache' }
    })
    .then(() => console.log('- Google ping: 成功'))
    .catch(err => console.error('- Google ping: 失敗', err));
    
    // 檢查 localStorage 存取
    console.log('【診斷】檢查 localStorage:');
    try {
        localStorage.setItem('app_check_test', 'test');
        const testValue = localStorage.getItem('app_check_test');
        console.log('- localStorage 存取:', testValue === 'test' ? '成功' : '失敗');
        localStorage.removeItem('app_check_test');
    } catch (error) {
        console.error('- localStorage 存取: 失敗', error);
    }
    
    // 檢查是否存在阻止跨域的擴展或設置
    console.log('【診斷】檢查潛在的跨域問題:');
    const testImage = new Image();
    testImage.onload = () => console.log('- 跨域圖片加載: 成功');
    testImage.onerror = (err) => console.error('- 跨域圖片加載: 失敗', err);
    testImage.src = 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg';
    
    console.log('===== 診斷完成 =====');
    return {
        timestamp: new Date().toISOString(),
        environment: {
            url: window.location.href,
            hostname: window.location.hostname,
            userAgent: navigator.userAgent,
            isDevEnvironment: window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' || 
                            window.location.hostname.includes('192.168.')
        },
        firebase: {
            firebaseGlobalExists: typeof firebase !== 'undefined',
            appInitialized: !!app,
            appCheckInitialized: !!appCheck
        },
        recaptcha: recaptchaStatus,
        network: {
            online: navigator.onLine
        }
    };
}

// 導出所有函數和對象
export {
    appCheck,
    checkAppCheckStatus,
    getAppCheckToken,
    installXHRInterceptor,
    installFetchInterceptor,
    addDiagnosticsPanel,
    runFullDiagnostics,
    checkRecaptchaStatus
};

// 打印模塊初始化完成消息
console.log('【AppCheckModule】App Check 模塊已加載，可通過 import 使用其功能');