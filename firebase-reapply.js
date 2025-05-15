// firebase-reapply.js 
// 定義必需的變量，避免後續函數使用時出現未定義錯誤
let auth, db, storage, doc, collection, onAuthStateChanged;
let setDoc, getDoc, updateDoc, serverTimestamp;
let ref, uploadBytes, getDownloadURL, deleteObject;
let checkAppCheckStatus, installXHRInterceptor;
let setupSessionManager;
let redirectInProgress = false;

// 全局變數用於存儲上傳文件
window.uploadedFiles = window.uploadedFiles || [];

// 使用 IIFE 來隔離作用域並確保加載順序
(async function() {
    console.log('開始初始化 firebase-reapply.js 核心模組');
    
    try {
        // 1. 先導入核心 Firebase 模組 - 使用動態導入確保按順序加載
        const firebaseConfig = await import('./firebase-config.js');
        auth = firebaseConfig.auth;
        db = firebaseConfig.db;
        storage = firebaseConfig.storage;
        doc = firebaseConfig.doc;
        collection = firebaseConfig.collection;
        onAuthStateChanged = firebaseConfig.onAuthStateChanged;
        console.log('Firebase 核心模組加載成功');
        
        // 2. 導入 Firestore 模組
        const firestoreModule = await import('https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js');
        setDoc = firestoreModule.setDoc;
        getDoc = firestoreModule.getDoc;
        updateDoc = firestoreModule.updateDoc;
        serverTimestamp = firestoreModule.serverTimestamp;
        console.log('Firestore 模組加載成功');
        
        // 3. 導入 Storage 模組
        const storageModule = await import('https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js');
        ref = storageModule.ref;
        uploadBytes = storageModule.uploadBytes;
        getDownloadURL = storageModule.getDownloadURL;
        deleteObject = storageModule.deleteObject;
        console.log('Storage 模組加載成功');
        
        // 4. 導入 App Check 模組
        const appCheckModule = await import('./app-check-module.js');
        checkAppCheckStatus = appCheckModule.checkAppCheckStatus;
        installXHRInterceptor = appCheckModule.installXHRInterceptor;
        console.log('App Check 模組加載成功');
        
        // 5. 導入會話管理模組
        const sessionModule = await import('./session-manager.js');
        setupSessionManager = sessionModule.setupSessionManager;
        console.log('會話管理模組加載成功');
        
        console.log('所有模組加載完成，準備初始化頁面');
        
        // 確保DOM已加載再初始化頁面
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializePage);
        } else {
            initializePage();
        }
    } catch (err) {
        console.error('核心模組加載失敗:', err);
        
        // 即使加載失敗，仍然嘗試初始化基本頁面功能
        setTimeout(() => {
            initializePage();
        }, 1000);
    }
})();

// 頁面初始化函數
function initializePage() {
    console.log('重新申請頁面初始化開始...');
    
    try {
        // 添加狀態變數以追蹤認證檢查
        let authCheckComplete = false;
        
        // 先檢查 URL 參數
        const urlParams = new URLSearchParams(window.location.search);
        const businessId = urlParams.get('id');
        
        if (!businessId) {
            console.error('URL中缺少店家ID參數');
            if (!redirectInProgress) {
                redirectInProgress = true;
                // 提供更好的用戶體驗，顯示訊息後再跳轉
                alert('缺少必要的店家ID參數，即將返回登入頁面');
                window.location.href = 'business-login.html';
            }
            return;
        }
        console.log('檢測到店家ID參數:', businessId);
        
        // 檢查是否有App Check功能
        if (typeof checkAppCheckStatus === 'function') {
            console.log('開始檢查App Check狀態...');
            checkAppCheckStatus().then(result => {
                console.log('App Check狀態檢查結果:', result.success ? '成功' : '失敗');
                
                // 安裝XHR攔截器以確保請求都帶有App Check令牌
                if (typeof installXHRInterceptor === 'function') {
                    installXHRInterceptor();
                }
                
                // 延遲檢查認證狀態，給Firebase足夠時間恢復會話
                setTimeout(() => {
                    console.log('延遲後開始檢查認證狀態...');
                    checkAuthState(businessId);
                }, 1000); // 延遲1秒再檢查認證狀態
            }).catch(error => {
                console.error('App Check檢查失敗:', error);
                // 即使App Check失敗，仍然嘗試讀取用戶狀態
                checkAuthState(businessId);
            });
        } else {
            console.warn('App Check模組未加載，跳過檢查');
            setTimeout(() => {
                checkAuthState(businessId);
            }, 500);
        }
        
        // 初始化會話管理器
        if (typeof setupSessionManager === 'function') {
            const sessionManager = setupSessionManager();
            console.log('會話管理器初始化完成');
        } else {
            console.warn('會話管理器未加載');
        }
        
        // 設置表單提交事件
        const reapplyForm = document.getElementById('businessReapplyForm');
        if (reapplyForm) {
            // 先移除之前的監聽器以避免重複
            reapplyForm.removeEventListener('submit', submitReapplication);
            reapplyForm.addEventListener('submit', submitReapplication);
            console.log('表單提交事件設置完成');
        } else {
            console.warn('找不到重新申請表單元素');
        }
        
        // 修正上傳資訊顯示
        const uploadInfoElements = document.querySelectorAll('.upload-info');
        uploadInfoElements.forEach(element => {
            const textElement = element.querySelector('.text-muted');
            if (textElement) {
                // 將"張照片"改為"張檔案"
                const text = textElement.innerHTML;
                textElement.innerHTML = text.replace('張照片', '張檔案');
            }
        });
        
        // 初始化文件上傳功能
        initializeFileUpload();
        
        // 應用iOS特定修復
        applyIOSFixes();
        
        console.log('頁面初始化完成');
    } catch (error) {
        console.error('頁面初始化過程中發生錯誤:', error);
        showError('頁面初始化失敗，請重新載入頁面');
    }
}

