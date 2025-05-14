// 全域變數
let currentUser = null;
let businessData = null;
let map = null;
let marker = null;
let geocoder = null;
let firebaseInitComplete = false;
let dataLoaded = false;
let initAttempts = 0;
let isIOS = false;

// 頁面載入初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM已加載，初始化儀表板...');
    
    // 檢測設備
    detectDevice();
    
    // 綁定登出按鈕
    initLogoutButtons();
    
    // 側邊欄切換
    initSidebar();
    
    // 表單驗證
    initFormValidation();
    
    // iOS 特定修復
    if (isIOS) {
        applyIOSFixes();
    }
    
    // 設置 Firebase 初始化檢查器
    checkFirebaseInitialization();
    
    // 添加錯誤處理
    setupErrorHandlers();
    
    // 會話超時處理
    setupSessionTimeoutHandler();
});

// 檢測設備類型
function detectDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    
    if (isIOS) {
        console.log('檢測到 iOS 設備，將應用特定修復...');
        document.body.classList.add('ios-device');
    }
}

// 檢查 Firebase 初始化
function checkFirebaseInitialization() {
    initAttempts++;
    console.log(`檢查 Firebase 初始化 (嘗試 ${initAttempts}/5)...`);
    
    // 檢查 Firebase 是否已初始化
    if (typeof window.auth !== 'undefined' && typeof window.db !== 'undefined') {
        console.log('Firebase 已初始化，設置認證狀態監聽器');
        firebaseInitComplete = true;
        
        // 設置認證狀態監聽器
        window.auth.onAuthStateChanged(handleAuthStateChanged);
    } else {
        // 如果還沒有初始化，等待事件或重試
        console.log('Firebase 未初始化，等待事件或重試');
        
        // 監聽 firebase-ready 事件
        document.addEventListener('firebase-ready', function() {
            console.log('收到 Firebase 初始化完成事件');
            firebaseInitComplete = true;
            
            // 設置認證狀態監聽器
            if (window.auth) {
                window.auth.onAuthStateChanged(handleAuthStateChanged);
            } else {
                console.error('Firebase Auth 未正確初始化');
                showAlert('加載錯誤，請重新整理頁面', 'danger');
            }
        }, { once: true });
        
        // 如果嘗試次數少於 5 次，設置重試
        if (initAttempts < 5) {
            setTimeout(checkFirebaseInitialization, 1000);
        } else {
            // 嘗試次數過多，顯示錯誤
            console.error('Firebase 初始化超時，請重新整理頁面');
            showPageError('Firebase 加載失敗', '無法初始化必要的資料庫連接。請嘗試重新整理頁面，或檢查您的網絡連接。');
        }
    }
}

// 顯示頁面錯誤
function showPageError(title, message) {
    const errorContainer = document.createElement('div');
    errorContainer.className = 'container py-5';
    errorContainer.innerHTML = `
        <div class="alert alert-danger text-center">
            <h4 class="alert-heading">${title}</h4>
            <p>${message}</p>
            <hr>
            <button class="btn btn-primary" onclick="window.location.reload()">重新載入頁面</button>
        </div>
    `;
    
    // 清空頁面並顯示錯誤
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.innerHTML = '';
        mainContent.appendChild(errorContainer);
    } else {
        document.body.innerHTML = '';
        document.body.appendChild(errorContainer);
    }
}

// 為 iOS 設備應用特定修復
function applyIOSFixes() {
    console.log('正在應用 iOS 特定修復...');
    
    // 修復 1: 防止 iOS 上的按鈕觸發表單提交
    document.querySelectorAll('button').forEach(button => {
        if (button.type !== 'submit') {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // 如果按鈕有 ID，觸發自定義事件以模擬點擊
                if (this.id) {
                    const customEvent = new CustomEvent('ios-click', { 
                        bubbles: true,
                        detail: { buttonId: this.id }
                    });
                    this.dispatchEvent(customEvent);
                }
            });
        }
    });
    
    // 監聽自定義事件，替代正常點擊
    document.addEventListener('ios-click', function(e) {
        const buttonId = e.detail.buttonId;
        console.log(`處理 iOS 按鈕點擊: ${buttonId}`);
        
        // 根據按鈕 ID 執行相應操作
        switch (buttonId) {
            case 'saveBusinessInfoBtn':
                saveBusinessInfo();
                break;
            case 'saveBusinessHoursBtn':
                saveBusinessHours();
                break;
            case 'saveLocationBtn':
                saveLocationInfo();
                break;
            case 'saveActivityTypesBtn':
                saveActivityTypes();
                break;
            case 'saveTagsBtn':
                updateBusinessTags();
                break;
            case 'createPromotionBtn':
                createPromotion();
                break;
            case 'searchLocationBtn':
                searchLocation();
                break;
            case 'logoutLink':
                performLogout();
                break;
            default:
                // 如果沒有特定處理，尋找對應的事件處理程序
                const handler = iosEventHandlers[buttonId];
                if (typeof handler === 'function') {
                    handler();
                }
        }
    });
    
    // 修復 2: 解決 iOS 上的點擊延遲問題
    document.documentElement.style.cursor = 'pointer';
    
    // 修復 3: 優化滾動行為
    document.querySelectorAll('.sidebar, .main-content').forEach(el => {
        el.style.webkitOverflowScrolling = 'touch';
    });
    
    // 修復 4: 修復 iOS 上的表單事件
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // 獲取表單 ID 或名稱
            const formId = this.id || 'unknown-form';
            console.log(`iOS 表單提交: ${formId}`);
            
            // 根據表單 ID 執行相應操作
            switch (formId) {
                case 'promotionForm':
                    createPromotion();
                    break;
                default:
                    console.log(`沒有為表單 ${formId} 定義處理程序`);
            }
        });
    });
}

// iOS 事件處理程序映射
const iosEventHandlers = {
    // 可以根據需要添加更多處理程序
    'addCategoryBtn': function() {
        const form = document.getElementById('addCategoryForm');
        if (form) {
            form.style.display = 'block';
        }
    },
    'cancelAddCategory': function() {
        const form = document.getElementById('addCategoryForm');
        if (form) {
            form.style.display = 'none';
        }
    },
    'resetPromotionForm': function() {
        const form = document.getElementById('promotionForm');
        if (form) {
            form.reset();
            initPromotionForm();
        }
    }
};

// 設置錯誤處理
function setupErrorHandlers() {
    // 全局錯誤處理
    window.addEventListener('error', function(event) {
        console.error('全局錯誤:', event.message, event);
        
        // 檢查是否是網絡相關錯誤
        if (event.message && (
            event.message.includes('network') || 
            event.message.includes('連接') ||
            event.message.includes('connection')
        )) {
            showAlert('網絡連接錯誤，請檢查您的網絡並重試', 'danger');
        }
    });
    
    // Promise 錯誤處理
    window.addEventListener('unhandledrejection', function(event) {
        console.error('未處理的 Promise 拒絕:', event.reason);
        
        // Firebase 錯誤處理
        if (event.reason && event.reason.code) {
            if (event.reason.code.includes('auth')) {
                showAlert('身份驗證錯誤，請重新登入', 'danger');
            } else if (event.reason.code.includes('firestore')) {
                showAlert('數據庫操作錯誤，請稍後再試', 'danger');
            }
        }
    });
}

// 處理認證狀態變更
function handleAuthStateChanged(user) {
    try {
        if (user) {
            currentUser = user;
            console.log('用戶已驗證:', user.email);
            
            // 延遲初始化其他功能，確保 Firebase 完全加載
            setTimeout(() => {
                initAfterAuth();
                loadBusinessData(true);
                initializeMenuMetadata(user.uid);
            }, 1000);
        } else {
            console.log('用戶未登入，重定向到登入頁面');
            
            // 防止無限重定向循環
            if (!sessionStorage.getItem('redirecting')) {
                sessionStorage.setItem('redirecting', 'true');
                window.location.href = 'business-login.html?redirect=true';
            }
        }
    } catch (error) {
        console.error('處理認證狀態變更時出錯:', error);
        showAlert('驗證狀態檢查錯誤，請重新整理頁面', 'danger');
    }
}

// 認證後初始化其他功能
function initAfterAuth() {
    try {
        console.log('初始化認證後功能...');
        
        // 商品類別管理
        initCategoryManagement();
        
        // 標籤輸入系統
        initTagsSystem();
        
        // 活動類型卡片選擇
        initActivityTypeCards();
        
        // 圖片上傳預覽
        initImageUploads();
        
        // 營業時間初始化
        initBusinessHours();
        
        // 綁定各個保存按鈕
        bindSaveButtons();
        
        // 綁定帳號設定表單
        bindAccountSettingsForm();
        
        // 初始化優惠表單
        initPromotionForm();
        
        // 初始化優惠管理模塊
        initPromotionsModule();
        
        console.log('認證後功能初始化完成');
    } catch (error) {
        console.error('認證後初始化時出錯:', error);
        showAlert('功能初始化錯誤，部分功能可能無法正常使用', 'warning');
    }
}

// 綁定保存按鈕
function bindSaveButtons() {
    try {
        // 店家基本資料保存按鈕
        const saveBusinessInfoBtn = document.getElementById('saveBusinessInfoBtn');
        if (saveBusinessInfoBtn) {
            saveBusinessInfoBtn.removeEventListener('click', saveBusinessInfo);
            saveBusinessInfoBtn.addEventListener('click', function(e) {
                if (e) e.preventDefault();
                saveBusinessInfo();
            });
            console.log('已綁定店家資料保存按鈕');
        }
        
        // 營業時間保存按鈕
        const saveBusinessHoursBtn = document.getElementById('saveBusinessHoursBtn');
        if (saveBusinessHoursBtn) {
            saveBusinessHoursBtn.removeEventListener('click', saveBusinessHours);
            saveBusinessHoursBtn.addEventListener('click', function(e) {
                if (e) e.preventDefault();
                saveBusinessHours();
            });
            console.log('已綁定營業時間保存按鈕');
        }
        
        // 地理位置保存按鈕
        const saveLocationBtn = document.getElementById('saveLocationBtn');
        if (saveLocationBtn) {
            saveLocationBtn.removeEventListener('click', saveLocationInfo);
            saveLocationBtn.addEventListener('click', function(e) {
                if (e) e.preventDefault();
                saveLocationInfo();
            });
            console.log('已綁定位置保存按鈕');
        }
        
        // 活動類型保存按鈕
        const saveActivityTypesBtn = document.getElementById('saveActivityTypesBtn');
        if (saveActivityTypesBtn) {
            saveActivityTypesBtn.removeEventListener('click', saveActivityTypes);
            saveActivityTypesBtn.addEventListener('click', function(e) {
                if (e) e.preventDefault();
                saveActivityTypes();
            });
            console.log('已綁定活動類型保存按鈕');
        }
        
        // 標籤保存按鈕
        const saveTagsBtn = document.getElementById('saveTagsBtn');
        if (saveTagsBtn) {
            saveTagsBtn.removeEventListener('click', updateBusinessTags);
            saveTagsBtn.addEventListener('click', function(e) {
                if (e) e.preventDefault();
                updateBusinessTags();
            });
            console.log('已綁定標籤保存按鈕');
        }
    } catch (error) {
        console.error('綁定保存按鈕時出錯:', error);
    }
}

// 登出按鈕初始化
function initLogoutButtons() {
    try {
        const logoutButtons = document.querySelectorAll('#logoutLink, a[href="#"][id="logoutLink"]');
        
        if (logoutButtons.length > 0) {
            logoutButtons.forEach(btn => {
                if (btn) {
                    // 移除現有事件監聽器
                    btn.removeEventListener('click', handleLogoutClick);
                    // 添加新事件監聽器
                    btn.addEventListener('click', handleLogoutClick);
                    console.log('已綁定登出按鈕:', btn);
                }
            });
        } else {
            console.warn('沒有找到登出按鈕');
        }
    } catch (error) {
        console.error('初始化登出按鈕時出錯:', error);
    }
}

// 登出按鈕點擊處理
function handleLogoutClick(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    performLogout();
}

// 執行登出
function performLogout() {
    console.log('開始登出流程...');
    
    // 顯示加載狀態
    const logoutButtons = document.querySelectorAll('#logoutLink, a[href="#"][id="logoutLink"]');
    logoutButtons.forEach(btn => {
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登出中...';
            btn.disabled = true;
            // 保存原始文本以便恢復
            btn.setAttribute('data-original-text', originalText);
        }
    });
    
    try {
        showPageLoading("登出中，請稍候...");
        
        // 檢查 Firebase 是否初始化
        if (!firebaseInitComplete) {
            console.warn('Firebase 未初始化，直接重定向');
            forceRedirect();
            return;
        }
        
        // 使用全局 auth 物件
        if (window.auth) {
            // 使用模組化方式登出
            window.auth.signOut().then(() => {
                logoutSuccess();
            }).catch(error => {
                logoutError(error);
            });
        } else if (window.firebase && window.firebase.auth) {
            // 使用全局 firebase 物件登出 (後備方案)
            window.firebase.auth().signOut().then(() => {
                logoutSuccess();
            }).catch(error => {
                logoutError(error);
            });
        } else {
            // 兩種方法都失敗，嘗試直接重定向
            console.error('找不到登出方法，嘗試直接重定向');
            forceRedirect();
        }
    } catch (error) {
        console.error('登出過程中發生錯誤:', error);
        logoutError(error);
    }
    
    // 設置超時，防止無限等待
    setTimeout(() => {
        forceRedirect();
    }, 5000);
}

