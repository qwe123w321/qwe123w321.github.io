// 全域變數
let currentUser = null;
let venueData = null;

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
                loadVenueData();
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

// 側邊欄初始化
function initSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const navToggle = document.querySelector('.nav-toggle');
    
    if (navToggle) {
        navToggle.addEventListener('click', function() {
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
            document.querySelector('.sidebar-menu li.active').classList.remove('active');
            item.parentElement.classList.add('active');
            
            // 顯示對應的內容區塊
            document.querySelector('.content-section.active').classList.remove('active');
            targetSection.classList.add('active');
        });
    });
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
        
        // 處理「編輯項目」按鈕點擊
        if (e.target.classList.contains('edit-item-btn') || e.target.closest('.edit-item-btn')) {
            const btn = e.target.classList.contains('edit-item-btn') ? e.target : e.target.closest('.edit-item-btn');
            const itemId = btn.getAttribute('data-id');
            editMenuItem(itemId);
        }
        
        // 處理「刪除項目」按鈕點擊
        if (e.target.classList.contains('delete-item-btn') || e.target.closest('.delete-item-btn')) {
            const btn = e.target.classList.contains('delete-item-btn') ? e.target : e.target.closest('.delete-item-btn');
            const itemId = btn.getAttribute('data-id');
            deleteMenuItem(itemId);
        }
    });
}

// 2. 添加 saveCategory 函數
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
            if (btn.parentElement.classList.contains('me-2')) { // 確保是標籤按鈕
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
        if (!venueData) venueData = {};
        venueData.tags = tags;
        
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

// 9. 添加標籤
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
    
    // 創建新標籤元素
    const tag = document.createElement("div");
    tag.className = "tag";
    tag.innerHTML = tagText + '<span class="tag-close">&times;</span>';
    
    // 獲取輸入框
    const tagInput = tagContainer.querySelector(".tag-input");
    
    // 添加到容器
    tagContainer.insertBefore(tag, tagInput);
    
    // 添加刪除事件
    const closeBtn = tag.querySelector(".tag-close");
    closeBtn.addEventListener("click", function() {
        tag.remove();
    });
}

// 活動類型卡片初始化
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