// 檢查認證狀態
function checkAuthState(businessId) {
    // 確保函數只執行一次
    if (window.authStateCheckInProgress) return;
    window.authStateCheckInProgress = true;
    
    console.log('檢查認證狀態...');
    
    try {
        // 如果auth未定義，顯示錯誤並重定向
        if (typeof auth === 'undefined' || !auth) {
            console.error('身份驗證模組未加載');
            showError('身份驗證模組未加載，請重新整理頁面');
            setTimeout(() => {
                if (!redirectInProgress) {
                    redirectInProgress = true;
                    window.location.href = 'business-login.html';
                }
            }, 3000);
            return;
        }
        
        // 檢查用戶是否已登入
        if (typeof onAuthStateChanged === 'function') {
            onAuthStateChanged(auth, function(user) {
                window.authStateCheckInProgress = false;
                
                if (user) {
                    // 用戶已登入，檢查是否為正確的店家帳號
                    console.log('用戶已登入:', user.uid);
                    if (user.uid === businessId) {
                        console.log('已驗證用戶權限，初始化重新申請頁面');
                        initReapplyPage(user);
                    } else {
                        console.warn('用戶ID與URL參數不匹配');
                        if (!redirectInProgress) {
                            redirectInProgress = true;
                            alert('您沒有權限訪問此店家的重新申請頁面');
                            window.location.href = 'business-login.html';
                        }
                    }
                } else {
                    console.warn('用戶未登入，嘗試進行重新登入處理...');
                    
                    // 檢查是否有緩存的認證會話
                    const cachedSession = localStorage.getItem('business_reapply_session');
                    
                    if (cachedSession && cachedSession === businessId) {
                        console.log('檢測到緩存的會話ID，等待認證恢復...');
                        
                        // 提供視覺提示
                        showLoadingMessage('認證狀態恢復中，請稍候...');
                        
                        // 再次檢查，給更多時間恢復認證狀態
                        setTimeout(() => {
                            if (auth.currentUser) {
                                console.log('成功恢復認證狀態');
                                initReapplyPage(auth.currentUser);
                            } else {
                                console.error('無法恢復認證狀態，重定向到登入頁面');
                                if (!redirectInProgress) {
                                    redirectInProgress = true;
                                    localStorage.removeItem('business_reapply_session');
                                    window.location.href = 'business-login.html?redirect=reapply&id=' + businessId;
                                }
                            }
                        }, 2000);
                    } else {
                        // 沒有緩存會話，需要重新登入
                        console.log('未找到緩存會話，重定向到登入頁面');
                        if (!redirectInProgress) {
                            redirectInProgress = true;
                            window.location.href = 'business-login.html?redirect=reapply&id=' + businessId;
                        }
                    }
                }
            });
        } else {
            console.error('身份驗證監聽器函數未加載');
            showError('身份驗證監聽器未加載，請重新整理頁面');
            setTimeout(() => {
                if (!redirectInProgress) {
                    redirectInProgress = true;
                    window.location.href = 'business-login.html';
                }
            }, 3000);
        }
    } catch (error) {
        console.error('檢查認證狀態時發生錯誤:', error);
        window.authStateCheckInProgress = false;
        showError('檢查認證狀態時發生錯誤，請重新整理頁面');
    }
}

// 顯示加載訊息
function showLoadingMessage(message) {
    // 檢查是否已存在加載訊息元素
    let loadingElement = document.getElementById('loadingMessage');
    
    if (!loadingElement) {
        // 創建加載訊息元素
        loadingElement = document.createElement('div');
        loadingElement.id = 'loadingMessage';
        loadingElement.style.position = 'fixed';
        loadingElement.style.top = '50%';
        loadingElement.style.left = '50%';
        loadingElement.style.transform = 'translate(-50%, -50%)';
        loadingElement.style.padding = '20px';
        loadingElement.style.background = 'rgba(0, 0, 0, 0.7)';
        loadingElement.style.color = 'white';
        loadingElement.style.borderRadius = '8px';
        loadingElement.style.zIndex = '9999';
        loadingElement.style.textAlign = 'center';
        
        document.body.appendChild(loadingElement);
    }
    
    // 更新訊息內容
    loadingElement.innerHTML = `
        <div class="spinner-border text-light" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <div class="mt-2">${message}</div>
    `;
}

