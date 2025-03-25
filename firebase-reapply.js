import { auth, db, storage, doc, collection, onAuthStateChanged } from './firebase-config.js';
import { setDoc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js';

// 導入App Check模組功能
import { checkAppCheckStatus, installXHRInterceptor } from './app-check-module.js';

// 等待 DOM 加載完成
document.addEventListener('DOMContentLoaded', function() {
    console.log('重新申請頁面DOM已載入，準備初始化...');
    
    // 添加狀態變數以追蹤認證檢查
    let authCheckComplete = false;
    let redirectInProgress = false;
    
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
    
    // 先檢查App Check狀態
    checkAppCheckStatus().then(result => {
        console.log('App Check狀態檢查結果:', result.success ? '成功' : '失敗');
        
        // 安裝XHR攔截器以確保請求都帶有App Check令牌
        installXHRInterceptor();
        
        // 延遲檢查認證狀態，給Firebase足夠時間恢復會話
        setTimeout(() => {
            console.log('延遲後開始檢查認證狀態...');
            
            // 檢查用戶是否已登入
            onAuthStateChanged(auth, function(user) {
                // 標記已完成認證檢查
                authCheckComplete = true;
                
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
        }, 1000); // 延遲1秒再檢查認證狀態
    }).catch(error => {
        console.error('App Check檢查失敗:', error);
        // 即使App Check失敗，仍然嘗試讀取用戶狀態
        onAuthStateChanged(auth, function(user) {
            if (user && !redirectInProgress) {
                console.log('App Check失敗但用戶已登入，嘗試繼續...');
                initReapplyPage(user);
            } else if (!redirectInProgress) {
                redirectInProgress = true;
                alert('初始化失敗，請重新登入');
                window.location.href = 'business-login.html';
            }
        });
    });
    
    // 表單提交事件
    const reapplyForm = document.getElementById('businessReapplyForm');
    if (reapplyForm) {
        reapplyForm.addEventListener('submit', submitReapplication);
    }
});

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

// 初始化重新申請頁面
async function initReapplyPage(user) {
    try {
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
        
        // 獲取店家信息
        const businessDoc = await getDoc(doc(db, 'businesses', businessId));
        
        if (!businessDoc.exists()) {
            alert('找不到店家信息');
            window.location.href = 'business-login.html';
            return;
        }
        
        const businessData = businessDoc.data();
        
        // 檢查狀態是否為 rejected
        if (businessData.status !== 'rejected') {
            alert('只有被拒絕的商家才能重新申請');
            window.location.href = 'business-login.html';
            return;
        }
        
        // 填充表單字段
        document.getElementById('businessName').value = businessData.businessName || '';
        
        const businessTypeSelect = document.getElementById('businessType');
        if (businessTypeSelect) {
            for (let i = 0; i < businessTypeSelect.options.length; i++) {
                if (businessTypeSelect.options[i].value === businessData.businessType) {
                    businessTypeSelect.selectedIndex = i;
                    break;
                }
            }
        }
        
        document.getElementById('businessAddress').value = businessData.address || '';
        document.getElementById('businessPhone').value = businessData.phoneNumber || '';
        document.getElementById('contactName').value = businessData.contactName || '';
        document.getElementById('contactPhone').value = businessData.contactPhone || '';
        
        // 顯示拒絕原因
        const rejectReasonEl = document.getElementById('rejectReason');
        if (rejectReasonEl && businessData.rejectReason) {
            rejectReasonEl.textContent = businessData.rejectReason;
        }
        
        // 加載已有的證照照片
        const licenseUrls = businessData.licenseUrls || [];
        
        if (licenseUrls.length > 0 && window.loadExistingLicenses) {
            window.loadExistingLicenses(licenseUrls);
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
    }
}

// 提交重新申請
async function submitReapplication(e) {
    e.preventDefault();
    
    try {
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
        submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 處理中...';
        submitButton.disabled = true;
        
        // 再次檢查App Check狀態
        try {
            const appCheckResult = await checkAppCheckStatus();
            if (!appCheckResult.success) {
                console.warn('App Check驗證失敗，但將繼續嘗試提交');
            }
            // 安裝攔截器確保請求帶有App Check令牌
            installXHRInterceptor();
        } catch (error) {
            console.error('重新檢查App Check狀態失敗:', error);
        }
        
        // 獲取表單數據
        const businessName = document.getElementById('businessName').value;
        const businessType = document.getElementById('businessType').value;
        const businessAddress = document.getElementById('businessAddress').value;
        const businessPhone = document.getElementById('businessPhone').value;
        const contactName = document.getElementById('contactName').value;
        const contactPhone = document.getElementById('contactPhone').value;
        
        // 更新店家資訊
        await updateDoc(doc(db, 'businesses', user.uid), {
            businessName: businessName,
            businessType: businessType,
            address: businessAddress,
            phoneNumber: businessPhone,
            contactName: contactName,
            contactPhone: contactPhone,
            ownerId: user.uid, // 確保包含 ownerId
            status: 'pending', // 改為待審核狀態
            rejectReason: null, // 清除拒絕原因
            updatedAt: serverTimestamp()
        });
        
        // 處理營業執照上傳
        const uploadedFiles = window.getUploadedBusinessLicenseFiles();
        let licenseUrls = [];
        
        if (uploadedFiles && uploadedFiles.length > 0) {
            // 找出新上傳的文件和已存在的文件
            const newFiles = uploadedFiles.filter(file => !file.existingUrl);
            const existingUrls = uploadedFiles.filter(file => file.existingUrl).map(file => file.existingUrl);
            
            // 如果有新文件，上傳它們
            if (newFiles.length > 0) {
                // 顯示上傳進度
                document.getElementById('uploadProgress').style.display = 'block';
                
                // 先刪除不在 existingUrls 中的舊文件
                try {
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
                for (const uploadedFile of newFiles) {
                    const file = uploadedFile.file;
                    // 修正：使用 business_licenses 路徑
                    const storageReference = ref(storage, `business_licenses/${user.uid}/${uploadedFile.fileName}`);
                    
                    // 上傳檔案
                    await uploadBytes(storageReference, file);
                    
                    // 獲取下載 URL
                    const licenseUrl = await getDownloadURL(storageReference);
                    licenseUrls.push(licenseUrl);
                }
                
                // 合併新舊 URL
                licenseUrls = [...existingUrls, ...licenseUrls];
            } else {
                // 沒有新文件，只保留選中的舊文件
                licenseUrls = existingUrls;
            }
            
            // 更新店家文檔添加執照 URL 數組
            await updateDoc(doc(db, 'businesses', user.uid), {
                licenseUrls: licenseUrls
            });
        }
        
        // 創建審核請求
        await setDoc(doc(db, 'businessApprovalRequests', user.uid), {
            userId: user.uid,
            businessName: businessName,
            businessType: businessType,
            address: businessAddress,
            phoneNumber: businessPhone,
            contactName: contactName,
            contactPhone: contactPhone,
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
        
        // 添加成功訊息
        const formContainer = document.querySelector('.register-form-container') || document.body;
        formContainer.appendChild(successAlert);
        
        // 登出用戶（需要等待審核）
        await auth.signOut();
        
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
        
        // 顯示錯誤訊息
        alert('重新申請時發生錯誤: ' + error.message);
    }
}

// 輔助函數: 從Firebase Storage URL中獲取路徑
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

// 輔助函數: 驗證表單 (保留原函數，但移至模組)
function validateReapplyForm() {
    let isValid = true;
    
    // 驗證店家名稱
    const businessName = document.getElementById('businessName');
    if (!businessName.value) {
        businessName.classList.add('is-invalid');
        isValid = false;
    } else {
        businessName.classList.remove('is-invalid');
    }
    
    // 驗證店家類型
    const businessType = document.getElementById('businessType');
    if (!businessType.value) {
        businessType.classList.add('is-invalid');
        isValid = false;
    } else {
        businessType.classList.remove('is-invalid');
    }
    
    // 驗證店家地址
    const businessAddress = document.getElementById('businessAddress');
    if (!businessAddress.value) {
        businessAddress.classList.add('is-invalid');
        isValid = false;
    } else {
        businessAddress.classList.remove('is-invalid');
    }
    
    // 驗證店家電話
    const businessPhone = document.getElementById('businessPhone');
    if (!businessPhone.value || !isValidPhone(businessPhone.value)) {
        businessPhone.classList.add('is-invalid');
        isValid = false;
    } else {
        businessPhone.classList.remove('is-invalid');
    }
    
    // 驗證聯絡人姓名
    const contactName = document.getElementById('contactName');
    if (!contactName.value) {
        contactName.classList.add('is-invalid');
        isValid = false;
    } else {
        contactName.classList.remove('is-invalid');
    }
    
    // 驗證聯絡人手機
    const contactPhone = document.getElementById('contactPhone');
    if (!contactPhone.value || !isValidPhone(contactPhone.value)) {
        contactPhone.classList.add('is-invalid');
        isValid = false;
    } else {
        contactPhone.classList.remove('is-invalid');
    }
    
    // 驗證營業執照上傳
    const uploadedFiles = window.getUploadedBusinessLicenseFiles();
    if (!uploadedFiles || uploadedFiles.length === 0) {
        // 檢查是否已有舊的證照
        const licenseContainer = document.getElementById('photoPreviewContainer');
        if (licenseContainer && licenseContainer.children.length === 0) {
            document.querySelector('.custom-file-upload').classList.add('is-invalid');
            isValid = false;
        }
    }
    
    // 驗證條款勾選
    const termsCheck = document.getElementById('termsCheck');
    if (!termsCheck.checked) {
        termsCheck.classList.add('is-invalid');
        isValid = false;
    } else {
        termsCheck.classList.remove('is-invalid');
    }
    
    if (!isValid) {
    }
    
    return isValid;
}

// 輔助函數：驗證電話號碼
function isValidPhone(phone) {
    // 簡單的臺灣電話格式驗證，可根據需要調整
    const phoneRegex = /^(0[2-9]\d{7,8}|09\d{8})$/;
    return phoneRegex.test(phone);
}