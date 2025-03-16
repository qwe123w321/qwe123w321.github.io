import { appCheck } from './firebase-config.js';
import { getToken } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app-check.js';

// 獲取 App Check 令牌的函數（本地實現，不再依賴從 firebase-config.js 導入）
async function getAppCheckToken() {
    if (!appCheck) {
        console.error('App Check 物件未初始化');
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

// 保存原始的 fetch 函數
const originalFetch = window.fetch;

// 使用代理替換全局 fetch 函數
window.fetch = async function(resource, options = {}) {
    try {
        // 檢查是否是 Firebase 請求
        let isFirebaseRequest = false;
        if (typeof resource === 'string') {
            isFirebaseRequest = resource.includes('firebaseapp') || 
                               resource.includes('identitytoolkit');
        } else if (resource instanceof Request) {
            isFirebaseRequest = resource.url.includes('firebaseapp') || 
                               resource.url.includes('identitytoolkit');
        }
        
        if (isFirebaseRequest) {
            try {
                const token = await getAppCheckToken();
                if (token) {
                    const newOptions = { ...options };
                    newOptions.headers = { ...options.headers };
                    newOptions.headers['X-Firebase-AppCheck'] = token;
                    return originalFetch(resource, newOptions);
                }
            } catch (e) {
                console.warn('App Check 令牌獲取失敗，使用原始請求', e);
            }
        }
        
        return originalFetch(resource, options);
    } catch (error) {
        console.error('Fetch 攔截器錯誤:', error);
        return originalFetch(resource, options);
    }
};

console.log('全局 fetch 攔截器已安裝，將自動為 Firebase 請求添加 App Check 令牌');

// 導出標記函數，表示攔截器已安裝
export function isAppCheckFetchInterceptorInstalled() {
    return true;
}