// 顯示錯誤訊息
function showError(message) {
    // 移除任何現有的加載訊息
    const loadingElement = document.getElementById('loadingMessage');
    if (loadingElement) {
        loadingElement.remove();
    }
    
    // 檢查是否已存在錯誤訊息元素
    let errorElement = document.getElementById('errorMessage');
    
    if (!errorElement) {
        // 創建錯誤訊息元素
        errorElement = document.createElement('div');
        errorElement.id = 'errorMessage';
        errorElement.className = 'alert alert-danger mt-3';
        errorElement.role = 'alert';
        
        // 尋找適合的容器
        let container = document.querySelector('.register-form-container');
        if (!container) {
            container = document.querySelector('.container');
        }
        if (!container) {
            container = document.body;
        }
        
        container.prepend(errorElement);
    }
    
    // 更新錯誤訊息
    errorElement.textContent = message;
    
    // 自動滾動到錯誤訊息
    errorElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 初始化重新申請頁面
async function initReapplyPage(user) {
    try {
        console.log('開始初始化重新申請頁面...');
        showLoadingMessage('正在載入店家資料...');
        
        // 從 URL 中獲取店家 ID
        const urlParams = new URLSearchParams(window.location.search);
        const businessId = urlParams.get('id') || user.uid;
        
        if (!businessId) {
            alert('缺少店家 ID');
            window.location.href = 'business-login.html';
            return;
        }
        
        // 檢查用戶是否為店家帳號
        if (user.uid !== businessId) {
            alert('請先登入店家帳號');
            window.location.href = 'business-login.html';
            return;
        }
        
        // 緩存會話ID，用於後續恢復
        localStorage.setItem('business_reapply_session', user.uid);
        
        // 檢查所需函數
        if (typeof doc !== 'function' || typeof getDoc !== 'function') {
            console.error('Firestore 函數未加載');
            alert('系統組件未加載完成，請重新整理頁面');
            return;
        }
        
        // 獲取店家信息
        console.log('正在從Firestore獲取店家數據...');
        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        
        if (!businessDoc.exists()) {
            console.error('找不到店家信息');
            alert('找不到店家信息');
            window.location.href = 'business-login.html';
            return;
        }
        
        const businessData = businessDoc.data();
        console.log('成功獲取店家數據:', businessData);
        
        // 檢查狀態是否為 rejected
        if (businessData.status !== 'rejected') {
            console.warn('店家狀態不是rejected:', businessData.status);
            alert('只有被拒絕的商家才能重新申請');
            window.location.href = 'business-login.html';
            return;
        }
        
        // 填充表單字段
        console.log('開始填充表單欄位...');
        fillFormFields(businessData);
        
        // 顯示拒絕原因
        const rejectReasonEl = document.getElementById('rejectReason');
        if (rejectReasonEl && businessData.rejectReason) {
            rejectReasonEl.textContent = businessData.rejectReason;
            console.log('設置拒絕原因:', businessData.rejectReason);
        } else {
            console.warn('找不到rejectReason元素或拒絕原因為空');
        }
        
        // 加載已有的證照照片
        const licenseUrls = businessData.licenseUrls || [];
        console.log(`找到${licenseUrls.length}個證照照片URL:`, licenseUrls);
        
        if (licenseUrls.length > 0) {
            // 使用改進的照片載入函數
            await loadExistingLicenses(licenseUrls);
        } else {
            console.log('沒有找到證照照片');
            // 更新空上傳預覽區域
            updateUploadPreview();
        }
        
        // 移除加載訊息
        const loadingElement = document.getElementById('loadingMessage');
        if (loadingElement) {
            loadingElement.remove();
        }
        
        console.log('重新申請頁面初始化完成');
        
    } catch (error) {
        console.error('初始化重新申請頁面時發生錯誤:', error);
        alert('加載頁面時發生錯誤: ' + error.message);
        
        // 移除加載訊息
        const loadingElement = document.getElementById('loadingMessage');
        if (loadingElement) {
            loadingElement.remove();
        }
    }
}

// 填充表單字段
function fillFormFields(businessData) {
    const fields = [
        { id: 'businessName', value: businessData.businessName || '' },
        { id: 'businessType', value: businessData.businessType || '' },
        { id: 'businessAddress', value: businessData.address || '' },
        { id: 'businessPhone', value: businessData.phoneNumber || '' },
        { id: 'businessDescription', value: businessData.description || '' },
        { id: 'contactName', value: businessData.contactName || '' },
        { id: 'contactPhone', value: businessData.contactPhone || '' }
    ];
    
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.value = field.value;
            console.log(`設置${field.id}:`, field.value);
        } else {
            console.warn(`找不到${field.id}欄位`);
        }
    });
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' Bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else return (bytes / 1048576).toFixed(2) + ' MB';
}

// 加載已有的證照照片
async function loadExistingLicenses(licenseUrls) {
    try {
        console.log('開始載入已有證照照片...');
        
        // 確保全局上傳文件數組已初始化
        if (!window.uploadedFiles) {
            window.uploadedFiles = [];
        } else {
            // 清空現有文件數組
            window.uploadedFiles = [];
        }
        
        // 更新上傳計數顯示（使用新ID）
        const uploadCountTopElement = document.getElementById('uploadCountTop');
        if (uploadCountTopElement) {
            uploadCountTopElement.textContent = licenseUrls.length;
        }
        
        const uploadCountBottomElement = document.getElementById('uploadCountBottom');
        if (uploadCountBottomElement) {
            uploadCountBottomElement.textContent = licenseUrls.length;
        }
        
        // 更新最大上傳數量顯示
        const maxUploadCountElement = document.getElementById('maxUploadCount');
        const MAX_UPLOAD_COUNT = maxUploadCountElement ? parseInt(maxUploadCountElement.textContent) : 5;
        
        // 如果已達最大上傳數量，隱藏上傳按鈕
        const uploadLabel = document.getElementById('uploadLabel');
        if (uploadLabel && licenseUrls.length >= MAX_UPLOAD_COUNT) {
            uploadLabel.style.display = 'none';
        }
        
        // 清空預覽容器
        const photoPreviewContainer = document.getElementById('photoPreviewContainer');
        if (!photoPreviewContainer) {
            console.error('找不到照片預覽容器');
            return;
        }
        photoPreviewContainer.innerHTML = '';
        
        // 為每個URL創建文件對象
        for (let i = 0; i < licenseUrls.length; i++) {
            const url = licenseUrls[i];
            const fileId = `existing-file-${Date.now()}-${i}`;
            
            try {
                // 提取文件名
                const fileName = getFileNameFromUrl(url);
                const fileExt = getFileExtension(fileName);
                const isPDF = fileExt.toLowerCase() === 'pdf';
                
                // 添加到上傳文件數組
                window.uploadedFiles.push({
                    id: fileId,
                    fileName: fileName,
                    preview: url,
                    existingUrl: url, // 標記為已存在的URL
                    isPDF: isPDF
                });
                
                console.log(`成功載入證照照片 ${i+1}/${licenseUrls.length}: ${fileName}`);
            } catch (error) {
                console.error(`載入證照照片 ${i+1}/${licenseUrls.length} 時發生錯誤:`, error);
            }
        }
        
        // 更新預覽區域
        updateUploadPreview();
        console.log('已成功載入所有證照照片');
        
    } catch (error) {
        console.error('載入證照照片時發生錯誤:', error);
        throw error;
    }
}

// 從URL中提取文件名
function getFileNameFromUrl(url) {
    try {
        // 嘗試解析URL
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        
        // 如果是Firebase Storage URL (含有/o/路徑)
        if (pathname.includes('/o/')) {
            // 提取編碼的文件路徑
            const encodedPath = pathname.split('/o/')[1];
            // 解碼路徑
            const decodedPath = decodeURIComponent(encodedPath);
            // 去除查詢參數
            const pathWithoutQuery = decodedPath.split('?')[0];
            // 獲取文件名(路徑最後部分)
            return pathWithoutQuery.split('/').pop();
        }
        
        // 一般URL處理
        return url.split('/').pop().split('?')[0] || "未命名檔案";
    } catch (error) {
        console.warn('解析URL時出錯:', error);
        return "未命名檔案";
    }
}

// 獲取文件擴展名
function getFileExtension(fileName) {
    return fileName.split('.').pop().toLowerCase();
}

