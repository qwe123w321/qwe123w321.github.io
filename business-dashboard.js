// 全域變數
let currentUser = null;
let businessData = null;

// 頁面載入初始化
document.addEventListener('DOMContentLoaded', function() {
    // 側邊欄切換
    initSidebar();
    
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
    
    // 表單驗證
    initFormValidation();
    
    // 登出按鈕初始化
    initLogoutButtons();
    
    // 如果當前頁面有地圖容器，載入 Google Maps
    if (document.getElementById('mapContainer')) {
        loadGoogleMapsAPI();
    }
    
    // 監聽 Firebase 初始化完成事件
    document.addEventListener('firebase-ready', function() {
        console.log('Firebase 初始化完成，開始監聽認證狀態');
        
        // 監聽用戶認證狀態
        onAuthStateChanged(auth, function(user) {
            if (user) {
                console.log('已檢測到登入用戶:', user.email);
                currentUser = user;
                // 清除重定向標記，允許下次檢查
                localStorage.removeItem('redirected_to_dashboard');
                // 加載店家資料
                loadBusinessData();
            } else {
                console.log('未檢測到登入用戶，將重定向到登入頁面');
                
                // 確保當前頁面是儀表板頁面
                if (window.location.pathname.includes('business-dashboard')) {
                    console.log('未登入但在儀表板頁面，重定向到登入頁面');
                    window.location.href = 'business-login.html?redirect=true';
                }
            }
        });
    });
});

// 登出按鈕初始化
function initLogoutButtons() {
    const logoutButtons = document.querySelectorAll('#logoutLink, a[href="#"][id="logoutLink"]');
    logoutButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                performLogout();
            });
            console.log('已綁定登出按鈕:', btn);
        }
    });
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