// 圖片上傳預覽初始化
function initImageUploads() {
    // 店家頭像上傳
    initMainImageUpload();
    
    // 環境照片上傳
    initEnvironmentImages();
    
    // 商品圖片上傳
    initItemImagePreview();
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

// 商品圖片預覽初始化
function initItemImagePreview() {
    const itemImage = document.getElementById('itemImage');
    if (itemImage) {
        itemImage.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // 檢查文件類型和大小
            if (!file.type.match('image.*')) {
                showAlert("請上傳圖片文件", "warning");
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) { // 5MB
                showAlert("圖片大小不能超過 5MB", "warning");
                return;
            }
            
            const previewContainer = document.getElementById('itemImagePreview');
            if (previewContainer) {
                // 清空現有內容
                previewContainer.innerHTML = '';
                
                // 創建圖片預覽
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                previewContainer.appendChild(img);
                
                // 添加刪除按鈕
                const removeBtn = document.createElement('div');
                removeBtn.className = 'remove-image';
                removeBtn.innerHTML = '<i class="fas fa-times"></i>';
                previewContainer.appendChild(removeBtn);
                
                // 綁定刪除事件
                removeBtn.addEventListener('click', function() {
                    itemImage.value = '';
                    previewContainer.innerHTML = `
                        <div class="upload-placeholder">
                            <i class="fas fa-image"></i>
                            <p>上傳商品圖片</p>
                        </div>
                    `;
                });
            }
        });
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
        if (!venueData) venueData = {};
        venueData.imageUrl = imageUrl;
        
        showAlert("店家頭像已成功更新", "success");
    } catch (error) {
        console.error("上傳圖片錯誤:", error);
        showAlert("上傳圖片失敗，請稍後再試", "danger");
    } finally {
        // 清空文件輸入，允許上傳相同檔案
        e.target.value = '';
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
        if (venueData && venueData.galleryImages) {
            galleryImages = [...venueData.galleryImages];
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
        if (!venueData) venueData = {};
        venueData.galleryImages = galleryImages;
        
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
    // 已在HTML中初始化，這裡可以添加額外功能
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
        if (!venueData) venueData = {};
        venueData.openingHours = openingHours;
        
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

// 加載店家資料
async function loadVenueData() {
    try {
        showAlert("載入店家資料中...", "info");
        const venueDoc = await db.collection("venues").doc(currentUser.uid).get();
        
        if (venueDoc.exists) {
            venueData = venueDoc.data();
            
            // 更新導航欄用戶資訊
            document.getElementById("navUserName").textContent = venueData.name || "未命名店家";
            if (venueData.profileImageUrl) {
                document.getElementById("navUserImage").src = venueData.profileImageUrl;
            } else if (venueData.imageUrl) {
                document.getElementById("navUserImage").src = venueData.imageUrl;
            }
            
            // 更新基本資料欄位
            document.getElementById("storeName").value = venueData.name || "";
            document.getElementById("storePhone").value = venueData.phoneNumber || "";
            document.getElementById("storeEmail").value = venueData.email || "";
            document.getElementById("storeWebsite").value = venueData.website || "";
            document.getElementById("storeDescription").value = venueData.description || "";
            
            // 更新店家主圖
            if (venueData.imageUrl) {
                const mainImagePreview = document.querySelector(".image-preview");
                mainImagePreview.innerHTML = `
                <img src="${venueData.imageUrl}" alt="店家頭像/Logo">
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
            
            // 更新營業時間
            if (venueData.openingHours && venueData.openingHours.length > 0) {
                updateOpeningHours(venueData.openingHours);
            } else {
                // 設置預設營業時間
                initDefaultOpeningHours();
            }
            
            // 更新活動類型
            if (venueData.activityTypes && venueData.activityTypes.length > 0) {
                updateActivityTypes(venueData.activityTypes);
            } else {
                // 重置所有活動類型卡片
                document.querySelectorAll('.activity-type-card').forEach(card => {
                    card.classList.remove('selected');
                });
                
                // 更新選擇數量顯示
                const badge = document.querySelector('.badge.bg-primary');
                if (badge) {
                    badge.textContent = '已選擇 0 項';
                }
            }
            
            // 更新標籤
            if (venueData.tags && venueData.tags.length > 0) {
                updateTags(venueData.tags);
            } else {
                // 清空標籤容器
                const tagContainer = document.getElementById('tagContainer');
                if (tagContainer) {
                    // 保留輸入框
                    const tagInput = tagContainer.querySelector('.tag-input');
                    tagContainer.innerHTML = '';
                    if (tagInput) {
                        tagContainer.appendChild(tagInput);
                    } else {
                        // 如果沒有找到輸入框，創建一個新的
                        const newInput = document.createElement('input');
                        newInput.type = 'text';
                        newInput.className = 'tag-input';
                        newInput.placeholder = '輸入標籤，按Enter添加';
                        tagContainer.appendChild(newInput);
                        
                        // 添加輸入事件
                        newInput.addEventListener('keydown', function(e) {
                            if (e.key === 'Enter' && this.value.trim() !== '') {
                                e.preventDefault();
                                addTag(this.value.trim());
                                this.value = '';
                            }
                        });
                    }
                }
            }
            
            // 加載商品項目
            loadMenuItems();
            
            // 更新環境照片
            if (venueData.galleryImages && venueData.galleryImages.length > 0) {
                updateGallery(venueData.galleryImages);
            }
        } else {
            // 店家資料不存在，可能是新用戶
            console.log("店家資料不存在，請建立資料");
            showAlert("歡迎使用店家管理平台！請完善您的店家資料。", "info");
            
            // 設置預設營業時間
            initDefaultOpeningHours();
        }
    } catch (error) {
        console.error("載入店家資料錯誤:", error);
        showAlert("載入資料時發生錯誤，請稍後再試", "danger");
    }
}

// 更新標籤
function updateTags(tags) {
    const tagContainer = document.getElementById("tagContainer");
    if (!tagContainer) return;
    
    // 清空現有標籤，但保留輸入框
    const tagInput = tagContainer.querySelector(".tag-input") || createTagInput();
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
    tagContainer.appendChild(tagInput);
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

// 更新活動類型
function updateActivityTypes(activityTypes) {
    const activityCards = document.querySelectorAll(".activity-type-card");
    if (!activityCards.length) return;
    
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
    
    // 更新選擇數量顯示
    const selectedCount = document.querySelectorAll(".activity-type-card.selected").length;
    const badge = document.querySelector(".badge.bg-primary");
    if (badge) {
        badge.textContent = `已選擇 ${selectedCount} 項`;
    }
}

// 3. 更新營業時間
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


// 繼續修復店家資訊頁面功能

// 1. 繼續 loadVenueData 函數
async function loadVenueData() {
    try {
        showAlert("載入店家資料中...", "info");
        
        // 確保用戶已登入
        if (!currentUser || !currentUser.uid) {
            console.error("未找到用戶資料");
            showAlert("請重新登入", "danger");
            return;
        }
        
        const venueDoc = await db.collection("venues").doc(currentUser.uid).get();
        
        if (venueDoc.exists) {
            venueData = venueDoc.data();
            
            // 更新導航欄用戶資訊
            document.getElementById("navUserName").textContent = venueData.name || "未命名店家";
            if (venueData.profileImageUrl) {
                document.getElementById("navUserImage").src = venueData.profileImageUrl;
            } else if (venueData.imageUrl) {
                document.getElementById("navUserImage").src = venueData.imageUrl;
            }
            
            // 更新基本資料欄位
            document.getElementById("storeName").value = venueData.name || "";
            document.getElementById("storePhone").value = venueData.phoneNumber || "";
            document.getElementById("storeEmail").value = venueData.email || "";
            document.getElementById("storeWebsite").value = venueData.website || "";
            document.getElementById("storeDescription").value = venueData.description || "";
            
            // 更新店家主圖
            if (venueData.imageUrl) {
                const mainImagePreview = document.querySelector(".image-preview");
                if (mainImagePreview) {
                    mainImagePreview.innerHTML = `
                    <img src="${venueData.imageUrl}" alt="店家頭像/Logo">
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
            if (venueData.openingHours && venueData.openingHours.length > 0) {
                updateOpeningHours(venueData.openingHours);
            } else {
                // 設置預設營業時間
                initDefaultOpeningHours();
            }
            
            // 更新活動類型
            if (venueData.activityTypes && venueData.activityTypes.length > 0) {
                updateActivityTypes(venueData.activityTypes);
            }
            
            // 更新標籤
            if (venueData.tags && venueData.tags.length > 0) {
                updateTags(venueData.tags);
            }
            
            // 更新環境照片
            if (venueData.galleryImages && venueData.galleryImages.length > 0) {
                updateGallery(venueData.galleryImages);
            }
            
            // 更新地理位置
            if (venueData.location) {
                updateLocationFields(venueData.location);
            }
            
            // 更新儀表板統計數據
            updateDashboardStats();
            
            console.log("店家資料載入完成");
        } else {
            // 店家資料不存在，可能是新用戶
            console.log("店家資料不存在，請建立資料");
            showAlert("歡迎使用店家管理平台！請完善您的店家資料。", "info");
            
            // 設置預設營業時間
            initDefaultOpeningHours();
            
            // 創建新的店家文檔
            await initializeNewVenue();
        }
    } catch (error) {
        console.error("載入店家資料錯誤:", error);
        showAlert("載入資料時發生錯誤，請稍後再試", "danger");
    }
}

// 2. 為新用戶初始化店家資料
async function initializeNewVenue() {
    try {
        if (!currentUser || !currentUser.uid) return;
        
        // 檢查是否已存在店家文檔
        const venueDoc = await db.collection("venues").doc(currentUser.uid).get();
        if (venueDoc.exists) return;
        
        // 創建預設數據
        const defaultVenueData = {
            name: "未命名店家",
            description: "",
            phoneNumber: "",
            email: currentUser.email || "",
            website: "",
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 寫入到資料庫
        await db.collection("venues").doc(currentUser.uid).set(defaultVenueData);
        console.log("已創建新的店家資料");
        
        // 更新本地數據
        venueData = defaultVenueData;
    } catch (error) {
        console.error("初始化新店家資料時出錯:", error);
    }
}

// 3. 更新營業時間
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

// 4. 設置下拉選單值
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

// 5. 初始化預設營業時間
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
        if (!venueData || !venueData.galleryImages) return;
        
        // 從存儲中刪除文件
        const storageRef = firebase.storage().refFromURL(imageUrl);
        await storageRef.delete();
        
        // 從店家數據中移除 URL
        const updatedImages = venueData.galleryImages.filter(url => url !== imageUrl);
        
        // 更新Firestore
        await db.collection("venues").doc(currentUser.uid).update({
            galleryImages: updatedImages,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        venueData.galleryImages = updatedImages;
        
        showAlert("照片已成功刪除", "success");
    } catch (error) {
        console.error("刪除照片錯誤:", error);
        showAlert("刪除照片失敗，請稍後再試", "danger");
    }
}

// 刪除主圖/頭像
async function removeMainImage() {
    try {
        if (!venueData || !venueData.imageUrl) return;
        
        // 從存儲中刪除文件
        const imageRef = storage.refFromURL(venueData.imageUrl);
        await imageRef.delete();
        
        // 從資料庫中刪除引用
        await db.collection("venues").doc(currentUser.uid).update({
            imageUrl: firebase.firestore.FieldValue.delete(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 更新本地數據
        delete venueData.imageUrl;
        
        // 更新UI
        const mainImagePreview = document.querySelector(".image-preview");
        mainImagePreview.innerHTML = `
            <div class="upload-placeholder">
                <i class="fas fa-image"></i>
                <p>上傳店家頭像/Logo</p>
            </div>
        `;
        
        // 更新導航頭像
        document.getElementById("navUserImage").src = "https://via.placeholder.com/40";
        
        showAlert("店家頭像已成功刪除", "success");
    } catch (error) {
        console.error("刪除主圖時發生錯誤:", error);
        showAlert("刪除頭像失敗，請稍後再試", "danger");
    }
}

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
        const venueDataToUpdate = {
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
            venueDataToUpdate.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        
        // 更新 Firestore 文檔
        await venueDocRef.set(venueDataToUpdate, { merge: true });
        
        // 更新本地數據
        if (!venueData) venueData = {};
        Object.assign(venueData, venueDataToUpdate);
        
        // 更新UI
        document.getElementById("navUserName").textContent = venueData.name;
        
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

//標籤與活動類型更新.


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
        updateMenuItemsUI(menuItemsByCategory);
    } catch (error) {
        console.error("載入商品項目錯誤:", error);
        showAlert("載入商品項目失敗，請稍後再試", "danger");
    }
}

// 更新商品項目 UI
async function loadVenueData() {
    try {
        showAlert("載入店家資料中...", "info");
        
        // 確保用戶已登入
        if (!currentUser || !currentUser.uid) {
            console.error("未找到用戶資料");
            showAlert("請重新登入", "danger");
            return;
        }
        
        const venueDoc = await db.collection("venues").doc(currentUser.uid).get();
        
        if (venueDoc.exists) {
            venueData = venueDoc.data();
            
            // 更新導航欄用戶資訊
            document.getElementById("navUserName").textContent = venueData.name || "未命名店家";
            if (venueData.profileImageUrl) {
                document.getElementById("navUserImage").src = venueData.profileImageUrl;
            } else if (venueData.imageUrl) {
                document.getElementById("navUserImage").src = venueData.imageUrl;
            }
            
            // 更新基本資料欄位
            document.getElementById("storeName").value = venueData.name || "";
            document.getElementById("storePhone").value = venueData.phoneNumber || "";
            document.getElementById("storeEmail").value = venueData.email || "";
            document.getElementById("storeWebsite").value = venueData.website || "";
            document.getElementById("storeDescription").value = venueData.description || "";
            
            // 更新店家主圖
            if (venueData.imageUrl) {
                const mainImagePreview = document.querySelector(".image-preview");
                if (mainImagePreview) {
                    mainImagePreview.innerHTML = `
                    <img src="${venueData.imageUrl}" alt="店家頭像/Logo">
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
            if (venueData.openingHours && venueData.openingHours.length > 0) {
                updateOpeningHours(venueData.openingHours);
            } else {
                // 設置預設營業時間
                initDefaultOpeningHours();
            }
            
            // 更新活動類型
            if (venueData.activityTypes && venueData.activityTypes.length > 0) {
                updateActivityTypes(venueData.activityTypes);
            }
            
            // 更新標籤
            if (venueData.tags && venueData.tags.length > 0) {
                updateTags(venueData.tags);
            }
            
            // 更新環境照片
            if (venueData.galleryImages && venueData.galleryImages.length > 0) {
                updateGallery(venueData.galleryImages);
            }
            
            // 更新地理位置
            if (venueData.location) {
                updateLocationFields(venueData.location);
            }
            
            // 更新儀表板統計數據
            updateDashboardStats();
            
            console.log("店家資料載入完成");
        } else {
            // 店家資料不存在，可能是新用戶
            console.log("店家資料不存在，請建立資料");
            showAlert("歡迎使用店家管理平台！請完善您的店家資料。", "info");
            
            // 設置預設營業時間
            initDefaultOpeningHours();
            
            // 創建新的店家文檔
            await initializeNewVenue();
        }
    } catch (error) {
        console.error("載入店家資料錯誤:", error);
        showAlert("載入資料時發生錯誤，請稍後再試", "danger");
    }
}

// 2. 為新用戶初始化店家資料
async function initializeNewVenue() {
    try {
        if (!currentUser || !currentUser.uid) return;
        
        // 檢查是否已存在店家文檔
        const venueDoc = await db.collection("venues").doc(currentUser.uid).get();
        if (venueDoc.exists) return;
        
        // 創建預設數據
        const defaultVenueData = {
            name: "未命名店家",
            description: "",
            phoneNumber: "",
            email: currentUser.email || "",
            website: "",
            isActive: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // 寫入到資料庫
        await db.collection("venues").doc(currentUser.uid).set(defaultVenueData);
        console.log("已創建新的店家資料");
        
        // 更新本地數據
        venueData = defaultVenueData;
    } catch (error) {
        console.error("初始化新店家資料時出錯:", error);
    }
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
        // 獲取當前顯示的表單的輸入值，而不是固定的 ID
        const formId = `${category.replace(/\s+/g, '-').toLowerCase()}-item-form`;
        const form = document.getElementById(formId);
        
        // 如果找不到特定類別的表單，使用通用表單
        let nameInput, descInput, imageInput;
        
        if (form) {
            nameInput = form.querySelector('#itemName') || form.querySelector('input[placeholder*="商品名稱"]');
            descInput = form.querySelector('#itemDesc') || form.querySelector('textarea[placeholder*="描述"]');
            imageInput = form.querySelector('#itemImage') || form.querySelector('input[type="file"]');
        } else {
            // 使用通用 ID
            nameInput = document.getElementById('itemName');
            descInput = document.getElementById('itemDesc');
            imageInput = document.getElementById('itemImage');
        }
        
        // 獲取輸入值
        const name = nameInput ? nameInput.value : '';
        const description = descInput ? descInput.value : '';
        const imageFile = imageInput && imageInput.files.length > 0 ? imageInput.files[0] : null;
        
        if (!name || !category) {
            showAlert("請填寫商品名稱", "warning");
            return;
        }
        
        let imageUrl = null;
        if (imageFile) {
            // 壓縮圖片並上傳
            const compressedFile = await compressImage(imageFile, 600, 400);
            const storageRef = storage.ref(`menu/${currentUser.uid}/${Date.now()}_${imageFile.name}`);
            await storageRef.put(compressedFile);
            imageUrl = await storageRef.getDownloadURL();
        }
        
        // 添加到 Firestore
        await db.collection("menuItems").add({
            venueId: currentUser.uid,
            category: category,
            name: name,
            description: description,
            imageUrl: imageUrl,
            displayInApp: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 重新加載商品列表
        await loadMenuItems();
        
        // 重置表單
        if (nameInput) nameInput.value = '';
        if (descInput) descInput.value = '';
        if (imageInput) imageInput.value = '';
        
        // 隱藏表單
        if (form) {
            form.style.display = 'none';
        }
        
        showAlert("商品項目已成功添加", "success");
    } catch (error) {
        console.error("添加商品項目時發生錯誤:", error);
        showAlert("添加商品項目失敗，請稍後再試", "danger");
    }
}




// 刪除商品類別
async function deleteCategory(category) {
    if (!category) {
        showAlert("無效的類別名稱", "warning");
        return;
    }
    
    try {
        // 先找出屬於此類別的所有項目
        const itemsSnapshot = await db.collection("menuItems")
            .where("venueId", "==", currentUser.uid)
            .where("category", "==", category)
            .get();
        
        // 刪除所有項目及其圖片
        const deletePromises = [];
        itemsSnapshot.forEach(doc => {
            const item = doc.data();
            
            // 如果有圖片，刪除圖片
            if (item.imageUrl) {
                try {
                    const imageRef = storage.refFromURL(item.imageUrl);
                    deletePromises.push(imageRef.delete());
                } catch (e) {
                    console.warn("刪除商品圖片失敗:", e);
                }
            }
            
            // 刪除項目文檔
            deletePromises.push(db.collection("menuItems").doc(doc.id).delete());
        });
        
        // 執行所有刪除操作
        await Promise.all(deletePromises);
        
        // 找出類別文檔並刪除
        const categorySnapshot = await db.collection("categories")
            .where("venueId", "==", currentUser.uid)
            .where("name", "==", category)
            .get();
        
        if (!categorySnapshot.empty) {
            await db.collection("categories").doc(categorySnapshot.docs[0].id).delete();
        }
        
        // 重新加載商品項目
        await loadMenuItems();
        
        showAlert(`類別「${category}」已成功刪除`, "success");
    } catch (error) {
        console.error("刪除類別錯誤:", error);
        showAlert("刪除類別失敗，請稍後再試", "danger");
    }
}

// 壓縮圖片函數
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
                
                try {
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
                } catch (error) {
                    console.error("圖片壓縮過程中出錯:", error);
                    // 如果壓縮失敗，返回原始文件
                    resolve(file);
                }
            };
            
            img.onerror = function() {
                console.error("圖片加載失敗");
                reject(new Error('圖片加載失敗'));
            };
        };
        
        reader.onerror = function() {
            console.error("文件讀取失敗");
            reject(new Error('文件讀取失敗'));
        };
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

// 顯示提示訊息
function showAlert(message, type = "success") {
    // 檢查是否已有提示，避免重複
    const existingAlerts = document.querySelectorAll('.alert-floating');
    existingAlerts.forEach(alert => alert.remove());
    
    const alertDiv = document.createElement("div");
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
    }, 3000);
}