// 初始化文件上傳功能
function initializeFileUpload() {
    console.log('初始化文件上傳功能...');
    
    // 確保全局上傳文件數組已初始化
    window.uploadedFiles = window.uploadedFiles || [];
    
    const businessLicenseFile = document.getElementById('businessLicenseFile');
    const photoPreviewContainer = document.getElementById('photoPreviewContainer');
    const uploadProgress = document.getElementById('uploadProgress');
    
    if (!businessLicenseFile) {
        console.warn('找不到上傳文件輸入元素');
        return;
    }
    
    if (!photoPreviewContainer) {
        console.warn('找不到照片預覽容器');
        return;
    }
    
    // 初始時檢查空狀態
    updateUploadPreview();
    
    // 處理文件上傳 - 移除舊的事件監聽器
    businessLicenseFile.removeEventListener('change', handleFileUpload);
    businessLicenseFile.addEventListener('change', handleFileUpload);
    
    // 設置拖放上傳
    const uploadArea = document.querySelector('.custom-file-upload');
    if (uploadArea) {
        console.log('設置拖放上傳功能...');
        
        // 移除任何現有的事件監聽器
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.removeEventListener(eventName, preventDefaults);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.removeEventListener(eventName, highlight);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.removeEventListener(eventName, unhighlight);
        });
        
        uploadArea.removeEventListener('drop', handleDrop);
        
        // 添加新的事件監聽器
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, unhighlight, false);
        });
        
        uploadArea.addEventListener('drop', handleDrop, false);
    } else {
        console.warn('找不到上傳區域元素');
    }
    
    console.log('文件上傳功能初始化完成');
}

// 防止拖放默認事件
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// 拖放區域高亮
function highlight() {
    const uploadArea = document.querySelector('.custom-file-upload');
    if (uploadArea) {
        uploadArea.classList.add('highlight');
    }
}

// 拖放區域取消高亮
function unhighlight() {
    const uploadArea = document.querySelector('.custom-file-upload');
    if (uploadArea) {
        uploadArea.classList.remove('highlight');
    }
}

// 處理拖放
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files && files.length > 0) {
        // 創建一個類似事件物件
        const event = { 
            target: { files: files },
            preventDefault: () => {}
        };
        handleFileUpload(event);
    }
}

// 處理文件上傳
async function handleFileUpload(e) {
    e.preventDefault();
    
    console.log('處理文件上傳...');
    const files = Array.from(e.target.files || []);
    
    // 獲取最大上傳數量
    const maxUploadCountElement = document.getElementById('maxUploadCount');
    const MAX_UPLOAD_COUNT = maxUploadCountElement ? parseInt(maxUploadCountElement.textContent) : 5;
    const MAX_FILE_SIZE_MB = 5; // 每個文件最大5MB
    
    // 確保不超過最大上傳數量
    if (window.uploadedFiles.length + files.length > MAX_UPLOAD_COUNT) {
        alert(`最多只能上傳 ${MAX_UPLOAD_COUNT} 張照片`);
        return;
    }
    
    console.log(`處理 ${files.length} 個文件...`);
    
    // 顯示上傳進度
    const uploadProgress = document.getElementById('uploadProgress');
    if (uploadProgress) {
        uploadProgress.style.display = 'block';
    }
    
    // 逐個處理文件
    for (const file of files) {
        // 檢查文件大小
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            alert(`文件 ${file.name} 超過大小限制（${MAX_FILE_SIZE_MB}MB）`);
            continue;
        }
        
        try {
            // 處理文件
            console.log(`正在處理文件: ${file.name}`);
            
            // 檢查文件類型是否允許
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                alert(`不支援的文件類型: ${file.name}\n僅支援JPEG、PNG和PDF格式`);
                continue;
            }
            
            // 壓縮圖片（如果是圖片類型）
            let processedFile = file;
            if (file.type.startsWith('image/')) {
                try {
                    processedFile = await compressImage(file);
                    console.log(`已壓縮圖片: ${file.name}`);
                } catch (compressError) {
                    console.warn(`圖片壓縮失敗，使用原始文件: ${compressError.message}`);
                    processedFile = file;
                }
            }
            
            // 創建文件ID和預覽URL
            const fileId = `file-${Date.now()}-${window.uploadedFiles.length}`;
            const preview = URL.createObjectURL(processedFile);
            const isPDF = file.type === 'application/pdf';
            
            // 添加到上傳文件列表
            window.uploadedFiles.push({
                id: fileId,
                file: processedFile,
                fileName: file.name,
                preview: preview,
                isPDF: isPDF
            });
            
            console.log(`文件已添加到上傳列表: ${file.name}`);
        } catch (error) {
            console.error(`處理文件 ${file.name} 時發生錯誤:`, error);
            alert(`處理文件 ${file.name} 時發生錯誤: ${error.message}`);
        }
    }
    
    // 隱藏上傳進度
    if (uploadProgress) {
        uploadProgress.style.display = 'none';
    }
    
    // 更新上傳計數和預覽
    updateUploadCount();
    updateUploadPreview();
    
    // 重置文件輸入，以便可以重新選擇相同的文件
    if (e.target && e.target.value !== undefined) {
        e.target.value = '';
    }
    
    console.log('文件上傳處理完成');
}

// 確認刪除文件
function confirmDeleteFile(fileId) {
    try {
        const fileIndex = window.uploadedFiles.findIndex(item => item.id === fileId);
        if (fileIndex === -1) return;
        
        const fileName = window.uploadedFiles[fileIndex].fileName;
        
        // 顯示確認對話框
        if (confirm(`確定要刪除檔案「${fileName}」嗎？`)) {
            // 移除預覽元素
            const previewElement = document.getElementById(`preview-container-${fileId}`);
            if (previewElement) {
                const parentElement = document.getElementById('photoPreviewContainer');
                if (parentElement) {
                    parentElement.removeChild(previewElement);
                }
            }
            
            // 釋放URL對象
            if (window.uploadedFiles[fileIndex].preview && !window.uploadedFiles[fileIndex].existingUrl) {
                URL.revokeObjectURL(window.uploadedFiles[fileIndex].preview);
            }
            
            // 從數組中移除
            window.uploadedFiles.splice(fileIndex, 1);
            
            // 更新UI
            updateUploadCount();
            
            // 如果沒有文件了，更新空預覽
            if (window.uploadedFiles.length === 0) {
                updateUploadPreview();
            }
        }
    } catch (error) {
        console.error('確認刪除文件時發生錯誤:', error);
    }
}