async function loadBusinessData() {
    try {
        showAlert("載入店家資料中...", "info");
        
        // 確保用戶已登入
        if (!currentUser || !currentUser.uid) {
            console.error("未找到用戶資料");
            showAlert("請重新登入", "danger");
            return;
        }
        
        // 從 businesses 集合加載數據
        const businessDoc = await db.collection("businesses").doc(currentUser.uid).get();
        
        if (businessDoc.exists) {
            businessData = businessDoc.data();
            
            // 更新導航欄用戶資訊
            document.getElementById("businessName").textContent = businessData.businessName || "未命名店家";
            if (businessData.profileImageUrl) {
                document.getElementById("businessImage").src = businessData.profileImageUrl;
            } else if (businessData.licenseUrls && businessData.licenseUrls.length > 0) {
                document.getElementById("businessImage").src = businessData.licenseUrls[0];
            }
            
            // 更新基本資料欄位
            document.getElementById("storeName").value = businessData.businessName || "";
            document.getElementById("storePhone").value = businessData.phoneNumber || "";
            document.getElementById("storeEmail").value = businessData.email || "";
            document.getElementById("storeWebsite").value = businessData.website || "";
            document.getElementById("storeDescription").value = businessData.description || "";
            
            // 更新店家類型
            const businessTypeSelect = document.getElementById("businessType");
            if (businessTypeSelect && businessData.businessType) {
                for (let i = 0; i < businessTypeSelect.options.length; i++) {
                    if (businessTypeSelect.options[i].value === businessData.businessType) {
                        businessTypeSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            
            // 更新店家主圖
            if (businessData.profileImageUrl) {
                const mainImagePreview = document.querySelector(".image-preview");
                if (mainImagePreview) {
                    mainImagePreview.innerHTML = `
                    <img src="${businessData.profileImageUrl}" alt="店家頭像/Logo">
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
            } else if (businessData.licenseUrls && businessData.licenseUrls.length > 0) {
                // 如果沒有專門的頭像，使用第一張營業執照照片
                const mainImagePreview = document.querySelector(".image-preview");
                if (mainImagePreview) {
                    mainImagePreview.innerHTML = `
                    <img src="${businessData.licenseUrls[0]}" alt="店家頭像/Logo">
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
            }
            
            // 更新營業時間
            if (businessData.openingHours && businessData.openingHours.length > 0) {
                updateOpeningHours(businessData.openingHours);
            } else {
                // 設置預設營業時間
                initDefaultOpeningHours();
            }
            
            // 更新活動類型
            if (businessData.activityTypes && businessData.activityTypes.length > 0) {
                updateActivityTypes(businessData.activityTypes);
            }
            
            // 更新標籤
            if (businessData.tags && businessData.tags.length > 0) {
                updateTags(businessData.tags);
            }
            
            // 更新環境照片
            if (businessData.galleryImages && businessData.galleryImages.length > 0) {
                updateGallery(businessData.galleryImages);
            } else if (businessData.licenseUrls && businessData.licenseUrls.length > 0) {
                // 使用營業執照照片作為環境照片
                updateGallery(businessData.licenseUrls);
            }
            
            // 更新地理位置
            if (businessData.position) {
                updateLocationFields(businessData.position);
            } else if (businessData.address) {
                // 如果只有地址，在地址框中顯示
                document.getElementById('formattedAddress').value = businessData.address;
            }
            
            console.log("店家資料載入完成");
            showAlert("店家資料已載入完成", "success");
        } else {
            // 店家資料不存在，可能是新用戶
            console.log("店家資料不存在，請建立資料");
            showAlert("歡迎使用店家管理平台！請完善您的店家資料。", "info");
            
            // 設置預設營業時間
            initDefaultOpeningHours();
            
            // 創建新的店家文檔
            await initializeNewBusiness();
        }
    } catch (error) {
        console.error("載入店家資料錯誤:", error);
        showAlert("載入資料時發生錯誤，請稍後再試", "danger");
    }
}

// 為新用戶初始化店家資料
async function initializeNewBusiness() {
    try {
        if (!currentUser || !currentUser.uid) return;
        
        // 檢查是否已存在店家文檔
        const businessDoc = await db.collection("businesses").doc(currentUser.uid).get();
        if (businessDoc.exists) return;
        
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
    } catch (error) {
        console.error("初始化新店家資料時出錯:", error);
    }
}



// 更新營業時間
function updateOpeningHours(hours) {
    const hourSelectionDivs = document.querySelectorAll(".hours-selection");
    if (!hourSelectionDivs.length) return;
    
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
    const hourSelectionDivs = document.querySelectorAll(".hours-selection");
    if (!hourSelectionDivs.length) return;
    
    const defaultOpenTimes = ["09:00", "09:00", "09:00", "09:00", "09:00", "10:00", "10:00"];
    const defaultCloseTimes = ["19:00", "19:00", "19:00", "19:00", "19:00", "20:00", "20:00"];
    
    hourSelectionDivs.forEach((div, index) => {
        const selects = div.querySelectorAll("select");
        if (selects.length === 2) {
            setSelectValue(selects[0], defaultOpenTimes[index]);
            setSelectValue(selects[1], defaultCloseTimes[index]);
        }
    });
}

// 更新環境照片畫廊
function updateGallery(images) {
    // 找到環境照片畫廊容器
    const galleryPreview = document.querySelector(".gallery-preview");
    if (!galleryPreview) return;
    
    // 保留添加按鈕
    const addBtn = galleryPreview.querySelector(".add-gallery-item");
    if (!addBtn) return;
    
    // 清空現有內容（除了添加按鈕）
    galleryPreview.innerHTML = "";
    
    // 添加所有照片
    images.forEach(imageUrl => {
        const galleryItem = document.createElement("div");
        galleryItem.className = "gallery-item";
        galleryItem.innerHTML = `
            <img src="${imageUrl}" alt="店內環境">
            <div class="remove-image">
                <i class="fas fa-times"></i>
            </div>
        `;
        
        galleryPreview.appendChild(galleryItem);
        
        // 添加刪除事件
        const removeBtn = galleryItem.querySelector('.remove-image');
        removeBtn.addEventListener('click', function() {
            if (confirm('確定要刪除此照片？')) {
                removeGalleryImage(imageUrl);
                galleryItem.remove();
            }
        });
    });
    
    // 重新添加上傳按鈕
    galleryPreview.appendChild(addBtn);
}

// 刪除環境照片
async function removeGalleryImage(imageUrl) {
    try {
        if (!businessData || !businessData.galleryImages) return;
        
        // 從存儲中刪除文件
        const storageRef = firebase.storage().refFromURL(imageUrl);
        await storageRef.delete();
        
        // 從店家數據中移除 URL
        const updatedImages = businessData.galleryImages.filter(url => url !== imageUrl);
        
        // 更新Firestore
        await db.collection("venues").doc(currentUser.uid).update({
            galleryImages: updatedImages,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        businessData.galleryImages = updatedImages;
        
        showAlert("照片已成功刪除", "success");
    } catch (error) {
        console.error("刪除照片錯誤:", error);
        showAlert("刪除照片失敗，請稍後再試", "danger");
    }
}

// 刪除主圖/頭像
async function removeMainImage() {
    try {
        if (!businessData || !businessData.imageUrl) return;
        
        // 從存儲中刪除文件
        const imageRef = storage.refFromURL(businessData.imageUrl);
        await imageRef.delete();
        
        // 從資料庫中刪除引用
        await db.collection("venues").doc(currentUser.uid).update({
            imageUrl: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        delete businessData.imageUrl;
        
        // 更新UI
        const mainImagePreview = document.querySelector(".image-preview");
        mainImagePreview.innerHTML = `
            <div class="upload-placeholder">
                <i class="fas fa-image"></i>
                <p>上傳店家頭像/Logo</p>
            </div>
        `;
        
        // 更新導航頭像
        document.getElementById("businessImage").src = "https://via.placeholder.com/40";
        
        showAlert("店家頭像已成功刪除", "success");
    } catch (error) {
        console.error("刪除主圖時發生錯誤:", error);
        showAlert("刪除頭像失敗，請稍後再試", "danger");
    }
}

// 提交店家基本資料表單
// 提交店家基本資料表單
async function submitVenueForm() {
    try {
        // 顯示載入提示
        const saveBtn = document.querySelector("#profile-section .card-header .btn-primary");
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 儲存中...';
        saveBtn.disabled = true;
        
        const nameInput = document.getElementById("storeName");
        const phoneInput = document.getElementById("storePhone");
        const emailInput = document.getElementById("storeEmail");
        const websiteInput = document.getElementById("storeWebsite");
        const descriptionInput = document.getElementById("storeDescription");
        
        // 驗證必填字段
        if (!nameInput.value) {
            showAlert("請填寫店家名稱", "warning");
            saveBtn.innerHTML = originalBtnText;
            saveBtn.disabled = false;
            return;
        }
        
        // 準備更新的數據
        const businessDataToUpdate = {
            name: nameInput.value,
            phoneNumber: phoneInput.value,
            email: emailInput.value,
            website: websiteInput.value,
            description: descriptionInput.value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 檢查是否有店家文檔
        let venueDocRef = db.collection("venues").doc(currentUser.uid);
        let venueDoc = await venueDocRef.get();
        
        // 如果文檔不存在，添加創建時間
        if (!venueDoc.exists) {
            businessDataToUpdate.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        // 更新 Firestore 文檔
        await venueDocRef.set(businessDataToUpdate, { merge: true });
        
        // 更新本地數據
        if (!businessData) businessData = {};
        Object.assign(businessData, businessDataToUpdate);
        
        // 更新UI
        document.getElementById("businessName").textContent = businessData.name;
        
        // 恢復按鈕狀態
        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;
        
        showAlert("店家資料已成功更新", "success");
    } catch (error) {
        console.error("更新店家資料錯誤:", error);
        showAlert("更新店家資料失敗，請稍後再試", "danger");
        
        // 恢復按鈕狀態
        const saveBtn = document.querySelector("#profile-section .card-header .btn-primary");
        saveBtn.innerHTML = '儲存變更';
        saveBtn.disabled = false;
    }
}

// 處理上傳環境照片
async function handleEnvironmentImageUpload(files) {
    if (!files || files.length === 0) return;
    
    try {
        showAlert("正在上傳環境照片，請稍候...", "info");
        
        // 獲取圖庫容器和添加按鈕
        const gallery = document.querySelector('.gallery-preview');
        const addBtn = gallery.querySelector('.add-gallery-item');
        
        // 獲取既有的環境照片URLs
        let galleryImages = [];
        if (businessData && businessData.galleryImages) {
            galleryImages = [...businessData.galleryImages];
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
            
            // 壓縮圖片
            const compressedFile = await compressImage(file, 800, 600);
            
            // 上傳到 Storage
            const storageRef = storage.ref(`venues/${currentUser.uid}/gallery/${Date.now()}_${file.name}`);
            await storageRef.put(compressedFile);
            const imageUrl = await storageRef.getDownloadURL();
            
            // 添加到圖片URLs陣列
            galleryImages.push(imageUrl);
            
            // 創建新的圖庫項目
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';
            galleryItem.innerHTML = `
                <img src="${imageUrl}" alt="店內環境照片">
                <div class="remove-image">
                    <i class="fas fa-times"></i>
                </div>
            `;
            
            // 插入到添加按鈕之前
            gallery.insertBefore(galleryItem, addBtn);
            
            // 添加刪除事件
            const removeBtn = galleryItem.querySelector('.remove-image');
            removeBtn.addEventListener('click', function() {
                if (confirm('確定要刪除此照片？')) {
                    removeGalleryImage(imageUrl);
                    galleryItem.remove();
                }
            });
        }
        
        // 更新 Firestore
        await db.collection("venues").doc(currentUser.uid).update({
            galleryImages: galleryImages,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        if (!businessData) businessData = {};
        businessData.galleryImages = galleryImages;
        
        showAlert("環境照片已成功上傳", "success");
    } catch (error) {
        console.error("上傳環境照片錯誤:", error);
        showAlert("上傳環境照片失敗，請稍後再試", "danger");
    } finally {
        // 清空文件輸入
        document.getElementById('addEnvironmentImage').value = '';
    }
}

// 營業時間初始化
function initBusinessHours() {
    // 營業時間保存按鈕
    const saveBusinessHoursBtn = document.querySelector("#profile-section .card-header .btn-primary");
    if (saveBusinessHoursBtn) {
        saveBusinessHoursBtn.addEventListener('click', function() {
            saveBusinessHours();
        });
    }
}

// 保存營業時間
async function saveBusinessHours() {
    try {
        // 獲取按鈕並顯示載入狀態
        const saveBtn = document.querySelector("#profile-section .card-header .btn-primary");
        const originalText = saveBtn.textContent;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 儲存中...';
        saveBtn.disabled = true;
        
        // 收集營業時間
        const openingHours = [];
        const hourSelectionDivs = document.querySelectorAll(".hours-selection");
        hourSelectionDivs.forEach((div, index) => {
            const selects = div.querySelectorAll("select");
            if (selects.length === 2) {
                openingHours[index] = {
                    day: index,
                    open: selects[0].value,
                    close: selects[1].value
                };
            }
        });
        
        // 更新 Firestore
        await db.collection("venues").doc(currentUser.uid).update({
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
        const saveBtn = document.querySelector("#profile-section .card-header .btn-primary");
        if (saveBtn) {
            saveBtn.textContent = '儲存營業時間';
            saveBtn.disabled = false;
        }
    }
}

// 表單驗證初始化
function initFormValidation() {
    // 基本資料表單提交
    const saveProfileBtn = document.querySelector("#profile-section .btn-primary");
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', function() {
            submitVenueForm();
        });
    }
    
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
        const geohash = document.getElementById('geohash').value || generateGeohash(lat, lng);
        
        if (isNaN(lat) || isNaN(lng) || !formattedAddress) {
            showAlert('位置資訊不完整，請確保已設定位置', 'warning');
            return;
        }
        
        // 按鈕載入狀態
        const saveBtn = document.getElementById('saveLocationBtn');
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 儲存中...';
        saveBtn.disabled = true;
        
        // 創建符合要求的位置數據結構
        const positionData = {
            geohash: geohash,
            geopoint: new firebase.firestore.GeoPoint(lat, lng)
        };
        
        // 更新Firestore
        await db.collection("businesses").doc(currentUser.uid).update({
            position: positionData,
            address: formattedAddress,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        if (!businessData) businessData = {};
        businessData.position = positionData;
        businessData.address = formattedAddress;
        
        // 恢復按鈕狀態
        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;
        
        showAlert('店家位置已成功更新', 'success');
    } catch (error) {
        console.error('儲存位置時發生錯誤:', error);
        
        // 恢復按鈕狀態
        const saveBtn = document.getElementById('saveLocationBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-map-marker-alt me-2"></i>儲存位置';
            saveBtn.disabled = false;
        }
        
        showAlert('儲存位置失敗，請稍後再試', 'danger');
    }
}

// 修改的商店基本資料儲存
async function saveBusinessInfo() {
    try {
        // 顯示載入提示
        const saveBtn = document.querySelector("#profile-section .card-header .btn-primary");
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> 儲存中...';
        saveBtn.disabled = true;
        
        const nameInput = document.getElementById("storeName");
        const phoneInput = document.getElementById("storePhone");
        const emailInput = document.getElementById("storeEmail");
        const websiteInput = document.getElementById("storeWebsite");
        const descriptionInput = document.getElementById("storeDescription");
        const businessTypeSelect = document.getElementById("businessType");
        
        // 驗證必填字段
        if (!nameInput.value) {
            showAlert("請填寫店家名稱", "warning");
            saveBtn.innerHTML = originalBtnText;
            saveBtn.disabled = false;
            return;
        }
        
        // 準備更新的數據
        const dataToUpdate = {
            businessName: nameInput.value,
            phoneNumber: phoneInput.value,
            email: emailInput.value,
            website: websiteInput.value,
            description: descriptionInput.value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 如果選擇了業務類型，也更新它
        if (businessTypeSelect) {
            dataToUpdate.businessType = businessTypeSelect.value;
        }
        
        // 檢查是否有店家文檔
        let businessDocRef = db.collection("businesses").doc(currentUser.uid);
        let businessDoc = await businessDocRef.get();
        
        // 如果文檔不存在，添加創建時間
        if (!businessDoc.exists) {
            dataToUpdate.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        // 更新 Firestore 文檔
        await businessDocRef.set(dataToUpdate, { merge: true });
        
        // 更新本地數據
        if (!businessData) businessData = {};
        Object.assign(businessData, dataToUpdate);
        
        // 更新UI
        document.getElementById("businessName").textContent = businessData.businessName;
        
        // 恢復按鈕狀態
        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;
        
        showAlert("店家資料已成功更新", "success");
    } catch (error) {
        console.error("更新店家資料錯誤:", error);
        showAlert("更新店家資料失敗，請稍後再試", "danger");
        
        // 恢復按鈕狀態
        const saveBtn = document.querySelector("#profile-section .card-header .btn-primary");
        saveBtn.innerHTML = '儲存變更';
        saveBtn.disabled = false;
    }
}

// 加載Google Maps API
function loadGoogleMapsAPI() {
    if (document.getElementById('google-maps-script')) {
        return; // 避免重複載入
    }
    
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyByRzxE7olx04Q_-ckYIKNyI9uJnZ_p_-Y&libraries=places&callback=initMap`;
    script.defer = true;
    script.async = true;
    script.onerror = function() {
        showAlert('無法載入 Google Maps API，請檢查您的網絡連接', 'warning');
    };
    document.head.appendChild(script);
}

// 頁面初始化時加載Google Maps
document.addEventListener('DOMContentLoaded', function() {
    // 如果當前頁面有地圖容器，載入 Google Maps
    if (document.getElementById('mapContainer')) {
        loadGoogleMapsAPI();
    }
});

// 監聽 Firebase 初始化完成事件
document.addEventListener('firebase-ready', function() {
    // 當Firebase初始化完成後，再次檢查地圖加載
    setTimeout(() => {
        if (document.getElementById('mapContainer') && !window.google) {
            loadGoogleMapsAPI();
        }
    }, 1000);
});

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
                
                // 將畫布轉換為Blob
                canvas.toBlob(blob => {
                    // 創建一個新文件，保持原始檔名
                    const compressedFile = new File([blob], file.name, {
                        type: file.type,
                        lastModified: Date.now()
                    });
                    
                    resolve(compressedFile);
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

// 顯示提示訊息
function showAlert(message, type = "success", duration = 3000) {
    // 檢查是否已有提示，避免重複
    const existingAlerts = document.querySelectorAll('.alert-floating');
    existingAlerts.forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show alert-floating`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '15px';
    alertDiv.style.left = '50%';
    alertDiv.style.transform = 'translateX(-50%)';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
    alertDiv.style.minWidth = '300px';
    alertDiv.role = 'alert';
    
    alertDiv.innerHTML = `
        <strong>${type === 'success' ? '✓' : type === 'danger' ? '✗' : 'ℹ'}</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // 自動關閉
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 300);
    }, duration);
    
    return alertDiv;
}

// 全頁面加載中顯示
function showPageLoading(message = '處理中，請稍候...') {
    const overlay = document.getElementById('loadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    
    if (overlay && messageEl) {
        messageEl.textContent = message;
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

// 加載商品項目
async function loadMenuItems() {
    try {
        console.log("開始加載商品項目列表");
        
        // 查詢商品類別
        const categoriesSnapshot = await db.collection("categories")
            .where("venueId", "==", currentUser.uid)
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
            .where("venueId", "==", currentUser.uid)
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
    if (!categoryList) return;
    
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
    
    // 為每個類別創建區塊
    for (const category in menuItemsByCategory) {
        const items = menuItemsByCategory[category];
        
        const categoryElement = document.createElement("div");
        categoryElement.className = "product-item mb-4";
        categoryElement.innerHTML = `
            <div class="product-category d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">${category}</h5>
                <div class="actions">
                    <button class="btn btn-sm btn-outline-primary add-product-btn" data-category="${category}">
                        <i class="fas fa-plus"></i> 新增項目
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-category-btn" data-category="${category}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
        
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
                        <span class="text-primary fw-bold">${item.price ? `${item.price}` : ''}</span>
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
}

// 添加商品項目相關事件
function addMenuItemsEvents() {
    // 為所有「新增項目」按鈕添加事件監聽
    document.querySelectorAll(".add-product-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            const category = this.getAttribute("data-category");
            const formId = `${category.replace(/\s+/g, '-').toLowerCase()}-item-form`;
            document.getElementById(formId).style.display = "block";
        });
    });
    
    // 為所有「取消」按鈕添加事件監聽
    document.querySelectorAll(".cancel-add-item").forEach(btn => {
        btn.addEventListener("click", function() {
            const formId = this.getAttribute("data-form");
            document.getElementById(formId).style.display = "none";
        });
    });
    
    // 為所有「儲存項目」按鈕添加事件監聽
    document.querySelectorAll(".save-item-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            const category = this.getAttribute("data-category");
            saveMenuItem(category);
        });
    });
    
    // 為所有「編輯項目」按鈕添加事件監聽
    document.querySelectorAll(".edit-item-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            const itemId = this.getAttribute("data-id");
            editMenuItem(itemId);
        });
    });
    
    // 為所有「刪除項目」按鈕添加事件監聽
    document.querySelectorAll(".delete-item-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            const itemId = this.getAttribute("data-id");
            deleteMenuItem(itemId);
        });
    });
    
    // 為所有「刪除類別」按鈕添加事件監聽
    document.querySelectorAll(".delete-category-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            const category = this.getAttribute("data-category");
            if (confirm(`確定要刪除「${category}」類別及其所有項目嗎？`)) {
                deleteCategory(category);
            }
        });
    });
}