// 登出成功處理
function logoutSuccess() {
    console.log('登出成功');
    
    // 清除本地存儲
    try {
        localStorage.removeItem('redirected_to_dashboard');
        localStorage.removeItem('business_id');
        sessionStorage.removeItem('redirecting');
    } catch (e) {
        console.warn('清除存儲時出錯:', e);
    }
    
    // 顯示成功消息
    hidePageLoading();
    showAlert('登出成功，正在跳轉...', 'success');
    
    // 延遲重定向以顯示訊息
    setTimeout(() => {
        // 添加時間戳防止快取
        window.location.href = 'business-login.html?t=' + new Date().getTime();
    }, 1500);
}

// 登出錯誤處理
function logoutError(error) {
    console.error('登出時發生錯誤:', error);
    
    // 恢復按鈕狀態
    const logoutButtons = document.querySelectorAll('#logoutLink, a[href="#"][id="logoutLink"]');
    logoutButtons.forEach(btn => {
        if (btn) {
            const originalText = btn.getAttribute('data-original-text') || '<i class="fas fa-sign-out-alt"></i> 登出';
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });
    
    // 顯示錯誤訊息
    hidePageLoading();
    showAlert('登出失敗，請重新嘗試', 'danger');
}

// 強制重定向（最後的後備方案）
function forceRedirect() {
    console.warn('強制重定向到登入頁面');
    hidePageLoading();
    showAlert('重新導向到登入頁面...', 'warning');
    
    // 清理會話標記以防止循環
    sessionStorage.removeItem('redirecting');
    
    setTimeout(() => {
        try {
            document.cookie = ""; // 清除 cookies
        } catch (e) {
            console.warn('清除 cookies 時出錯:', e);
        }
        window.location.href = 'business-login.html?forced=true&t=' + new Date().getTime();
    }, 1000);
}

// 加載店家資料
async function loadBusinessData(force = false) {
    try {
        // 如果數據已經加載，並且不是強制重新加載，則跳過
        if (dataLoaded && !force) {
            console.log("店家資料已加載，跳過重複加載");
            return businessData;
        }
        
        showPageLoading("載入店家資料中...");
        
        // 確保 Firebase 已初始化
        if (!firebaseInitComplete) {
            console.log("等待 Firebase 初始化...");
            await new Promise((resolve) => {
                const checkInit = () => {
                    if (firebaseInitComplete) {
                        resolve();
                    } else {
                        setTimeout(checkInit, 300);
                    }
                };
                checkInit();
            });
        }
        
        // 確保用戶已登入
        if (!currentUser || !currentUser.uid) {
            console.error("未找到用戶資料");
            showAlert("請重新登入", "danger");
            hidePageLoading();
            setTimeout(() => {
                window.location.href = 'business-login.html?redirect=true';
            }, 2000);
            return null;
        }
        
        console.log("開始加載商家資料...");
        
        // 檢查 DB 是否已初始化
        const db = window.db;
        if (!db) {
            console.error("Firestore 未正確初始化");
            showAlert("資料庫連接錯誤，請重新整理頁面", "danger");
            hidePageLoading();
            return null;
        }
        
        // 加載商家資料
        try {
            const businessDoc = await db.collection("businesses").doc(currentUser.uid).get();
            
            if (businessDoc.exists) {
                businessData = businessDoc.data();
                console.log("成功從資料庫載入商家資料");
                
                // 更新 UI 顯示
                updateAllUI();
                
                // 特別處理營業時間
                ensureBusinessHoursExist();
                
                // 加載商品項目
                loadMenuItems();
                
                // 加載優惠資訊
                loadPromotions();
                
                // 設置資料加載標記
                dataLoaded = true;
                
                showAlert("店家資料已載入完成", "success");
            } else {
                // 店家資料不存在，可能是新用戶
                console.log("店家資料不存在，創建新資料");
                showAlert("歡迎使用店家管理平台！請完善您的店家資料。", "info");
                
                // 創建新的店家文檔
                await initializeNewBusiness();
                
                // 設置預設營業時間
                ensureBusinessHoursExist();
                
                // 設置資料加載標記
                dataLoaded = true;
            }
        } catch (dbError) {
            console.error("Firestore 查詢錯誤:", dbError);
            showAlert("讀取資料時發生錯誤: " + dbError.message, "danger");
            hidePageLoading();
            return null;
        }
        
        hidePageLoading();
        
        // 確保只有當地圖容器存在時才初始化Google Maps
        if (document.getElementById('mapContainer')) {
            // 檢查API密鑰問題
            if (!window.googleMapsInitialized) {
                loadGoogleMapsAPI();
                window.googleMapsInitialized = true;
            }
        }
        
        // 確保地址顯示正確
        const formattedAddressField = document.getElementById('formattedAddress');
        if (formattedAddressField && businessData && businessData.address) {
            formattedAddressField.value = businessData.address;
        }
        
        return businessData;
    } catch (error) {
        console.error("載入店家資料錯誤:", error);
        showAlert("載入資料時發生錯誤，請稍後再試", "danger");
        hidePageLoading();
        return null;
    }
}

// 初始化優惠表單
function initPromotionForm() {
    console.log("初始化優惠表單");
    const promotionForm = document.getElementById('promotionForm');
    
    // 清除所有現有的事件監聽器(如果有的話)
    const createBtn = document.getElementById('createPromotionBtn');
    if (createBtn) {
        // 先移除現有的監聽器
        createBtn.removeEventListener('click', createPromotion);
        // 複製按鈕，移除所有事件
        const newBtn = createBtn.cloneNode(true);
        createBtn.parentNode.replaceChild(newBtn, createBtn);
    }
    
    if (promotionForm) {
        // 重置表單以清除可能的狀態
        promotionForm.reset();
        
        // 確保表單不會自動提交
        promotionForm.onsubmit = function(e) { 
            if (e) e.preventDefault(); 
            return false;
        };
        
        // 設置當前日期為默認開始日期
        const promotionStart = document.getElementById('promotionStart');
        const today = new Date();
        if (promotionStart) {
            promotionStart.value = formatDateForInput(today);
        }
        
        // 設置默認結束日期為30天後
        const promotionEnd = document.getElementById('promotionEnd');
        if (promotionEnd) {
            const endDate = new Date();
            endDate.setDate(today.getDate() + 30);
            promotionEnd.value = formatDateForInput(endDate);
        }
        
        // 獲取新的按鈕引用並重新添加事件
        const newCreateBtn = document.getElementById('createPromotionBtn');
        if (newCreateBtn) {
            console.log("正在綁定建立優惠按鈕點擊事件");
            newCreateBtn.addEventListener('click', function(e) {
                if (e) e.preventDefault();
                console.log("點擊建立優惠按鈕");
                createPromotion();
            });
        } else {
            console.error("找不到建立優惠按鈕 (ID: createPromotionBtn)");
        }
        
        // 綁定重置按鈕
        const resetBtn = document.getElementById('resetPromotionForm');
        if (resetBtn) {
            // 移除現有的事件監聽器
            resetBtn.removeEventListener('click', resetPromotionForm);
            
            // 添加新的事件監聽器
            resetBtn.addEventListener('click', function(e) {
                if (e) e.preventDefault();
                resetPromotionForm();
            });
        }
    } else {
        console.error("找不到優惠表單 (ID: promotionForm)");
    }
    
    // 綁定搜索按鈕
    const searchBtn = document.getElementById('searchPromotionBtn');
    if (searchBtn) {
        // 移除現有的事件監聽器
        searchBtn.removeEventListener('click', searchPromotions);
        
        // 添加新的事件監聽器
        searchBtn.addEventListener('click', function(e) {
            if (e) e.preventDefault();
            searchPromotions();
        });
    }
    
    // 綁定過濾下拉框
    const filterSelect = document.getElementById('promotionFilter');
    if (filterSelect) {
        // 移除現有的事件監聽器
        filterSelect.removeEventListener('change', searchPromotions);
        
        // 添加新的事件監聽器
        filterSelect.addEventListener('change', searchPromotions);
    }
    
    // 綁定搜索框
    const searchInput = document.getElementById('promotionSearch');
    if (searchInput) {
        // 移除現有的事件監聽器
        searchInput.removeEventListener('keyup', handleSearchKeyUp);
        
        // 添加新的事件監聽器
        searchInput.addEventListener('keyup', handleSearchKeyUp);
    }
}

// 處理搜索框回車事件
function handleSearchKeyUp(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        searchPromotions();
    }
}

// 重置優惠表單
function resetPromotionForm() {
    const form = document.getElementById('promotionForm');
    if (!form) return;
    
    form.reset();
    
    // 重新設置日期欄位
    const promotionStart = document.getElementById('promotionStart');
    if (promotionStart) {
        promotionStart.value = formatDateForInput(new Date());
    }
    
    const promotionEnd = document.getElementById('promotionEnd');
    if (promotionEnd) {
        const newEndDate = new Date();
        newEndDate.setDate(new Date().getDate() + 30);
        promotionEnd.value = formatDateForInput(newEndDate);
    }
    
    console.log("優惠表單已重置");
}