// 從Firebase Storage URL中獲取路徑
function getPathFromFirebaseStorageUrl(url) {
    try {
        // 創建URL對象
        const urlObj = new URL(url);
        
        // 檢查是否是Firebase Storage URL (包含 /o/ 路徑)
        if (urlObj.pathname.includes('/o/')) {
            // 提取 /o/ 後面的部分
            const encodedFilePath = urlObj.pathname.split('/o/')[1];
            
            // 解碼路徑
            const decodedPath = decodeURIComponent(encodedFilePath);
            
            // 移除查詢參數
            const pathWithoutQuery = decodedPath.split('?')[0];
            
            return pathWithoutQuery;
        }
        
        // 如果不是預期的格式，返回null
        return null;
    } catch (error) {
        console.error('解析Storage URL時出錯:', error);
        return null;
    }
}

// 提交重新申請
async function submitReapplication(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation(); // 防止事件冒泡
    }
    
    try {
        // 檢查必要模組是否加載
        if (!auth || typeof updateDoc !== 'function' || typeof setDoc !== 'function') {
            console.error('Firebase 模組未完全加載，無法提交申請');
            alert('系統模組未完全加載，請重新整理頁面後再試');
            return;
        }
        
        const user = auth.currentUser;
        
        if (!user) {
            alert('請先登入');
            return;
        }
        
        // 檢查表單是否有效
        if (!validateReapplyForm()) {
            return;
        }
        
        // 禁用提交按鈕防止重複提交
        const submitButton = document.querySelector('.btn-submit');
        const originalButtonText = submitButton ? submitButton.innerHTML : '提交申請';
        if (submitButton) {
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 處理中...';
            submitButton.disabled = true;
        }
        
        // 再次檢查App Check狀態
        try {
            if (typeof checkAppCheckStatus === 'function') {
                const appCheckResult = await checkAppCheckStatus();
                if (!appCheckResult.success) {
                    console.warn('App Check驗證失敗，但將繼續嘗試提交');
                }
                // 安裝攔截器確保請求帶有App Check令牌
                if (typeof installXHRInterceptor === 'function') {
                    installXHRInterceptor();
                }
            }
        } catch (error) {
            console.error('重新檢查App Check狀態失敗:', error);
        }
        
        // 獲取表單數據
        const businessName = document.getElementById('businessName').value.trim();
        const businessType = document.getElementById('businessType').value.trim();
        const businessAddress = document.getElementById('businessAddress').value.trim();
        const businessPhone = document.getElementById('businessPhone').value.trim();
        const businessDescription = document.getElementById('businessDescription').value.trim();
        const contactName = document.getElementById('contactName').value.trim();
        const contactPhone = document.getElementById('contactPhone').value.trim();
        
        // 確保所有數據都有值
        if (!businessName || !businessType || !businessAddress || !businessPhone || !businessDescription || !contactName || !contactPhone) {
            alert('所有必填欄位必須填寫');
            
            // 恢復提交按鈕
            if (submitButton) {
                submitButton.innerHTML = originalButtonText;
                submitButton.disabled = false;
            }
            
            return;
        }
        
        // 顯示處理訊息
        showLoadingMessage('正在更新店家資料...');
        
        // 更新店家資訊
        await updateDoc(doc(db, 'businesses', user.uid), {
            businessName: businessName,
            businessType: businessType,
            address: businessAddress,
            phoneNumber: businessPhone,
            description: businessDescription,
            contactName: contactName,
            contactPhone: contactPhone,
            email: user.email,
            ownerId: user.uid, // 確保包含 ownerId
            status: 'pending', // 改為待審核狀態
            rejectReason: null, // 清除拒絕原因
            updatedAt: serverTimestamp()
        });
        
        // 處理營業執照上傳
        const uploadedFiles = window.uploadedFiles || [];
        let licenseUrls = [];
        
        if (uploadedFiles.length > 0) {
            showLoadingMessage('正在處理檔案上傳...');
            
            // 找出新上傳的文件和已存在的文件
            const newFiles = uploadedFiles.filter(file => !file.existingUrl);
            const existingUrls = uploadedFiles.filter(file => file.existingUrl).map(file => file.existingUrl);
            
            // 如果有新文件，上傳它們
            if (newFiles.length > 0) {
                // 顯示上傳進度
                document.getElementById('uploadProgress').style.display = 'block';
                
                // 先刪除不在 existingUrls 中的舊文件
                try {
                    showLoadingMessage('正在處理既有檔案...');
                    const businessDoc = await getDoc(doc(db, 'businesses', user.uid));
                    const oldLicenseUrls = businessDoc.data().licenseUrls || [];
                    
                    for (const oldUrl of oldLicenseUrls) {
                        if (!existingUrls.includes(oldUrl)) {
                            try {
                                // 從URL中提取路徑
                                const pathFromUrl = getPathFromFirebaseStorageUrl(oldUrl);
                                if (pathFromUrl) {
                                    // 使用提取的路徑創建參考
                                    const oldRef = ref(storage, pathFromUrl);
                                    await deleteObject(oldRef);
                                    console.log('已刪除舊檔案:', pathFromUrl);
                                } else {
                                    console.error('無法從URL提取路徑:', oldUrl);
                                }
                            } catch (error) {
                                console.error('刪除舊照片錯誤:', error);
                                // 繼續處理，不阻止整個流程
                            }
                        }
                    }
                } catch (error) {
                    console.error('處理舊照片時發生錯誤:', error);
                    // 繼續處理，不阻止整個流程
                }
                
                // 上傳新文件
                for (let i = 0; i < newFiles.length; i++) {
                    const uploadedFile = newFiles[i];
                    const file = uploadedFile.file;
                    
                    showLoadingMessage(`正在上傳檔案 ${i+1}/${newFiles.length}...`);
                    
                    try {
                        // 修正：使用 licenses 路徑
                        const storageReference = ref(storage, `licenses/${user.uid}/${uploadedFile.fileName}`);
                        
                        // 上傳檔案
                        await uploadBytes(storageReference, file);
                        
                        // 獲取下載 URL
                        const licenseUrl = await getDownloadURL(storageReference);
                        licenseUrls.push(licenseUrl);
                        
                        console.log(`檔案上傳成功: ${uploadedFile.fileName}`);
                    } catch (uploadError) {
                        console.error(`上傳檔案時發生錯誤:`, uploadError);
                        alert(`上傳檔案 ${uploadedFile.fileName} 時發生錯誤: ${uploadError.message}`);
                        
                        // 恢復提交按鈕
                        if (submitButton) {
                            submitButton.innerHTML = originalButtonText;
                            submitButton.disabled = false;
                        }
                        
                        // 移除加載訊息
                        const loadingElement = document.getElementById('loadingMessage');
                        if (loadingElement) {
                            loadingElement.remove();
                        }
                        
                        return; // 終止提交過程
                    }
                }
                
                // 合併新舊 URL
                licenseUrls = [...existingUrls, ...licenseUrls];
            } else {
                // 沒有新文件，只保留選中的舊文件
                licenseUrls = existingUrls;
            }
            
            // 更新店家文檔添加執照 URL 數組
            showLoadingMessage('正在更新執照資訊...');
            await updateDoc(doc(db, 'businesses', user.uid), {
                licenseUrls: licenseUrls
            });
        } else {
            // 檢查是否已有執照
            try {
                const businessDoc = await getDoc(doc(db, 'businesses', user.uid));
                licenseUrls = businessDoc.data().licenseUrls || [];
                
                if (licenseUrls.length === 0) {
                    alert('請上傳至少一個營業執照檔案');
                    
                    // 恢復提交按鈕
                    if (submitButton) {
                        submitButton.innerHTML = originalButtonText;
                        submitButton.disabled = false;
                    }
                    
                    // 移除加載訊息
                    const loadingElement = document.getElementById('loadingMessage');
                    if (loadingElement) {
                        loadingElement.remove();
                    }
                    
                    return; // 終止提交過程
                }
            } catch (error) {
                console.error('檢查執照時發生錯誤:', error);
                // 繼續處理，不阻止整個流程
            }
        }
        
        // 創建審核請求
        showLoadingMessage('正在提交審核請求...');
        await setDoc(doc(db, 'businessApprovalRequests', user.uid), {
            userId: user.uid,
            businessName: businessName,
            businessType: businessType,
            address: businessAddress,
            phoneNumber: businessPhone,
            description: businessDescription,
            contactName: contactName,
            contactPhone: contactPhone,
            email: user.email,
            licenseUrls: licenseUrls,
            status: 'pending',
            rejectReason: null,
            isReapply: true, // 標記為重新申請
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // 清除會話緩存
        localStorage.removeItem('business_reapply_session');
        
        // 顯示成功訊息
        const successAlert = document.createElement('div');
        successAlert.className = 'alert alert-success mt-4';
        successAlert.innerHTML = `
            <h5>重新申請已成功提交！</h5>
            <p>我們將盡快審核您的申請，並通過電子郵件通知您結果。</p>
            <p>5秒後將自動跳轉到登入頁面...</p>
        `;
        
        // 移除加載訊息
        const loadingElement = document.getElementById('loadingMessage');
        if (loadingElement) {
            loadingElement.remove();
        }
        
        // 添加成功訊息
        const formContainer = document.querySelector('.register-form-container') || document.body;
        formContainer.appendChild(successAlert);
        
        // 登出用戶（需要等待審核）
        if (typeof auth.signOut === 'function') {
            try {
                await auth.signOut();
            } catch (signOutError) {
                console.error('登出時發生錯誤:', signOutError);
                // 繼續處理，不阻止整個流程
            }
        }
        
        // 5秒後跳轉到登入頁面
        setTimeout(() => {
            window.location.href = 'business-login.html?status=reapplied';
        }, 5000);
        
    } catch (error) {
        console.error('重新申請時發生錯誤:', error);
        
        // 恢復按鈕狀態
        const submitButton = document.querySelector('.btn-submit');
        if (submitButton) {
            submitButton.innerHTML = '提交申請';
            submitButton.disabled = false;
        }
        
        // 移除加載訊息
        const loadingElement = document.getElementById('loadingMessage');
        if (loadingElement) {
            loadingElement.remove();
        }
        
        // 顯示錯誤訊息
        alert('重新申請時發生錯誤: ' + error.message);
    }
}

// 驗證表單
function validateReapplyForm() {
    let isValid = true;
    
    // 驗證店家名稱
    const businessName = document.getElementById('businessName');
    if (!businessName || !businessName.value.trim()) {
        if (businessName) {
            businessName.classList.add('is-invalid');
        }
        isValid = false;
    } else {
        businessName.classList.remove('is-invalid');
    }
    
    // 驗證店家類型
    const businessType = document.getElementById('businessType');
    if (!businessType || !businessType.value.trim()) {
        if (businessType) businessType.classList.add('is-invalid');
        isValid = false;
    } else if (businessType.value && businessType.value.length > 10) {
        businessType.classList.add('is-invalid');
        const errorFeedback = document.querySelector('#businessType + .error-feedback');
        if (errorFeedback) {
            errorFeedback.textContent = '店家類型不能超過10個字';
        }
        isValid = false;
    } else {
        businessType.classList.remove('is-invalid');
    }
    
    // 驗證店家地址
    const businessAddress = document.getElementById('businessAddress');
    if (!businessAddress || !businessAddress.value.trim()) {
        if (businessAddress) {
            businessAddress.classList.add('is-invalid');
        }
        isValid = false;
    } else {
        businessAddress.classList.remove('is-invalid');
    }
    
    // 驗證店家電話
    const businessPhone = document.getElementById('businessPhone');
    if (!businessPhone || !businessPhone.value.trim() || !isValidPhone(businessPhone.value)) {
        if (businessPhone) {
            businessPhone.classList.add('is-invalid');
        }
        isValid = false;
    } else {
        businessPhone.classList.remove('is-invalid');
    }

    // 驗證店家介紹
    const businessDescription = document.getElementById('businessDescription');
    if (!businessDescription || !businessDescription.value || !businessDescription.value.trim()) {
        if (businessDescription) businessDescription.classList.add('is-invalid');
        isValid = false;
    } else {
        businessDescription.classList.remove('is-invalid');
    }
    
    // 驗證聯絡人姓名
    const contactName = document.getElementById('contactName');
    if (!contactName || !contactName.value.trim()) {
        if (contactName) {
            contactName.classList.add('is-invalid');
        }
        isValid = false;
    } else {
        contactName.classList.remove('is-invalid');
    }
    
    // 驗證聯絡人手機
    const contactPhone = document.getElementById('contactPhone');
    if (!contactPhone || !contactPhone.value.trim() || !isValidPhone(contactPhone.value)) {
        if (contactPhone) {
            contactPhone.classList.add('is-invalid');
        }
        isValid = false;
    } else {
        contactPhone.classList.remove('is-invalid');
    }
    
    // 驗證營業執照上傳
    const uploadedFiles = window.uploadedFiles || [];
    if (uploadedFiles.length === 0) {
        // 檢查是否已有舊的證照
        const licenseContainer = document.getElementById('photoPreviewContainer');
        if (licenseContainer && licenseContainer.children.length === 0) {
            const fileUploadArea = document.querySelector('.custom-file-upload');
            if (fileUploadArea) {
                fileUploadArea.classList.add('is-invalid');
            }
            isValid = false;
        }
    }
    
    // 驗證條款勾選
    const termsCheck = document.getElementById('termsCheck');
    if (!termsCheck || !termsCheck.checked) {
        if (termsCheck) {
            termsCheck.classList.add('is-invalid');
        }
        isValid = false;
    } else if (termsCheck) {
        termsCheck.classList.remove('is-invalid');
    }
    
    if (!isValid) {
        alert('請填寫所有必填欄位');
    }
    
    return isValid;
}

// 驗證電話號碼
function isValidPhone(phone) {
    if (!phone) return false;
    
    // 去除所有非數字字符（例如空格、破折號等）
    const cleanPhone = phone.replace(/\D/g, '');
    
    // 簡單的臺灣電話格式驗證，可根據需要調整
    // 市話: 0X-XXXXXXXX 或 0X-XXXXXXX (如02-12345678)
    // 手機: 09XXXXXXXX (如0912345678)
    const phoneRegex = /^(0[2-9]\d{7,8}|09\d{8})$/;
    return phoneRegex.test(cleanPhone);
}

// iOS特定修復函數
function applyIOSFixes() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (isIOS) {
        console.log('檢測到iOS裝置，應用特定修復...');
        
        // 修復1: 防止iOS上的表單自動提交
        document.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', function(e) {
                // 對於非提交按鈕，阻止預設行為
                if (this.type !== 'submit') {
                    e.preventDefault();
                }
            });
        });
        
        // 修復2: 解決iOS上的點擊延遲問題
        document.documentElement.style.cursor = 'pointer';
        
        // 修復3: 確保文件上傳在iOS上正常工作
        const fileInput = document.getElementById('businessLicenseFile');
        if (fileInput) {
            // 使用另一個元素觸發文件選擇
            const uploadLabel = document.getElementById('uploadLabel');
            if (uploadLabel) {
                uploadLabel.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    fileInput.click();
                });
            }
        }
        
        // 修復4: 確保表單提交在iOS上可靠工作
        const reapplyForm = document.getElementById('businessReapplyForm');
        if (reapplyForm) {
            reapplyForm.addEventListener('submit', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('iOS上的表單提交觸發');
                
                // 在iOS上，直接調用處理函數而不是依賴事件傳播
                if (typeof submitReapplication === 'function') {
                    submitReapplication(e);
                } else {
                    console.error('submitReapplication函數未加載');
                    alert('系統錯誤：表單提交功能未加載，請重新整理頁面');
                }
            });
        }
        
        // 修復5: 修復iOS上的拖放功能
        const uploadArea = document.querySelector('.custom-file-upload');
        if (uploadArea) {
            // 在iOS上禁用拖放（因為iOS不支持文件拖放）
            uploadArea.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('iOS裝置禁用拖放功能');
            });
        }
    }
}

