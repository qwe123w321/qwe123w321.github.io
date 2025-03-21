// verify.js - 使用 ES 模組方式 (CDN 版本)
import { 
    auth, 
    db, 
    onAuthStateChanged,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from './firebase-config.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

// 從統一的 App Check 模組導入需要的函數
import { 
    checkAppCheckStatus,
    getAppCheckToken,
    installXHRInterceptor,
    installFetchInterceptor
} from './app-check-module.js';

let scanner = null; // 全局掃描器實例
let hasActiveCamera = false;

// DOM 元素綁定
document.addEventListener('DOMContentLoaded', function() {
    console.log('正在初始化優惠核銷頁面...');
    
    // 安裝 App Check 請求攔截器
    console.log('安裝 App Check 請求攔截器...');
    try {
        installXHRInterceptor();
        installFetchInterceptor();
        console.log('App Check 請求攔截器安裝成功');
    } catch (error) {
        console.error('安裝 App Check 請求攔截器失敗:', error);
    }
    
    // 優先檢查 App Check 狀態
    setTimeout(async () => {
        console.log('驗證 App Check 狀態...');
        try {
            // 確保 App Check 已初始化
            const result = await checkAppCheckStatus();
            if (result.success) {
                console.log('App Check 驗證成功，可以正常使用核銷功能');
                
                // 預先獲取一個令牌
                try {
                    const token = await getAppCheckToken();
                    console.log('成功獲取 App Check 令牌:', token ? '有效' : '無效');
                } catch (tokenError) {
                    console.error('獲取 App Check 令牌失敗:', tokenError);
                }
            } else {
                console.error('App Check 驗證失敗:', result);
                showError('App Check 驗證失敗，這可能導致核銷功能無法使用。請刷新頁面後重試。');
            }
        } catch (error) {
            console.error('檢查 App Check 狀態出錯:', error);
            showError('無法完成安全驗證，請重新加載頁面。');
        }
    }, 1000);
    
    // 標籤頁切換事件
    const tabs = document.querySelectorAll('.verification-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 移除所有標籤頁和內容區的 active 類
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tabs-container').forEach(c => c.classList.remove('active'));
            
            // 添加當前標籤頁和對應內容區的 active 類
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).classList.add('active');
            
            // 如果切換到掃描標籤，停止掃描器
            if (tabId !== 'scan' && scanner) {
                scanner.stop();
                hasActiveCamera = false;
            }
        });
    });
    
    // 請求攝影機權限按鈕
    const requestCameraBtn = document.getElementById('requestCameraBtn');
    if (requestCameraBtn) {
        requestCameraBtn.addEventListener('click', function() {
            initScanner();
        });
    }
    
    // 開始掃描按鈕
    const scanQrBtn = document.getElementById('scanQrBtn');
    if (scanQrBtn) {
        scanQrBtn.addEventListener('click', function() {
            if (!hasActiveCamera) {
                initScanner();
            } else if (scanner) {
                scanner.start();
            }
        });
    }
    
    // 驗證碼提交
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    if (verifyCodeBtn) {
        verifyCodeBtn.addEventListener('click', function() {
            const code = document.getElementById('verificationCode').value.trim();
            if (code.length !== 6) {
                showError('請輸入正確的6位數驗證碼');
                return;
            }
            
            // 更新按鈕狀態
            verifyCodeBtn.disabled = true;
            verifyCodeBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 驗證中...';
            
            // 驗證優惠券
            verifyPromotion(code);
        });
    }
    
    // 監聽驗證碼輸入框，只允許輸入數字
    const codeInput = document.getElementById('verificationCode');
    if (codeInput) {
        codeInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
        
        // 按 Enter 鍵提交
        codeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const verifyCodeBtn = document.getElementById('verifyCodeBtn');
                if (verifyCodeBtn && !verifyCodeBtn.disabled) {
                    verifyCodeBtn.click();
                }
            }
        });
    }
    
    // 嘗試自動初始化掃描器
    setTimeout(() => {
        if (document.querySelector('.verification-tab.active').getAttribute('data-tab') === 'scan') {
            initScanner();
        }
    }, 1000);
});