// 儲存商品項目
async function saveMenuItem(category) {
    try {
        const formId = `${category.replace(/\s+/g, '-').toLowerCase()}-item-form`;
        const nameInput = document.getElementById(`${formId}-name`);
        const priceInput = document.getElementById(`${formId}-price`);
        const descInput = document.getElementById(`${formId}-desc`);
        
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
            venueId: currentUser.uid,
            category: category,
            name: nameInput.value,
            price: price,
            description: descInput.value,
            displayInApp: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 添加到Firestore
        await db.collection("menuItems").add(itemData);
        
        // 重新加載商品列表
        await loadMenuItems();
        
        // 重置表單
        nameInput.value = "";
        priceInput.value = "";
        descInput.value = "";
        
        // 隱藏表單
        document.getElementById(formId).style.display = "none";
        
        showAlert("商品項目已成功添加", "success");
    } catch (error) {
        console.error("保存商品項目時出錯:", error);
        showAlert("保存商品項目失敗，請稍後再試", "danger");
    }
}

// 編輯商品項目
async function editMenuItem(itemId) {
    try {
        // 獲取項目數據
        const doc = await db.collection("menuItems").doc(itemId).get();
        if (!doc.exists) {
            showAlert("找不到此商品項目", "warning");
            return;
        }
        
        const item = doc.data();
        
        // 建立編輯表單
        const categoryElement = document.querySelector(`.product-subitem[data-id="${itemId}"]`).closest('.product-item');
        
        // 如果已有編輯表單，先移除
        const existingForm = categoryElement.querySelector('.edit-form');
        if (existingForm) {
            existingForm.remove();
        }
        
        // 創建編輯表單
        const editForm = document.createElement('div');
        editForm.className = 'menu-item-form mt-3 edit-form';
        editForm.innerHTML = `
            <h6>編輯 ${item.name}</h6>
            <div class="row">
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">商品名稱</label>
                        <input type="text" class="form-control" id="edit-name-${itemId}" value="${item.name}">
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="mb-3">
                        <label class="form-label">價格</label>
                        <input type="number" class="form-control" id="edit-price-${itemId}" value="${item.price}">
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

// 更新商品項目
async function updateMenuItem(itemId) {
    try {
        const nameInput = document.getElementById(`edit-name-${itemId}`);
        const priceInput = document.getElementById(`edit-price-${itemId}`);
        const descInput = document.getElementById(`edit-desc-${itemId}`);
        
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
            description: descInput.value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 更新Firestore
        await db.collection("menuItems").doc(itemId).update(itemData);
        
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
    const editForm = btn.closest('.edit-form');
    if (editForm) {
        editForm.remove();
    }
}

// 刪除商品項目
async function deleteMenuItem(itemId) {
    if (!confirm("確定要刪除此商品項目嗎？")) return;
    
    try {
        showAlert("刪除中...", "info");
        
        // 從Firestore刪除
        await db.collection("menuItems").doc(itemId).delete();
        
        // 重新加載商品列表
        await loadMenuItems();
        
        showAlert("商品項目已成功刪除", "success");
    } catch (error) {
        console.error("刪除商品項目失敗:", error);
        showAlert("刪除商品項目失敗，請稍後再試", "danger");
    }
}

// 刪除類別
async function deleteCategory(categoryName) {
    try {
        showAlert("刪除類別中...", "info");
        
        // 查詢屬於此類別的所有商品項目
        const itemsSnapshot = await db.collection("menuItems")
            .where("venueId", "==", currentUser.uid)
            .where("category", "==", categoryName)
            .get();
        
        // 創建批處理刪除所有商品項目
        const batch = db.batch();
        itemsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // 查詢類別文檔
        const categoriesSnapshot = await db.collection("categories")
            .where("venueId", "==", currentUser.uid)
            .where("name", "==", categoryName)
            .get();
        
        // 添加類別到批處理
        categoriesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // 提交批處理
        await batch.commit();
        
        // 重新加載商品列表
        await loadMenuItems();
        
        showAlert(`「${categoryName}」類別已成功刪除`, "success");
    } catch (error) {
        console.error("刪除類別失敗:", error);
        showAlert("刪除類別失敗，請稍後再試", "danger");
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
        defaultMenuItem.click();
    }
}

// 商品類別管理初始化
function initCategoryManagement() {
    // 類別管理
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const addCategoryForm = document.getElementById('addCategoryForm');
    const cancelAddCategory = document.getElementById('cancelAddCategory');
    
    if (addCategoryBtn && addCategoryForm && cancelAddCategory) {
        addCategoryBtn.addEventListener('click', function() {
            addCategoryForm.style.display = 'block';
        });
        
        cancelAddCategory.addEventListener('click', function() {
            addCategoryForm.style.display = 'none';
        });
        
        // 儲存類別按鈕
        const saveCategoryBtn = addCategoryForm.querySelector('.btn-primary');
        if (saveCategoryBtn) {
            saveCategoryBtn.addEventListener('click', function() {
                saveCategory();
            });
        }
    }
    
    // 綁定商品項目新增和表單顯示隱藏功能
    document.addEventListener('click', function(e) {
        // 處理「新增項目」按鈕點擊
        if (e.target.classList.contains('add-product-btn') || e.target.closest('.add-product-btn')) {
            const btn = e.target.classList.contains('add-product-btn') ? e.target : e.target.closest('.add-product-btn');
            const category = btn.getAttribute('data-category');
            const formId = `${category.replace(/\s+/g, '-').toLowerCase()}-item-form`;
            const form = document.getElementById(formId);
            
            if (form) {
                form.style.display = 'block';
            } else {
                // 如果沒有對應的表單，使用通用的咖啡項目表單
                const coffeeForm = document.getElementById('coffeeItemForm');
                if (coffeeForm) {
                    coffeeForm.style.display = 'block';
                }
            }
        }
        
        // 處理「取消」按鈕點擊
        if (e.target.classList.contains('cancel-add-item') || e.target.closest('.cancel-add-item')) {
            const btn = e.target.classList.contains('cancel-add-item') ? e.target : e.target.closest('.cancel-add-item');
            const formId = btn.getAttribute('data-form');
            
            if (formId) {
                document.getElementById(formId).style.display = 'none';
            } else {
                // 隱藏所有商品表單
                document.querySelectorAll('.menu-item-form').forEach(form => {
                    if (form.id !== 'addCategoryForm') {
                        form.style.display = 'none';
                    }
                });
            }
        }
        
        // 處理「儲存項目」按鈕點擊
        if (e.target.classList.contains('save-item-btn') || e.target.closest('.save-item-btn')) {
            const btn = e.target.classList.contains('save-item-btn') ? e.target : e.target.closest('.save-item-btn');
            const category = btn.getAttribute('data-category');
            saveMenuItem(category);
        }
    });
}

// 添加類別
async function saveCategory() {
    try {
        const categoryName = document.getElementById('categoryName').value;
        const categoryDesc = document.getElementById('categoryDesc').value;
        
        if (!categoryName) {
            showAlert("請填寫類別名稱", "warning");
            return;
        }
        
        // 顯示載入狀態
        const saveBtn = document.querySelector('#addCategoryForm .btn-primary');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 儲存中...';
            saveBtn.disabled = true;
            
            // 恢復按鈕狀態的函數
            const restoreButton = () => {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            };
            
            try {
                // 檢查是否已存在相同類別
                const categoriesSnapshot = await db.collection("categories")
                    .where("venueId", "==", currentUser.uid)
                    .where("name", "==", categoryName)
                    .get();
                
                if (!categoriesSnapshot.empty) {
                    showAlert("已存在相同名稱的類別", "warning");
                    restoreButton();
                    return;
                }
                
                // 添加到 Firestore
                await db.collection("categories").add({
                    venueId: currentUser.uid,
                    name: categoryName,
                    description: categoryDesc,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // 重新加載商品列表
                await loadMenuItems();
                
                // 隱藏表單並重置
                document.getElementById('addCategoryForm').style.display = 'none';
                document.getElementById('categoryName').value = '';
                document.getElementById('categoryDesc').value = '';
                
                showAlert("商品類別已成功添加", "success");
            } catch (error) {
                console.error("添加類別時發生錯誤:", error);
                showAlert("添加類別失敗，請稍後再試", "danger");
            } finally {
                restoreButton();
            }
        } else {
            // 如果找不到按鈕，直接執行
            await db.collection("categories").add({
                venueId: currentUser.uid,
                name: categoryName,
                description: categoryDesc,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // 重新加載商品列表
            await loadMenuItems();
            
            // 隱藏表單並重置
            document.getElementById('addCategoryForm').style.display = 'none';
            document.getElementById('categoryName').value = '';
            document.getElementById('categoryDesc').value = '';
            
            showAlert("商品類別已成功添加", "success");
        }
    } catch (error) {
        console.error("添加類別時發生錯誤:", error);
        showAlert("添加類別失敗，請稍後再試", "danger");
    }
}

// 標籤輸入系統初始化
function initTagsSystem() {
    const tagContainer = document.getElementById('tagContainer');
    const tagInput = tagContainer?.querySelector('.tag-input');
    
    if (tagContainer && tagInput) {
        // 添加新標籤
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
            if (btn.parentElement.classList.contains('me-2') || btn.classList.contains('me-2')) {
                btn.addEventListener('click', function() {
                    const tagText = this.textContent.trim();
                    addTag(tagText);
                });
            }
        });
        
        // 儲存標籤按鈕
        const saveTagsBtn = document.querySelector("#activities-section .card-header .btn-primary");
        if (saveTagsBtn) {
            saveTagsBtn.addEventListener('click', function() {
                updateVenueTags();
            });
        }
    }
}

// 更新店家標籤
async function updateVenueTags() {
    try {
        // 獲取按鈕並顯示載入狀態
        const saveBtn = document.querySelector("#activities-section .card-header .btn-primary");
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
        await db.collection("venues").doc(currentUser.uid).update({
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
        const saveBtn = document.querySelector("#activities-section .card-header .btn-primary");
        if (saveBtn) {
            saveBtn.textContent = '儲存標籤';
            saveBtn.disabled = false;
        }
    }
}

// 添加標籤
function addTag(tagText) {
    const tagContainer = document.getElementById("tagContainer");
    if (!tagContainer) return;
    
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
    tagContainer.insertBefore(tag, tagInput);
    
    // 添加刪除事件
    const closeBtn = tag.querySelector(".tag-close");
    closeBtn.addEventListener("click", function() {
        tag.remove();
    });
}

// 更新標籤
function updateTags(tags) {
    const tagContainer = document.getElementById("tagContainer");
    if (!tagContainer) return;
    
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
}

// 創建標籤輸入框
function createTagInput() {
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
}

// 活動類型卡片選擇
function initActivityTypeCards() {
    const activityCards = document.querySelectorAll('.activity-type-card');
    
    activityCards.forEach(card => {
        card.addEventListener('click', function() {
            this.classList.toggle('selected');
            
            // 更新選中數量
            const selectedCount = document.querySelectorAll('.activity-type-card.selected').length;
            const badge = document.querySelector('.badge.bg-primary');
            if (badge) {
                badge.textContent = `已選擇 ${selectedCount} 項`;
            }
        });
    });
}

// 更新活動類型
function updateActivityTypes(activityTypes) {
    const activityCards = document.querySelectorAll(".activity-type-card");
    
    // 重置所有卡片
    activityCards.forEach(card => {
        card.classList.remove("selected");
    });
    
    // 選中對應活動類型
    activityTypes.forEach(type => {
        activityCards.forEach(card => {
            if (card.querySelector("p").textContent === type) {
                card.classList.add("selected");
            }
        });
    });
    
    // 更新選擇數量
    const selectedCount = document.querySelectorAll(".activity-type-card.selected").length;
    const badge = document.querySelector(".badge.bg-primary");
    if (badge) {
        badge.textContent = `已選擇 ${selectedCount} 項`;
    }
}

// 儲存活動類型
async function saveActivityTypes() {
    try {
        // 獲取按鈕並顯示載入狀態
        const saveBtn = document.querySelector("#activities-section .card-header .btn-primary");
        if (!saveBtn) return;
        
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
        await db.collection("businesses").doc(currentUser.uid).update({
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
        const saveBtn = document.querySelector("#activities-section .card-header .btn-primary");
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
    if (addEnvironmentImage) {
        // 點擊添加按鈕時觸發文件選擇
        const addGalleryItem = document.querySelector('.add-gallery-item');
        if (addGalleryItem) {
            addGalleryItem.addEventListener('click', function() {
                addEnvironmentImage.click();
            });
        }
        
        // 選擇文件後處理上傳
        addEnvironmentImage.addEventListener('change', function(e) {
            handleEnvironmentImageUpload(e.target.files);
        });
    }
    
    // 綁定既有刪除按鈕
    document.querySelectorAll('.gallery-item .remove-image').forEach(btn => {
        btn.addEventListener('click', function() {
            const galleryItem = this.closest('.gallery-item');
            const imgUrl = galleryItem.querySelector('img').src;
            
            if (confirm('確定要刪除此照片嗎?')) {
                removeGalleryImage(imgUrl);
                galleryItem.remove();
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
        showAlert("正在上傳圖片，請稍候...", "info");
        
        // 壓縮圖片
        const compressedFile = await compressImage(file, 400, 400);
        
        // 上傳到 Storage
        const storageRef = storage.ref(`venues/${currentUser.uid}/main`);
        await storageRef.put(compressedFile);
        const imageUrl = await storageRef.getDownloadURL();
        
        // 更新 Firestore
        await db.collection("venues").doc(currentUser.uid).update({
            imageUrl: imageUrl,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新預覽
        const mainImagePreview = document.querySelector(".image-preview");
        mainImagePreview.innerHTML = `
            <img src="${imageUrl}" alt="店家頭像">
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
        
        // 更新本地數據
        if (!businessData) businessData = {};
        businessData.imageUrl = imageUrl;
        
        // 更新導航頭像
        document.getElementById("businessImage").src = imageUrl;
        
        showAlert("店家頭像已成功更新", "success");
    } catch (error) {
        console.error("上傳圖片錯誤:", error);
        showAlert("上傳圖片失敗，請稍後再試", "danger");
    } finally {
        // 清空文件輸入，允許上傳相同檔案
        e.target.value = '';
    }
}