// 確保全局可訪問關鍵函數
window.updateUploadPreview = updateUploadPreview;
window.updateUploadCount = updateUploadCount;
window.confirmDeleteFile = confirmDeleteFile;
window.handleFileUpload = handleFileUpload;
window.loadExistingLicenses = loadExistingLicenses;
window.getFileNameFromUrl = getFileNameFromUrl;
window.getFileExtension = getFileExtension;
window.formatFileSize = formatFileSize;
window.submitReapplication = submitReapplication;
window.validateReapplyForm = validateReapplyForm;
window.isValidPhone = isValidPhone;
window.showLoadingMessage = showLoadingMessage;
window.showError = showError;
window.getUploadedBusinessLicenseFiles = function() {
    return window.uploadedFiles || [];
};
window.removeUploadedFile = function(index) {
    if (Array.isArray(window.uploadedFiles) && index >= 0 && index < window.uploadedFiles.length) {
        const fileName = window.uploadedFiles[index].fileName;
        
        // 顯示確認對話框
        if (confirm(`確定要刪除檔案「${fileName}」嗎？`)) {
            // 如果有預覽URL，釋放
            if (window.uploadedFiles[index].preview && !window.uploadedFiles[index].existingUrl) {
                URL.revokeObjectURL(window.uploadedFiles[index].preview);
            }
            
            // 從數組中移除
            window.uploadedFiles.splice(index, 1);
            
            // 更新UI
            updateUploadCount();
            updateUploadPreview();
        }
    }
};

