// 管理員功能初始化
function initAdminManager() {
    console.log("初始化管理員功能...");
    const adminButton = document.getElementById('adminButton');
    const adminKeyModal = document.getElementById('adminKeyModal');
    const cancelAdminKey = document.getElementById('cancelAdminKey');
    const submitAdminKey = document.getElementById('submitAdminKey');
    const adminKeyError = document.getElementById('adminKeyError');
    const adminSuccessModal = document.getElementById('adminSuccessModal');
    const reloadNowButton = document.getElementById('reloadNow');
    const userStatus = document.getElementById('userStatus');

    // 確保所有必要元素都存在
    if (!adminButton) {
        console.error('管理員功能初始化失敗：缺少adminButton元素');
        return;
    }
    
    if (!adminKeyModal || !cancelAdminKey || !submitAdminKey || 
        !adminKeyError || !adminSuccessModal || !reloadNowButton) {
        console.error('管理員功能初始化失敗：缺少必要DOM元素');
        return;
    }

    console.log('所有必要元素已找到，繼續初始化...');

    // 檢查當前用戶是否已是管理員
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('用戶已登入:', user.email);
            try {
                // 先將按鈕隱藏，只有確認用戶不是管理員才顯示
                adminButton.style.display = 'none';
                
                // 檢查用戶Token中是否有管理員角色
                const idTokenResult = await user.getIdTokenResult();
                const isAdmin = idTokenResult.claims.role === 'admin';
                
                if (isAdmin) {
                    console.log('用戶已是管理員，顯示管理員標識');
                    if (userStatus) {
                        userStatus.innerHTML = `已登入: ${user.email} <span style="color: #4CAF50; font-weight: bold; margin-left: 5px;">[管理員]</span>`;
                    }
                } else {
                    console.log('用戶不是管理員，顯示申請按鈕');
                    adminButton.style.display = 'inline-block';
                    
                    // 也可以選擇自動檢查，無需按鈕
                    // checkAdminEligibility();
                }
            } catch (error) {
                console.error('檢查管理員狀態失敗:', error);
                adminButton.style.display = 'inline-block'; // 出錯時也顯示按鈕
            }
        } else {
            console.log('用戶未登入，隱藏管理員按鈕');
            adminButton.style.display = 'none';
        }
    });

    // 顯示管理員申請對話框
    adminButton.addEventListener('click', () => {
        console.log('點擊管理員按鈕，顯示申請對話框');
        adminKeyModal.style.display = 'block';
        adminKeyError.style.display = 'none';
    });

    // 關閉對話框
    cancelAdminKey.addEventListener('click', () => {
        adminKeyModal.style.display = 'none';
    });

    // 提交管理員申請
    // 提交管理員申請 - 嘗試多種調用方式
    submitAdminKey.addEventListener('click', async () => {
        try {
            console.log("開始申請管理員權限...");
            
            // 禁用按鈕
            submitAdminKey.disabled = true;
            submitAdminKey.innerHTML = '<div class="loading-spinner"></div> 處理中...';
            
            // 獲取當前用戶
            const user = auth.currentUser;
            if (!user) {
                throw new Error("未登入，請先登入");
            }
            
            const uid = user.uid;
            console.log("當前用戶ID:", uid);
            
            // 方法1: 嘗試正常調用 (指定區域)
            try {
                console.log("嘗試方法1: 標準調用 (指定區域)");
                const functions = firebase.functions(firebase.app(), 'us-central1');
                const checkAdminFunction = functions.httpsCallable('checkAndSetAdmin');
                const result = await checkAdminFunction({uid: uid});
                
                if (result.data.success) {
                    console.log("方法1成功:", result.data);
                    showSuccessAndReload();
                    return;
                }
            } catch (error1) {
                console.warn("方法1失敗:", error1);
            }
            
            // 方法2: 使用REST API調用
            try {
                console.log("嘗試方法2: REST API調用");
                const response = await fetch(
                    'https://us-central1-test1-b1d68.cloudfunctions.net/adminSetupHttp',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({uid: uid})
                    }
                );
                
                const result = await response.json();
                if (result.success) {
                    console.log("方法2成功:", result);
                    showSuccessAndReload();
                    return;
                }
            } catch (error2) {
                console.warn("方法2失敗:", error2);
            }
            
            // 方法3: 直接寫入Firestore (應急方案)
            try {
                console.log("嘗試方法3: 直接寫入Firestore");
                await db.collection('admins').doc(uid).set({
                    role: 'admin',
                    addedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    note: "應急方案設置，請手動更新custom claims"
                });
                
                console.log("方法3成功: 已寫入Firestore");
                showSuccessAndReload();
                return;
            } catch (error3) {
                console.warn("方法3失敗:", error3);
                throw error3; // 所有方法都失敗，拋出最後一個錯誤
            }
        } catch (error) {
            console.error('設置管理員權限失敗:', error);
            showAdminKeyError(`操作失敗: ${error.message}`);
            resetSubmitButton();
        }
    });

    // 顯示成功並重新載入
    function showSuccessAndReload() {
        // 關閉申請對話框
        adminKeyModal.style.display = 'none';
        
        // 顯示成功對話框
        adminSuccessModal.style.display = 'block';
        
        // 倒計時重新載入
        let countdown = 3;
        const countdownElement = document.getElementById('reloadCountdown');
        
        const countdownInterval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(countdownInterval);
                window.location.reload();
            }
        }, 1000);
        
        // 立即重新載入按鈕
        reloadNowButton.addEventListener('click', () => {
            clearInterval(countdownInterval);
            window.location.reload();
        });
    }

    // 顯示錯誤信息
    function showAdminKeyError(message) {
        adminKeyError.textContent = message;
        adminKeyError.style.display = 'block';
    }

    // 重置提交按鈕狀態
    function resetSubmitButton() {
        submitAdminKey.disabled = false;
        submitAdminKey.textContent = '確認申請';
    }
    
    // 自動檢查是否符合管理員資格（可選功能）
    async function checkAdminEligibility() {
        try {
            const user = auth.currentUser;
            if (!user) return;
            
            const checkAdminFunction = firebase.functions().httpsCallable('checkAndSetAdmin');
            await checkAdminFunction();
            
            // 重新獲取token以更新claims
            await user.getIdToken(true);
            
            // 重新加載頁面以更新UI
            window.location.reload();
        } catch (error) {
            console.error('自動檢查管理員資格失敗:', error);
        }
    }
}