// 初始化 QR 掃描器
function initScanner() {
    try {
        console.log('初始化 QR 掃描器...');
        
        // 更新按鈕狀態
        const requestCameraBtn = document.getElementById('requestCameraBtn');
        if (requestCameraBtn) {
            requestCameraBtn.disabled = true;
            requestCameraBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 請求攝影機權限中...';
        }
        
        // 如果已有掃描器，先停止它
        if (scanner) {
            try {
                scanner.stop();
            } catch (stopError) {
                console.error('停止現有掃描器錯誤:', stopError);
            }
        }
        
        // 創建新的掃描器實例
        scanner = new Instascan.Scanner({ 
            video: document.getElementById('preview'),
            scanPeriod: 3, // 每3秒掃描一次
            mirror: false  // 不使用鏡像模式，更容易對準
        });
        
        // 掃描成功事件
        scanner.addListener('scan', function(content) {
            console.log('掃描到 QR 碼:', content);
            
            // 提取驗證碼 (假設格式為 "BREWDATE:123456")
            let code = content;
            
            if (content.includes('BREWDATE:')) {
                code = content.split('BREWDATE:')[1];
            }
            
            // 驗證優惠券
            verifyPromotion(code);
        });
        
        // 獲取可用攝影機
        Instascan.Camera.getCameras().then(function(cameras) {
            if (cameras.length > 0) {
                // 優先使用後置鏡頭（如果有）
                let selectedCamera = cameras[0]; // 默認前置鏡頭
                
                // 嘗試找到後置鏡頭
                for (let i = 0; i < cameras.length; i++) {
                    if (!cameras[i].name.toLowerCase().includes('front')) {
                        selectedCamera = cameras[i];
                        break;
                    }
                }
                
                // 啟動掃描器
                scanner.start(selectedCamera);
                hasActiveCamera = true;
                
                console.log('掃描器已啟動，使用鏡頭:', selectedCamera.name);
                
                // 更新按鈕狀態
                if (requestCameraBtn) {
                    requestCameraBtn.disabled = false;
                    requestCameraBtn.innerHTML = '<i class="fas fa-camera me-2"></i>切換攝影機';
                }
                
                // 如果有多個鏡頭，提供切換選項
                if (cameras.length > 1) {
                    let cameraIndex = cameras.indexOf(selectedCamera);
                    
                    requestCameraBtn.addEventListener('click', function() {
                        // 切換到下一個鏡頭
                        cameraIndex = (cameraIndex + 1) % cameras.length;
                        scanner.start(cameras[cameraIndex]);
                        console.log('切換到鏡頭:', cameras[cameraIndex].name);
                    });
                }
            } else {
                console.error('未檢測到攝影機');
                showError('未檢測到攝影機，請確保您的設備有攝影機並已授予權限');
                
                // 更新按鈕狀態
                if (requestCameraBtn) {
                    requestCameraBtn.disabled = false;
                    requestCameraBtn.innerHTML = '<i class="fas fa-camera me-2"></i>重試攝影機權限';
                }
            }
        }).catch(function(error) {
            console.error('獲取攝影機列表出錯:', error);
            showError('無法獲取攝影機列表: ' + error.toString());
            
            // 更新按鈕狀態
            if (requestCameraBtn) {
                requestCameraBtn.disabled = false;
                requestCameraBtn.innerHTML = '<i class="fas fa-camera me-2"></i>重試攝影機權限';
            }
        });
    } catch (error) {
        console.error('初始化掃描器出錯:', error);
        showError('初始化掃描器出錯: ' + error.toString());
        
        // 更新按鈕狀態
        const requestCameraBtn = document.getElementById('requestCameraBtn');
        if (requestCameraBtn) {
            requestCameraBtn.disabled = false;
            requestCameraBtn.innerHTML = '<i class="fas fa-camera me-2"></i>重試攝影機權限';
        }
    }
}