// 添加初始化完成標記
window.firebaseReapplyJsLoaded = true;
console.log('firebase-reapply.js 完全加載完成！');

        // 壓縮圖片
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        try {
            const reader = new FileReader();
            
            reader.onload = function(event) {
                try {
                    const img = new Image();
                    
                    img.onload = function() {
                        try {
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            
                            // 計算新的尺寸，保持寬高比
                            let width = img.width;
                            let height = img.height;
                            const maxDimension = 1024; // 最大寬度/高度
                            
                            if (width > height && width > maxDimension) {
                                height = Math.round((height * maxDimension) / width);
                                width = maxDimension;
                            } else if (height > maxDimension) {
                                width = Math.round((width * maxDimension) / height);
                                height = maxDimension;
                            }
                            
                            canvas.width = width;
                            canvas.height = height;
                            ctx.drawImage(img, 0, 0, width, height);
                            
                            // 轉換為 Blob
                            canvas.toBlob(
                                (blob) => {
                                    try {
                                        // 創建新文件對象
                                        const compressedFile = new File([blob], file.name, {
                                            type: 'image/jpeg',
                                            lastModified: Date.now()
                                        });
                                        resolve(compressedFile);
                                    } catch (blobError) {
                                        console.error('Blob轉換為File時出錯:', blobError);
                                        resolve(file); // 失敗時使用原始文件
                                    }
                                },
                                'image/jpeg',
                                0.7 // 設置壓縮質量 (0.7 = 70% 質量)
                            );
                        } catch (canvasError) {
                            console.error('Canvas繪製錯誤:', canvasError);
                            resolve(file); // 失敗時使用原始文件
                        }
                    };
                    
                    img.onerror = function(imgError) {
                        console.error('圖片加載錯誤:', imgError);
                        resolve(file); // 失敗時使用原始文件
                    };
                    
                    img.src = event.target.result;
                } catch (imgCreateError) {
                    console.error('圖片創建錯誤:', imgCreateError);
                    resolve(file); // 失敗時使用原始文件
                }
            };
            
            reader.onerror = function(readerError) {
                console.error('FileReader錯誤:', readerError);
                resolve(file); // 失敗時使用原始文件
            };
            
            reader.readAsDataURL(file);
        } catch (mainError) {
            console.error('壓縮總體錯誤:', mainError);
            resolve(file); // 失敗時使用原始文件
        }
    });
}