let map;
let marker;
let geocoder;

// 初始化地圖
function initMap() {
    // 預設位置 (台北市中心)
    const defaultPosition = { lat: 25.033964, lng: 121.564468 };
    
    // 從Firestore中獲取店家位置（如果有）
    if (businessData && businessData.position && businessData.position.geopoint) {
        defaultPosition.lat = businessData.position.geopoint.latitude;
        defaultPosition.lng = businessData.position.geopoint.longitude;
    }
    
    // 檢查地圖容器是否存在
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;
    
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
            url: 'https://maps.google.com/mapfiles/ms/icons/pink-dot.png' // 使用粉紅色標記符合品牌顏色
        }
    });
    
    // 初始化地理編碼器
    geocoder = new google.maps.Geocoder();
    
    // 更新座標顯示
    document.getElementById('latitude').value = defaultPosition.lat.toFixed(6);
    document.getElementById('longitude').value = defaultPosition.lng.toFixed(6);
    
    // 生成並顯示geohash
    const geohash = generateGeohash(defaultPosition.lat, defaultPosition.lng);
    document.getElementById('geohash').value = geohash;
    
    // 根據經緯度取得地址 (初始載入時)
    if (businessData && businessData.address) {
        // 如果已有地址，直接顯示
        document.getElementById('formattedAddress').value = businessData.address;
    } else if (geocoder) {
        // 否則根據坐標獲取地址
        geocoder.geocode({ location: defaultPosition }, function(results, status) {
            if (status === 'OK' && results[0]) {
                document.getElementById('formattedAddress').value = results[0].formatted_address;
            }
        });
    }
    
    // 獲取地標拖動後的位置
    google.maps.event.addListener(marker, 'dragend', function() {
        const position = marker.getPosition();
        updateLocationFields(position);
        
        // 根據經緯度取得地址
        geocoder.geocode({ location: position }, function(results, status) {
            if (status === 'OK' && results[0]) {
                document.getElementById('formattedAddress').value = results[0].formatted_address;
            }
        });
    });
    
    // 搜尋地址按鈕事件
    const searchLocationBtn = document.getElementById('searchLocationBtn');
    if (searchLocationBtn) {
        searchLocationBtn.addEventListener('click', function() {
            searchLocation();
        });
    }
    
    // 地址搜尋框按下Enter事件
    const locationSearch = document.getElementById('locationSearch');
    if (locationSearch) {
        locationSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // 防止表單提交
                searchLocation();
            }
        });
    }
    
    // 儲存位置按鈕事件
    const saveLocationBtn = document.getElementById('saveLocationBtn');
    if (saveLocationBtn) {
        saveLocationBtn.addEventListener('click', function() {
            saveLocationInfo();
        });
    }
}

