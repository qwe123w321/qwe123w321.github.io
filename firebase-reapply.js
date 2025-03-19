// firebase-reapply.js
import { auth, db, storage, doc, collection, onAuthStateChanged } from './firebase-config.js';
import { setDoc, getDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL, deleteObject, refFromURL } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js';

// 等待 DOM 加載完成
document.addEventListener('DOMContentLoaded', function() {
    // 檢查用戶是否已登入
    onAuthStateChanged(auth, function(user) {
        if (user) {
            // 用戶已登入，初始化重新申請頁面
            initReapplyPage(user);
        } else {
            // 用戶未登入，重定向到登入頁面
            window.location.href = 'business-login.html';
        }
    });
    
    // 表單提交事件
    const reapplyForm = document.getElementById('businessReapplyForm');
    if (reapplyForm) {
        reapplyForm.addEventListener('submit', submitReapplication);
    }
});

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
                                // 嘗試從URL創建引用並刪除
                                try {
                                    // 提取文件路徑
                                    const oldRef = refFromURL(storage, oldUrl);
                                    await deleteObject(oldRef);
                                } catch (refError) {
                                    console.error('無法創建引用:', refError);
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