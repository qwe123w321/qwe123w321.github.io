<script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-app-check.js"></script>

// Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyDslE4rgN8ZiUam3MCT_bJiSfusUxZS-wU",
    authDomain: "test1-b1d68.firebaseapp.com",
    databaseURL: "https://test1-b1d68-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "test1-b1d68",
    storageBucket: "test1-b1d68.appspot.com",
    messagingSenderId: "1010412789448",
    appId: "1:1010412789448:web:2843afa459b3644d118ffd",
    measurementId: "G-X7RQ8DRZ7P"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);

// 初始化 App Check (在初始化其他服務之前)
const appCheck = firebase.appCheck();
appCheck.activate('6LfRXvMqAAAAAGA0CuAxE_e6k_Kg_67Tn_fSCx6e', true);

// 然後再初始化其他服務
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// 設置一些安全性選項
auth.useDeviceLanguage();
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);