// session-manager.js
// 會話管理模組 - 處理登入逾時和會話狀態

import { auth, signOut } from './firebase-config.js';

// 會話配置
const SESSION_CONFIG = {
  TIMEOUT: 60 * 60 * 1000, // 60分鐘 (可依需求調整)
  ACTIVITY_EVENTS: ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
};

// 初始化變數
let inactivityTimer;
let initialized = false;

/**
 * 設置會話超時處理
 * @returns {Object} 包含當前會話管理的方法
 */
export function setupSessionManager() {
  // 避免重複初始化
  if (initialized) {
    console.log('會話管理器已初始化');
    return getSessionManager();
  }
  
  console.log('初始化會話管理器...');
  initialized = true;
  
  // 重置計時器的函數
  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(handleSessionTimeout, SESSION_CONFIG.TIMEOUT);
  }
  
  // 處理會話超時的函數
  function handleSessionTimeout() {
    // 檢查是否已經顯示了對話框
    if (document.getElementById('session-timeout-modal')) {
      return;
    }
    
    // 創建會話超時對話框
    const modal = document.createElement('div');
    modal.id = 'session-timeout-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>登入已過期</h2>
        <p>由於長時間未操作，您的登入已過期。</p>
        <p>請重新登入以繼續使用系統。</p>
        <div class="modal-buttons">
          <button id="session-relogin" class="btn-primary">重新登入</button>
        </div>
      </div>
    `;
    
    // 添加樣式
    const style = document.createElement('style');
    style.textContent = `
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      .modal-content {
        background: white;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        max-width: 450px;
        width: 85%;
        text-align: center;
      }
      .modal-buttons {
        margin-top: 20px;
      }
      .btn-primary {
        background: #9D7F86;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
      }
      .btn-primary:hover {
        background: #8A6E75;
      }
    `;
    
    // 添加到頁面
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // 添加事件監聽器
    document.getElementById('session-relogin').addEventListener('click', () => {
      // 登出當前用戶
      if (auth) {
        signOut(auth).then(() => {
          // 刷新頁面
          window.location.reload();
        }).catch(error => {
          console.error('登出錯誤:', error);
          window.location.reload();
        });
      } else {
        // 如果auth不可用，直接刷新
        window.location.reload();
      }
    });
    
    // 如果用戶仍然登入，則清理監聽器
    cleanupListeners();
  }
  
  // 清理監聽器和其他資源
  function cleanupListeners() {
    // 這裡可以清理特定的監聽器
    console.log('清理會話資源和監聽器');
    
    // 移除用戶活動監聽器
    SESSION_CONFIG.ACTIVITY_EVENTS.forEach(eventType => {
      document.removeEventListener(eventType, resetInactivityTimer);
    });
  }
  
  // 添加用戶活動監聽器
  SESSION_CONFIG.ACTIVITY_EVENTS.forEach(eventType => {
    document.addEventListener(eventType, resetInactivityTimer, { passive: true });
  });
  
  // 監聽 App Check 錯誤
  window.addEventListener('error', event => {
    // 檢查是否是 App Check 403 錯誤
    if (event.message && (
        event.message.includes('appCheck/fetch-status-error') || 
        (event.error && event.error.code === 'appCheck/fetch-status-error')
    )) {
      handleSessionTimeout();
    }
  });
  
  // 擴展 XHR 以捕獲 403 錯誤
  if (typeof XMLHttpRequest !== 'undefined') {
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function() {
      const xhr = this;
      const originalOnReadyStateChange = xhr.onreadystatechange;
      
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 403) {
          if (xhr.responseText && xhr.responseText.includes('appCheck/fetch-status-error')) {
            handleSessionTimeout();
          }
        }
        if (originalOnReadyStateChange) {
          originalOnReadyStateChange.apply(this, arguments);
        }
      };
      
      originalXHROpen.apply(this, arguments);
    };
  }
  
  // 初始化計時器
  resetInactivityTimer();
  
  // 返回會話管理器對象，提供外部可用的方法
  return getSessionManager();
}

/**
 * 獲取會話管理器
 * @returns {Object} 包含當前會話管理的方法
 */
function getSessionManager() {
  return {
    // 手動重置計時器
    resetTimer: function() {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(handleSessionTimeout, SESSION_CONFIG.TIMEOUT);
      }
    },
    
    // 手動觸發會話超時
    forceTimeout: function() {
      if (typeof handleSessionTimeout === 'function') {
        handleSessionTimeout();
      }
    },
    
    // 更新超時時間
    updateTimeoutDuration: function(milliseconds) {
      if (milliseconds && milliseconds > 0) {
        SESSION_CONFIG.TIMEOUT = milliseconds;
        if (inactivityTimer) {
          clearTimeout(inactivityTimer);
          inactivityTimer = setTimeout(handleSessionTimeout, SESSION_CONFIG.TIMEOUT);
        }
      }
    }
  };
}

// 導出基本的會話管理器 (未初始化)
export const SessionManager = {
  setup: setupSessionManager
};

// 自動初始化 (如果啟用)
if (typeof document !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupSessionManager);
} else if (typeof document !== 'undefined') {
  setupSessionManager();
}