// 搜尋地址
function searchLocation() {
    if (!geocoder) return;
    
    const address = document.getElementById('locationSearch').value;
    if (!address) {
        showAlert('請輸入要搜尋的地址', 'warning');
        return;
    }
    
    showAlert("搜尋地址中...", "info");
    
    geocoder.geocode({ address: address }, function(results, status) {
        if (status === 'OK' && results[0]) {
            const position = results[0].geometry.location;
            
            // 更新地圖中心和標記位置
            map.setCenter(position);
            marker.setPosition(position);
            
            // 更新顯示欄位
            updateLocationFields(position);
            document.getElementById('formattedAddress').value = results[0].formatted_address;
            
            showAlert("地址已找到並更新", "success");
        } else {
            showAlert('無法找到該地址，請嘗試其他關鍵字', 'warning');
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
        const lat = position.lat();
        const lng = position.lng();
        
        latitudeField.value = lat.toFixed(6);
        longitudeField.value = lng.toFixed(6);
        
        // 更新geohash欄位
        const geohashField = document.getElementById('geohash');
        if (geohashField) {
            geohashField.value = generateGeohash(lat, lng);
        }
    }
}

// 頁面載入時初始化更多功能
document.addEventListener('DOMContentLoaded', function() {
    // 設置活動類型儲存按鈕
    const saveActivityTypesBtn = document.querySelector("#activities-section .card-header .btn-primary");
    if (saveActivityTypesBtn) {
        saveActivityTypesBtn.addEventListener('click', function() {
            saveActivityTypes();
        });
    }
    
    // 綁定店家位置儲存按鈕
    const saveLocationBtn = document.getElementById('saveLocationBtn');
    if (saveLocationBtn) {
        saveLocationBtn.addEventListener('click', async function() {
            const lat = parseFloat(document.getElementById('latitude').value);
            const lng = parseFloat(document.getElementById('longitude').value);
            const formattedAddress = document.getElementById('formattedAddress').value;
            
            if (isNaN(lat) || isNaN(lng) || !formattedAddress) {
                showAlert('位置資訊不完整，請確保已設定位置', 'warning');
                return;
            }
            
            showPageLoading('正在儲存位置...');
            
            // 使用Firebase儲存位置
            try {
                // 檢查是否已初始化Firebase
                if (window.db && window.currentUser) {
                    await window.db.collection("venues").doc(window.currentUser.uid).update({
                        location: new firebase.firestore.GeoPoint(lat, lng),
                        address: formattedAddress,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    // 更新本地數據
                    if (!window.businessData) window.businessData = {};
                    window.businessData.location = { latitude: lat, longitude: lng };
                    window.businessData.address = formattedAddress;
                    
                    hidePageLoading();
                    showAlert('店家位置已成功更新', 'success');
                } else {
                    hidePageLoading();
                    showAlert('無法儲存位置，請重新整理頁面後再試', 'danger');
                }
            } catch (error) {
                console.error('更新位置時發生錯誤:', error);
                hidePageLoading();
                showAlert('更新位置失敗，請稍後再試', 'danger');
            }
        });
    }
});

// 添加全局函數，以便在HTML中直接調用
window.cancelEdit = cancelEdit;
window.updateMenuItem = updateMenuItem;
window.initMap = initMap; // Google Maps 初始化函數，需要全局可訪問
window.searchLocation = searchLocation;
window.showAlert = showAlert;
window.showPageLoading = showPageLoading;
window.hidePageLoading = hidePageLoading;