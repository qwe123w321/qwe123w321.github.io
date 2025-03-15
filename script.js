document.addEventListener('DOMContentLoaded', function() {
    // 導航欄滾動效果
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // 平滑滾動
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 70,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 表單提交處理
    const businessForm = document.getElementById('businessForm');
    if (businessForm) {
        businessForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // 獲取表單數據
            const businessName = document.getElementById('businessName').value;
            const contactPerson = document.getElementById('contactPerson').value;
            const email = document.getElementById('email').value;
            const phone = document.getElementById('phone').value;
            const businessType = document.getElementById('businessType').value;
            const message = document.getElementById('message').value;
            
            // 在實際應用中，這裡會發送數據到伺服器
            // 這裡僅顯示提交成功的訊息
            alert(`感謝您的合作意向！\n\n商家名稱: ${businessName}\n聯絡人: ${contactPerson}\n\n我們將盡快與您聯繫。`);
            
            // 重置表單
            businessForm.reset();
        });
    }

    // 添加動畫效果
    const animateElements = document.querySelectorAll('.feature-card, .pain-point-card');
    
    // 檢查元素是否在視窗中
    function checkIfInView() {
        animateElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementVisible = 150;
            
            if (elementTop < window.innerHeight - elementVisible) {
                element.classList.add('animate');
            }
        });
    }
    
    // 初始檢查
    checkIfInView();
    
    // 滾動時檢查
    window.addEventListener('scroll', checkIfInView);

    // 添加文字淡入效果
    const heroTitle = document.querySelector('.hero-section h1');
    const heroSubtitle = document.querySelector('.hero-section h2');
    const heroParagraph = document.querySelector('.hero-section p');
    
    if (heroTitle && heroSubtitle && heroParagraph) {
        setTimeout(() => {
            heroTitle.style.opacity = '1';
            heroTitle.style.transform = 'translateY(0)';
            
            setTimeout(() => {
                heroSubtitle.style.opacity = '1';
                heroSubtitle.style.transform = 'translateY(0)';
                
                setTimeout(() => {
                    heroParagraph.style.opacity = '1';
                    heroParagraph.style.transform = 'translateY(0)';
                }, 200);
            }, 200);
        }, 300);
    }

    // 添加卡片懸停效果
    const cards = document.querySelectorAll('.feature-card, .pain-point-card');
    
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
            this.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.1)';
            this.style.borderColor = '#b39b7d';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.05)';
            this.style.borderColor = 'rgba(179, 155, 125, 0.1)';
        });
    });

    // 添加圖片懸停效果
    const heroImage = document.querySelector('.hero-image');
    if (heroImage) {
        heroImage.addEventListener('mouseenter', function() {
            this.style.transform = 'perspective(1000px) rotateY(0deg)';
            this.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.4)';
        });
        
        heroImage.addEventListener('mouseleave', function() {
            this.style.transform = 'perspective(1000px) rotateY(-15deg)';
            this.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.3)';
        });
    }
}); 

// 處理即將推出的功能點擊
function showComingSoonMessage(event) {
    event.preventDefault();
    
    // 創建一個彈出提示
    const toast = document.createElement('div');
    toast.className = 'coming-soon-toast';
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas fa-info-circle"></i>
            <span>iOS 版本即將推出，敬請期待！</span>
        </div>
    `;
    
    // 添加樣式
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'rgba(52, 58, 64, 0.9)';
    toast.style.color = 'white';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '30px';
    toast.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
    toast.style.zIndex = '1000';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.justifyContent = 'center';
    toast.style.minWidth = '250px';
    toast.style.maxWidth = '80%';
    
    // 添加到頁面
    document.body.appendChild(toast);
    
    // 3秒後自動移除
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 500);
    }, 3000);
}

// 監聽下載按鈕點擊事件
document.addEventListener('DOMContentLoaded', function() {
    const downloadBtn = document.querySelector('a[href="app-debug.apk"]');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            // Google Analytics 追蹤下載事件 (如果有使用 GA)
            if (typeof gtag !== 'undefined') {
                gtag('event', 'download', {
                    'event_category': 'app_download',
                    'event_label': 'Android APK'
                });
            }
            
            // 顯示下載已開始的提示
            const toast = document.createElement('div');
            toast.className = 'download-toast';
            toast.innerHTML = `
                <div class="toast-content">
                    <i class="fas fa-download"></i>
                    <span>下載已開始，請按照安裝指南進行安裝</span>
                </div>
            `;
            
            // 添加樣式
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(157, 127, 134, 0.9)';
            toast.style.color = 'white';
            toast.style.padding = '12px 20px';
            toast.style.borderRadius = '30px';
            toast.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.2)';
            toast.style.zIndex = '1000';
            toast.style.display = 'flex';
            toast.style.alignItems = 'center';
            toast.style.justifyContent = 'center';
            toast.style.minWidth = '250px';
            toast.style.maxWidth = '80%';
            
            // 添加到頁面
            document.body.appendChild(toast);
            
            // 3秒後自動移除
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 500);
            }, 3000);
        });
    }
});