// 頁面加載時初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('頁面已加載，檢查Firebase初始化狀態...');
    
    // 確保Firebase完全初始化
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        console.log('Firebase已初始化，開始初始化管理員功能');
        
        // 確保先等待認證狀態穩定
        firebase.auth().onAuthStateChanged(function(user) {
            console.log('認證狀態檢查:', user ? '已登入' : '未登入');
            // 只有在確認認證狀態後才初始化管理員功能
            initAdminManager();
        });
    } else {
        console.error('Firebase 尚未初始化，無法初始化管理員功能');
        
        // 添加一個等待Firebase初始化的機制
        let checkCount = 0;
        const maxChecks = 10; // 最多檢查10次
        
        const checkFirebase = setInterval(() => {
            checkCount++;
            console.log(`嘗試檢查Firebase初始化狀態 (${checkCount}/${maxChecks})...`);
            
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                console.log('Firebase已初始化，開始初始化管理員功能');
                clearInterval(checkFirebase);
                
                // 確保先等待認證狀態穩定
                firebase.auth().onAuthStateChanged(function(user) {
                    console.log('認證狀態檢查:', user ? '已登入' : '未登入');
                    initAdminManager();
                });
            } else if (checkCount >= maxChecks) {
                console.error('Firebase 初始化檢查達到最大次數，放棄等待');
                clearInterval(checkFirebase);
            }
        }, 1000); // 每秒檢查一次
    }
});