// 更新上傳計數
function updateUploadCount() {
    // 更新頂部計數
    const uploadCountTopElement = document.getElementById('uploadCountTop');
    if (uploadCountTopElement) {
        uploadCountTopElement.textContent = window.uploadedFiles.length;
    }
    
    // 更新底部計數
    const uploadCountBottomElement = document.getElementById('uploadCountBottom');
    if (uploadCountBottomElement) {
        uploadCountBottomElement.textContent = window.uploadedFiles.length;
    }
    
    // 如果已達最大上傳數，隱藏上傳按鈕
    const uploadLabel = document.getElementById('uploadLabel');
    const maxUploadCountElement = document.getElementById('maxUploadCount');
    const MAX_UPLOAD_COUNT = maxUploadCountElement ? parseInt(maxUploadCountElement.textContent) : 5;
    
    if (uploadLabel) {
        uploadLabel.style.display = window.uploadedFiles.length >= MAX_UPLOAD_COUNT ? 'none' : 'block';
    }
}

// 更新上傳預覽區域
function updateUploadPreview() {
    const uploadPreview = document.getElementById('photoPreviewContainer');
    
    // 檢查元素是否存在
    if (!uploadPreview) {
        console.warn('找不到上傳預覽容器元素 (photoPreviewContainer)');
        return; // 提前返回，避免錯誤
    }
    
    // 確保uploadedFiles已初始化
    if (!window.uploadedFiles) {
        window.uploadedFiles = [];
    }
    
    // 清空預覽容器
    uploadPreview.innerHTML = '';
    
    // 如果沒有上傳文件，顯示空訊息
    if (window.uploadedFiles.length === 0) {
        uploadPreview.innerHTML = `
            <div class="empty-preview-message w-100 text-center py-4">
                <i class="fas fa-images mb-2" style="font-size: 2rem; color: #ced4da;"></i>
                <p class="text-muted">尚未上傳任何檔案</p>
            </div>
        `;
        return;
    }
    
    // 為每個文件創建預覽
    window.uploadedFiles.forEach((file, index) => {
        const isPDF = file.isPDF || (file.fileName && file.fileName.toLowerCase().endsWith('.pdf'));
        const fileId = file.id;
        
        // 創建預覽元素
        const previewItem = document.createElement('div');
        previewItem.className = 'col-md-6 col-lg-4 mb-3';
        previewItem.id = `preview-container-${fileId}`;
        
        if (isPDF) {
            // PDF 預覽
            previewItem.innerHTML = `
                <div class="card h-100 file-preview-card">
                    <div class="card-img-top bg-light d-flex align-items-center justify-content-center" style="height: 160px;">
                        <i class="fas fa-file-pdf text-danger" style="font-size: 3rem;"></i>
                    </div>
                    <div class="card-body p-3">
                        <h6 class="card-title text-truncate mb-1" title="${file.fileName}">${file.fileName}</h6>
                                <p class="card-text text-muted small mb-0">${file.file ? formatFileSize(file.file.size) : '已存在的檔案'}</p>
                    </div>
                    <button class="position-absolute btn btn-sm btn-danger rounded-circle delete-file-btn" 
                            style="top: 8px; right: 8px; width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; z-index: 10;" 
                            data-id="${fileId}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        } else {
            // 圖片預覽
            previewItem.innerHTML = `
                <div class="card h-100 file-preview-card">
                    <div class="card-img-top" style="height: 160px; background-image: url('${file.preview}'); background-size: cover; background-position: center;"></div>
                    <div class="card-body p-3">
                        <h6 class="card-title text-truncate mb-1" title="${file.fileName}">${file.fileName}</h6>
                        <p class="card-text text-muted small mb-0">${file.file ? formatFileSize(file.file.size) : '已存在的檔案'}</p>
                    </div>
                    <button class="position-absolute btn btn-sm btn-danger rounded-circle delete-file-btn" 
                            style="top: 8px; right: 8px; width: 28px; height: 28px; padding: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; z-index: 10;" 
                            data-id="${fileId}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }
        
        // 添加到預覽容器
        uploadPreview.appendChild(previewItem);
        
        // 添加刪除按鈕點擊事件
        setTimeout(() => {
            const deleteBtn = previewItem.querySelector('.delete-file-btn');
            if (deleteBtn) {
                deleteBtn.removeEventListener('click', deleteButtonClickHandler);
                deleteBtn.addEventListener('click', deleteButtonClickHandler);
            }
        }, 0);
    });
}

// 刪除按鈕點擊處理函數
function deleteButtonClickHandler() {
    const fileId = this.getAttribute('data-id');
    if (fileId) {
        confirmDeleteFile(fileId);
    }
}