// 格式化日期為input[type=date]接受的格式
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 建立新優惠
async function createPromotion() {
    // 先防止表單提交引起的頁面重新加載
    const form = document.getElementById('promotionForm');
    if (form) {
        form.onsubmit = function() { return false; };
    }
    
    try {
        showPageLoading("正在建立優惠...");
        
        // 驗證用戶是否登入
        if (!currentUser || !currentUser.uid) {
            hidePageLoading();
            showAlert("請先登入", "danger");
            return;
        }
        
        // 檢查 Firebase 是否初始化
        if (!firebaseInitComplete || !window.db) {
            hidePageLoading();
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        // 收集表單數據
        console.log("收集表單數據");
        const title = document.getElementById('promotionTitle')?.value?.trim();
        const type = document.getElementById('promotionType')?.value;
        const description = document.getElementById('promotionDesc')?.value?.trim();
        const startDateStr = document.getElementById('promotionStart')?.value;
        const endDateStr = document.getElementById('promotionEnd')?.value;
        const targetAudienceEl = document.querySelector('input[name="targetAudience"]:checked');
        const targetAudience = targetAudienceEl ? targetAudienceEl.value : 'all';
        const statsEnabledEl = document.getElementById('statsEnabled');
        const statsEnabled = statsEnabledEl ? statsEnabledEl.checked : false;
        
        // 驗證必填字段
        if (!title || !type || !description || !startDateStr || !endDateStr) {
            hidePageLoading();
            showAlert("請填寫所有必填字段", "warning");
            return;
        }
        
        // 解析日期
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999); // 設置結束日期為當天結束
        
        // 驗證日期
        if (startDate > endDate) {
            hidePageLoading();
            showAlert("結束日期必須晚於開始日期", "warning");
            return;
        }
        
        // 準備優惠數據
        const promotionData = {
            businessId: currentUser.uid,
            title: title,
            type: type,
            description: description,
            startDate: window.firebase.firestore.Timestamp.fromDate(startDate),
            endDate: window.firebase.firestore.Timestamp.fromDate(endDate),
            targetAudience: targetAudience,
            isActive: true,
            viewCount: 0,
            usageCount: 0,
            statsEnabled: statsEnabled,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 保存到Firestore
        console.log("保存資料到 Firestore");
        const docRef = await window.db.collection("promotions").add(promotionData);
        console.log("優惠已創建，ID:", docRef.id);
        
        // 重置表單
        if (form) {
            form.reset();
        }
        
        // 重新設置日期欄位
        const promotionStart = document.getElementById('promotionStart');
        if (promotionStart) {
            promotionStart.value = formatDateForInput(new Date());
        }
        
        const promotionEnd = document.getElementById('promotionEnd');
        if (promotionEnd) {
            const newEndDate = new Date();
            newEndDate.setDate(new Date().getDate() + 30);
            promotionEnd.value = formatDateForInput(newEndDate);
        }
        
        // 重新載入優惠列表
        await loadPromotions();
        
        hidePageLoading();
        showAlert("優惠已成功創建", "success");
        
        // 重新初始化表單以確保事件處理器重新綁定
        setTimeout(() => {
            initPromotionForm();
        }, 500);
        
    } catch (error) {
        console.error("創建優惠失敗:", error);
        console.error("錯誤詳情:", error.stack);
        hidePageLoading();
        showAlert(`創建優惠失敗: ${error.message || '伺服器錯誤'}`, "danger");
        
        // 嘗試重新初始化 Firebase
        if (error.code && (error.code.includes('auth') || error.code.includes('firestore'))) {
            setTimeout(() => {
                checkFirebaseInitialization();
            }, 1000);
        }
    }
}

// 搜索優惠
async function searchPromotions() {
    try {
        showPageLoading("搜尋優惠中...");
        
        // 檢查 Firebase 是否初始化
        if (!firebaseInitComplete || !window.db || !currentUser) {
            hidePageLoading();
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        const searchText = document.getElementById('promotionSearch')?.value?.trim().toLowerCase() || '';
        const filterValue = document.getElementById('promotionFilter')?.value || 'all';
        
        // 獲取所有優惠
        const promotionsSnapshot = await window.db.collection("promotions")
            .where("businessId", "==", currentUser.uid)
            .orderBy("createdAt", "desc")
            .get();
        
        const allPromotions = [];
        promotionsSnapshot.forEach(doc => {
            allPromotions.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // 根據搜索文本和過濾條件過濾優惠
        const filteredPromotions = allPromotions.filter(promotion => {
            // 首先過濾搜索文本
            const matchesSearchText = searchText === '' || 
                (promotion.title && promotion.title.toLowerCase().includes(searchText)) ||
                (promotion.description && promotion.description.toLowerCase().includes(searchText));
            
            // 然後過濾狀態
            const isActive = isPromotionActive(promotion);
            const matchesFilter = 
                filterValue === 'all' || 
                (filterValue === 'active' && isActive) || 
                (filterValue === 'inactive' && !isActive);
            
            return matchesSearchText && matchesFilter;
        });
        
        // 更新UI
        updatePromotionsList(filteredPromotions);
        hidePageLoading();
    } catch (error) {
        console.error("搜索優惠失敗:", error);
        hidePageLoading();
        showAlert(`搜索優惠失敗: ${error.message || '未知錯誤'}`, "danger");
    }
}

// 加載所有優惠
async function loadPromotions() {
    try {
        console.log("開始加載優惠列表");
        
        if (!window.db || !currentUser) {
            console.error("Firestore或用戶未初始化");
            return;
        }
        
        // 確保優惠管理區域可見
        const promotionsSection = document.getElementById('promotions-section');
        if (promotionsSection) {
            // 確保顯示一些默認內容
            const promotionsTableBody = document.getElementById('promotionsTableBody');
            if (promotionsTableBody) {
                promotionsTableBody.innerHTML = `
                    <tr class="text-center">
                        <td colspan="8" class="py-4">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">載入中...</span>
                            </div>
                            <p class="mt-2 text-muted">載入優惠列表...</p>
                        </td>
                    </tr>
                `;
            }
            
            // 初始化統計數據
            if (document.getElementById('totalPromotionUsage')) {
                document.getElementById('totalPromotionUsage').textContent = "0";
            }
            if (document.getElementById('avgDailyUsage')) {
                document.getElementById('avgDailyUsage').textContent = "0";
            }
            if (document.getElementById('appGeneratedCustomers')) {
                document.getElementById('appGeneratedCustomers').textContent = "0";
            }
            if (document.getElementById('mostPopularPromotion')) {
                document.getElementById('mostPopularPromotion').textContent = "-";
            }
            
            // 只有在必要時初始化圖表
            const chartElement = document.getElementById('promotionUsageChart');
            if (chartElement) {
                initEmptyPromotionChart();
            }
        }
        
        // 查詢優惠活動
        const promotionsSnapshot = await db.collection("promotions")
            .where("businessId", "==", currentUser.uid)
            .orderBy("createdAt", "desc")
            .get();
        
        if (!promotionsSnapshot.empty) {
            // 有優惠數據，更新表格
            const promotions = [];
            promotionsSnapshot.forEach(doc => {
                promotions.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log(`找到 ${promotions.length} 個優惠活動`);
            
            // 更新UI
            updatePromotionsList(promotions);
        } else {
            console.log("沒有找到優惠活動");
            // 顯示空列表
            updatePromotionsList([]);
        }
    } catch (error) {
        console.error("載入優惠活動錯誤:", error);
        showAlert("載入優惠活動失敗，請稍後再試", "danger");
    }
}

// 初始化空的優惠圖表
function initEmptyPromotionChart() {
    const chartElement = document.getElementById('promotionUsageChart');
    if (!chartElement) return;
    
    // 檢查是否已存在圖表，使用更可靠的判斷方式
    if (window.promotionChart) {
        try {
            if (typeof window.promotionChart.destroy === 'function') {
                window.promotionChart.destroy();
            } else if (typeof window.promotionChart.dispose === 'function') {
                window.promotionChart.dispose();
            }
        } catch (e) {
            console.warn("清理舊圖表時出錯:", e);
        }
        // 確保清空圖表元素
        chartElement.innerHTML = '';
    }
    
    // 確保 ApexCharts 庫已加載
    if (typeof ApexCharts === 'undefined') {
        console.warn("ApexCharts 庫未加載，跳過圖表初始化");
        chartElement.innerHTML = `
            <div class="alert alert-warning text-center">
                <i class="fas fa-chart-line me-2"></i> 圖表元件未載入，請重新整理頁面
            </div>
        `;
        return;
    }
    
    try {
        // 創建基本圖表
        window.promotionChart = new ApexCharts(chartElement, {
            series: [{
                name: '使用次數',
                data: [0, 0, 0, 0, 0, 0, 0]
            }],
            chart: {
                height: 300,
                type: 'line',
                zoom: {
                    enabled: false
                },
                toolbar: {
                    show: false
                },
                fontFamily: "'Noto Sans TC', sans-serif",
                background: 'transparent'
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: 3,
                colors: ['#9D7F86']
            },
            grid: {
                row: {
                    colors: ['#f8f9fa', 'transparent'],
                    opacity: 0.5
                }
            },
            xaxis: {
                categories: ['7天前', '6天前', '5天前', '4天前', '3天前', '昨天', '今天'],
            },
            tooltip: {
                y: {
                    formatter: function (val) {
                        return val + " 次";
                    }
                }
            },
            colors: ['#9D7F86']
        });
        
        // 確保 render 方法存在
        if (typeof window.promotionChart.render === 'function') {
            window.promotionChart.render();
        } else {
            console.warn("ApexCharts 對象缺少 render 方法");
        }
    } catch (error) {
        console.error("初始化圖表時出錯:", error);
        chartElement.innerHTML = `
            <div class="alert alert-danger text-center">
                <i class="fas fa-exclamation-circle me-2"></i> 圖表初始化失敗: ${error.message}
            </div>
        `;
    }
}

// 更新優惠
async function updatePromotion(promotionId, updatedData) {
    try {
        showPageLoading("更新優惠中...");
        
        // 檢查 Firebase 是否初始化
        if (!firebaseInitComplete || !window.db) {
            hidePageLoading();
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        // 添加更新時間
        updatedData.updatedAt = window.firebase.firestore.FieldValue.serverTimestamp();
        
        // 更新Firestore
        await window.db.collection("promotions").doc(promotionId).update(updatedData);
        
        // 重新載入優惠列表
        await loadPromotions();
        
        hidePageLoading();
        showAlert("優惠已成功更新", "success");
    } catch (error) {
        console.error("更新優惠失敗:", error);
        hidePageLoading();
        showAlert(`更新優惠失敗: ${error.message || '未知錯誤'}`, "danger");
    }
}

// 處理查看優惠按鈕點擊
function handleViewPromotion(e) {
    if (e) e.preventDefault();
    const promotionId = this.getAttribute('data-id');
    if (promotionId) {
        viewPromotion(promotionId);
    }
}

// 處理編輯優惠按鈕點擊
function handleEditPromotion(e) {
    if (e) e.preventDefault();
    const promotionId = this.getAttribute('data-id');
    if (promotionId) {
        editPromotion(promotionId);
    }
}

// 處理刪除優惠按鈕點擊
function handleDeletePromotion(e) {
    if (e) e.preventDefault();
    const promotionId = this.getAttribute('data-id');
    if (promotionId && confirm("確定要刪除此優惠嗎？")) {
        deletePromotion(promotionId);
    }
}

// 查看優惠詳情
function viewPromotion(promotionId) {
    try {
        // 檢查 Firebase 是否初始化
        if (!firebaseInitComplete || !window.db) {
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        // 獲取優惠數據
        window.db.collection("promotions").doc(promotionId).get()
            .then(doc => {
                if (!doc.exists) {
                    showAlert("找不到此優惠", "warning");
                    return;
                }
                
                const promotion = doc.data();
                
                // 創建查看模態框
                showViewPromotionModal(promotionId, promotion);
                
                // 增加查看次數
                incrementViewCount(promotionId);
            })
            .catch(error => {
                console.error("獲取優惠數據失敗:", error);
                showAlert("獲取優惠數據失敗", "danger");
            });
    } catch (error) {
        console.error("查看優惠詳情時出錯:", error);
        showAlert("查看優惠時出錯", "danger");
    }
}

// 顯示查看優惠模態框
function showViewPromotionModal(promotionId, promotion) {
    // 檢查是否已存在相同ID的模態框
    let modalElement = document.getElementById(`viewModal-${promotionId}`);
    if (modalElement) {
        try {
            // 如果存在，嘗試使用 Bootstrap 方法顯示
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
            return;
        } catch (error) {
            console.error("顯示現有模態框時出錯:", error);
            modalElement.remove();
            modalElement = null;
        }
    }
    
    try {
        // 格式化日期
        const startDate = promotion.startDate instanceof Date ? 
            promotion.startDate : 
            new Date(promotion.startDate.seconds * 1000);
        
        const endDate = promotion.endDate instanceof Date ? 
            promotion.endDate : 
            new Date(promotion.endDate.seconds * 1000);
        
        const formatDate = (date) => {
            return date.toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };
        
        // 獲取狀態
        const isActive = isPromotionActive(promotion);
        const statusClass = isActive ? 'success' : 'secondary';
        const statusText = isActive ? '進行中' : '已結束';
        
        // 創建模態框HTML
        const modalHTML = `
            <div class="modal fade" id="viewModal-${promotionId}" tabindex="-1" aria-labelledby="viewModalLabel-${promotionId}" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-light">
                            <h5 class="modal-title" id="viewModalLabel-${promotionId}">
                                <i class="fas fa-ticket-alt me-2 text-primary"></i>${promotion.title || '未命名優惠'}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row mb-4">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <h6 class="text-muted mb-2">優惠類型</h6>
                                        <p class="lead">${formatPromotionType(promotion.type)}</p>
                                    </div>
                                    <div class="mb-3">
                                        <h6 class="text-muted mb-2">適用對象</h6>
                                        <p class="lead">${formatTargetAudience(promotion.targetAudience)}</p>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <h6 class="text-muted mb-2">有效期間</h6>
                                        <p class="lead">${formatDate(startDate)} - ${formatDate(endDate)}</p>
                                    </div>
                                    <div class="mb-3">
                                        <h6 class="text-muted mb-2">狀態</h6>
                                        <p><span class="badge bg-${statusClass} px-3 py-2">${statusText}</span></p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mb-4">
                                <h6 class="text-muted mb-2">優惠詳情</h6>
                                <div class="p-3 bg-light rounded">
                                    <p>${promotion.description || '無優惠詳情'}</p>
                                </div>
                            </div>
                            
                            <div class="row mb-3">
                                <div class="col-6">
                                    <div class="card text-center p-3">
                                        <h3 class="mb-0">${promotion.viewCount || 0}</h3>
                                        <p class="text-muted mb-0">瀏覽次數(此為模擬)</p>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="card text-center p-3">
                                        <h3 class="mb-0">${promotion.usageCount || 0}</h3>
                                        <p class="text-muted mb-0">使用次數(此為模擬)</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                此優惠在APP上向用戶顯示，無需掃描QR碼或輸入驗證碼。用戶直接到店時能直接使用此優惠。
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">關閉</button>
                            <button type="button" class="btn btn-primary" id="editBtn-${promotionId}">
                                <i class="fas fa-edit me-1"></i>編輯優惠
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加模態框到頁面
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer);
        
        // 顯示模態框
        modalElement = document.getElementById(`viewModal-${promotionId}`);
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        
        // 綁定編輯按鈕
        const editBtn = document.getElementById(`editBtn-${promotionId}`);
        if (editBtn) {
            editBtn.addEventListener('click', function() {
                // 關閉查看模態框
                modal.hide();
                
                // 打開編輯模態框
                setTimeout(() => {
                    editPromotion(promotionId);
                }, 500);
            });
        }
    } catch (error) {
        console.error("顯示優惠詳情模態框時出錯:", error);
        showAlert("無法顯示優惠詳情，請重試", "danger");
    }
}

// 增加查看次數
async function incrementViewCount(promotionId) {
    try {
        // 檢查 Firebase 是否初始化
        if (!firebaseInitComplete || !window.db) {
            console.warn("Firebase 尚未準備好，跳過增加查看次數");
            return;
        }
        
        const promotionRef = window.db.collection("promotions").doc(promotionId);
        
        // 使用FieldValue.increment自動增加計數
        await promotionRef.update({
            viewCount: window.firebase.firestore.FieldValue.increment(1),
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log("優惠查看次數已增加");
    } catch (error) {
        console.error("增加查看次數失敗:", error);
    }
}

// 增加使用次數
async function incrementUsageCount(promotionId) {
    try {
        // 檢查 Firebase 是否初始化
        if (!firebaseInitComplete || !window.db) {
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        const promotionRef = window.db.collection("promotions").doc(promotionId);
        
        // 使用FieldValue.increment自動增加計數
        await promotionRef.update({
            usageCount: window.firebase.firestore.FieldValue.increment(1),
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log("優惠使用次數已增加");
        
        // 重新載入優惠列表
        await loadPromotions();
    } catch (error) {
        console.error("增加使用次數失敗:", error);
        showAlert("增加使用次數失敗", "danger");
    }
}

// 更新優惠列表 UI
function updatePromotionsList(promotions) {
    try {
        const promotionsTableBody = document.getElementById('promotionsTableBody');
        if (!promotionsTableBody) return;
        
        // 如果沒有優惠，顯示空狀態
        if (!promotions || promotions.length === 0) {
            promotionsTableBody.innerHTML = `
                <tr class="text-center">
                    <td colspan="8" class="py-4">
                        <div class="text-center">
                            <i class="fas fa-ticket-alt fa-3x mb-3 text-muted"></i>
                            <p class="text-muted">尚無優惠活動，請點擊「建立優惠」按鈕創建您的第一個優惠活動</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // 更新數量標籤
        const activeCount = promotions.filter(p => isPromotionActive(p)).length;
        const inactiveCount = promotions.length - activeCount;
        
        const activeCountBadge = document.querySelector('.promotion-active-count');
        const inactiveCountBadge = document.querySelector('.promotion-inactive-count');
        
        if (activeCountBadge) activeCountBadge.textContent = `${activeCount} 個進行中`;
        if (inactiveCountBadge) inactiveCountBadge.textContent = `${inactiveCount} 個已結束`;
        
        // 生成表格內容
        let tableContent = '';
        
        promotions.forEach(promotion => {
            const isActive = isPromotionActive(promotion);
            const statusClass = isActive ? 'active' : 'inactive';
            const statusText = isActive ? '進行中' : '已結束';
            
            tableContent += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="promotion-icon rounded-circle bg-light p-2 me-2">
                                <i class="fas fa-ticket-alt text-primary"></i>
                            </div>
                            <div>
                                <span class="d-block fw-bold">${promotion.title || '未命名優惠'}</span>
                                <small class="text-muted">${formatPromotionType(promotion.type)}</small>
                            </div>
                        </div>
                    </td>
                    <td>${formatPromotionType(promotion.type)}</td>
                    <td>${formatTargetAudience(promotion.targetAudience)}</td>
                    <td>${formatDateRange(promotion.startDate, promotion.endDate)}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td class="text-center">${promotion.viewCount || 0}</td>
                    <td class="text-center">${promotion.usageCount || 0}</td>
                    <td>
                        <div class="btn-group">
                            <button type="button" class="btn btn-sm btn-outline-primary view-promotion" data-id="${promotion.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-secondary edit-promotion" data-id="${promotion.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-danger delete-promotion" data-id="${promotion.id}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        promotionsTableBody.innerHTML = tableContent;
        
        // 添加事件監聽器
        addPromotionEventListeners();
        
        // 更新優惠使用統計圖表
        updatePromotionStatsChart(promotions);
    } catch (error) {
        console.error("更新優惠列表UI時出錯:", error);
        
        const promotionsTableBody = document.getElementById('promotionsTableBody');
        if (promotionsTableBody) {
            promotionsTableBody.innerHTML = `
                <tr class="text-center">
                    <td colspan="8" class="py-4">
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle me-2"></i>
                            更新優惠列表時發生錯誤: ${error.message}
                        </div>
                    </td>
                </tr>
            `;
        }
    }
}

// 更新優惠統計圖表
function updatePromotionStatsChart(promotions) {
    // 更新圖表
    if (window.promotionChart && typeof ApexCharts !== 'undefined') {
        try {
            // 獲取當前日期
            const now = new Date();
            
            // 計算過去7天日期
            const dates = [];
            const usageCounts = [];
            
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(now.getDate() - i);
                dates.push(formatShortDate(date));
                usageCounts.push(0); // 初始化為0
            }
            
            // 遍歷所有優惠，統計每天使用次數
            let totalUsage = 0;
            
            // 使用隨機數據展示
            for (let i = 0; i < usageCounts.length; i++) {
                usageCounts[i] = Math.floor(Math.random() * 5); // 隨機生成0-4的數字
                totalUsage += usageCounts[i];
            }
            
            // 更新圖表數據
            window.promotionChart.updateOptions({
                xaxis: {
                    categories: dates
                }
            });
            
            window.promotionChart.updateSeries([{
                name: '使用次數',
                data: usageCounts
            }]);
            
            // 更新統計數據
            updateStatElement('totalPromotionUsage', totalUsage);
            updateStatElement('avgDailyUsage', (totalUsage / 7).toFixed(1));
            updateStatElement('appGeneratedCustomers', totalUsage);
            
            // 找出最熱門優惠
            let maxUsage = 0;
            let popularPromotion = "-";
            
            promotions.forEach(promotion => {
                if (promotion.usageCount > maxUsage) {
                    maxUsage = promotion.usageCount;
                    popularPromotion = promotion.title;
                }
            });
            
            updateStatElement('mostPopularPromotion', popularPromotion);
        } catch (error) {
            console.error("更新圖表失敗:", error);
        }
    }
}

// 更新統計元素
function updateStatElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

// 格式化簡短日期
function formatShortDate(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 刪除優惠
async function deletePromotion(promotionId) {
    try {
        showPageLoading("刪除優惠中...");
        
        // 檢查 Firebase 是否初始化
        if (!firebaseInitComplete || !window.db) {
            hidePageLoading();
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        await window.db.collection("promotions").doc(promotionId).delete();
        
        // 重新加載優惠列表
        await loadPromotions();
        
        hidePageLoading();
        showAlert("優惠已成功刪除", "success");
    } catch (error) {
        console.error("刪除優惠失敗:", error);
        hidePageLoading();
        showAlert(`刪除優惠失敗: ${error.message || '未知錯誤'}`, "danger");
    }
}

// 初始化優惠管理模塊
function initPromotionsModule() {
    console.log("初始化優惠管理模塊");
    
    // 初始化表單
    initPromotionForm();
    
    // 載入優惠列表
    loadPromotions();
    
    // 添加調試日誌
    console.log("優惠管理模塊初始化完成，表單和事件處理器已設置");

    // 綁定圖表時間範圍按鈕
    const periodButtons = document.querySelectorAll('.btn-group [data-period]');
    periodButtons.forEach(button => {
        // 移除現有事件監聽器
        button.removeEventListener('click', handlePeriodButtonClick);
        
        // 添加新事件監聽器
        button.addEventListener('click', handlePeriodButtonClick);
    });
}

// 處理圖表時間範圍按鈕點擊
function handlePeriodButtonClick(e) {
    // 移除其他按鈕的active類
    const periodButtons = document.querySelectorAll('.btn-group [data-period]');
    periodButtons.forEach(btn => btn.classList.remove('active'));
    
    // 添加當前按鈕的active類
    this.classList.add('active');
    
    // 獲取時間範圍
    const period = parseInt(this.getAttribute('data-period')) || 7;
    
    // 更新圖表
    console.log(`切換圖表時間範圍為 ${period} 天`);
    
    // 臨時顯示提示
    showAlert(`已切換為${period}天數據統計`, "info");
}

function ensureBusinessHoursExist() {
    console.log("初始化營業時間區域...");
    
    // 1. 先找到營業時間卡片
    const businessHoursCard = document.querySelector('#profile-section .dashboard-card');
    if (!businessHoursCard) {
        console.error("找不到營業時間卡片");
        return;
    }
    
    // 2. 確保卡片內容區域存在
    const cardBody = businessHoursCard.querySelector('.card-body');
    if (!cardBody) {
        console.error("找不到卡片內容區域");
        return;
    }
    
    // 3. 檢查營業時間容器是否存在，如果不存在，創建一個
    let businessHoursContainer = document.getElementById('businessHoursContainer');
    if (!businessHoursContainer) {
        console.log("創建營業時間容器");
        businessHoursContainer = document.createElement('div');
        businessHoursContainer.id = 'businessHoursContainer';
        businessHoursContainer.className = 'row mt-3';
        cardBody.appendChild(businessHoursContainer);
    } else {
        // 清空既有內容
        businessHoursContainer.innerHTML = '';
    }
    
    // 4. 創建營業時間 UI - 確保只創建一次
    const hourSelectionDivs = createBusinessHoursUI(businessHoursContainer);
    
    // 5. 設置營業時間數據
    if (businessData && businessData.openingHours && businessData.openingHours.length > 0) {
        console.log("設置已有的營業時間");
        updateOpeningHours(businessData.openingHours);
    } else {
        console.log("設置預設營業時間");
        initDefaultOpeningHours();
    }
}

function updateAllUI() {
    try {
        // 更新導航欄用戶資訊
        updateHeaderInfo();
        
        // 更新基本資料欄位
        updateBusinessFormFields();
        
        // 更新店家主圖
        updateBusinessImage();
        
        // 更新活動類型
        updateActivityTypesUI();
        
        // 更新標籤
        updateTagsUI();
        
        // 更新環境照片
        updateEnvironmentImages();
        
        // 更新地理位置
        updateLocationFields();
        
        // 更新帳號設定UI
        updateAccountSettingsUI();
        
        console.log("所有 UI 元素已更新");
    } catch (error) {
        console.error("更新 UI 時出錯:", error);
        showAlert("更新用戶界面時出錯，某些資料可能無法正確顯示", "warning");
    }
}

// 更新導航欄用戶資訊
function updateHeaderInfo() {
    try {
        const businessNameElement = document.getElementById("businessName");
        const businessImageElement = document.getElementById("businessImage");
        
        if (businessNameElement) {
            businessNameElement.textContent = businessData.businessName || businessData.name || "未命名店家";
        }
        
        if (businessImageElement) {
            if (businessData.profileImageUrl || businessData.imageUrl) {
                businessImageElement.src = businessData.profileImageUrl || businessData.imageUrl;
            } else {
                businessImageElement.src = "store.png";
            }
        }
    } catch (error) {
        console.error("更新導航欄資訊錯誤:", error);
    }
}

// 更新基本資料欄位
function updateBusinessFormFields() {
    try {
        if (!businessData) {
            console.warn("尚未獲取店家資料，無法更新表單欄位");
            return;
        }
        
        // 基本資料欄位
        const storeNameInput = document.getElementById("storeName");
        const storePhoneInput = document.getElementById("storePhone");
        const storeEmailInput = document.getElementById("storeEmail");
        const storeWebsiteInput = document.getElementById("storeWebsite");
        const storeDescriptionInput = document.getElementById("storeDescription");
        const businessTypeInput = document.getElementById("businessType");
        
        // 設置值
        if (storeNameInput) {
            storeNameInput.value = businessData.businessName || businessData.name || "";
        }
        
        if (storePhoneInput) {
            storePhoneInput.value = businessData.businessPhone || businessData.phoneNumber || "";
        }
        
        if (storeEmailInput) {
            storeEmailInput.value = businessData.email || "";
        }
        
        if (storeWebsiteInput) {
            storeWebsiteInput.value = businessData.website || "";
        }
        
        if (storeDescriptionInput) {
            storeDescriptionInput.value = businessData.description || "";
        }
        
        // 更新店家類型
        if (businessTypeInput) {
            businessTypeInput.value = businessData.businessType || "";
        }
    } catch (error) {
        console.error("更新基本資料欄位錯誤:", error);
    }
}

// 更新店家主圖
function updateBusinessImage() {
    try {
        if (!businessData) return;
        
        const imageUrl = businessData.profileImageUrl || businessData.imageUrl;
        
        if (imageUrl) {
            updateMainImagePreview(imageUrl);
        }
    } catch (error) {
        console.error("更新店家主圖錯誤:", error);
    }
}

// 更新主圖預覽
function updateMainImagePreview(imageUrl) {
    try {
        const mainImagePreview = document.querySelector(".image-preview");
        if (mainImagePreview) {
            mainImagePreview.innerHTML = `
            <img src="${imageUrl}" alt="店家頭像/Logo" onerror="this.src='https://via.placeholder.com/400x400?text=圖片載入失敗'">
            <div class="remove-image">
                <i class="fas fa-times"></i>
            </div>
            `;
            
            // 添加刪除事件
            const removeBtn = mainImagePreview.querySelector('.remove-image');
            if (removeBtn) {
                removeBtn.addEventListener('click', function(e) {
                    if (e) e.preventDefault();
                    if (confirm('確定要刪除頭像嗎?')) {
                        removeMainImage();
                    }
                });
            }
        }
    } catch (error) {
        console.error("更新主圖預覽錯誤:", error);
    }
}

// 更新營業時間
function updateOpeningHoursFields() {
    try {
        if (!businessData) return;
        
        if (businessData.openingHours && businessData.openingHours.length > 0) {
            updateOpeningHours(businessData.openingHours);
        } else {
            // 設置預設營業時間
            initDefaultOpeningHours();
        }
    } catch (error) {
        console.error("更新營業時間錯誤:", error);
    }
}

// 更新營業時間
function updateOpeningHours(hours) {
    try {
        const businessHoursContainer = document.getElementById('businessHoursContainer');
        // 檢查容器是否存在，如果不存在，創建一個
        if (!businessHoursContainer) {
            // 檢查父元素是否存在
            const card = document.querySelector('.dashboard-card');
            if (card) {
                const newContainer = document.createElement('div');
                newContainer.id = 'businessHoursContainer';
                newContainer.className = 'row mt-3';
                card.querySelector('.card-body').appendChild(newContainer);
                
                // 重新獲取引用
                const hourSelectionDivs = createBusinessHoursUI(newContainer);
                // 現在設置值
                hours.forEach((hourData, index) => {
                    if (index < hourSelectionDivs.length) {
                        const selects = hourSelectionDivs[index].querySelectorAll("select");
                        if (selects.length === 2) {
                            // 設置值
                            setSelectValue(selects[0], hourData.open);
                            setSelectValue(selects[1], hourData.close);
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error("更新營業時間UI錯誤:", error);
    }
}

// 創建營業時間UI
function createBusinessHoursUI(container) {
    // 檢查容器是否已有營業時間選擇器
    if (container.querySelectorAll('.hours-selection').length > 0) {
        console.log("營業時間選擇器已存在，不重複創建");
        return Array.from(container.querySelectorAll('.hours-selection'));
    }
    
    // 假設整點與半點
    const timeSlots = [
        '00:00','00:30','01:00','01:30','02:00','02:30',
        '03:00','03:30','04:00','04:30','05:00','05:30',
        '06:00','06:30','07:00','07:30','08:00','08:30',
        '09:00','09:30','10:00','10:30','11:00','11:30',
        '12:00','12:30','13:00','13:30','14:00','14:30',
        '15:00','15:30','16:00','16:30','17:00','17:30',
        '18:00','18:30','19:00','19:30','20:00','20:30',
        '21:00','21:30','22:00','22:30','23:00','23:30'
    ];
    
    const days = [
        { label: '星期一', value: 1 },
        { label: '星期二', value: 2 },
        { label: '星期三', value: 3 },
        { label: '星期四', value: 4 },
        { label: '星期五', value: 5 },
        { label: '星期六', value: 6 },
        { label: '星期日', value: 7 }
    ];
    
    const hourSelectionDivs = [];
    
    days.forEach(dayObj => {
        // 建立一個 col-md-6
        const col = document.createElement('div');
        col.classList.add('col-md-6');
    
        // 生成 day-label
        const dayLabel = document.createElement('div');
        dayLabel.classList.add('day-label');
        dayLabel.textContent = dayObj.label;
    
        // 生成「起始時間」的 select
        const startSelect = document.createElement('select');
        startSelect.classList.add('form-select', 'form-select-sm', 'business-hours', 'custom-arrow');
        // 可用 data-* 來記錄是第幾天、屬於 open 之類
        startSelect.setAttribute('data-day', dayObj.value);
        startSelect.setAttribute('data-type', 'start');
        // 動態插入所有 options
        timeSlots.forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = t;
            startSelect.appendChild(option);
        });
    
        // 生成「結束時間」的 select
        const endSelect = document.createElement('select');
        endSelect.classList.add('form-select', 'form-select-sm', 'business-hours', 'custom-arrow');
        endSelect.setAttribute('data-day', dayObj.value);
        endSelect.setAttribute('data-type', 'end');
        timeSlots.forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = t;
            endSelect.appendChild(option);
        });
    
        // 組合成排版
        const timeInputsDiv = document.createElement('div');
        timeInputsDiv.classList.add('time-inputs');
        timeInputsDiv.appendChild(startSelect);
    
        const separator = document.createElement('span');
        separator.classList.add('time-separator');
        separator.textContent = '至';
        timeInputsDiv.appendChild(separator);
    
        timeInputsDiv.appendChild(endSelect);
    
        const hoursSelectionDiv = document.createElement('div');
        hoursSelectionDiv.classList.add('hours-selection');
        hoursSelectionDiv.appendChild(dayLabel);
        hoursSelectionDiv.appendChild(timeInputsDiv);
    
        col.appendChild(hoursSelectionDiv);
        container.appendChild(col);
        
        hourSelectionDivs.push(hoursSelectionDiv);
    });
    
    return hourSelectionDivs;
}

// 設置下拉選單值
function setSelectValue(selectElement, value) {
    if (!selectElement || !value) return;
    
    // 嘗試將選擇器滾動到可視範圍
    try {
        selectElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (e) {
        console.warn("無法滾動到選擇器:", e);
    }
    
    // 嘗試設置值
    try {
        // 尋找匹配的選項
        for (let i = 0; i < selectElement.options.length; i++) {
            if (selectElement.options[i].value === value) {
                selectElement.selectedIndex = i;
                return;
            }
        }
        
        // 如果沒找到匹配的選項，添加一個新選項
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        option.selected = true;
        selectElement.appendChild(option);
    } catch (e) {
        console.error("設置選擇器值時出錯:", e);
    }
}

// 初始化預設營業時間
function initDefaultOpeningHours() {
    try {
        // 檢查容器是否存在
        let businessHoursContainer = document.getElementById('businessHoursContainer');
        
        // 如果不存在，創建一個
        if (!businessHoursContainer) {
            const card = document.querySelector('#profile-section .dashboard-card');
            if (card) {
                const cardBody = card.querySelector('.card-body');
                if (cardBody) {
                    businessHoursContainer = document.createElement('div');
                    businessHoursContainer.id = 'businessHoursContainer';
                    businessHoursContainer.className = 'row mt-3';
                    cardBody.appendChild(businessHoursContainer);
                }
            }
        }
        
        if (!businessHoursContainer) {
            console.error("找不到營業時間容器");
            return;
        }
        
        // 創建營業時間UI
        const hourSelectionDivs = createBusinessHoursUI(businessHoursContainer);
        
        const defaultOpenTimes = ["09:00", "09:00", "09:00", "09:00", "09:00", "10:00", "10:00"];
        const defaultCloseTimes = ["19:00", "19:00", "19:00", "19:00", "19:00", "20:00", "20:00"];
        
        hourSelectionDivs.forEach((div, index) => {
            const selects = div.querySelectorAll("select");
            if (selects.length === 2) {
                setSelectValue(selects[0], defaultOpenTimes[index]);
                setSelectValue(selects[1], defaultCloseTimes[index]);
            }
        });
    } catch (error) {
        console.error("初始化預設營業時間錯誤:", error);
    }
}

// 更新活動類型
function updateActivityTypesUI() {
    try {
        if (businessData && businessData.activityTypes && businessData.activityTypes.length > 0) {
            updateActivityTypes(businessData.activityTypes);
        }
    } catch (error) {
        console.error("更新活動類型UI錯誤:", error);
    }
}

// 更新活動類型UI
function updateActivityTypes(activityTypes) {
    try {
        const activityCards = document.querySelectorAll(".activity-type-card");
        
        if (!activityCards || activityCards.length === 0) {
            console.warn("找不到活動類型卡片元素");
            return;
        }
        
        // 重置所有卡片
        activityCards.forEach(card => {
            card.classList.remove("selected");
        });
        
        // 選中對應活動類型
        activityTypes.forEach(type => {
            activityCards.forEach(card => {
                const cardType = card.getAttribute('data-type') || card.querySelector("p").textContent;
                if (cardType === type) {
                    card.classList.add("selected");
                }
            });
        });
        
        // 更新選擇數量
        const selectedCount = document.querySelectorAll(".activity-type-card.selected").length;
        const badge = document.querySelector(".activity-count-badge");
        if (badge) {
            badge.textContent = `已選擇 ${selectedCount} 項`;
        }
    } catch (error) {
        console.error("更新活動類型選擇錯誤:", error);
    }
}

// 更新環境照片
function updateEnvironmentImages() {
    try {
      // 獲取照片來源
      const environmentImages = businessData?.environmentImages || [];
      
      if (environmentImages && environmentImages.length > 0) {
        updateEnvironmentUI(environmentImages);
      }
    } catch (error) {
        console.error("更新環境照片錯誤:", error);
    }
}

// 更新環境照片畫廊
function updateEnvironmentUI(images) {
    try {
      // 找到環境照片容器
      const environmentPreview = document.querySelector(".environment-preview");
      if (!environmentPreview) {
        console.warn("找不到環境照片容器");
        return;
      }
      
      // 保留添加按鈕
      const addBtn = environmentPreview.querySelector(".add-environment-item");
      if (!addBtn) {
        console.warn("找不到添加照片按鈕");
        return;
      }
      
      // 清空現有內容（除了添加按鈕）
      environmentPreview.innerHTML = "";
      
      // 添加所有照片
      images.forEach(imageUrl => {
        if (!imageUrl) return; // 跳過空值
        
        const environmentItem = document.createElement("div");
        environmentItem.className = "environment-item";
        environmentItem.innerHTML = `
            <img src="${imageUrl}" alt="店內環境" onerror="this.src='https://via.placeholder.com/150x150?text=載入失敗'">
            <div class="remove-image">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        environmentPreview.appendChild(environmentItem);
        
        // 添加刪除事件
        const removeBtn = environmentItem.querySelector('.remove-image');
        if (removeBtn) {
          removeBtn.addEventListener('click', function() {
            if (confirm('確定要刪除此照片？')) {
              removeEnvironmentImage(imageUrl);
              environmentItem.remove();
            }
          });
        }
      });
      
      // 重新添加上傳按鈕
      environmentPreview.appendChild(addBtn);
    } catch (error) {
      console.error("更新環境照片UI錯誤:", error);
    }
}

// 更新標籤UI
function updateTagsUI() {
    try {
        if (businessData && businessData.tags && businessData.tags.length > 0) {
            updateTags(businessData.tags);
        }
    } catch (error) {
        console.error("更新標籤UI錯誤:", error);
    }
}

// 更新標籤
function updateTags(tags) {
    try {
        const tagContainer = document.getElementById("tagContainer");
        if (!tagContainer) {
            console.warn("找不到標籤容器元素");
            return;
        }
        
        // 清空現有標籤，但保留輸入框
        const tagInput = tagContainer.querySelector(".tag-input");
        tagContainer.innerHTML = "";
        
        // 添加標籤
        tags.forEach(tag => {
            if (!tag) return; // 跳過空標籤
            
            const tagElement = document.createElement("div");
            tagElement.className = "tag";
            tagElement.innerHTML = `
            ${tag}
            <span class="tag-close">&times;</span>
            `;
            
            tagContainer.appendChild(tagElement);
            
            // 添加刪除事件
            const closeBtn = tagElement.querySelector(".tag-close");
            if (closeBtn) {
                closeBtn.addEventListener("click", function() {
                    tagElement.remove();
                });
            }
        });
        
        // 添加輸入框
        tagContainer.appendChild(tagInput || createTagInput());
    } catch (error) {
        console.error("更新標籤顯示錯誤:", error);
    }
}

// 創建標籤輸入框
function createTagInput() {
    try {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "tag-input";
        input.placeholder = "輸入標籤，按Enter添加";
        
        input.addEventListener("keydown", function(e) {
            if (e.key === "Enter" && this.value.trim() !== "") {
                e.preventDefault();
                addTag(this.value.trim());
                this.value = "";
            }
        });
        
        return input;
    } catch (error) {
        console.error("創建標籤輸入框錯誤:", error);
        // 提供一個後備輸入框
        const backupInput = document.createElement("input");
        backupInput.type = "text";
        backupInput.className = "tag-input";
        backupInput.placeholder = "輸入標籤";
        return backupInput;
    }
}

// 添加標籤
function addTag(tagText) {
    const tagContainer = document.getElementById("tagContainer");
    if (!tagContainer) {
        console.error("找不到標籤容器");
        return;
    }
    
    // 檢查是否已存在
    const existingTags = tagContainer.querySelectorAll(".tag");
    let isDuplicate = false;
    
    existingTags.forEach(tag => {
        const tagContent = tag.textContent.replace('×', '').trim();
        if (tagContent === tagText) {
            isDuplicate = true;
        }
    });
    
    if (isDuplicate) {
        showAlert("此標籤已添加", "warning");
        return;
    }
    
    // 檢查是否已達到最大數量
    if (existingTags.length >= 10) {
        showAlert("最多只能添加10個標籤", "warning");
        return;
    }
    
    // 檢查標籤長度
    if (tagText.length > 10) {
        showAlert("標籤不能超過10個字", "warning");
        return;
    }
    
    // 獲取輸入框
    const tagInput = tagContainer.querySelector(".tag-input");
    
    // 創建新標籤元素
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = tagText + '<span class="tag-close">&times;</span>';
    
    // 添加到容器
    if (tagInput) {
        tagContainer.insertBefore(tag, tagInput);
    } else {
        tagContainer.appendChild(tag);
    }
    
    // 添加刪除事件
    const closeBtn = tag.querySelector(".tag-close");
    closeBtn.addEventListener("click", function() {
        tag.remove();
    });
}

// 更新店家標籤
async function updateBusinessTags() {
    try {
        // 獲取按鈕並顯示載入狀態
        const saveBtn = document.getElementById("saveTagsBtn");
        if (!saveBtn) {
            console.error("找不到保存標籤按鈕");
            return;
        }
        
        const originalText = saveBtn.textContent;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 儲存中...';
        saveBtn.disabled = true;
        
        // 收集標籤
        const tags = [];
        const tagElements = document.querySelectorAll("#tagContainer .tag");
        tagElements.forEach(tag => {
            tags.push(tag.textContent.replace('×', '').trim());
        });
        
        // 檢查 Firebase 初始化
        if (!firebaseInitComplete || !window.db) {
            showAlert("系統尚未準備好，請稍後再試", "warning");
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
            return;
        }
        
        // 更新 Firestore
        await window.db.collection("businesses").doc(currentUser.uid).update({
            tags: tags,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        if (!businessData) businessData = {};
        businessData.tags = tags;
        
        // 恢復按鈕狀態
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        
        showAlert("標籤已成功更新", "success");
    } catch (error) {
        console.error("更新標籤錯誤:", error);
        showAlert("更新標籤失敗，請稍後再試", "danger");
        
        // 恢復按鈕狀態
        const saveBtn = document.getElementById("saveTagsBtn");
        if (saveBtn) {
            saveBtn.textContent = '儲存標籤';
            saveBtn.disabled = false;
        }
    }
}

// 更新地理位置欄位
function updateLocationFields() {
    try {
        if (!businessData) return;
        
        if (businessData.position && businessData.position.geopoint) {
            // 填充地址欄位
            const formattedAddressField = document.getElementById('formattedAddress');
            if (formattedAddressField) {
                formattedAddressField.value = businessData.address || "";
            }
            
            // 填充經緯度欄位
            const latitudeField = document.getElementById('latitude');
            const longitudeField = document.getElementById('longitude');
            
            if (latitudeField && longitudeField && businessData.position.geopoint) {
                latitudeField.value = businessData.position.geopoint.latitude?.toFixed(6) || "";
                longitudeField.value = businessData.position.geopoint.longitude?.toFixed(6) || "";
            }
            
            // 地圖會在 initMap 函數中更新
        } else if (businessData.address) {
            const formattedAddressField = document.getElementById('formattedAddress');
            if (formattedAddressField) {
                formattedAddressField.value = businessData.address || "";
            }
        }
    } catch (error) {
        console.error("更新地理位置欄位錯誤:", error);
    }
}

// 自動填充帳號設定欄位
function updateAccountSettingsUI() {
    console.log("正在更新帳號設定欄位...");
    try {
        // 確保已載入用戶資料
        if (!currentUser || !businessData) {
            console.warn("用戶資料尚未載入，無法更新帳號設定");
            return;
        }

        // 獲取DOM元素
        const accountEmailField = document.getElementById("accountEmail");
        const accountNameField = document.getElementById("accountName");
        const accountPhoneField = document.getElementById("accountPhone");

        // 設置電子郵件 (使用用戶註冊時的Email)
        if (accountEmailField && currentUser.email) {
            accountEmailField.value = currentUser.email;
            // 確保是禁用狀態
            accountEmailField.disabled = true;
        }

        // 設置聯絡人姓名
        if (accountNameField) {
            accountNameField.value = businessData.contactName || businessData.ownerName || "";
        }

        // 設置聯絡人電話
        if (accountPhoneField) {
            accountPhoneField.value = businessData.contactPhone || businessData.phoneNumber || businessData.businessPhone || "";
        }

        console.log("帳號設定欄位已更新");
    } catch (error) {
        console.error("更新帳號設定欄位時發生錯誤:", error);
    }
}

// 綁定帳號設定表單提交事件
function bindAccountSettingsForm() {
    const accountForm = document.querySelector('#settings-section form');
    if (accountForm) {
        accountForm.removeEventListener('submit', handleAccountFormSubmit);
        accountForm.addEventListener('submit', handleAccountFormSubmit);
        console.log("已綁定帳號設定表單提交事件");
    }
}

// 處理帳號設定表單提交
function handleAccountFormSubmit(e) {
    e.preventDefault();
    saveAccountSettings();
}

// 保存帳號設定
async function saveAccountSettings() {
    try {
        // 獲取表單數據
        const accountName = document.getElementById("accountName")?.value?.trim();
        const accountPhone = document.getElementById("accountPhone")?.value?.trim();
        
        // 顯示加載狀態
        showPageLoading("正在保存帳號設定...");
        
        // 檢查 Firebase 初始化
        if (!firebaseInitComplete || !window.db) {
            hidePageLoading();
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        // 構建更新數據
        const updateData = {
            contactName: accountName,
            contactPhone: accountPhone,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 更新數據庫
        await window.db.collection("businesses").doc(currentUser.uid).update(updateData);
        
        // 更新本地數據
        if (!businessData) businessData = {};
        businessData.contactName = accountName;
        businessData.contactPhone = accountPhone;
        
        hidePageLoading();
        showAlert("帳號設定已成功更新", "success");
    } catch (error) {
        console.error("保存帳號設定出錯:", error);
        hidePageLoading();
        showAlert("保存帳號設定失敗: " + error.message, "danger");
    }
}

// 活動類型卡片選擇
function initActivityTypeCards() {
    const activityCards = document.querySelectorAll('.activity-type-card');
    
    if (!activityCards || activityCards.length === 0) {
        console.warn("找不到活動類型卡片元素");
        return;
    }
    
    // 設置資料屬性以便於 CSS 和 JS 更容易識別
    activityCards.forEach(card => {
        // 獲取類型，如果已有資料屬性則使用，否則從內容獲取
        const activityType = card.getAttribute('data-type') || card.querySelector('p')?.textContent;
        
        if (activityType) {
            card.setAttribute('data-type', activityType);
            
            // 為 iOS 特別處理點擊事件
            if (isIOS) {
                card.addEventListener('touchend', function(e) {
                    e.preventDefault();
                    this.classList.toggle('selected');
                    
                    // 更新選中數量
                    updateActivityTypeCount();
                });
            } else {
                card.addEventListener('click', function() {
                    this.classList.toggle('selected');
                    
                    // 更新選中數量
                    updateActivityTypeCount();
                });
            }
        }
    });
    
    // 初始時更新選中數量
    updateActivityTypeCount();
}

// 更新活動類型選中數量
function updateActivityTypeCount() {
    const selectedCount = document.querySelectorAll('.activity-type-card.selected').length;
    const badge = document.querySelector('.activity-count-badge');
    if (badge) {
        badge.textContent = `已選擇 ${selectedCount} 項`;
    }
}

// 儲存選擇的活動類型
async function saveActivityTypes() {
    try {
        // 獲取按鈕並顯示載入狀態
        const saveBtn = document.getElementById("saveActivityTypesBtn");
        if (!saveBtn) {
            console.error("找不到保存活動類型按鈕");
            return;
        }
        
        const originalText = saveBtn.textContent;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 儲存中...';
        saveBtn.disabled = true;
        
        // 檢查 Firebase 初始化
        if (!firebaseInitComplete || !window.db) {
            showAlert("系統尚未準備好，請稍後再試", "warning");
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
            return;
        }
        
        // 收集選中的活動類型
        const activityTypes = [];
        const selectedCards = document.querySelectorAll(".activity-type-card.selected");
        selectedCards.forEach(card => {
            const typeText = card.getAttribute('data-type') || card.querySelector("p")?.textContent;
            if (typeText) {
                activityTypes.push(typeText);
            }
        });
        
        // 更新 Firestore
        await window.db.collection("businesses").doc(currentUser.uid).update({
            activityTypes: activityTypes,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        if (!businessData) businessData = {};
        businessData.activityTypes = activityTypes;
        
        // 恢復按鈕狀態
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        
        showAlert("活動類型已成功更新", "success");
    } catch (error) {
        console.error("更新活動類型錯誤:", error);
        showAlert("更新活動類型失敗，請稍後再試", "danger");
        
        // 恢復按鈕狀態
        const saveBtn = document.getElementById("saveActivityTypesBtn");
        if (saveBtn) {
            saveBtn.textContent = '儲存活動類型';
            saveBtn.disabled = false;
        }
    }
}

// 圖片上傳預覽初始化
function initImageUploads() {
    // 店家頭像上傳
    initMainImageUpload();
    
    // 環境照片上傳
    initEnvironmentImages();
}

// 店家主圖上傳初始化
function initMainImageUpload() {
    const mainImageUpload = document.getElementById('mainImageUpload');
    if (mainImageUpload) {
        mainImageUpload.removeEventListener('change', handleMainImageUpload);
        mainImageUpload.addEventListener('change', handleMainImageUpload);
    }
    
    // 綁定既有刪除按鈕
    const existingRemoveBtn = document.querySelector('.image-preview .remove-image');
    if (existingRemoveBtn) {
        existingRemoveBtn.removeEventListener('click', handleRemoveMainImageClick);
        existingRemoveBtn.addEventListener('click', handleRemoveMainImageClick);
    }
}

// 處理刪除主圖點擊事件
function handleRemoveMainImageClick(e) {
    if (e) e.preventDefault();
    if (confirm('確定要刪除店家頭像嗎?')) {
        removeMainImage();
    }
}

// 店家環境照片上傳初始化
function initEnvironmentImages() {
    const addEnvironmentImage = document.getElementById('addEnvironmentImage');
    if (!addEnvironmentImage) {
      console.warn("找不到環境照片上傳元素");
      return;
    }
    
    // 點擊添加按鈕時觸發文件選擇
    const addEnvironmentItem = document.querySelector('.add-environment-item');
    if (addEnvironmentItem) {
      addEnvironmentItem.removeEventListener('click', handleAddEnvironmentClick);
      addEnvironmentItem.addEventListener('click', handleAddEnvironmentClick);
    }
    
    // 選擇文件後處理上傳
    addEnvironmentImage.removeEventListener('change', handleEnvironmentImageChange);
    addEnvironmentImage.addEventListener('change', handleEnvironmentImageChange);
    
    // 綁定既有刪除按鈕
    document.querySelectorAll('.environment-item .remove-image').forEach(btn => {
      btn.removeEventListener('click', handleRemoveEnvironmentClick);
      btn.addEventListener('click', handleRemoveEnvironmentClick);
    });
}

// 添加環境照片點擊事件
function handleAddEnvironmentClick(e) {
    if (e) e.preventDefault();
    const addEnvironmentImage = document.getElementById('addEnvironmentImage');
    if (addEnvironmentImage) {
        addEnvironmentImage.click();
    }
}

// 環境照片變更事件
function handleEnvironmentImageChange(e) {
    if (e?.target?.files) {
        handleEnvironmentImageUpload(e.target.files);
    }
}

// 刪除環境照片點擊事件
function handleRemoveEnvironmentClick(e) {
    if (e) e.preventDefault();
    const environmentItem = this.closest('.environment-item');
    const imgUrl = environmentItem?.querySelector('img')?.src;
    
    if (imgUrl && confirm('確定要刪除此照片嗎?')) {
        
        removeEnvironmentImage(imgUrl);
        environmentItem.remove();
    }
}

// 處理上傳店家主圖/頭像
async function handleMainImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // 檢查文件類型和大小
    if (!file.type.match('image.*')) {
        showAlert("請上傳圖片文件", "warning");
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB
        showAlert("檔案大小不能超過 5MB", "warning");
        return;
    }
    
    try {
        // 顯示加載
        showPageLoading("正在上傳圖片，請稍候...");
        
        // 檢查 Firebase 初始化
        if (!firebaseInitComplete || !window.storage) {
            hidePageLoading();
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        // 壓縮圖片 - 返回blob而非File
        const imageBlob = await compressImage(file, 400, 400);
        
        // 上傳到 Storage
        const storageRef = window.storage.ref(`businesses/${currentUser.uid}/main`);
        const uploadResult = await storageRef.put(imageBlob);
        const imageUrl = await uploadResult.ref.getDownloadURL();
        
        // 更新 Firestore
        await window.db.collection("businesses").doc(currentUser.uid).update({
            imageUrl: imageUrl,
            profile_image_updated_at: window.firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新UI
        updateMainImagePreview(imageUrl);
        
        // 更新本地數據
        if (!businessData) businessData = {};
        businessData.imageUrl = imageUrl;
        
        // 更新導航頭像
        const businessImageElement = document.getElementById("businessImage");
        if (businessImageElement) {
            businessImageElement.src = imageUrl;
        }
        
        hidePageLoading();
        showAlert("店家頭像已成功更新", "success");
    } catch (error) {
        console.error("上傳圖片錯誤:", error);
        hidePageLoading();
        showAlert("上傳圖片失敗: " + error.message, "danger");
    } finally {
        // 清空文件輸入，允許上傳相同檔案
        e.target.value = '';
    }
}

// 處理上傳環境照片
async function handleEnvironmentImageUpload(files) {
    if (!files || files.length === 0) return;
    
    try {
        showPageLoading("正在上傳環境照片，請稍候...");
        
        // 檢查 Firebase 初始化
        if (!firebaseInitComplete || !window.storage || !window.db) {
            hidePageLoading();
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        // 獲取環境照片容器
        const environmentPreview = document.querySelector('.environment-preview');
        if (!environmentPreview) {
            hidePageLoading();
            showAlert("找不到環境照片容器", "danger");
            return;
        }
        
        // 確保先獲取添加按鈕
        const addBtn = environmentPreview.querySelector('.add-environment-item');
        if (!addBtn) {
            hidePageLoading();
            showAlert("找不到添加照片按鈕，請確認HTML結構", "danger");
            return;
        }
        
        // 獲取既有的環境照片URLs
        let environmentImages = [];
        if (businessData && businessData.environmentImages) {
            environmentImages = [...businessData.environmentImages];
        }
        
        // 處理每張照片
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // 檢查文件類型和大小
            if (!file.type.match('image.*')) {
                showAlert(`文件 ${file.name} 不是圖片，已跳過`, "warning");
                continue;
            }
            
            if (file.size > 5 * 1024 * 1024) { // 5MB
                showAlert(`圖片 ${file.name} 超過 5MB，已跳過`, "warning");
                continue;
            }
            
            // 壓縮圖片 - 返回blob而非File
            const imageBlob = await compressImage(file, 800, 600);
            
            // 上傳到 Storage
            const path = `businesses/${currentUser.uid}/environment/${Date.now()}_${file.name}`;
            const storageRef = window.storage.ref(path);
            const uploadResult = await storageRef.put(imageBlob);
            const imageUrl = await uploadResult.ref.getDownloadURL();
            
            // 添加到圖片URLs陣列
            environmentImages.push(imageUrl);
            
            // 創建新的環境照片項目
            const environmentItem = document.createElement('div');
            environmentItem.className = 'environment-item';
            environmentItem.innerHTML = `
                <img src="${imageUrl}" alt="店內環境照片" onerror="this.src='https://via.placeholder.com/150x150?text=載入失敗'">
                <div class="remove-image">
                    <i class="fas fa-times"></i>
                </div>
            `;
            
            // 插入到添加按鈕之前
            environmentPreview.insertBefore(environmentItem, addBtn);
            
            // 添加刪除事件
            const removeBtn = environmentItem.querySelector('.remove-image');
            if (removeBtn) {
                removeBtn.addEventListener('click', function() {
                    if (confirm('確定要刪除此照片？')) {
                        removeEnvironmentImage(imageUrl);
                        environmentItem.remove();
                    }
                });
            }
        }
        
        // 更新 Firestore
        await window.db.collection("businesses").doc(currentUser.uid).update({
            environmentImages: environmentImages,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        if (!businessData) businessData = {};
        businessData.environmentImages = environmentImages;
        
        hidePageLoading();
        showAlert("環境照片已成功上傳", "success");
    } catch (error) {
        console.error("上傳環境照片錯誤:", error);
        hidePageLoading();
        showAlert("上傳環境照片失敗: " + error.message, "danger");
    } finally {
        // 清空文件輸入
        document.getElementById('addEnvironmentImage').value = '';
    }
}

// 刪除環境照片
async function removeEnvironmentImage(imageUrl) {
    try {
        showPageLoading("正在移除照片...");
        
        // 檢查必要數據
        if (!businessData || !businessData.environmentImages || !imageUrl) {
            hidePageLoading();
            showAlert("找不到照片資訊", "warning");
            return;
        }
        
        // 檢查 Firebase 初始化
        if (!firebaseInitComplete || !window.storage || !window.db) {
            hidePageLoading();
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        // 從存儲中刪除文件
        try {
            // 從URL中獲取路徑 (不使用 refFromURL)
            const urlPath = imageUrl.split('?')[0]; // 移除查詢參數
            if (urlPath.includes('/o/')) {
                const storagePath = decodeURIComponent(urlPath.split('/o/')[1]); // 獲取 object 路徑部分
                
                const storageRef = window.storage.ref(storagePath);
                await storageRef.delete();
                console.log("成功從 Storage 刪除照片");
            }
        } catch (storageError) {
            console.warn("刪除 Storage 檔案失敗:", storageError);
            // 繼續處理，不中斷流程
        }
        
        // 從店家數據中移除 URL
        const updatedImages = businessData.environmentImages.filter(url => url !== imageUrl);
        
        // 更新 Firestore
        await window.db.collection("businesses").doc(currentUser.uid).update({
            environmentImages: updatedImages,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        businessData.environmentImages = updatedImages;
        
        hidePageLoading();
        showAlert("照片已成功刪除", "success");
    } catch (error) {
        console.error("刪除照片錯誤:", error);
        hidePageLoading();
        showAlert("刪除照片失敗，請稍後再試", "danger");
    }
}

// 刪除主圖/頭像
async function removeMainImage() {
    try {
        showPageLoading("正在移除店家頭像...");
        
        // 檢查必要數據
        if (!businessData || !businessData.imageUrl) {
            hidePageLoading();
            showAlert("找不到頭像資訊", "warning");
            return;
        }
        
        // 檢查 Firebase 初始化
        if (!firebaseInitComplete || !window.storage || !window.db) {
            hidePageLoading();
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        // 從存儲中刪除文件
        try {
            // 從URL中獲取路徑 (不使用 refFromURL)
            const urlPath = businessData.imageUrl.split('?')[0]; // 移除查詢參數
            if (urlPath.includes('/o/')) {
                const storagePath = decodeURIComponent(urlPath.split('/o/')[1]); // 獲取 object 路徑部分
                
                const storageRef = window.storage.ref(storagePath);
                await storageRef.delete();
                console.log("成功從 Storage 刪除頭像");
            }
        } catch (storageError) {
            console.warn("刪除存儲檔案失敗:", storageError);
            // 繼續處理，不中斷流程
        }
        
        // 使用對應的方法刪除欄位
        // 適配不同的 Firebase 版本
        let updateData;
        
        if (window.firebase.firestore.FieldValue.delete) {
            // 如果存在 delete 方法
            updateData = {
                imageUrl: window.firebase.firestore.FieldValue.delete(),
                updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            };
        } else {
            // 如果沒有 delete 方法，使用 null 代替
            updateData = {
                imageUrl: null,
                updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            };
        }
        
        // 從資料庫中刪除引用
        await window.db.collection("businesses").doc(currentUser.uid).update(updateData);
        
        // 更新本地數據
        delete businessData.imageUrl;
        
        // 更新UI
        const mainImagePreview = document.querySelector(".image-preview");
        if (mainImagePreview) {
            mainImagePreview.innerHTML = `
                <div class="upload-placeholder">
                    <i class="fas fa-image"></i>
                    <p>上傳店家頭像/Logo</p>
                </div>
            `;
        }
        
        // 更新導航頭像
        const businessImageElement = document.getElementById("businessImage");
        if (businessImageElement) {
            businessImageElement.src = "store.png";
        }
        
        hidePageLoading();
        showAlert("店家頭像已成功刪除", "success");
    } catch (error) {
        console.error("刪除主圖時發生錯誤:", error);
        hidePageLoading();
        showAlert("刪除頭像失敗，請稍後再試", "danger");
    }
}

// 保存營業時間
async function saveBusinessHours() {
    try {
        // 獲取按鈕並顯示載入狀態
        const saveBtn = document.getElementById("saveBusinessHoursBtn");
        if (!saveBtn) {
            console.error("找不到保存營業時間按鈕");
            return;
        }
        
        const originalText = saveBtn.textContent;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 儲存中...';
        saveBtn.disabled = true;
        
        // 檢查 Firebase 初始化
        if (!firebaseInitComplete || !window.db) {
            showAlert("系統尚未準備好，請稍後再試", "warning");
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
            return;
        }
        
        // 收集營業時間
        const openingHours = [];
        const hourSelectionDivs = document.querySelectorAll(".hours-selection");
        
        if (hourSelectionDivs.length === 0) {
            showAlert("找不到營業時間設定", "warning");
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
            return;
        }
        
        hourSelectionDivs.forEach((div, index) => {
            const selects = div.querySelectorAll("select");
            if (selects.length === 2) {
                openingHours.push({
                    day: index + 1, // 1-7 代表星期一到星期日
                    open: selects[0].value,
                    close: selects[1].value
                });
            }
        });
        
        // 更新 Firestore
        await window.db.collection("businesses").doc(currentUser.uid).update({
            openingHours: openingHours,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        if (!businessData) businessData = {};
        businessData.openingHours = openingHours;
        
        // 恢復按鈕狀態
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
        
        showAlert("營業時間已成功更新", "success");
    } catch (error) {
        console.error("更新營業時間錯誤:", error);
        showAlert("更新營業時間失敗，請稍後再試", "danger");
        
        // 恢復按鈕狀態
        const saveBtn = document.getElementById("saveBusinessHoursBtn");
        if (saveBtn) {
            saveBtn.textContent = '儲存營業時間';
            saveBtn.disabled = false;
        }
    }
}

// 儲存店家位置資訊
async function saveLocationInfo() {
    try {
        const lat = parseFloat(document.getElementById('latitude')?.value);
        const lng = parseFloat(document.getElementById('longitude')?.value);
        const formattedAddress = document.getElementById('formattedAddress')?.value;
        
        if (isNaN(lat) || isNaN(lng) || !formattedAddress) {
            showAlert('位置資訊不完整，請確保已設定位置', 'warning');
            return;
        }
        
        // 檢查 Firebase 初始化
        if (!firebaseInitComplete || !window.db) {
            showAlert("系統尚未準備好，請稍後再試", "warning");
            return;
        }
        
        // 按鈕載入狀態
        const saveBtn = document.getElementById('saveLocationBtn');
        if (!saveBtn) {
            showAlert('找不到儲存位置按鈕', 'warning');
            return;
        }
        
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 儲存中...';
        saveBtn.disabled = true;
        
        // 生成geohash (如果提供了生成函數)
        let geohash = "";
        if (typeof generateGeohash === 'function') {
            geohash = generateGeohash(lat, lng);
        } else {
            // 使用簡化的geohash生成方法
            geohash = simpleGeohash(lat, lng);
        }
        
        // 創建符合要求的位置數據結構
        const positionData = {
            geopoint: new window.firebase.firestore.GeoPoint(lat, lng)
        };
        
        // 如果有geohash，添加到位置數據
        if (geohash) {
            positionData.geohash = geohash;
        }
        
        // 更新Firestore
        await window.db.collection("businesses").doc(currentUser.uid).update({
            position: positionData,
            address: formattedAddress,
            location_updated_at: window.firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        if (!businessData) businessData = {};
        businessData.position = positionData;
        businessData.address = formattedAddress;
        
        // 恢復按鈕狀態
        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;
        
        showAlert('店家位置已成功更新，資料將用於APP中的距離計算及推薦功能', 'success');
    } catch (error) {
        console.error('儲存位置時發生錯誤:', error);
        
        // 恢復按鈕狀態
        const saveBtn = document.getElementById('saveLocationBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-map-marker-alt me-2"></i>儲存位置';
            saveBtn.disabled = false;
        }
        
        showAlert('儲存位置失敗，請稍後再試: ' + error.message, 'danger');
    }
}

// 簡易的geohash生成方法，備用方案
function simpleGeohash(lat, lng, precision = 8) {
    // 這只是一個非常簡化的geohash生成方法，實際應用中應使用專門的庫
    // 將經緯度轉換成字串並保留精度
    const latStr = lat.toFixed(precision);
    const lngStr = lng.toFixed(precision);
    
    // 使用標準編碼方法
    const chars = '0123456789bcdefghjkmnpqrstuvwxyz';
    let geohash = '';
    
    // 混合經緯度的精確位置來生成唯一標識符
    const combinedStr = latStr + lngStr;
    let hashValue = 0;
    
    // 簡單哈希算法
    for (let i = 0; i < combinedStr.length; i++) {
        hashValue = ((hashValue << 5) - hashValue) + combinedStr.charCodeAt(i);
        hashValue |= 0; // 轉為32位整數
    }
    
    // 生成假的geohash字符串
    const absValue = Math.abs(hashValue);
    for (let i = 0; i < 8; i++) {
        geohash += chars[absValue % chars.length];
        hashValue = Math.floor(absValue / chars.length);
    }
    
    return geohash;
}

// 修改的商店基本資料儲存
async function saveBusinessInfo() {
    try {
        // 顯示載入提示
        const saveBtn = document.getElementById("saveBusinessInfoBtn");
        if (!saveBtn) {
            showAlert("找不到儲存按鈕", "warning");
            return;
        }
        
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 儲存中...';
        saveBtn.disabled = true;
        
        // 檢查 Firebase 初始化
        if (!firebaseInitComplete || !window.db) {
            showAlert("系統尚未準備好，請稍後再試", "warning");
            saveBtn.innerHTML = originalBtnText;
            saveBtn.disabled = false;
            return;
        }
        
        // 獲取表單數據
        const nameInput = document.getElementById("storeName");
        const phoneInput = document.getElementById("storePhone");
        const emailInput = document.getElementById("storeEmail");
        const websiteInput = document.getElementById("storeWebsite");
        const descriptionInput = document.getElementById("storeDescription");
        const businessTypeInput = document.getElementById("businessType");
        
        // 驗證必填字段
        if (!nameInput || !nameInput.value.trim()) {
            showAlert("請填寫店家名稱", "warning");
            saveBtn.innerHTML = originalBtnText;
            saveBtn.disabled = false;
            return;
        }

        // 驗證店家類型長度
        if (!businessTypeInput || !businessTypeInput.value.trim()) {
            showAlert("請填寫店家類型", "warning");
            saveBtn.innerHTML = originalBtnText;
            saveBtn.disabled = false;
            return;
        } else if (businessTypeInput.value.trim().length > 10) {
            showAlert("店家類型不能超過10個字", "warning");
            saveBtn.innerHTML = originalBtnText;
            saveBtn.disabled = false;
            return;
        }
        
        // 驗證店家介紹
        if (!descriptionInput || !descriptionInput.value.trim()) {
            showAlert("請填寫店家介紹", "warning");
            saveBtn.innerHTML = originalBtnText;
            saveBtn.disabled = false;
            return;
        }
        
        // 準備更新的數據
        const dataToUpdate = {
            businessName: nameInput.value.trim(),
            businessPhone: phoneInput ? phoneInput.value.trim() : "",
            email: emailInput ? emailInput.value.trim() : "",
            website: websiteInput ? websiteInput.value.trim() : "",
            description: descriptionInput ? descriptionInput.value.trim() : "",
            businessType: businessTypeInput ? businessTypeInput.value : "",
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 更新 Firestore
        await window.db.collection("businesses").doc(currentUser.uid).update(dataToUpdate);
        
        // 更新本地數據
        if (!businessData) businessData = {};
        Object.assign(businessData, dataToUpdate);
        
        // 更新UI
        const businessNameElement = document.getElementById("businessName");
        if (businessNameElement) {
            businessNameElement.textContent = businessData.businessName;
        }
        
        // 恢復按鈕狀態
        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;
        
        showAlert("店家資料已成功更新", "success");
    } catch (error) {
        console.error("更新店家資料錯誤:", error);
        showAlert("更新店家資料失敗，請稍後再試", "danger");
        
        // 恢復按鈕狀態
        const saveBtn = document.getElementById("saveBusinessInfoBtn");
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>儲存變更';
            saveBtn.disabled = false;
        }
    }
}

// 加載Google Maps API
function loadGoogleMapsAPI() {
    if (document.getElementById('google-maps-script')) {
        return; // 避免重複載入
    }
    
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    // 使用標準版本
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyByRzxE7olx04Q_-ckYIKNyI9uJnZ_p_-Y&libraries=places&callback=initMap`;
    script.defer = true;
    script.async = true;
    script.loading = "async";
    script.onerror = function() {
        showAlert('無法載入 Google Maps API，請檢查您的網絡連接', 'warning');
    };
    document.head.appendChild(script);
}

// 初始化地圖
async function initMap() {
    // 檢查地圖容器是否存在
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;
    
    try {
        // 初始化地圖 - 暫時使用預設位置，稍後會更新
        const defaultPosition = { lat: 25.033964, lng: 121.564468 }; // 台北市
        
        // 初始化地圖
        map = new google.maps.Map(mapContainer, {
            center: defaultPosition,
            zoom: 15,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            mapTypeControl: false,
            styles: [
                {
                    "featureType": "poi",
                    "elementType": "labels",
                    "stylers": [
                        { "visibility": "off" }
                    ]
                }
            ]
        });
        
        // 初始化地標標記
        marker = new google.maps.Marker({
            position: defaultPosition,
            map: map,
            draggable: true,
            animation: google.maps.Animation.DROP,
            icon: {
                url: 'https://maps.google.com/mapfiles/ms/icons/pink-dot.png'
            }
        });
        
        // 初始化地理編碼器
        geocoder = new google.maps.Geocoder();
        
        // 獲取座標和地址欄位
        const latitudeField = document.getElementById('latitude');
        const longitudeField = document.getElementById('longitude');
        const formattedAddressField = document.getElementById('formattedAddress');
        
        // 綁定標記拖動事件
        google.maps.event.addListener(marker, 'dragend', function() {
            const position = marker.getPosition();
            updateLocationFields(position);
            
            // 根據經緯度取得地址
            if (geocoder && formattedAddressField) {
                geocoder.geocode({ 
                    location: position,
                    language: 'zh-TW'
                }, function(results, status) {
                    if (status === 'OK' && results[0]) {
                        formattedAddressField.value = results[0].formatted_address;
                    }
                });
            }
        });
        
        // 處理位置資料
        let hasValidLocation = false;
        
        // 場景1: 檢查是否有完整的座標資料
        if (businessData && businessData.position && businessData.position.geopoint) {
            try {
                console.log("使用已存在的地理位置資料");
                
                const position = {
                    lat: businessData.position.geopoint.latitude,
                    lng: businessData.position.geopoint.longitude
                };
                
                // 更新地圖和標記
                map.setCenter(position);
                marker.setPosition(position);
                
                // 更新座標欄位
                if (latitudeField) latitudeField.value = position.lat.toFixed(6);
                if (longitudeField) longitudeField.value = position.lng.toFixed(6);
                
                // 填入地址
                if (formattedAddressField) {
                    if (businessData.address) {
                        formattedAddressField.value = businessData.address;
                    } else {
                        // 如果沒有地址，嘗試根據座標獲取
                        geocoder.geocode({ 
                            location: position,
                            language: 'zh-TW'
                        }, function(results, status) {
                            if (status === 'OK' && results[0]) {
                                formattedAddressField.value = results[0].formatted_address;
                            }
                        });
                    }
                }
                
                hasValidLocation = true;
            } catch (error) {
                console.error("處理地理座標時出錯:", error);
            }
        }
        
        // 場景2: 如果沒有有效座標但有地址，嘗試使用地址定位
        else if (businessData && businessData.address && businessData.address.trim() !== "") {
            try {
                console.log("嘗試使用地址定位:", businessData.address);
                
                // 先填入已知地址
                if (formattedAddressField) {
                    formattedAddressField.value = businessData.address;
                }
                
                // 使用地址查詢經緯度
                const geocodingOptions = {
                    address: businessData.address,
                    region: 'tw',
                    language: 'zh-TW'
                };
                
                geocoder.geocode(geocodingOptions, function(results, status) {
                    if (status === 'OK' && results[0]) {
                        const position = results[0].geometry.location;
                        
                        // 更新地圖和標記
                        map.setCenter(position);
                        marker.setPosition(position);
                        
                        // 更新座標欄位
                        if (latitudeField) latitudeField.value = position.lat().toFixed(6);
                        if (longitudeField) longitudeField.value = position.lng().toFixed(6);
                        
                        // 更新地址為更標準的格式
                        if (formattedAddressField) {
                            formattedAddressField.value = results[0].formatted_address;
                        }
                        
                        hasValidLocation = true;
                        
                        // 使用對話框提示店家保存位置
                        showLocationSaveDialog();
                    } else {
                        console.warn("地址轉換為座標失敗:", status);
                        // 地址無法轉換為有效座標時，顯示對話框提示
                        showLocationErrorDialog();
                    }
                });
            } catch (error) {
                console.error("處理地址時出錯:", error);
                showLocationErrorDialog();
            }
        }
        
        // 場景3: 如果沒有位置資料，顯示提示
        else {
            console.log("無位置資料，顯示對話框提示");
            showLocationErrorDialog();
        }
        
        // 綁定地址搜尋相關事件
        const searchLocationBtn = document.getElementById('searchLocationBtn');
        if (searchLocationBtn) {
            searchLocationBtn.addEventListener('click', function() {
                searchLocation();
            });
        }
        
        const locationSearch = document.getElementById('locationSearch');
        if (locationSearch) {
            locationSearch.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchLocation();
                }
            });
        }
    } catch (error) {
        console.error("初始化地圖時出錯:", error);
        const mapContainer = document.getElementById('mapContainer');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div class="alert alert-danger text-center">
                    <i class="fas fa-map-marker-alt me-2"></i> 
                    無法載入地圖: ${error.message}
                    <button class="btn btn-sm btn-outline-danger mt-2" onclick="loadGoogleMapsAPI()">
                        重新載入地圖
                    </button>
                </div>
            `;
        }
    }
}

// 會話超時處理
function setupSessionTimeoutHandler() {
    let inactivityTimer;
    const SESSION_TIMEOUT = 60 * 60 * 1000; // 60分鐘閒置時間
    
    // 重置計時器的函數
    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(handleSessionTimeout, SESSION_TIMEOUT);
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
            if (window.auth) {
                // 登出當前用戶
                window.auth.signOut().then(() => {
                    // 刷新頁面
                    window.location.reload();
                }).catch(error => {
                    console.error('登出錯誤:', error);
                    window.location.reload();
                });
            } else {
                window.location.reload();
            }
        });
    }
    
    // 添加用戶活動監聽器
    const userActivityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    userActivityEvents.forEach(eventType => {
        document.addEventListener(eventType, resetInactivityTimer, { passive: true });
    });
    
    // 初始化計時器
    resetInactivityTimer();
}

// 顯示提示訊息 - 修改為堆疊式顯示
function showAlert(message, type = "success", duration = 3000) {
    // 找出當前頁面中的所有提示訊息
    const existingAlerts = document.querySelectorAll('.alert-floating');
    const alertCount = existingAlerts.length;
    
    // 創建新的提示訊息元素
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show alert-floating`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = `${15 + alertCount * 70}px`; // 每個訊息垂直間隔70px
    alertDiv.style.left = '50%';
    alertDiv.style.transform = 'translateX(-50%)';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.6)';
    alertDiv.style.minWidth = '300px';
    alertDiv.style.maxWidth = '80%';
    alertDiv.role = 'alert';
    
    alertDiv.innerHTML = `
        <strong>${type === 'success' ? '✓' : type === 'danger' ? '✗' : 'ℹ'}</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // 為關閉按鈕添加事件監聽器
    const closeButton = alertDiv.querySelector('.btn-close');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            removeAlert(alertDiv);
            // 重新調整其他提示訊息的位置
            repositionAlerts();
        });
    }
    
    // 自動關閉
    setTimeout(() => {
        removeAlert(alertDiv);
        // 重新調整其他提示訊息的位置
        repositionAlerts();
    }, duration);
    
    return alertDiv;
}

// 移除提示訊息
function removeAlert(alertDiv) {
    alertDiv.classList.remove('show');
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 300);
}

// 重新調整其他提示訊息的位置
function repositionAlerts() {
    const alerts = document.querySelectorAll('.alert-floating');
    alerts.forEach((alert, index) => {
        alert.style.top = `${15 + index * 70}px`;
    });
}

// 全頁面加載中顯示
function showPageLoading(message = '處理中，請稍候...') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        // 創建一個新的 overlay
        const newOverlay = document.createElement('div');
        newOverlay.id = 'loadingOverlay';
        newOverlay.innerHTML = `
            <div class="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-25" style="z-index: 9999;">
                <div class="card p-4 shadow">
                    <div class="d-flex align-items-center">
                        <div class="spinner-border text-primary me-3" role="status">
                            <span class="visually-hidden">載入中...</span>
                        </div>
                        <span id="loadingMessage">${message}</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(newOverlay);
    } else {
        const messageEl = document.getElementById('loadingMessage');
        if (messageEl) {
            messageEl.textContent = message;
        }
        overlay.classList.remove('d-none');
    }
}

// 全頁面加載中隱藏
function hidePageLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('d-none');
    }
}

// 添加優惠事件監聽器
function addPromotionEventListeners() {
    try {
        // 查看優惠
        document.querySelectorAll('.view-promotion').forEach(btn => {
            btn.removeEventListener('click', handleViewPromotion);
            btn.addEventListener('click', handleViewPromotion);
        });
        
        // 編輯優惠
        document.querySelectorAll('.edit-promotion').forEach(btn => {
            btn.removeEventListener('click', handleEditPromotion);
            btn.addEventListener('click', handleEditPromotion);
        });
        
        // 刪除優惠
        document.querySelectorAll('.delete-promotion').forEach(btn => {
            btn.removeEventListener('click', handleDeletePromotion);
            btn.addEventListener('click', handleDeletePromotion);
        });
    } catch (error) {
        console.error("添加優惠事件監聽器時出錯:", error);
    }
}

// 處理查看優惠按鈕點擊
function handleViewPromotion(e) {
    if (e) e.preventDefault();
    const promotionId = this.getAttribute('data-id');
    if (promotionId) {
        viewPromotion(promotionId);
    }
}

// 處理編輯優惠按鈕點擊
function handleEditPromotion(e) {
    if (e) e.preventDefault();
    const promotionId = this.getAttribute('data-id');
    if (promotionId) {
        editPromotion(promotionId);
    }
}

// 處理刪除優惠按鈕點擊
function handleDeletePromotion(e) {
    if (e) e.preventDefault();
    const promotionId = this.getAttribute('data-id');
    if (promotionId && confirm("確定要刪除此優惠嗎？")) {
        deletePromotion(promotionId);
    }
}

// 為 iOS 設備提供的圖片壓縮函數 - 處理記憶體問題
async function compressImage(file, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // 計算縮放比例
                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }
                    
                    if (height > maxHeight) {
                        width = (maxHeight / height) * width;
                        height = maxHeight;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    
                    // 使用setTimeout讓瀏覽器有時間釋放資源（對iOS特別有用）
                    setTimeout(() => {
                        try {
                            ctx.clearRect(0, 0, width, height);
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            // 釋放原始圖像
                            img.src = '';
                            
                            // 轉換為blob
                            canvas.toBlob(blob => {
                                // 釋放canvas資源
                                canvas.width = 1;
                                canvas.height = 1;
                                ctx.clearRect(0, 0, 1, 1);
                                
                                resolve(blob);
                            }, file.type, 0.7); // 壓縮質量0.7，對iOS非常重要
                        } catch (e) {
                            console.error("Canvas處理圖像時出錯:", e);
                            reject(e);
                        }
                    }, 50);
                } catch (e) {
                    console.error("創建Canvas元素時出錯:", e);
                    reject(e);
                }
            };
            
            img.onerror = function(e) {
                console.error("圖像加載失敗:", e);
                reject(new Error('圖片加載失敗'));
            };
        };
        
        reader.onerror = function(e) {
            console.error("文件讀取失敗:", e);
            reject(new Error('文件讀取失敗'));
        };
    });
}

// 添加全局函數，以便在HTML中直接調用
window.cancelEdit = cancelEdit;
window.updateMenuItem = updateMenuItem;
window.initMap = initMap; // Google Maps 初始化函數，需要全局可訪問
window.searchLocation = searchLocation;
window.showAlert = showAlert;
window.showPageLoading = showPageLoading;
window.hidePageLoading = hidePageLoading;
window.generateGeohash = generateGeohash;
window.saveBusinessInfo = saveBusinessInfo;
window.saveBusinessHours = saveBusinessHours;
window.saveLocationInfo = saveLocationInfo;
window.saveActivityTypes = saveActivityTypes;
window.updateBusinessTags = updateBusinessTags;
window.createPromotion = createPromotion;
window.loadGoogleMapsAPI = loadGoogleMapsAPI;