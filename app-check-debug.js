// app-check-debug.js - App Check 調試工具
// 將此文件引入到您的網頁中可以幫助診斷 App Check 相關問題

import { appCheck, printAppCheckStatus } from './firebase-config.js';
import { getToken } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app-check.js';

// 在全局範圍內添加調試功能
window.appCheckDebug = {
    // 檢查 App Check 狀態
    checkStatus: async function() {
        console.group('App Check 狀態檢查');
        try {
            const result = await printAppCheckStatus();
            if (result.success) {
                console.log('%c✅ App Check 令牌獲取成功!', 'color: green; font-weight: bold;');
                console.log('令牌有效期至:', new Date(result.expireTimeMillis).toLocaleString());
                console.log('令牌前10位:', result.token.substring(0, 10) + '...');
            } else {
                console.log('%c❌ App Check 令牌獲取失敗!', 'color: red; font-weight: bold;');
                console.error('錯誤:', result.error);
            }
        } catch (error) {
            console.log('%c❌ App Check 檢查發生錯誤!', 'color: red; font-weight: bold;');
            console.error(error);
        }
        console.groupEnd();
        return '檢查完成，請查看上方日誌';
    },

    // 強制刷新令牌
    forceRefresh: async function() {
        console.group('App Check 令牌強制刷新');
        try {
            console.log('嘗試強制刷新 App Check 令牌...');
            const tokenResult = await getToken(appCheck, /* forceRefresh */ true);
            console.log('%c✅ 令牌刷新成功!', 'color: green; font-weight: bold;');
            console.log('新令牌有效期至:', new Date(tokenResult.expireTimeMillis).toLocaleString());
            console.log('新令牌前10位:', tokenResult.token.substring(0, 10) + '...');
            return true;
        } catch (error) {
            console.log('%c❌ 令牌刷新失敗!', 'color: red; font-weight: bold;');
            console.error(error);
            return false;
        } finally {
            console.groupEnd();
        }
    },

    // 檢查 reCAPTCHA 狀態
    checkRecaptcha: function() {
        console.group('reCAPTCHA 狀態檢查');
        try {
            // 檢查全局 grecaptcha 對象
            if (typeof grecaptcha === 'undefined') {
                console.log('%c❌ grecaptcha 全局對象不存在!', 'color: red; font-weight: bold;');
                console.log('這可能意味著 reCAPTCHA 腳本未正確加載');
                return false;
            } else {
                console.log('%c✅ grecaptcha 全局對象已存在', 'color: green; font-weight: bold;');
                console.log('reCAPTCHA 版本:', grecaptcha.version || '未知');
                return true;
            }
        } catch (error) {
            console.log('%c❌ 檢查 reCAPTCHA 時發生錯誤!', 'color: red; font-weight: bold;');
            console.error(error);
            return false;
        } finally {
            console.groupEnd();
        }
    },

    // 運行完整的診斷
    runDiagnostics: async function() {
        console.group('%c🔍 App Check 完整診斷', 'color: blue; font-weight: bold; font-size: 14px;');
        console.log('開始 App Check 診斷...');
        console.log('時間:', new Date().toLocaleString());
        console.log('URL:', window.location.href);
        
        // 檢查 reCAPTCHA
        const recaptchaOk = this.checkRecaptcha();
        
        // 檢查网络状态
        console.log('網絡狀態:', navigator.onLine ? '在線' : '離線');
        
        // 嘗試獲取令牌
        await this.checkStatus();
        
        // 如果失敗，嘗試強制刷新
        if (!recaptchaOk) {
            console.log('由於 reCAPTCHA 問題，嘗試強制刷新令牌...');
            await this.forceRefresh();
        }
        
        console.log('診斷完成');
        console.groupEnd();
        
        return '診斷完成，請查看控制台日誌';
    },

    // 添加視覺化調試器到頁面
    addDebugger: function() {
        // 創建調試器 UI
        const debuggerUI = document.createElement('div');
        debuggerUI.id = 'appCheckDebugger';
        debuggerUI.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 9999; max-width: 300px;';
        
        debuggerUI.innerHTML = `
            <h5 style="margin-top: 0; border-bottom: 1px solid #eee; padding-bottom: 8px;">App Check 調試</h5>
            <div id="appCheckDebuggerContent" style="margin-bottom: 10px; font-size: 13px;">
                <p>點擊按鈕執行診斷</p>
            </div>
            <div style="display: flex; gap: 5px;">
                <button id="runDiagnosticsBtn" style="flex: 1; padding: 8px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">運行診斷</button>
                <button id="refreshTokenBtn" style="flex: 1; padding: 8px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">刷新令牌</button>
                <button id="closeDebuggerBtn" style="width: 30px; padding: 0; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">✕</button>
            </div>
        `;
        
        // 添加到頁面
        document.body.appendChild(debuggerUI);
        
        // 添加事件監聽器
        document.getElementById('runDiagnosticsBtn').addEventListener('click', async () => {
            const content = document.getElementById('appCheckDebuggerContent');
            content.innerHTML = '<p>正在運行診斷...</p>';
            await this.runDiagnostics();
            
            // 檢查 App Check 狀態
            try {
                const result = await printAppCheckStatus();
                if (result.success) {
                    content.innerHTML = `
                        <p style="color: green; font-weight: bold;">✅ App Check 正常!</p>
                        <p>令牌有效期至: ${new Date(result.expireTimeMillis).toLocaleString()}</p>
                        <p>令牌前10位: ${result.token.substring(0, 10)}...</p>
                    `;
                } else {
                    content.innerHTML = `
                        <p style="color: red; font-weight: bold;">❌ App Check 失敗!</p>
                        <p>錯誤: ${result.error}</p>
                        <p>請查看控制台以獲取更多信息</p>
                    `;
                }
            } catch (error) {
                content.innerHTML = `
                    <p style="color: red; font-weight: bold;">❌ 診斷時發生錯誤!</p>
                    <p>${error.message}</p>
                `;
            }
        });
        
        document.getElementById('refreshTokenBtn').addEventListener('click', async () => {
            const content = document.getElementById('appCheckDebuggerContent');
            content.innerHTML = '<p>正在刷新令牌...</p>';
            
            const success = await this.forceRefresh();
            if (success) {
                content.innerHTML = '<p style="color: green; font-weight: bold;">✅ 令牌刷新成功!</p>';
            } else {
                content.innerHTML = '<p style="color: red; font-weight: bold;">❌ 令牌刷新失敗!</p><p>請查看控制台以獲取更多信息</p>';
            }
        });
        
        document.getElementById('closeDebuggerBtn').addEventListener('click', () => {
            document.getElementById('appCheckDebugger').remove();
        });
        
        return '調試器已添加到頁面右下角';
    }
};

console.log('%c🔍 App Check 調試工具已加載', 'color: blue; font-weight: bold;');
console.log('在控制台中使用 appCheckDebug 對象來診斷 App Check 問題');
console.log('- appCheckDebug.checkStatus() - 檢查當前狀態');
console.log('- appCheckDebug.forceRefresh() - 強制刷新令牌');
console.log('- appCheckDebug.runDiagnostics() - 運行完整診斷');
console.log('- appCheckDebug.addDebugger() - 添加視覺化調試器到頁面');

// 導出調試工具
export default window.appCheckDebug;