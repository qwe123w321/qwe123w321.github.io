// firebase-register.js
import { auth, db, storage, doc, collection } from './firebase-config.js';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';
import { setDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js';

// 等待 DOM 加載完成
document.addEventListener('DOMContentLoaded', function() {
    // 獲取註冊表單
    const registerForm = document.getElementById('businessRegisterForm');
    
    if (registerForm) {
        // 為表單添加提交事件監聽器
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // 檢查第三步的必填字段是否已填寫
            if (!validateStep(3)) {
                // 如果未驗證通過，切換到第三步
                document.querySelectorAll('.form-step').forEach(step => step.classList.remove('active'));
                document.getElementById('step-3-content').classList.add('active');
                document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
                document.getElementById('step-3').classList.add('active');
                return;
            }
            
            // 禁用提交按鈕防止重複提交
            const submitButton = document.querySelector('.btn-submit');
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 處理中...';
            submitButton.disabled = true;
            
            try {
                // 獲取表單數據
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const businessName = document.getElementById('businessName').value;
                const businessType = document.getElementById('businessType').value;
                const businessAddress = document.getElementById('businessAddress').value;
                const businessPhone = document.getElementById('businessPhone').value;
                const contactName = document.getElementById('contactName').value;
                const contactPhone = document.getElementById('contactPhone').value;
                
                console.log("提交表單資料:", {email, businessName, businessType});
                
                // 1. 創建 Firebase 用戶 (使用模組化 API)
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // 2. 發送驗證郵件
                await sendEmailVerification(user);
                
                // 3. 存儲店家資訊到 Firestore
                await setDoc(doc(db, 'businesses', user.uid), {
                    businessName: businessName,
                    businessType: businessType,
                    address: businessAddress,
                    phoneNumber: businessPhone,
                    contactName: contactName,
                    contactPhone: contactPhone,
                    status: 'pending', // 審核狀態：pending, approved, rejected
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                
                // 4. 處理營業執照上傳
                const uploadedFiles = window.getUploadedBusinessLicenseFiles();
                console.log('提交表單處理上傳檔案:', uploadedFiles);

                let licenseUrls = [];
                
                if (uploadedFiles && uploadedFiles.length > 0) {
                    // 建立照片URL陣列
                    for (const uploadedFile of uploadedFiles) {
                        const file = uploadedFile.file;
                        const storageReference = ref(storage, `licenses/${user.uid}/${uploadedFile.fileName}`);
                        
                        // 上傳檔案
                        await uploadBytes(storageReference, file);
                        
                        // 獲取下載 URL
                        const licenseUrl = await getDownloadURL(storageReference);
                        licenseUrls.push(licenseUrl);
                    }
                    
                    // 更新店家文檔添加執照 URL 數組
                    await updateDoc(doc(db, 'businesses', user.uid), {
                        licenseUrls: licenseUrls
                    });
                }
                
                // 5. 創建審核請求
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
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                
                // 6. 登出用戶（因為需要等待審核）
                await auth.signOut();
                
                // 顯示成功訊息
                const successAlert = document.createElement('div');
                successAlert.className = 'alert alert-success mt-4';
                successAlert.innerHTML = `
                    <h5>註冊申請已成功提交！</h5>
                    <p>我們將盡快審核您的申請，並通過電子郵件通知您結果。請確認您的郵箱並完成驗證。</p>
                    <p>5秒後將自動跳轉到登入頁面...</p>
                `;
                document.querySelector('.register-form-container').appendChild(successAlert);
                
                // 5秒後跳轉到登入頁面
                setTimeout(() => {
                    window.location.href = 'business-login.html?status=registered';
                }, 5000);
                
            } catch (error) {
                console.error('註冊時發生錯誤:', error);
                
                // 恢復按鈕狀態
                submitButton.innerHTML = '提交註冊';
                submitButton.disabled = false;
                
                // 顯示錯誤訊息
                let errorMessage = '註冊過程中發生錯誤，請稍後再試';
                
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = '此電子郵件已被使用';
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = '無效的電子郵件格式';
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = '密碼強度不夠，請設置更複雜的密碼';
                } else if (error.code === 'auth/network-request-failed') {
                    errorMessage = '網絡連接失敗，請檢查您的網絡連接';
                } else if (error.message) {
                    errorMessage = error.message;
                }
                
                // 添加錯誤提示元素（如果不存在）
                let errorAlert = document.querySelector('.register-error-alert');
                if (!errorAlert) {
                    errorAlert = document.createElement('div');
                    errorAlert.className = 'alert alert-danger register-error-alert mt-3';
                    errorAlert.role = 'alert';
                    document.querySelector('.register-form-header').after(errorAlert);
                }
                
                errorAlert.textContent = errorMessage;
                errorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }
    
    // 重新申請審核功能 (用於被拒絕的商家)
    async function reapplyForApproval() {
        try {
            const user = firebase.auth().currentUser;
            
            if (!user) {
                alert('請先登入');
                return;
            }
            
            // 獲取商家信息
            const businessDoc = await firebase.firestore().collection('businesses').doc(user.uid).get();
            
            if (!businessDoc.exists) {
                alert('找不到商家信息');
                return;
            }
            
            const businessData = businessDoc.data();
            
            // 檢查狀態是否為 rejected
            if (businessData.status !== 'rejected') {
                alert('只有被拒絕的商家才能重新申請');
                return;
            }
            
            // 更新商家狀態為 pending
            await firebase.firestore().collection('businesses').doc(user.uid).update({
                status: 'pending',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                rejectReason: null // 清除拒絕原因
            });
            
            // 創建新的審核請求
            await firebase.firestore().collection('businessApprovalRequests').doc(user.uid).set({
                userId: user.uid,
                businessName: businessData.businessName,
                businessType: businessData.businessType,
                address: businessData.address,
                phoneNumber: businessData.phoneNumber,
                contactName: businessData.contactName,
                contactPhone: businessData.contactPhone,
                licenseUrls: businessData.licenseUrls || [],
                status: 'pending',
                rejectReason: null,
                isReapply: true, // 標記為重新申請
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            alert('重新申請已提交，我們將盡快審核您的申請');
            
            // 轉到待審核狀態頁面
            window.location.reload();
            
        } catch (error) {
            console.error('重新申請審核時發生錯誤:', error);
            alert('重新申請時發生錯誤: ' + error.message);
        }
    }
});