// 管理員密鑰配置（實際應用中應該存放在環境變量或後端）
const ADMIN_KEY = "Kxq7PqM2D9FwUtP"; // 請替換為您的實際密鑰
const ALLOWED_IPS = ["192.168.171.83", "192.168.50.206", "192.168.0.11"]; // 允許的IP列表，或使用正則表達式: "192.168.171.*"

// 初始化管理員功能
function initAdminManager() {
    const adminButton = document.getElementById('adminButton');
    const adminKeyModal = document.getElementById('adminKeyModal');
    const cancelAdminKey = document.getElementById('cancelAdminKey');
    const submitAdminKey = document.getElementById('submitAdminKey');
    const adminKeyInput = document.getElementById('adminKeyInput');
    const adminKeyError = document.getElementById('adminKeyError');
    const adminSuccessModal = document.getElementById('adminSuccessModal');
    const reloadNowButton = document.getElementById('reloadNow');

    // 確保所有必要元素都存在
    if (!adminButton || !adminKeyModal || !cancelAdminKey || !submitAdminKey || 
        !adminKeyInput || !adminKeyError || !adminSuccessModal || !reloadNowButton) {
        console.error('管理員功能初始化失敗：缺少必要DOM元素');
        return;
    }

    // 檢查當前用戶是否已是管理員
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                // 檢查用戶是否在管理員集合中
                const adminDoc = await db.collection('admins').doc(user.uid).get();
                
                // 只有非管理員用戶才顯示申請按鈕
                if (!adminDoc.exists) {
                    adminButton.style.display = 'inline-block';
                } else {
                    // 已經是管理員，可以添加一個標識
                    const userStatus = document.getElementById('userStatus');
                    if (userStatus) {
                        userStatus.innerHTML = `已登入: ${user.email} <span style="color: #4CAF50; font-weight: bold; margin-left: 5px;">[管理員]</span>`;
                    }
                }
            } catch (error) {
                console.error('檢查管理員狀態失敗:', error);
            }
        }
    });

    // 顯示管理員密鑰輸入對話框
    adminButton.addEventListener('click', () => {
        adminKeyModal.style.display = 'block';
        adminKeyInput.value = '';
        adminKeyError.style.display = 'none';
    });

    // 關閉對話框
    cancelAdminKey.addEventListener('click', () => {
        adminKeyModal.style.display = 'none';
    });

    // 提交管理員密鑰
    submitAdminKey.addEventListener('click', async () => {
        const key = adminKeyInput.value.trim();
        
        if (!key) {
            showAdminKeyError('請輸入管理員密鑰');
            return;
        }

        if (key !== ADMIN_KEY) {
            showAdminKeyError('管理員密鑰錯誤');
            return;
        }

        // 禁用按鈕，顯示處理中
        submitAdminKey.disabled = true;
        submitAdminKey.innerHTML = '<div class="loading-spinner" style="width: 16px; height: 16px; display: inline-block; margin-right: 8px;"></div> 處理中...';

        try {
            // 獲取客戶端IP（實際應用中應通過後端API獲取）
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            const clientIP = ipData.ip;

            // 檢查IP是否在允許列表中
            const isAllowedIP = checkAllowedIP(clientIP);

            if (!isAllowedIP) {
                showAdminKeyError(`您的IP (${clientIP}) 不在允許的列表中`);
                resetSubmitButton();
                return;
            }

            // 獲取當前用戶
            const user = auth.currentUser;
            if (!user) {
                showAdminKeyError('未登入，請先登入');
                resetSubmitButton();
                return;
            }

            // 將用戶添加到管理員集合
            await db.collection('admins').doc(user.uid).set({
                email: user.email,
                addedAt: firebase.firestore.FieldValue.serverTimestamp(),
                addedBy: 'self',
                addedFromIP: clientIP
            });

            // 設置用戶Storage權限（如果需要）
            try {
                const adminStorageRef = storage.ref(`admin_permissions/${user.uid}`);
                const adminPermissionFile = new Blob([JSON.stringify({
                    isAdmin: true,
                    addedAt: new Date().toISOString()
                })], { type: 'application/json' });
                
                await adminStorageRef.put(adminPermissionFile);
                console.log('已創建管理員Storage權限記錄');
            } catch (storageError) {
                console.error('創建Storage權限記錄失敗:', storageError);
                // 如果設置Storage權限失敗，仍然繼續（不阻止流程）
            }

            // 關閉密鑰對話框
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
            
        } catch (error) {
            console.error('設置管理員權限失敗:', error);
            showAdminKeyError(`操作失敗: ${error.message}`);
            resetSubmitButton();
        }
    });

    // 顯示錯誤信息
    function showAdminKeyError(message) {
        adminKeyError.textContent = message;
        adminKeyError.style.display = 'block';
    }

    // 重置提交按鈕狀態
    function resetSubmitButton() {
        submitAdminKey.disabled = false;
        submitAdminKey.textContent = '確認';
    }

    // 檢查IP是否在允許列表中
    function checkAllowedIP(ip) {
        // 標準IP檢查
        if (ALLOWED_IPS.includes(ip)) {
            return true;
        }
        
        // 正則表達式IP檢查
        for (const pattern of ALLOWED_IPS) {
            if (pattern.includes('*')) {
                const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
                const regex = new RegExp(`^${regexPattern}$`);
                if (regex.test(ip)) {
                    return true;
                }
            }
        }
        
        return false;
    }
}

// 頁面加載時初始化
document.addEventListener('DOMContentLoaded', function() {
    // 確保基本Firebase服務已初始化後再初始化管理員功能
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        initAdminManager();
    } else {
        console.error('Firebase 尚未初始化，無法初始化管理員功能');
    }
});