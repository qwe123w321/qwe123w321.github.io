// 全域變數
let currentUser = null;
let businessData = null;
let map = null;
let marker = null;
let geocoder = null;

// 頁面載入初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM已加載，初始化儀表板...');
    
    // 綁定登出按鈕
    initLogoutButtons();
    
    // 側邊欄切換
    initSidebar();
    
    // 表單驗證
    initFormValidation();
    
    // 監聽 Firebase 初始化完成事件
    document.addEventListener('firebase-ready', function() {
        console.log('Firebase 初始化完成，開始監聽認證狀態');
        
        // 使用 ES 模組風格的引用
        if (window.auth) {
            window.auth.onAuthStateChanged(handleAuthStateChanged);
        } else if (window.firebase && window.firebase.auth) {
            // 使用全局 firebase
            window.firebase.auth().onAuthStateChanged(handleAuthStateChanged);
        } else {
            console.error('Firebase Auth 未正確初始化');
            showAlert('加載錯誤，請重新整理頁面', 'danger');
        }
    });
    setupSessionTimeoutHandler();
});

// 處理認證狀態變更
function handleAuthStateChanged(user) {
    if (user) {
        currentUser = user;
        setTimeout(() => {
            initAfterAuth();
            loadBusinessData(true);
            initializeMenuMetadata(user.uid); // 明確傳入 businessId
        }, 500);
    } else {
        window.location.href = 'business-login.html?redirect=true';
    }
}

// 認證後初始化其他功能
function initAfterAuth() {
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
    initPromotionForm()
}

// 綁定保存按鈕
function bindSaveButtons() {
    // 店家基本資料保存按鈕
    const saveBusinessInfoBtn = document.getElementById('saveBusinessInfoBtn');
    if (saveBusinessInfoBtn) {
        saveBusinessInfoBtn.addEventListener('click', function() {
            saveBusinessInfo();
        });
        console.log('已綁定店家資料保存按鈕');
    }
    
    // 營業時間保存按鈕
    const saveBusinessHoursBtn = document.getElementById('saveBusinessHoursBtn');
    if (saveBusinessHoursBtn) {
        saveBusinessHoursBtn.addEventListener('click', function() {
            saveBusinessHours();
        });
        console.log('已綁定營業時間保存按鈕');
    }
    
    // 地理位置保存按鈕
    const saveLocationBtn = document.getElementById('saveLocationBtn');
    if (saveLocationBtn) {
        saveLocationBtn.addEventListener('click', function() {
            saveLocationInfo();
        });
        console.log('已綁定位置保存按鈕');
    }
    
    // 活動類型保存按鈕
    const saveActivityTypesBtn = document.getElementById('saveActivityTypesBtn');
    if (saveActivityTypesBtn) {
        saveActivityTypesBtn.addEventListener('click', function() {
            saveActivityTypes();
        });
        console.log('已綁定活動類型保存按鈕');
    }
    
    // 標籤保存按鈕
    const saveTagsBtn = document.getElementById('saveTagsBtn');
    if (saveTagsBtn) {
        saveTagsBtn.addEventListener('click', function() {
            updateBusinessTags();
        });
        console.log('已綁定標籤保存按鈕');
    }
}

// 登出按鈕初始化
function initLogoutButtons() {
    const logoutButtons = document.querySelectorAll('#logoutLink, a[href="#"][id="logoutLink"]');
    
    if (logoutButtons.length > 0) {
        logoutButtons.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    performLogout();
                });
                console.log('已綁定登出按鈕:', btn);
            }
        });
    } else {
        console.warn('沒有找到登出按鈕');
    }
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
    
    // 使用全局 auth 物件
    try {
        if (window.auth) {
            // 使用模組化方式登出
            window.auth.signOut().then(() => {
                logoutSuccess();
            }).catch(error => {
                logoutError(error);
            });
        } else if (window.firebase && window.firebase.auth) {
            // 使用全局 firebase 物件登出 (後備方案)
            window.firebase.auth.signOut().then(() => {
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
        localStorage.clear();
        sessionStorage.clear();
    } catch (e) {
        console.warn('清除存儲時出錯:', e);
    }
    
    // 顯示成功消息
    showAlert('登出成功，正在跳轉...', 'success');
    
    // 延遲重定向以顯示訊息
    setTimeout(() => {
        // 添加時間戳防止快取
        window.location.href = 'business-login.html?t=' + new Date().getTime();
    }, 1000);
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
    showAlert('登出失敗，請重新嘗試', 'danger');
}

// 強制重定向（最後的後備方案）
function forceRedirect() {
    console.warn('強制重定向到登入頁面');
    showAlert('重新導向到登入頁面...', 'warning');
    
    setTimeout(() => {
        document.cookie = ""; // 清除 cookies
        window.location.href = 'business-login.html?forced=true&t=' + new Date().getTime();
    }, 1000);
}

// 加載店家資料
async function loadBusinessData(force = false) {
    try {
        showPageLoading("載入店家資料中...");
        
        // 確保用戶已登入
        if (!currentUser || !currentUser.uid) {
            console.error("未找到用戶資料");
            showAlert("請重新登入", "danger");
            hidePageLoading();
            return;
        }
        
        console.log("開始加載商家資料...");
        
        // 檢查 DB 是否已初始化
        const db = window.db;
        if (!db) {
            console.error("Firestore 未正確初始化");
            showAlert("資料庫連接錯誤，請重新整理頁面", "danger");
            hidePageLoading();
            return;
        }
        
        // 加載商家資料
        try {
            const businessDoc = await db.collection("businesses").doc(currentUser.uid).get();
            
            if (businessDoc.exists) {
                businessData = businessDoc.data();
                console.log("成功從資料庫載入商家資料:", businessData);
                
                // 更新 UI 顯示
                updateAllUI();
                
                // 特別處理營業時間
                ensureBusinessHoursExist();
                
                // 加載商品項目
                loadMenuItems();
                
                // 加載優惠資訊
                loadPromotions();
                
                showAlert("店家資料已載入完成", "success");
            } else {
                // 店家資料不存在，可能是新用戶
                console.log("店家資料不存在，創建新資料");
                showAlert("歡迎使用店家管理平台！請完善您的店家資料。", "info");
                
                // 創建新的店家文檔
                await initializeNewBusiness();
                
                // 設置預設營業時間
                ensureBusinessHoursExist();
            }
        } catch (dbError) {
            console.error("Firestore 查詢錯誤:", dbError);
            showAlert("讀取資料時發生錯誤: " + dbError.message, "danger");
        }
        
        hidePageLoading();
    } catch (error) {
        console.error("載入店家資料錯誤:", error);
        showAlert("載入資料時發生錯誤，請稍後再試", "danger");
        hidePageLoading();
    }

    // 確保只有當地圖容器存在時才初始化Google Maps
    if (document.getElementById('mapContainer')) {
        // 檢查API密鑰問題
        if (!window.googleMapsInitialized) {
            loadGoogleMapsAPI();
            window.googleMapsInitialized = true;
        }
    }
    
    // 新增：確保地址顯示正確
    const formattedAddressField = document.getElementById('formattedAddress');
    if (formattedAddressField && businessData && businessData.address) {
        formattedAddressField.value = businessData.address;
    }
}

// 初始化優惠表單
function initPromotionForm() {
    console.log("初始化優惠表單");
    const promotionForm = document.getElementById('promotionForm');
    
    // 清除所有現有的事件監聽器(如果有的話)
    const createBtn = document.getElementById('createPromotionBtn');
    if (createBtn) {
        const newBtn = createBtn.cloneNode(true);
        createBtn.parentNode.replaceChild(newBtn, createBtn);
    }
    
    if (promotionForm) {
        // 重置表單以清除可能的狀態
        promotionForm.reset();
        
        // 確保表單不會自動提交
        promotionForm.setAttribute('onsubmit', 'return false;');
        
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
        const createBtn = document.getElementById('createPromotionBtn');
        if (createBtn) {
            console.log("正在綁定建立優惠按鈕點擊事件");
            createBtn.addEventListener('click', function() {
                console.log("點擊建立優惠按鈕");
                createPromotion();
            });
        } else {
            console.error("找不到建立優惠按鈕 (ID: createPromotionBtn)");
        }
        
        // 綁定重置按鈕
        const resetBtn = document.getElementById('resetPromotionForm');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                promotionForm.reset();
                
                if (promotionStart) {
                    promotionStart.value = formatDateForInput(new Date());
                }
                
                if (promotionEnd) {
                    const newEndDate = new Date();
                    newEndDate.setDate(new Date().getDate() + 30);
                    promotionEnd.value = formatDateForInput(newEndDate);
                }
            });
        }
    } else {
        console.error("找不到優惠表單 (ID: promotionForm)");
    }
    
    // 綁定搜索按鈕
    const searchBtn = document.getElementById('searchPromotionBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            searchPromotions();
        });
    }
    
    // 綁定過濾下拉框
    const filterSelect = document.getElementById('promotionFilter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            searchPromotions();
        });
    }
    
    // 綁定搜索框
    const searchInput = document.getElementById('promotionSearch');
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            if (e.key === 'Enter') {
                searchPromotions();
            }
        });
    }
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
        
        // 收集表單數據
        console.log("收集表單數據");
        const title = document.getElementById('promotionTitle').value;
        const type = document.getElementById('promotionType').value;
        const description = document.getElementById('promotionDesc').value;
        const startDateStr = document.getElementById('promotionStart').value;
        const endDateStr = document.getElementById('promotionEnd').value;
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
        showAlert("創建優惠失敗: " + error.message, "danger");
    }
}