// 驗證優惠券
async function verifyPromotion(code) {
    try {
        console.log('開始驗證優惠券，驗證碼:', code);
        
        // 先獲取 App Check 令牌，確保請求不會被拒絕
        let appCheckToken = null;
        try {
            console.log('獲取 App Check 令牌...');
            appCheckToken = await getAppCheckToken();
            console.log('App Check 令牌獲取成功:', appCheckToken ? '有效' : '無效');
        } catch (tokenError) {
            console.error('獲取 App Check 令牌失敗，但將繼續嘗試驗證:', tokenError);
        }
        
        // 重置結果顯示
        const resultElement = document.getElementById('verification-result');
        resultElement.innerHTML = '';
        resultElement.className = 'verification-result';
        resultElement.style.display = 'none';
        
        // 禁用驗證按鈕
        const verifyCodeBtn = document.getElementById('verifyCodeBtn');
        if (verifyCodeBtn) {
            verifyCodeBtn.disabled = true;
            verifyCodeBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 驗證中...';
        }
        
        // 查詢 Firestore 中的優惠券
        const promotionsRef = collection(db, 'promotions');
        const q = query(promotionsRef, where('verificationCode', '==', code), where('isActive', '==', true));
        
        console.log('執行 Firestore 查詢...');
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            console.log('未找到有效優惠券');
            showError('無效的驗證碼或優惠券已過期');
            return;
        }
        
        // 獲取優惠券數據
        const promotionDoc = querySnapshot.docs[0];
        const promotionData = promotionDoc.data();
        const promotionId = promotionDoc.id;
        
        console.log('找到優惠券:', promotionId, promotionData);
        
        // 檢查優惠券是否已使用
        if (promotionData.isUsed) {
            showError('此優惠券已被使用，使用時間: ' + formatDate(promotionData.usedAt.toDate()));
            return;
        }
        
        // 檢查優惠券是否過期
        const now = new Date();
        const expiryDate = promotionData.expiryDate ? promotionData.expiryDate.toDate() : null;
        
        if (expiryDate && now > expiryDate) {
            showError('此優惠券已過期，過期時間: ' + formatDate(expiryDate));
            return;
        }
        
        // 標記優惠券為已使用
        await updateDoc(doc(db, 'promotions', promotionId), {
            isUsed: true,
            usedAt: serverTimestamp(),
            verifiedBy: auth.currentUser ? auth.currentUser.uid : 'anonymous',
            verifiedByEmail: auth.currentUser ? auth.currentUser.email : 'anonymous'
        });
        
        console.log('優惠券已成功核銷');
        
        // 顯示成功消息
        showSuccess(promotionData);
        
    } catch (error) {
        console.error('驗證優惠券出錯:', error);
        
        // 檢查是否是 App Check 錯誤
        if (error.code === 'permission-denied' || 
            error.message?.includes('app-check') || 
            error.message?.includes('token')) {
            showError('安全驗證失敗，無法核銷優惠券。這可能是由於 App Check 驗證問題，請刷新頁面重試。');
        } else {
            showError('驗證優惠券時發生錯誤: ' + error.message);
        }
    } finally {
        // 恢復驗證按鈕
        const verifyCodeBtn = document.getElementById('verifyCodeBtn');
        if (verifyCodeBtn) {
            verifyCodeBtn.disabled = false;
            verifyCodeBtn.innerHTML = '<i class="fas fa-check-circle me-2"></i>驗證優惠';
        }
    }
}

// 顯示錯誤訊息
function showError(message) {
    const resultElement = document.getElementById('verification-result');
    
    if (!resultElement) return;
    
    resultElement.className = 'verification-result error';
    resultElement.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-times-circle fa-2x text-danger me-3"></i>
            <div>
                <h5 class="mb-1">驗證失敗</h5>
                <p class="mb-0">${message}</p>
            </div>
        </div>
    `;
    resultElement.style.display = 'block';
    
    // 自動滾動到結果區域
    resultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// 顯示成功訊息
function showSuccess(promotionData) {
    const resultElement = document.getElementById('verification-result');
    
    if (!resultElement) return;
    
    // 獲取優惠內容
    const promotionTitle = promotionData.title || '未命名優惠';
    const promotionDesc = promotionData.description || '無詳細描述';
    const businessName = promotionData.businessName || '未知店家';
    const discountValue = promotionData.discountValue || '';
    
    // 構建優惠詳情
    let discountDetails = '';
    if (promotionData.discountType === 'percentage') {
        discountDetails = `${discountValue}% 折扣`;
    } else if (promotionData.discountType === 'fixed') {
        discountDetails = `NT$ ${discountValue} 折抵`;
    } else if (promotionData.discountType === 'freebie') {
        discountDetails = `贈送 ${discountValue}`;
    } else {
        discountDetails = promotionDesc;
    }
    
    // 設置結果內容
    resultElement.className = 'verification-result success';
    resultElement.innerHTML = `
        <div class="text-center mb-3">
            <i class="fas fa-check-circle fa-3x text-success"></i>
            <h4 class="mt-2">優惠核銷成功</h4>
        </div>
        
        <div class="card mb-3">
            <div class="card-body">
                <h5 class="card-title">${promotionTitle}</h5>
                <h6 class="card-subtitle mb-2 text-muted">${businessName}</h6>
                <p class="card-text">${promotionDesc}</p>
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <span class="badge bg-success p-2">${discountDetails}</span>
                    <small class="text-muted">核銷時間: ${formatDate(new Date())}</small>
                </div>
            </div>
        </div>
        
        <div class="text-center">
            <button class="btn btn-primary" onclick="window.location.reload()">
                <i class="fas fa-redo me-2"></i>繼續核銷其他優惠
            </button>
        </div>
    `;
    resultElement.style.display = 'block';
    
    // 自動滾動到結果區域
    resultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // 停止掃描器（如果有）
    if (scanner) {
        scanner.stop();
        hasActiveCamera = false;
    }
}

// 格式化日期
function formatDate(date) {
    if (!date) return '未知時間';
    
    return new Intl.DateTimeFormat('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date);
}

// 輸入清理函數
function sanitizeInput(input) {
    return input.replace(/[<>&"']/g, function(match) {
        return {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#39;'
        }[match];
    });
}

// 將重要函數暴露到全局範圍，以便從 HTML 中直接調用
window.initScanner = initScanner;
window.verifyPromotion = verifyPromotion;
window.showError = showError;
window.showSuccess = showSuccess;