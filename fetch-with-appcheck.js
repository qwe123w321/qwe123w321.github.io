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
    // 檢查是否是 Firebase 請求
    let isFirebaseRequest = false;
    if (typeof resource === 'string') {
        isFirebaseRequest = resource.includes('firebaseapp') || 
                           resource.includes('identitytoolkit') ||
                           resource.includes('securetoken') ||
                           resource.includes('googleapis.com');
    } else if (resource instanceof Request) {
        isFirebaseRequest = resource.url.includes('firebaseapp') || 
                           resource.url.includes('identitytoolkit') ||
                           resource.url.includes('securetoken') ||
                           resource.url.includes('googleapis.com');
    }
    
    // 如果是 Firebase 請求，添加 App Check 令牌
    if (isFirebaseRequest) {
        console.log('檢測到 Firebase 請求，嘗試添加 App Check 令牌');
        
        try {
            // 獲取 App Check 令牌
            const token = await getAppCheckToken();
            
            if (token) {
                console.log('成功獲取 App Check 令牌，將添加到請求中');
                
                // 準備新的請求選項，包括 App Check 令牌
                const newOptions = { ...options };
                newOptions.headers = { ...options.headers };
                
                // 添加 App Check 令牌到請求頭
                newOptions.headers['X-Firebase-AppCheck'] = token;
                
                // 使用新選項調用原始 fetch
                return originalFetch(resource, newOptions);
            } else {
                console.warn('無法獲取 App Check 令牌，將繼續原始請求');
            }
        } catch (error) {
            console.error('處理 App Check 令牌時發生錯誤:', error);
            // 在錯誤情況下，繼續原始請求
        }
    }
    
    // 對於非 Firebase 請求或處理錯誤的情況，使用原始 fetch
    return originalFetch(resource, options);
};

console.log('全局 fetch 攔截器已安裝，將自動為 Firebase 請求添加 App Check 令牌');

// 導出標記函數，表示攔截器已安裝
export function isAppCheckFetchInterceptorInstalled() {
    return true;
}