// 搜索優惠
async function searchPromotions() {
    try {
        const searchText = document.getElementById('promotionSearch').value.trim().toLowerCase();
        const filterValue = document.getElementById('promotionFilter').value;
        
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
                promotion.title.toLowerCase().includes(searchText) ||
                promotion.description.toLowerCase().includes(searchText);
            
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
    } catch (error) {
        console.error("搜索優惠失敗:", error);
        showAlert("搜索優惠失敗: " + error.message, "danger");
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
    if (window.promotionChart && typeof window.promotionChart.dispose === 'function') {
        window.promotionChart.dispose();
    } else {
        // 如果不存在或者dispose不是函數，確保清空图表元素
        chartElement.innerHTML = '';
    }
    
    // 確保 ApexCharts 庫已加載
    if (typeof ApexCharts === 'undefined') {
        console.warn("ApexCharts 庫未加載，跳過圖表初始化");
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
                }
            },
            dataLabels: {
                enabled: false
            },
            stroke: {
                curve: 'smooth',
                width: 3
            },
            grid: {
                row: {
                    colors: ['#f3f3f3', 'transparent'],
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
            }
        });
        
        // 確保 render 方法存在
        if (typeof window.promotionChart.render === 'function') {
            window.promotionChart.render();
        } else {
            console.warn("ApexCharts 對象缺少 render 方法");
        }
    } catch (error) {
        console.error("初始化圖表時出錯:", error);
    }
}

// 更新優惠
async function updatePromotion(promotionId, updatedData) {
    try {
        showPageLoading("更新優惠中...");
        
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
        showAlert("更新優惠失敗: " + error.message, "danger");
    }
}

// 編輯優惠
function editPromotion(promotionId) {
    // 獲取優惠數據
    window.db.collection("promotions").doc(promotionId).get()
        .then(doc => {
            if (!doc.exists) {
                showAlert("找不到此優惠", "warning");
                return;
            }
            
            const promotion = doc.data();
            
            // 創建編輯模態框
            showEditPromotionModal(promotionId, promotion);
        })
        .catch(error => {
            console.error("獲取優惠數據失敗:", error);
            showAlert("獲取優惠數據失敗", "danger");
        });
}

// 顯示編輯優惠模態框
function showEditPromotionModal(promotionId, promotion) {
    // 檢查是否已存在相同ID的模態框
    let modalElement = document.getElementById(`editModal-${promotionId}`);
    if (modalElement) {
        // 如果存在，直接顯示
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        return;
    }
    
    // 格式化日期
    const startDate = promotion.startDate instanceof Date ? 
        promotion.startDate : 
        new Date(promotion.startDate.seconds * 1000);
    
    const endDate = promotion.endDate instanceof Date ? 
        promotion.endDate : 
        new Date(promotion.endDate.seconds * 1000);
    
    // 創建模態框HTML
    const modalHTML = `
        <div class="modal fade" id="editModal-${promotionId}" tabindex="-1" aria-labelledby="editModalLabel-${promotionId}" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="editModalLabel-${promotionId}">編輯優惠</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <form id="editForm-${promotionId}">
                            <div class="mb-3">
                                <label for="editTitle-${promotionId}" class="form-label">優惠標題</label>
                                <input type="text" class="form-control" id="editTitle-${promotionId}" value="${promotion.title || ''}" required>
                            </div>
                            <div class="mb-3">
                                <label for="editType-${promotionId}" class="form-label">優惠類型</label>
                                <select class="form-select" id="editType-${promotionId}" required>
                                    <option value="discount" ${promotion.type === 'discount' ? 'selected' : ''}>折扣</option>
                                    <option value="gift" ${promotion.type === 'gift' ? 'selected' : ''}>招待</option>
                                    <option value="combo" ${promotion.type === 'combo' ? 'selected' : ''}>套餐</option>
                                    <option value="special" ${promotion.type === 'special' ? 'selected' : ''}>特別優惠</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="editDesc-${promotionId}" class="form-label">優惠描述</label>
                                <textarea class="form-control" id="editDesc-${promotionId}" rows="3" required>${promotion.description || ''}</textarea>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="editStart-${promotionId}" class="form-label">開始日期</label>
                                        <input type="date" class="form-control" id="editStart-${promotionId}" value="${formatDateForInput(startDate)}" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="editEnd-${promotionId}" class="form-label">結束日期</label>
                                        <input type="date" class="form-control" id="editEnd-${promotionId}" value="${formatDateForInput(endDate)}" required>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">適用對象</label>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="editTargetAudience-${promotionId}" id="editAllUsers-${promotionId}" value="all" ${promotion.targetAudience === 'all' ? 'checked' : ''}>
                                    <label class="form-check-label" for="editAllUsers-${promotionId}">
                                        目前店內活動（所有顧客）
                                    </label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="editTargetAudience-${promotionId}" id="editBrewdateUsers-${promotionId}" value="brewdate" ${promotion.targetAudience === 'brewdate' ? 'checked' : ''}>
                                    <label class="form-check-label" for="editBrewdateUsers-${promotionId}">
                                        <strong>僅限BREWDATE用戶</strong>
                                    </label>
                                </div>
                            </div>
                            <div class="mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input" type="checkbox" id="editActive-${promotionId}" ${promotion.isActive ? 'checked' : ''}>
                                    <label class="form-check-label" for="editActive-${promotionId}">
                                        優惠狀態 (啟用/停用)
                                    </label>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                        <button type="button" class="btn btn-primary" id="saveEditBtn-${promotionId}">儲存變更</button>
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
    modalElement = document.getElementById(`editModal-${promotionId}`);
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    
    // 綁定儲存按鈕
    const saveBtn = document.getElementById(`saveEditBtn-${promotionId}`);
    saveBtn.addEventListener('click', async function() {
        try {
            // 收集表單數據
            const title = document.getElementById(`editTitle-${promotionId}`).value;
            const type = document.getElementById(`editType-${promotionId}`).value;
            const description = document.getElementById(`editDesc-${promotionId}`).value;
            const startDateStr = document.getElementById(`editStart-${promotionId}`).value;
            const endDateStr = document.getElementById(`editEnd-${promotionId}`).value;
            const targetAudience = document.querySelector(`input[name="editTargetAudience-${promotionId}"]:checked`).value;
            const isActive = document.getElementById(`editActive-${promotionId}`).checked;
            
            // 驗證必填字段
            if (!title || !type || !description || !startDateStr || !endDateStr) {
                showAlert("請填寫所有必填字段", "warning");
                return;
            }
            
            // 解析日期
            const startDate = new Date(startDateStr);
            const endDate = new Date(endDateStr);
            endDate.setHours(23, 59, 59, 999); // 設置結束日期為當天結束
            
            // 準備更新數據
            const updatedData = {
                title: title,
                type: type,
                description: description,
                startDate: window.firebase.firestore.Timestamp.fromDate(startDate),
                endDate: window.firebase.firestore.Timestamp.fromDate(endDate),
                targetAudience: targetAudience,
                isActive: isActive
            };
            
            // 更新優惠
            await updatePromotion(promotionId, updatedData);
            
            // 關閉模態框
            modal.hide();
        } catch (error) {
            console.error("儲存編輯失敗:", error);
            showAlert("儲存編輯失敗: " + error.message, "danger");
        }
    });
}

// 判斷優惠是否進行中
function isPromotionActive(promotion) {
    // 檢查isActive屬性
    if (promotion.isActive === false) {
        return false;
    }
    
    const now = new Date();
    
    // 如果沒有日期，假設結束
    if (!promotion.startDate || !promotion.endDate) return false;
    
    // 轉換日期
    let startDate, endDate;
    
    if (promotion.startDate instanceof Date) {
        startDate = promotion.startDate;
    } else if (promotion.startDate.seconds) {
        // Firestore Timestamp
        startDate = new Date(promotion.startDate.seconds * 1000);
    } else {
        startDate = new Date(promotion.startDate);
    }
    
    if (promotion.endDate instanceof Date) {
        endDate = promotion.endDate;
    } else if (promotion.endDate.seconds) {
        // Firestore Timestamp
        endDate = new Date(promotion.endDate.seconds * 1000);
    } else {
        endDate = new Date(promotion.endDate);
    }
    
    // 設置結束日期到當天結束
    endDate.setHours(23, 59, 59, 999);
    
    return now >= startDate && now <= endDate;
}

// 格式化優惠類型
function formatPromotionType(type) {
    const types = {
        "discount": "折扣",
        "gift": "贈品",
        "combo": "套餐",
        "special": "特別優惠"
    };
    
    return types[type] || type || "未指定";
}

// 格式化目標受眾
function formatTargetAudience(audience) {
    const audiences = {
        "all": "目前店內活動",
        "brewdate": "僅限BREWDATE用戶"
    };
    
    return audiences[audience] || audience || "所有顧客";
}

// 格式化日期範圍
function formatDateRange(start, end) {
    if (!start || !end) return "未設定";
    
    // 解析開始日期
    let startDate;
    if (start instanceof Date) {
        startDate = start;
    } else if (start.seconds) {
        // Firestore Timestamp
        startDate = new Date(start.seconds * 1000);
    } else {
        startDate = new Date(start);
    }
    
    // 解析結束日期
    let endDate;
    if (end instanceof Date) {
        endDate = end;
    } else if (end.seconds) {
        // Firestore Timestamp
        endDate = new Date(end.seconds * 1000);
    } else {
        endDate = new Date(end);
    }
    
    // 格式化
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    };
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

// 添加優惠事件監聽器
function addPromotionEventListeners() {
    // 查看優惠
    document.querySelectorAll('.view-promotion').forEach(btn => {
        btn.addEventListener('click', function() {
            const promotionId = this.getAttribute('data-id');
            viewPromotion(promotionId);
        });
    });
    
    // 編輯優惠
    document.querySelectorAll('.edit-promotion').forEach(btn => {
        btn.addEventListener('click', function() {
            const promotionId = this.getAttribute('data-id');
            editPromotion(promotionId);
        });
    });
    
    // 刪除優惠
    document.querySelectorAll('.delete-promotion').forEach(btn => {
        btn.addEventListener('click', function() {
            const promotionId = this.getAttribute('data-id');
            if (confirm("確定要刪除此優惠嗎？")) {
                deletePromotion(promotionId);
            }
        });
    });
}

// 查看優惠詳情
function viewPromotion(promotionId) {
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
}

// 顯示查看優惠模態框
function showViewPromotionModal(promotionId, promotion) {
    // 檢查是否已存在相同ID的模態框
    let modalElement = document.getElementById(`viewModal-${promotionId}`);
    if (modalElement) {
        // 如果存在，直接顯示
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
        return;
    }
    
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
    editBtn.addEventListener('click', function() {
        // 關閉查看模態框
        modal.hide();
        
        // 打開編輯模態框
        setTimeout(() => {
            editPromotion(promotionId);
        }, 500);
    });
}

// 增加查看次數
async function incrementViewCount(promotionId) {
    try {
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
    }
}

// 更新優惠列表 UI
function updatePromotionsList(promotions) {
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
}

// 更新優惠統計圖表
function updatePromotionStatsChart(promotions) {
    // 更新圖表
    if (window.promotionChart && typeof ApexCharts !== 'undefined') {
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
        
        // TODO: 這裡需要與實際資料結構相匹配
        // 實際上應該從優惠的使用記錄中統計每天的使用次數
        
        // 暫時使用隨機數據展示
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
        document.getElementById('totalPromotionUsage').textContent = totalUsage;
        document.getElementById('avgDailyUsage').textContent = (totalUsage / 7).toFixed(1);
        document.getElementById('appGeneratedCustomers').textContent = totalUsage;
        
        // 找出最熱門優惠
        let maxUsage = 0;
        let popularPromotion = "-";
        
        promotions.forEach(promotion => {
            if (promotion.usageCount > maxUsage) {
                maxUsage = promotion.usageCount;
                popularPromotion = promotion.title;
            }
        });
        
        document.getElementById('mostPopularPromotion').textContent = popularPromotion;
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
        
        await window.db.collection("promotions").doc(promotionId).delete();
        
        // 重新加載優惠列表
        await loadPromotions();
        
        hidePageLoading();
        showAlert("優惠已成功刪除", "success");
    } catch (error) {
        console.error("刪除優惠失敗:", error);
        hidePageLoading();
        showAlert("刪除優惠失敗: " + error.message, "danger");
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
        button.addEventListener('click', function() {
            // 移除其他按鈕的active類
            periodButtons.forEach(btn => btn.classList.remove('active'));
            
            // 添加當前按鈕的active類
            this.classList.add('active');
            
            // 獲取時間範圍
            const period = parseInt(this.getAttribute('data-period')) || 7;
            
            // 更新圖表
            // TODO: 根據選擇的時間範圍更新圖表數據
            console.log(`切換圖表時間範圍為 ${period} 天`);
            
            // 臨時顯示提示
            showAlert(`已切換為${period}天數據統計`, "info");
        });
    });
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
            <img src="${imageUrl}" alt="店家頭像/Logo">
            <div class="remove-image">
                <i class="fas fa-times"></i>
            </div>
            `;
            
            // 添加刪除事件
            const removeBtn = mainImagePreview.querySelector('.remove-image');
            if (removeBtn) {
                removeBtn.addEventListener('click', function() {
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
        } else {
            const hourSelectionDivs = businessHoursContainer.querySelectorAll(".hours-selection");
            if (hourSelectionDivs.length > 0) {
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
            } else {
                // 如果選擇器不存在，創建新的UI
                const hourSelectionDivs = createBusinessHoursUI(businessHoursContainer);
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
        if (businessData.activityTypes && businessData.activityTypes.length > 0) {
            updateActivityTypes(businessData.activityTypes);
        }
    } catch (error) {
        console.error("更新活動類型UI錯誤:", error);
    }
}

// 更新活動類型
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
                const cardText = card.querySelector("p");
                if (cardText && cardText.textContent === type) {
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

// 更新標籤UI
function updateTagsUI() {
    try {
        if (businessData.tags && businessData.tags.length > 0) {
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

// 更新環境照片
function updateEnvironmentImages() {
    try {
      // 獲取照片來源 - 統一使用 environmentImages
      const environmentImages = businessData.environmentImages || [];
      
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
  

// 更新地理位置
function updateLocationFields() {
    try {
        if (businessData.position && businessData.position.geopoint) {
            // 填充地址欄位
            const formattedAddressField = document.getElementById('formattedAddress');
            if (formattedAddressField) {
                formattedAddressField.value = businessData.address || "";
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

// 為新用戶初始化店家資料
async function initializeNewBusiness() {
    try {
        if (!currentUser || !currentUser.uid) {
            console.error("未找到用戶資料，無法初始化店家");
            return;
        }
        
        const db = window.db;
        if (!db) {
            console.error("Firestore 未正確初始化");
            return;
        }
        
        // 檢查是否已存在店家文檔
        const businessDoc = await db.collection("businesses").doc(currentUser.uid).get();
        if (businessDoc.exists) {
            console.log("店家文檔已存在，不需要初始化");
            return;
        }
        
        // 創建預設數據
        const defaultBusinessData = {
            businessName: "未命名店家",
            description: "",
            phoneNumber: "",
            email: currentUser.email || "",
            website: "",
            status: "active",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 寫入到資料庫
        await db.collection("businesses").doc(currentUser.uid).set(defaultBusinessData);
        console.log("已創建新的店家資料");
        
        // 更新本地數據
        businessData = defaultBusinessData;
        
        // 更新UI顯示
        updateHeaderInfo();
        updateBusinessFormFields();
    } catch (error) {
        console.error("初始化新店家資料時出錯:", error);
        showAlert("創建店家檔案時發生錯誤，請稍後再試", "danger");
    }
}

// 加載商品項目
async function loadMenuItems() {
    try {
        console.log("開始加載商品項目列表");
        
        if (!window.db || !currentUser) {
            console.error("Firestore或用戶未初始化");
            return;
        }
        
        // 確保商品管理區域可見
        const menuSection = document.getElementById('menu-section');
        if (menuSection && !menuSection.innerHTML.trim()) {
            console.log("初始化商品管理區域");
        }
        
        const db = window.db;
        
        // 查詢商品類別
        const categoriesSnapshot = await db.collection("categories")
            .where("businessId", "==", currentUser.uid)
            .orderBy("createdAt", "asc")
            .get();
        
        const categories = [];
        categoriesSnapshot.forEach(doc => {
            categories.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`找到 ${categories.length} 個類別`);
        
        // 查詢商品項目
        const menuItemsSnapshot = await db.collection("menuItems")
            .where("businessId", "==", currentUser.uid)
            .orderBy("createdAt", "asc")
            .get();
        
        // 按類別分組商品項目
        const menuItemsByCategory = {};
        
        // 先初始化從資料庫獲取的類別
        categories.forEach(category => {
            menuItemsByCategory[category.name] = [];
        });
        
        // 將項目添加到對應類別
        let totalItems = 0;
        menuItemsSnapshot.forEach(doc => {
            const item = {
                id: doc.id,
                ...doc.data()
            };
            totalItems++;
            
            // 如果類別不存在，創建它
            if (!menuItemsByCategory[item.category]) {
                menuItemsByCategory[item.category] = [];
            }
            
            menuItemsByCategory[item.category].push(item);
        });
        
        console.log(`找到 ${totalItems} 個商品項目`);
        
        // 更新 UI
        updateMenuItemsList(menuItemsByCategory);
    } catch (error) {
        console.error("載入商品項目錯誤:", error);
        showAlert("載入商品項目失敗，請稍後再試", "danger");
    }
}

// 更新商品列表UI
function updateMenuItemsList(menuItemsByCategory) {
    const categoryList = document.getElementById("categoryList");
    if (!categoryList) {
        console.warn("找不到類別列表容器");
        return;
    }
    
    // 清空現有內容
    categoryList.innerHTML = "";
    
    // 檢查是否有商品類別
    if (Object.keys(menuItemsByCategory).length === 0) {
        categoryList.innerHTML = `
            <div class="text-center py-4 text-muted" id="categoryListEmpty">
                <i class="fas fa-utensils fa-3x mb-3"></i>
                <p>尚未添加任何商品類別</p>
                <p>點擊「新增類別」按鈕開始建立您的菜單</p>
            </div>
        `;
        return;
    }
    
    // 首先，獲取所有類別的詳細信息
    getCategoryDetails().then(categoryDetails => {
        // 為每個類別創建區塊
        for (const category in menuItemsByCategory) {
            const items = menuItemsByCategory[category];
            const categoryInfo = categoryDetails[category] || { description: "" };
            
            const categoryElement = document.createElement("div");
            categoryElement.className = "product-item mb-4";
            categoryElement.innerHTML = `
                <div class="product-category d-flex justify-content-between align-items-center mb-2">
                    <h5 class="mb-0">${category}</h5>
                    <div class="actions">
                        <button class="btn btn-sm btn-outline-primary add-product-btn" data-category="${category}">
                            <i class="fas fa-plus"></i> 新增項目
                        </button>
                        <button class="btn btn-sm btn-outline-secondary edit-category-btn" data-category="${category}">
                            <i class="fas fa-edit"></i> 修改類別
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-category-btn" data-category="${category}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
            
            // 添加類別描述（如果有）
            if (categoryInfo.description && categoryInfo.description.trim() !== "") {
                const descriptionElement = document.createElement("div");
                descriptionElement.className = "category-description mb-3";
                descriptionElement.innerHTML = `
                    <p class="text-muted small">${categoryInfo.description}</p>
                `;
                categoryElement.appendChild(descriptionElement);
            }
            
            // 創建項目列表容器
            const itemsList = document.createElement("div");
            itemsList.className = "product-item-list";
            
            // 添加每個項目
            items.forEach(item => {
                const itemElement = document.createElement("div");
                itemElement.className = "product-subitem mb-2";
                itemElement.dataset.id = item.id;
                
                itemElement.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <span class="product-name fw-bold">${item.name}</span>
                            ${item.description ? `<p class="mb-0 text-muted small">${item.description}</p>` : ''}
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="text-primary fw-bold">${item.price ? `NT$${item.price}` : ''}</span>
                            <button class="btn btn-sm btn-outline-secondary edit-item-btn" data-id="${item.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger delete-item-btn" data-id="${item.id}">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                itemsList.appendChild(itemElement);
            });
            
            // 添加項目表單 (初始隱藏)
            const formId = `${category.replace(/\s+/g, '-').toLowerCase()}-item-form`;
            const itemForm = document.createElement("div");
            itemForm.className = "menu-item-form mt-3";
            itemForm.id = formId;
            itemForm.style.display = "none";
            
            itemForm.innerHTML = `
                <h6>新增 ${category} 項目</h6>
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="${formId}-name" class="form-label">商品名稱</label>
                            <input type="text" class="form-control" id="${formId}-name" placeholder="輸入商品名稱">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="${formId}-price" class="form-label">價格</label>
                            <input type="number" class="form-control" id="${formId}-price" placeholder="輸入價格">
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <label for="${formId}-desc" class="form-label">描述</label>
                    <textarea class="form-control" id="${formId}-desc" rows="2" placeholder="描述商品特色或口味"></textarea>
                </div>
                <div class="d-flex gap-2">
                    <button type="button" class="btn btn-primary save-item-btn" data-category="${category}">儲存</button>
                    <button type="button" class="btn btn-outline-secondary cancel-add-item" data-form="${formId}">取消</button>
                </div>
            `;
            
            // 將項目列表和表單添加到類別元素
            categoryElement.appendChild(itemsList);
            categoryElement.appendChild(itemForm);
            
            // 將類別元素添加到頁面
            categoryList.appendChild(categoryElement);
        }
        
        // 添加事件監聽器
        addMenuItemsEvents();
    }).catch(error => {
        console.error("獲取類別詳情失敗:", error);
        showAlert("載入類別詳情失敗，請稍後再試", "danger");
    });
}

// 獲取所有類別的詳細信息，包括描述
async function getCategoryDetails() {
    try {
        // 確保 Firestore 和用戶已初始化
        if (!window.db || !currentUser) {
            console.error("Firestore 或用戶未初始化");
            return {};
        }
        
        // 查詢所有類別
        const categoriesSnapshot = await window.db.collection("categories")
            .where("businessId", "==", currentUser.uid)
            .get();
        
        // 建立類別詳情映射
        const categoryDetails = {};
        categoriesSnapshot.forEach(doc => {
            const data = doc.data();
            categoryDetails[data.name] = {
                id: doc.id,
                description: data.description || "",
                createdAt: data.createdAt,
                updatedAt: data.updatedAt
            };
        });
        
        return categoryDetails;
    } catch (error) {
        console.error("獲取類別詳情失敗:", error);
        return {};
    }
}

// 將函數暴露到全局範圍
window.editCategory = editCategory;
window.updateCategory = updateCategory;

// 編輯類別功能
async function editCategory(categoryName) {
    try {
        console.log("開始編輯類別:", categoryName);
        
        // 使用單一 where 查詢，然後在 JavaScript 中篩選結果
        const categoriesSnapshot = await window.db.collection("categories")
            .where("businessId", "==", currentUser.uid)
            .get();
        
        // 手動在結果中查找對應名稱的類別
        let categoryDoc = null;
        let categoryId = null;
        
        categoriesSnapshot.forEach(doc => {
            // 只處理名稱匹配的文檔
            if (doc.data().name === categoryName) {
                categoryDoc = doc.data();
                categoryId = doc.id;
            }
        });
        
        if (!categoryDoc) {
            showAlert("找不到此類別", "warning");
            return;
        }
        
        console.log("獲取到類別資料:", categoryDoc);
        
        // 找到此類別的HTML元素
        let categoryElement = null;
        const categoryHeaders = document.querySelectorAll('.product-category h5.mb-0');
        for (const header of categoryHeaders) {
            if (header.textContent === categoryName) {
                categoryElement = header.closest('.product-item');
                break;
            }
        }
        
        if (!categoryElement) {
            showAlert("找不到類別元素", "warning");
            return;
        }
        
        // 如果已有編輯表單，先移除
        const existingForm = categoryElement.querySelector('.edit-category-form');
        if (existingForm) {
            existingForm.remove();
        }
        
        // 創建編輯表單
        const editForm = document.createElement('div');
        editForm.className = 'menu-item-form mt-3 edit-category-form';
        editForm.style.display = 'block'; // 確保表單顯示
        editForm.innerHTML = `
            <h6>編輯「${categoryName}」類別</h6>
            <div class="mb-3">
                <label class="form-label">類別名稱</label>
                <input type="text" class="form-control" id="edit-category-name-${categoryId}" value="${categoryDoc.name || ''}">
                <input type="hidden" id="edit-category-oldname-${categoryId}" value="${categoryName}">
            </div>
            <div class="mb-3">
                <label class="form-label">類別描述</label>
                <textarea class="form-control" id="edit-category-desc-${categoryId}" rows="2">${categoryDoc.description || ''}</textarea>
            </div>
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-primary" onclick="updateCategory('${categoryId}')">更新類別</button>
                <button type="button" class="btn btn-outline-secondary cancel-edit-btn">取消</button>
            </div>
        `;
        
        // 插入表單到類別元素中
        categoryElement.appendChild(editForm);
        
        // 為取消按鈕添加事件
        const cancelBtn = editForm.querySelector('.cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                editForm.remove();
            });
        }
        
        // 滾動到表單位置
        editForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
        console.error("載入類別編輯失敗:", error);
        showAlert("無法載入類別資料，請稍後再試", "danger");
    }
}

// 添加商品項目相關事件
function addMenuItemsEvents() {
    // 使用事件委派方式處理所有按鈕交互
    const categoryList = document.getElementById("categoryList");
    if (categoryList) {
        // 移除先前的事件處理器，防止重複綁定
        categoryList.removeEventListener("click", categoryClickHandler);
        
        // 添加新的事件委派處理器
        categoryList.addEventListener("click", categoryClickHandler);
    }
    
    // 綁定添加項目按鈕 - 這部分交由事件委派處理
    // 綁定取消按鈕 - 這部分交由事件委派處理
}

// 事件委派處理函數
function categoryClickHandler(event) {
    const target = event.target;
    
    // ===== 類別相關操作 =====
    
    // 處理編輯類別按鈕點擊
    if (target.classList.contains("edit-category-btn") || target.closest(".edit-category-btn")) {
        const btn = target.classList.contains("edit-category-btn") ? target : target.closest(".edit-category-btn");
        const categoryName = btn.getAttribute("data-category");
        console.log("編輯類別按鈕被點擊，類別名稱:", categoryName);
        editCategory(categoryName);
        event.stopPropagation(); // 阻止事件冒泡
        return; // 提早返回，防止其他處理邏輯執行
    }
    
    // 處理刪除類別按鈕點擊
    if (target.classList.contains("delete-category-btn") || target.closest(".delete-category-btn")) {
        const btn = target.classList.contains("delete-category-btn") ? target : target.closest(".delete-category-btn");
        const category = btn.getAttribute("data-category");
        if (confirm(`確定要刪除「${category}」類別及其所有項目嗎？`)) {
            deleteCategory(category);
        }
        event.stopPropagation(); // 阻止事件冒泡
        return; // 提早返回，防止其他處理邏輯執行
    }
    
    // 處理添加項目按鈕點擊
    if (target.classList.contains("add-product-btn") || target.closest(".add-product-btn")) {
        const btn = target.classList.contains("add-product-btn") ? target : target.closest(".add-product-btn");
        const category = btn.getAttribute("data-category");
        const formId = `${category.replace(/\s+/g, '-').toLowerCase()}-item-form`;
        const form = document.getElementById(formId);
        
        if (form) {
            form.style.display = 'block';
        }
        event.stopPropagation(); // 阻止事件冒泡
        return; // 提早返回，防止其他處理邏輯執行
    }
    
    // ===== 項目相關操作 =====
    
    // 處理編輯項目按鈕點擊
    if (target.classList.contains("edit-item-btn") || target.closest(".edit-item-btn")) {
        const btn = target.classList.contains("edit-item-btn") ? target : target.closest(".edit-item-btn");
        const itemId = btn.getAttribute("data-id");
        console.log("編輯按鈕被點擊，項目ID:", itemId);
        editMenuItem(itemId);
        event.stopPropagation(); // 阻止事件冒泡
        return; // 提早返回，防止其他處理邏輯執行
    }
    
    // 處理刪除項目按鈕點擊
    if (target.classList.contains("delete-item-btn") || target.closest(".delete-item-btn")) {
        const btn = target.classList.contains("delete-item-btn") ? target : target.closest(".delete-item-btn");
        const itemId = btn.getAttribute("data-id");
        if (confirm("確定要刪除此商品項目嗎？")) {
            deleteMenuItem(itemId);
        }
        event.stopPropagation(); // 阻止事件冒泡
        return; // 提早返回，防止其他處理邏輯執行
    }
    
    // ===== 表單相關操作 =====
    
    // 處理儲存項目按鈕點擊
    if (target.classList.contains("save-item-btn") || target.closest(".save-item-btn")) {
        const btn = target.classList.contains("save-item-btn") ? target : target.closest(".save-item-btn");
        const category = btn.getAttribute("data-category");
        saveMenuItem(category);
        event.stopPropagation(); // 阻止事件冒泡
        return; // 提早返回，防止其他處理邏輯執行
    }
    
    // 處理取消按鈕點擊
    if (target.classList.contains("cancel-add-item") || target.closest(".cancel-add-item")) {
        const btn = target.classList.contains("cancel-add-item") ? target : target.closest(".cancel-add-item");
        const formId = btn.getAttribute("data-form");
        
        if (formId) {
            const form = document.getElementById(formId);
            if (form) {
                form.style.display = 'none';
            }
        }
        event.stopPropagation(); // 阻止事件冒泡
        return; // 提早返回，防止其他處理邏輯執行
    }
}

// 確保該函數成為全局可用
window.categoryClickHandler = categoryClickHandler;

// 儲存商品項目
async function saveMenuItem(category) {
    console.log(`正在儲存 ${category} 的商品項目`); // 添加日誌
    
    try {
        const formId = `${category.replace(/\s+/g, '-').toLowerCase()}-item-form`;
        const nameInput = document.getElementById(`${formId}-name`);
        const priceInput = document.getElementById(`${formId}-price`);
        const descInput = document.getElementById(`${formId}-desc`);
        
        if (!nameInput || !priceInput) {
            showAlert("商品表單欄位不完整", "warning");
            return;
        }
        
        // 驗證必填字段
        if (!nameInput.value) {
            showAlert("請填寫商品名稱", "warning");
            return;
        }
        
        // 驗證價格
        const price = parseFloat(priceInput.value);
        if (isNaN(price) || price <= 0) {
            showAlert("請輸入有效的價格", "warning");
            return;
        }
        
        // 顯示載入提示
        showAlert("儲存中...", "info");
        
        // 準備項目數據
        const itemData = {
            businessId: currentUser.uid,
            category: category,
            name: nameInput.value,
            price: price,
            description: descInput ? descInput.value : "",
            displayInApp: true,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 添加到Firestore
        await window.db.collection("menuItems").add(itemData);

        // 新增：更新菜單元數據
        await updateMenuMetadata();
        
        // 重新加載商品列表
        await loadMenuItems();

        // 重置表單
        if (nameInput) nameInput.value = "";
        if (priceInput) priceInput.value = "";
        if (descInput) descInput.value = "";
        
        // 隱藏表單
        const form = document.getElementById(formId);
        if (form) {
            form.style.display = "none";
        }
        
        showAlert("商品項目已成功添加", "success");
    } catch (error) {
        console.error("保存商品項目時出錯:", error);
        showAlert("保存商品項目失敗，請稍後再試", "danger");
    }
}

// 編輯商品項目
async function editMenuItem(itemId) {
    try {
        console.log("開始編輯商品項目:", itemId);
        // 獲取項目數據
        const doc = await window.db.collection("menuItems").doc(itemId).get();
        if (!doc.exists) {
            showAlert("找不到此商品項目", "warning");
            return;
        }
        
        const item = doc.data();
        console.log("獲取到商品項目資料:", item);
        
        // 建立編輯表單
        const productItem = document.querySelector(`.product-subitem[data-id="${itemId}"]`);
        if (!productItem) {
            showAlert("找不到商品項目元素", "warning");
            return;
        }
        
        const categoryElement = productItem.closest('.product-item');
        if (!categoryElement) {
            showAlert("找不到商品類別元素", "warning");
            return;
        }
        
        // 如果已有編輯表單，先移除
        const existingForm = categoryElement.querySelector('.edit-form');
        if (existingForm) {
            existingForm.remove();
        }
        
        // 創建編輯表單
        const editForm = document.createElement('div');
        editForm.className = 'menu-item-form mt-3 edit-form';
        editForm.style.display = 'block'; // 確保表單顯示
        editForm.innerHTML = `
            <h6>編輯 ${item.name}</h6>
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">商品名稱</label>
                        <input type="text" class="form-control" id="edit-name-${itemId}" value="${item.name || ''}">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">價格</label>
                        <input type="number" class="form-control" id="edit-price-${itemId}" value="${item.price || ''}">
                    </div>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">描述</label>
                <textarea class="form-control" id="edit-desc-${itemId}" rows="2">${item.description || ''}</textarea>
            </div>
            <div class="d-flex gap-2">
                <button type="button" class="btn btn-primary" onclick="updateMenuItem('${itemId}')">更新</button>
                <button type="button" class="btn btn-outline-secondary" onclick="cancelEdit(this)">取消</button>
            </div>
        `;
        
        // 插入表單
        categoryElement.appendChild(editForm);
        
        // 滾動到表單位置
        editForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) {
        console.error("載入商品項目編輯失敗:", error);
        showAlert("無法載入商品項目，請稍後再試", "danger");
    }
}

// 更新類別
async function updateCategory(categoryId) {
    try {
        // 獲取表單數據
        const nameInput = document.getElementById(`edit-category-name-${categoryId}`);
        const descInput = document.getElementById(`edit-category-desc-${categoryId}`);
        const oldNameInput = document.getElementById(`edit-category-oldname-${categoryId}`);
        
        if (!nameInput || !oldNameInput) {
            showAlert("編輯表單欄位不完整", "warning");
            return;
        }
        
        // 驗證類別名稱
        if (!nameInput.value.trim()) {
            showAlert("請填寫類別名稱", "warning");
            return;
        }
        
        const newCategoryName = nameInput.value.trim();
        const oldCategoryName = oldNameInput.value.trim();
        
        // 如果新名稱與舊名稱相同且描述沒變，不需要更新
        const categoryDoc = await window.db.collection("categories").doc(categoryId).get();
        if (!categoryDoc.exists) {
            showAlert("找不到此類別", "warning");
            return;
        }
        
        const currentDesc = categoryDoc.data().description || "";
        const newDesc = descInput ? descInput.value : "";
        
        if (newCategoryName === oldCategoryName && newDesc === currentDesc) {
            // 關閉編輯表單
            const editForm = document.querySelector('.edit-category-form');
            if (editForm) editForm.remove();
            
            showAlert("未進行任何修改", "info");
            return;
        }
        
        // 檢查新名稱是否與其他類別重複
        const categoriesSnapshot = await window.db.collection("categories")
            .where("businessId", "==", currentUser.uid)
            .get();
            
        let isDuplicate = false;
        categoriesSnapshot.forEach(doc => {
            // 跳過當前正在編輯的類別
            if (doc.id !== categoryId && doc.data().name === newCategoryName) {
                isDuplicate = true;
            }
        });
        
        if (isDuplicate) {
            showAlert("已存在相同名稱的類別", "warning");
            return;
        }
        
        // 顯示載入提示
        showAlert("更新中...", "info");
        
        // 準備更新數據
        const updateData = {
            name: newCategoryName,
            description: newDesc,
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 更新類別
        await window.db.collection("categories").doc(categoryId).update(updateData);
        
        // 如果類別名稱有變更，需要更新所有使用此類別的商品項目
        if (newCategoryName !== oldCategoryName) {
            // 先獲取所有商品項目
            const menuItemsSnapshot = await window.db.collection("menuItems")
                .where("businessId", "==", currentUser.uid)
                .get();
            
            // 篩選出使用舊類別名稱的項目
            const itemsToUpdate = [];
            menuItemsSnapshot.forEach(doc => {
                if (doc.data().category === oldCategoryName) {
                    itemsToUpdate.push({
                        id: doc.id,
                        data: doc.data()
                    });
                }
            });
            
            // 更新這些項目的類別名稱
            if (itemsToUpdate.length > 0) {
                console.log(`需要更新 ${itemsToUpdate.length} 個商品項目的類別名稱`);
                
                if (typeof window.db.batch === 'function') {
                    // 使用批處理更新
                    const batch = window.db.batch();
                    
                    itemsToUpdate.forEach(item => {
                        const itemRef = window.db.collection("menuItems").doc(item.id);
                        batch.update(itemRef, {
                            category: newCategoryName,
                            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    
                    await batch.commit();
                } else {
                    // 如果批處理不可用，逐個更新
                    for (const item of itemsToUpdate) {
                        await window.db.collection("menuItems").doc(item.id).update({
                            category: newCategoryName,
                            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                }
                
                console.log(`已更新 ${itemsToUpdate.length} 個商品項目的類別名稱`);
            }
        }
        
        // 關閉編輯表單
        const editForm = document.querySelector('.edit-category-form');
        if (editForm) editForm.remove();
        
        // 新增：更新菜單元數據
        await updateMenuMetadata();
        
        // 重新加載商品列表
        await loadMenuItems();

        showAlert("類別已成功更新", "success");
    } catch (error) {
        console.error("更新類別失敗:", error);
        showAlert("更新類別失敗: " + error.message, "danger");
    }
}

// 更新商品項目
async function updateMenuItem(itemId) {
    try {
        const nameInput = document.getElementById(`edit-name-${itemId}`);
        const priceInput = document.getElementById(`edit-price-${itemId}`);
        const descInput = document.getElementById(`edit-desc-${itemId}`);
        
        if (!nameInput || !priceInput) {
            showAlert("編輯表單欄位不完整", "warning");
            return;
        }
        
        // 驗證必填字段
        if (!nameInput.value) {
            showAlert("請填寫商品名稱", "warning");
            return;
        }
        
        // 驗證價格
        const price = parseFloat(priceInput.value);
        if (isNaN(price) || price <= 0) {
            showAlert("請輸入有效的價格", "warning");
            return;
        }
        
        // 顯示載入提示
        showAlert("更新中...", "info");
        
        // 準備更新數據
        const itemData = {
            name: nameInput.value,
            price: price,
            description: descInput ? descInput.value : "",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 更新Firestore
        await window.db.collection("menuItems").doc(itemId).update(itemData);
                
        // 新增：更新菜單元數據
        await updateMenuMetadata();

        // 重新加載商品列表
        await loadMenuItems();
        
        showAlert("商品項目已成功更新", "success");
    } catch (error) {
        console.error("更新商品項目失敗:", error);
        showAlert("更新商品項目失敗，請稍後再試", "danger");
    }
}

// 取消編輯
function cancelEdit(btn) {
    // 尋找最近的編輯表單（可能是項目或類別編輯表單）
    const editForm = btn.closest('.edit-form, .edit-category-form');
    if (editForm) {
        editForm.remove();
    }
}

// 刪除商品項目
async function deleteMenuItem(itemId) {
    try {
        showAlert("刪除中...", "info");
        
        // 從Firestore刪除
        await window.db.collection("menuItems").doc(itemId).delete();
        
        // 新增：更新菜單元數據
        await updateMenuMetadata();

        // 重新加載商品列表
        await loadMenuItems();
        
        showAlert("商品項目已成功刪除", "success");
    } catch (error) {
        console.error("刪除商品項目失敗:", error);
        showAlert("刪除商品項目失敗，請稍後再試", "danger");
    }
}


// 刪除類別
// 使用批量操作刪除類別和相關商品
async function deleteCategory(categoryName) {
    try {
      showAlert("刪除類別中...", "info");
      
      // 搜索相關項
      const categoriesSnapshot = await window.db.collection("categories")
        .where("businessId", "==", currentUser.uid)
        .where("name", "==", categoryName)
        .get();
        
      const itemsSnapshot = await window.db.collection("menuItems")
        .where("businessId", "==", currentUser.uid)
        .where("category", "==", categoryName)
        .get();
      
      // 使用批量操作
      const batch = window.db.batch();
      
      // 批量刪除類別
      categoriesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // 批量刪除商品項目
      itemsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // 提交批量操作
      await batch.commit();
      
      // 更新元數據
      await updateMenuMetadata();
      
      // 重新加載商品列表
      await loadMenuItems();
      
      showAlert(`「${categoryName}」類別已成功刪除`, "success");
    } catch (error) {
      console.error("刪除類別失敗:", error);
      showAlert(`刪除類別失敗: ${error.message}`, "danger");
    }
}

// 添加類別
async function saveCategory() {
    try {
        const categoryNameInput = document.getElementById('categoryName');
        if (!categoryNameInput || !categoryNameInput.value.trim()) {
            showAlert("請填寫類別名稱", "warning");
            return;
        }
        
        const categoryName = categoryNameInput.value.trim();
        
        // 先獲取商家的所有類別
        const categoriesSnapshot = await window.db.collection("categories")
            .where("businessId", "==", currentUser.uid)
            .get();
            
        // 手動在JavaScript中檢查是否有重複名稱
        let isDuplicate = false;
        categoriesSnapshot.forEach(doc => {
            if (doc.data().name === categoryName) {
                isDuplicate = true;
            }
        });
        
        if (isDuplicate) {
            showAlert("已存在相同名稱的類別", "warning");
            return;
        }
        
        // 添加到Firestore
        await window.db.collection("categories").add({
            businessId: currentUser.uid,
            name: categoryName,
            description: document.getElementById('categoryDesc')?.value || "",
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 新增：更新菜單元數據
        await updateMenuMetadata();
        
        // 重新加載商品列表
        await loadMenuItems();

        // 重置表單
        document.getElementById('addCategoryForm').style.display = 'none';
        categoryNameInput.value = '';
        if (document.getElementById('categoryDesc')) {
            document.getElementById('categoryDesc').value = '';
        }
        
        showAlert("商品類別已成功添加", "success");
    } catch (error) {
        console.error("添加類別時發生錯誤:", error);
        showAlert("添加類別失敗，請稍後再試", "danger");
    }
}

// 側邊欄初始化
function initSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const businessToggle = document.querySelector('.business-toggle');
    
    if (businessToggle) {
        businessToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            mainContent.classList.toggle('active');
        });
    }
    
    // 內容區塊切換
    const menuItems = document.querySelectorAll('.sidebar-menu li a');
    const contentSections = document.querySelectorAll('.content-section');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // 避免特殊按鈕（如登出）被攔截
            if(item.id === 'logoutLink') return;
            
            e.preventDefault();
            
            const target = item.getAttribute('href').substring(1);
            const targetSection = document.getElementById(target + '-section');
            
            if(!targetSection) return;
            
            // 更新活躍菜單項
            const activeItem = document.querySelector('.sidebar-menu li.active');
            if(activeItem) {
                activeItem.classList.remove('active');
            }
            item.parentElement.classList.add('active');
            
            // 顯示對應的內容區塊
            const activeSection = document.querySelector('.content-section.active');
            if(activeSection) {
                activeSection.classList.remove('active');
            }
            targetSection.classList.add('active');
        });
    });
    
    // 預設選中側邊欄第一項
    const defaultMenuItem = document.querySelector('.sidebar-menu li a');
    if (defaultMenuItem && !document.querySelector('.content-section.active')) {
        setTimeout(() => {
            defaultMenuItem.click();
        }, 100);
    }
}

// 商品類別管理初始化
function initCategoryManagement() {
    // 類別管理
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const addCategoryForm = document.getElementById('addCategoryForm');
    const cancelAddCategory = document.getElementById('cancelAddCategory');
    
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', function() {
            if (addCategoryForm) {
                addCategoryForm.style.display = 'block';
            }
        });
    }
    
    if (cancelAddCategory) {
        cancelAddCategory.addEventListener('click', function() {
            if (addCategoryForm) {
                addCategoryForm.style.display = 'none';
            }
        });
    }
    
    // 儲存類別按鈕
    const saveCategoryBtn = addCategoryForm ? addCategoryForm.querySelector('.btn-primary') : null;
    if (saveCategoryBtn) {
        saveCategoryBtn.addEventListener('click', saveCategory);
    }
}

// 初始化菜單元數據
async function initializeMenuMetadata(businessId) {
    try {
        if (!businessId) {
            console.error("未提供店家ID，無法初始化菜單元數據");
            return;
        }
        if (businessId !== currentUser.uid) {
            console.error("當前用戶無權初始化此店家的菜單元數據");
            return;
        }

        const metadataRef = window.db.collection("menuMetadata").doc(businessId);
        const metadataDoc = await metadataRef.get();

        if (!metadataDoc.exists) {
            await metadataRef.set({
                businessId: businessId,
                version: 1,
                lastUpdated: window.firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log(`已為店家 ${businessId} 初始化菜單元數據`);
        }
    } catch (error) {
        console.error("初始化菜單元數據錯誤:", error);
    }
}

//更新菜單元數據函數
async function updateMenuMetadata() {
    try {
        if (!currentUser || !currentUser.uid) {
            console.error("未找到用戶資料，無法更新菜單元數據");
            return;
        }
        
        // 取得元數據引用
        const metadataRef = window.db.collection("menuMetadata").doc(currentUser.uid);
        
        // 嘗試使用事務增加版本號
        try {
            const metadataDoc = await metadataRef.get();
            let newVersion = 1;
            
            if (metadataDoc.exists) {
                const currentData = metadataDoc.data();
                newVersion = (currentData.version || 0) + 1;
            }
            
            // 修改: 只保存版本號，移除時間戳
            await metadataRef.set({
                version: newVersion,
            });
            
            console.log("元數據已基本更新，新版本:", newVersion);
        } catch (error) {
            console.error("更新菜單元數據錯誤:", error);
        }
    } catch (error) {
        console.error("更新菜單元數據錯誤:", error);
    }
}

// 標籤輸入系統初始化
function initTagsSystem() {
    const tagContainer = document.getElementById('tagContainer');
    if (!tagContainer) {
        console.warn("找不到標籤容器");
        return;
    }
    
    // 確保容器中有一個輸入框
    let tagInput = tagContainer.querySelector('.tag-input');
    if (!tagInput) {
        tagInput = createTagInput();
        tagContainer.appendChild(tagInput);
    }
    
    // 添加新標籤事件
    tagInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && this.value.trim() !== '') {
            e.preventDefault();
            addTag(this.value.trim());
            this.value = '';
        }
    });
    
    // 為推薦標籤按鈕添加點擊事件
    const tagButtons = document.querySelectorAll('.btn-outline-secondary');
    tagButtons.forEach(btn => {
        // 只處理標籤按鈕 (有mb-2類的按鈕)
        if (btn.classList.contains('me-2') || btn.classList.contains('mb-2')) {
            btn.addEventListener('click', function() {
                const tagText = this.textContent.trim();
                addTag(tagText);
            });
        }
    });
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
        
        // 更新 Firestore
        await window.db.collection("businesses").doc(currentUser.uid).update({
            tags: tags,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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

// 活動類型卡片選擇
function initActivityTypeCards() {
    const activityCards = document.querySelectorAll('.activity-type-card');
    
    activityCards.forEach(card => {
        card.addEventListener('click', function() {
            this.classList.toggle('selected');
            
            // 更新選中數量
            const selectedCount = document.querySelectorAll('.activity-type-card.selected').length;
            const badge = document.querySelector('.activity-count-badge');
            if (badge) {
                badge.textContent = `已選擇 ${selectedCount} 項`;
            }
        });
    });
}

// 儲存活動類型
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
        
        // 收集選中的活動類型
        const activityTypes = [];
        const selectedCards = document.querySelectorAll(".activity-type-card.selected");
        selectedCards.forEach(card => {
            const typeText = card.querySelector("p").textContent;
            activityTypes.push(typeText);
        });
        
        // 更新 Firestore
        await window.db.collection("businesses").doc(currentUser.uid).update({
            activityTypes: activityTypes,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
        mainImageUpload.addEventListener('change', handleMainImageUpload);
    }
    
    // 綁定既有刪除按鈕
    const existingRemoveBtn = document.querySelector('.image-preview .remove-image');
    if (existingRemoveBtn) {
        existingRemoveBtn.addEventListener('click', function() {
            if (confirm('確定要刪除店家頭像嗎?')) {
                removeMainImage();
            }
        });
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
      addEnvironmentItem.addEventListener('click', function() {
        addEnvironmentImage.click();
      });
    }
    
    // 選擇文件後處理上傳
    addEnvironmentImage.addEventListener('change', function(e) {
      handleEnvironmentImageUpload(e.target.files);
    });
    
    // 綁定既有刪除按鈕
    document.querySelectorAll('.environment-item .remove-image').forEach(btn => {
      btn.addEventListener('click', function() {
        const environmentItem = this.closest('.environment-item');
        const imgUrl = environmentItem.querySelector('img').src;
        
        if (confirm('確定要刪除此照片嗎?')) {
          removeEnvironmentImage(imgUrl);
          environmentItem.remove();
        }
      });
    });
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
        
        if (!businessData || !businessData.environmentImages) {
            hidePageLoading();
            showAlert("找不到照片資訊", "warning");
            return;
        }
        
        // 從存儲中刪除文件
        try {
            // 從URL中獲取路徑 (不使用 refFromURL)
            const urlPath = imageUrl.split('?')[0]; // 移除查詢參數
            const storagePath = decodeURIComponent(urlPath.split('/o/')[1]); // 獲取 object 路徑部分
            
            const storageRef = window.storage.ref(storagePath);
            await storageRef.delete();
            console.log("成功從 Storage 刪除照片");
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
        
        if (!businessData || !businessData.imageUrl) {
            hidePageLoading();
            showAlert("找不到頭像資訊", "warning");
            return;
        }
        
        // 從存儲中刪除文件
        try {
            // 從URL中獲取路徑 (不使用 refFromURL)
            const urlPath = businessData.imageUrl.split('?')[0]; // 移除查詢參數
            const storagePath = decodeURIComponent(urlPath.split('/o/')[1]); // 獲取 object 路徑部分
            
            const storageRef = window.storage.ref(storagePath);
            await storageRef.delete();
            console.log("成功從 Storage 刪除頭像");
        } catch (storageError) {
            console.warn("刪除存儲檔案失敗:", storageError);
            // 繼續處理，不中斷流程
        }
        
        // 使用對應的方法刪除欄位
        // 適配不同的 Firebase 版本
        let updateData;
        
        if (window.firebase.firestore.FieldValue.deleteField) {
            // 如果存在 deleteField 方法
            updateData = {
                imageUrl: window.firebase.firestore.FieldValue.deleteField(),
                updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
            };
        } else {
            // 如果沒有 deleteField 方法，使用 null 代替
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

// 營業時間初始化
function initBusinessHours() {
    // 確保營業時間容器存在，且僅創建一次
    const businessHoursContainer = document.getElementById('businessHoursContainer');
    if (!businessHoursContainer) {
        const businessHoursSection = document.querySelector('.dashboard-card .card-body');
        if (businessHoursSection) {
            const container = document.createElement('div');
            container.id = 'businessHoursContainer';
            container.className = 'row mt-3';
            businessHoursSection.appendChild(container);
            console.log("已創建營業時間容器");
        }
    } else {
        console.log("營業時間容器已存在，無需重複創建");
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
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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

// 表單驗證初始化
function initFormValidation() {
    // 為所有必填字段添加驗證
    const requiredFields = document.querySelectorAll('input[required], textarea[required], select[required]');
    
    requiredFields.forEach(field => {
        field.addEventListener('blur', function() {
            if (!this.value.trim()) {
                this.classList.add('is-invalid');
                
                // 檢查是否已存在錯誤提示
                let feedback = this.nextElementSibling;
                if (!feedback || !feedback.classList.contains('invalid-feedback')) {
                    feedback = document.createElement('div');
                    feedback.className = 'invalid-feedback';
                    feedback.textContent = '此欄位為必填';
                    this.after(feedback);
                }
            } else {
                this.classList.remove('is-invalid');
                
                // 移除錯誤提示
                const feedback = this.nextElementSibling;
                if (feedback && feedback.classList.contains('invalid-feedback')) {
                    feedback.remove();
                }
            }
        });
    });
    
    // 為電子郵件欄位添加格式驗證
    const emailFields = document.querySelectorAll('input[type="email"]');
    emailFields.forEach(field => {
        field.addEventListener('blur', function() {
            if (this.value && !isValidEmail(this.value)) {
                this.classList.add('is-invalid');
                
                // 檢查是否已存在錯誤提示
                let feedback = this.nextElementSibling;
                if (!feedback || !feedback.classList.contains('invalid-feedback')) {
                    feedback = document.createElement('div');
                    feedback.className = 'invalid-feedback';
                    feedback.textContent = '請輸入有效的電子郵件地址';
                    this.after(feedback);
                }
            }
        });
    });
    
    // 為網址欄位添加格式驗證
    const urlFields = document.querySelectorAll('input[type="url"]');
    urlFields.forEach(field => {
        field.addEventListener('blur', function() {
            if (this.value && !isValidUrl(this.value)) {
                this.classList.add('is-invalid');
                
                // 檢查是否已存在錯誤提示
                let feedback = this.nextElementSibling;
                if (!feedback || !feedback.classList.contains('invalid-feedback')) {
                    feedback = document.createElement('div');
                    feedback.className = 'invalid-feedback';
                    feedback.textContent = '請輸入有效的網址，包含http://或https://';
                    this.after(feedback);
                }
            }
        });
    });
}

// 驗證電子郵件格式
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// 驗證URL格式
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

// 儲存店家位置資訊
async function saveLocationInfo() {
    try {
        const lat = parseFloat(document.getElementById('latitude').value);
        const lng = parseFloat(document.getElementById('longitude').value);
        const formattedAddress = document.getElementById('formattedAddress').value;
        
        if (isNaN(lat) || isNaN(lng) || !formattedAddress) {
            showAlert('位置資訊不完整，請確保已設定位置', 'warning');
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
            geopoint: new firebase.firestore.GeoPoint(lat, lng)
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
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
        absValue = Math.floor(absValue / chars.length);
    }
    
    return geohash;
}

// 添加更新追蹤文檔的函數
async function updateTrackingDocument(businessId, updateType) {
    const trackingRef = window.db.doc('update_tracking/essential_updates');
    
    // 更新追蹤文檔
    await trackingRef.update({
      [updateType === 'profile_image' ? 'profile_images' : 'locations']: 
        window.firebase.firestore.FieldValue.arrayUnion(businessId),
      'last_updated': window.firebase.firestore.FieldValue.serverTimestamp()
    });
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
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
}

// 顯示位置儲存提示對話框
function showLocationSaveDialog() {
    // 檢查是否已有相同對話框
    if (document.getElementById('locationSaveDialog')) {
        return;
    }
    
    // 創建對話框元素
    const dialog = document.createElement('div');
    dialog.id = 'locationSaveDialog';
    dialog.className = 'modal fade';
    dialog.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', 'locationSaveDialogLabel');
    dialog.setAttribute('aria-hidden', 'true');
    dialog.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title" id="locationSaveDialogLabel">
                        <i class="fas fa-map-marker-alt me-2"></i>位置資訊更新
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="d-flex align-items-start mb-3">
                        <div class="bg-light rounded-circle p-2 me-3 text-primary">
                            <i class="fas fa-exclamation-circle fa-2x"></i>
                        </div>
                        <div>
                            <p class="mb-2">系統已根據您的地址資料找到對應位置，為確保資料完整，請點擊「儲存位置」按鈕儲存地理座標。</p>
                            <p class="mb-0 text-muted">這將有助於提升您店家在搜尋中的曝光度及準確性。</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">稍後再說</button>
                    <button type="button" class="btn btn-primary" id="dialogSaveLocationBtn">
                        <i class="fas fa-save me-2"></i>儲存位置
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 添加到頁面
    document.body.appendChild(dialog);
    
    // 顯示對話框
    const modalInstance = new bootstrap.Modal(dialog);
    modalInstance.show();
    
    // 綁定儲存按鈕事件
    const saveBtn = document.getElementById('dialogSaveLocationBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
            // 呼叫位置儲存函數
            saveLocationInfo();
            // 關閉對話框
            modalInstance.hide();
        });
    }
}

// 顯示位置錯誤對話框
function showLocationErrorDialog() {
    // 檢查是否已有相同對話框
    if (document.getElementById('locationErrorDialog')) {
        return;
    }
    
    // 創建對話框元素
    const dialog = document.createElement('div');
    dialog.id = 'locationErrorDialog';
    dialog.className = 'modal fade';
    dialog.tabIndex = -1;
    dialog.setAttribute('aria-labelledby', 'locationErrorDialogLabel');
    dialog.setAttribute('aria-hidden', 'true');
    dialog.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header bg-warning text-dark">
                    <h5 class="modal-title" id="locationErrorDialogLabel">
                        <i class="fas fa-exclamation-triangle me-2"></i>位置資訊不完整
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="d-flex align-items-start mb-3">
                        <div class="bg-light rounded-circle p-2 me-3 text-warning">
                            <i class="fas fa-map-marked-alt fa-2x"></i>
                        </div>
                        <div>
                            <p class="mb-2">系統未能找到有效的店家位置資訊，請完成以下步驟設定您的店家位置：</p>
                            <ol class="mb-2">
                                <li>在搜尋框輸入您的店家地址</li>
                                <li>點擊搜尋按鈕或按下 Enter 鍵</li>
                                <li>調整地圖標記至精確位置</li>
                                <li>點擊「儲存位置」按鈕</li>
                            </ol>
                            <p class="mb-0 text-danger"><strong>注意：</strong> 未設定位置資訊將影響店家在 APP 中的曝光度！</p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">我知道了</button>
                    <button type="button" class="btn btn-warning" data-bs-dismiss="modal">
                        <i class="fas fa-arrow-right me-2"></i>前往設定位置
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 添加到頁面
    document.body.appendChild(dialog);
    
    // 顯示對話框
    const modalInstance = new bootstrap.Modal(dialog);
    modalInstance.show();
}

// 根據地址獲取地理位置
function geocodeAddress(address) {
    if (!geocoder || !address) return;
    
    showAlert("根據地址定位中...", "info");
    
    // 設定 geocoding 選項，確保返回繁體中文
    const geocodingOptions = {
        address: address,
        region: 'tw',     // 地區設為台灣
        language: 'zh-TW' // 語言設為繁體中文
    };
    
    geocoder.geocode(geocodingOptions, function(results, status) {
        if (status === 'OK' && results[0]) {
            const position = results[0].geometry.location;
            
            // 更新地圖和標記
            map.setCenter(position);
            marker.setPosition(position);
            
            // 更新座標欄位
            updateLocationFields(position);
            
            // 使用返回的繁體中文地址更新地址欄位
            const formattedAddressField = document.getElementById('formattedAddress');
            if (formattedAddressField) {
                formattedAddressField.value = results[0].formatted_address;
            }
            
            showAlert("已根據地址自動設定位置，請點擊「儲存位置」按鈕確認", "success");
        } else {
            showAlert('無法根據地址定位，請手動設定位置或嘗試更詳細的地址', 'warning');
        }
    });
}

// 檢查位置資料，如有需要則提示用戶
function checkLocationData() {
    // 檢查是否缺少位置資料
    if (!businessData || !businessData.position || !businessData.position.geopoint) {
        // 顯示提醒訊息，要求店家設定位置
        showAlert("請設定店家位置資訊以提升在APP中的曝光度", "warning", 6000);
    }
}

// 搜尋地址
function searchLocation() {
    if (!geocoder) {
        console.error("地理編碼器未初始化");
        showAlert("地理編碼服務未就緒，請重新整理頁面後再試", "danger");
        return;
    }
    
    const address = document.getElementById('locationSearch').value;
    if (!address) {
        showAlert('請輸入要搜尋的地址', 'warning');
        return;
    }
    
    showAlert("搜尋地址中...", "info");
    
    // 增加在地化參數，提高台灣地址的搜尋準確度並確保繁體中文
    const geocodingOptions = {
        address: address,
        region: 'tw',     // 設定搜尋區域為台灣
        language: 'zh-TW' // 設定返回結果語言為繁體中文
    };
    
    geocoder.geocode(geocodingOptions, function(results, status) {
        if (status === 'OK' && results[0]) {
            const position = results[0].geometry.location;
            
            // 更新地圖中心
            map.setCenter(position);
            
            // 根據標記類型設定位置
            if (marker instanceof google.maps.Marker) {
                marker.setPosition(position);
            } else {
                // 進階標記設定位置的方式
                marker.position = position;
            }
            
            // 更新顯示欄位
            updateLocationFields(position);
            
            const formattedAddressField = document.getElementById('formattedAddress');
            if (formattedAddressField) {
                // 使用繁體中文地址
                formattedAddressField.value = results[0].formatted_address;
            }
            
            showAlert("地址已找到並更新，請點擊「儲存位置」按鈕確認", "success");
        } else {
            showAlert('無法找到該地址，請嘗試更具體的地址或關鍵字', 'warning');
        }
    });
}

// 更新位置欄位
function updateLocationFields(position) {
    if (!position) return;
    
    // 更新緯度經度欄位
    const latitudeField = document.getElementById('latitude');
    const longitudeField = document.getElementById('longitude');
    
    if (latitudeField && longitudeField) {
        let lat, lng;
        
        // 處理不同類型的位置物件
        if (position.lat && typeof position.lat === 'function') {
            // 傳統的 google.maps.LatLng 物件
            lat = position.lat();
            lng = position.lng();
        } else if (position.lat !== undefined && position.lng !== undefined) {
            // 普通的 {lat, lng} 物件
            lat = position.lat;
            lng = position.lng;
        } else {
            console.error("無法識別的位置物件格式", position);
            return;
        }
        
        latitudeField.value = lat.toFixed(6);
        longitudeField.value = lng.toFixed(6);
        
        // 更新geohash欄位
        const geohashField = document.getElementById('geohash');
        if (geohashField && typeof generateGeohash === 'function') {
            geohashField.value = generateGeohash(lat, lng);
        }
    }
}

// 圖片壓縮函數
async function compressImage(file, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = function() {
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
                ctx.drawImage(img, 0, 0, width, height);
                
                // 將畫布轉換為Blob，而不是File對象
                canvas.toBlob(blob => {
                    // 直接返回blob對象
                    resolve(blob);
                }, file.type, 0.7); // 壓縮質量0.7
            };
            
            img.onerror = function() {
                reject(new Error('圖片加載失敗'));
            };
        };
        
        reader.onerror = function() {
            reject(new Error('文件讀取失敗'));
        };
    });
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
        accountForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveAccountSettings();
        });
        console.log("已綁定帳號設定表單提交事件");
    }
}

// 保存帳號設定
async function saveAccountSettings() {
    try {
        // 獲取表單數據
        const accountName = document.getElementById("accountName").value;
        const accountPhone = document.getElementById("accountPhone").value;
        
        // 顯示加載狀態
        showPageLoading("正在保存帳號設定...");
        
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

// 全頁面加載中隱藏
function hidePageLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('d-none');
    }
}

// 簡易 geohash 生成器 (如果沒有額外庫可用)
function generateGeohash(lat, lng, precision = 8) {
    // 以下是一個非常簡化的 geohash 生成方法
    // 實際應用中應使用專門的庫，如 latlon-geohash 或 ngeohash
    
    // 將緯度和經度轉換為整數部分和小數部分
    const latInt = Math.floor(lat);
    const lngInt = Math.floor(lng);
    const latDecimal = (lat - latInt).toFixed(precision);
    const lngDecimal = (lng - lngInt).toFixed(precision);
    
    // 用這些數字組合成一個字符串
    // 這不是真正的 geohash，僅供演示
    return `${latInt}_${latDecimal}_${lngInt}_${lngDecimal}`;
}

function setupSessionTimeoutHandler() {
  let inactivityTimer;
  const SESSION_TIMEOUT = 60 * 60 * 1000; // 30分鐘閒置時間
  
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
      // 登出當前用戶
      signOut(auth).then(() => {
        // 刷新頁面
        window.location.reload();
      }).catch(error => {
        console.error('登出錯誤:', error);
        window.location.reload();
      });
    });
    
    // 如果用戶仍然登入，則強制登出
    if (auth.currentUser) {
      // 停止所有後台操作和監聽器
      // 這裡您可能需要清理項目中特定的監聽器
    }
  }
  
  // 添加用戶活動監聽器
  const userActivityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  userActivityEvents.forEach(eventType => {
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
  
  // 初始化計時器
  resetInactivityTimer();
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