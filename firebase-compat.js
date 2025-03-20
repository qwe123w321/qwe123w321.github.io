// Firebase v9 與 v8 相容層
// 此文件創建一個橋接層，允許使用Firebase v8風格的語法，但底層使用Firebase v9 API

import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  setDoc, 
  deleteDoc, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp, 
  GeoPoint,
  limit,
  startAfter,
  writeBatch,
  deleteField,  // 添加 deleteField 函數
  arrayUnion,   // 添加陣列操作
  arrayRemove,
  increment     // 添加計數器操作
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';

import { 
  getStorage, 
  ref as storageRef, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js';

// Firebase App (必須是首先引入的)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';

// 初始化Firebase應用 - 使用你自己的配置
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
const app = initializeApp(firebaseConfig);

// 取得 Firebase 服務
const firestoreDb = getFirestore(app);
const firestoreAuth = getAuth(app);
const firestoreStorage = getStorage(app);

// 創建一個Firebase v8風格的API相容層
function createCompatibilityLayer() {
  // 用於轉換文檔快照到 v8 風格的文檔
  function wrapDocumentSnapshot(docSnap) {
    if (!docSnap.exists()) {
      return {
        exists: false,
        data: () => null,
        id: docSnap.id
      };
    }
    return {
      exists: true,
      data: () => docSnap.data(),
      id: docSnap.id
    };
  }

  // 用於轉換查詢快照到 v8 風格的查詢結果
  function wrapQuerySnapshot(querySnap) {
    return {
      empty: querySnap.empty,
      size: querySnap.size,
      docs: querySnap.docs.map(wrapDocumentSnapshot),
      forEach: (callback) => {
        querySnap.forEach((doc) => {
          callback(wrapDocumentSnapshot(doc));
        });
      }
    };
  }
  
  // 創建 batch 包裝器函數
  function createBatchWrapper(batchInstance) {
    return {
      set: (docRef, data) => {
        batchInstance.set(docRef._firestoreRef, data);
        return batchWrapper;
      },
      update: (docRef, data) => {
        batchInstance.update(docRef._firestoreRef, data);
        return batchWrapper;
      },
      delete: (docRef) => {
        batchInstance.delete(docRef._firestoreRef);
        return batchWrapper;
      },
      commit: () => batchInstance.commit()
    };
  }

  // Firestore 相容層
  const firestoreCompat = {
    collection: (collectionPath) => {
      const collectionRef = collection(firestoreDb, collectionPath);
      
      return {
        doc: (docId) => {
          const docRef = doc(firestoreDb, collectionPath, docId);
          
          // 創建文檔引用，包含實際的Firestore引用以便批處理使用
          const docRefWrapper = {
            get: async () => {
              const docSnap = await getDoc(docRef);
              return wrapDocumentSnapshot(docSnap);
            },
            update: (data) => updateDoc(docRef, data),
            set: (data) => setDoc(docRef, data),
            delete: () => deleteDoc(docRef),
            // 存儲原始引用，供batch使用
            _firestoreRef: docRef
          };
          
          return docRefWrapper;
        },
        where: (field, operator, value) => {
          const q = query(collectionRef, where(field, operator, value));
          
          return {
            orderBy: (field, direction = 'asc') => {
              const orderedQuery = query(q, orderBy(field, direction));
              
              return {
                get: async () => {
                  const querySnapshot = await getDocs(orderedQuery);
                  return wrapQuerySnapshot(querySnapshot);
                },
                limit: (limitVal) => {
                  const limitedQuery = query(orderedQuery, limit(limitVal));
                  return {
                    get: async () => {
                      const querySnapshot = await getDocs(limitedQuery);
                      return wrapQuerySnapshot(querySnapshot);
                    }
                  };
                }
              };
            },
            get: async () => {
              const querySnapshot = await getDocs(q);
              return wrapQuerySnapshot(querySnapshot);
            },
            limit: (limitVal) => {
              const limitedQuery = query(q, limit(limitVal));
              return {
                get: async () => {
                  const querySnapshot = await getDocs(limitedQuery);
                  return wrapQuerySnapshot(querySnapshot);
                }
              };
            }
          };
        },
        orderBy: (field, direction = 'asc') => {
          const q = query(collectionRef, orderBy(field, direction));
          return {
            get: async () => {
              const querySnapshot = await getDocs(q);
              return wrapQuerySnapshot(querySnapshot);
            },
            limit: (limitVal) => {
              const limitedQuery = query(q, limit(limitVal));
              return {
                get: async () => {
                  const querySnapshot = await getDocs(limitedQuery);
                  return wrapQuerySnapshot(querySnapshot);
                }
              };
            }
          };
        },
        get: async () => {
          const querySnapshot = await getDocs(collectionRef);
          return wrapQuerySnapshot(querySnapshot);
        },
        add: (data) => addDoc(collectionRef, data)
      };
    },
    // 批處理操作
    batch: () => {
      const batchInstance = writeBatch(firestoreDb);
      return createBatchWrapper(batchInstance);
    },
    // 添加Firestore數據類型
    GeoPoint: GeoPoint,
    Timestamp: Timestamp,
    FieldValue: {
      serverTimestamp: () => serverTimestamp(),
      delete: () => deleteField(),       // 添加刪除欄位操作
      arrayUnion: (...elements) => arrayUnion(...elements),   // 添加陣列聯集操作
      arrayRemove: (...elements) => arrayRemove(...elements), // 添加陣列移除操作
      increment: (number) => increment(number)   // 添加計數器操作
    }
  };

  // Auth 相容層
  const authCompat = {
    currentUser: firestoreAuth.currentUser,
    signInWithEmailAndPassword: (email, password) => 
      signInWithEmailAndPassword(firestoreAuth, email, password),
    signOut: () => signOut(firestoreAuth),
    onAuthStateChanged: (callback) => 
      onAuthStateChanged(firestoreAuth, callback)
  };

  // Storage 相容層
  const storageCompat = {
    ref: (path) => {
      const reference = storageRef(firestoreStorage, path);
      return {
        put: async (file) => {
          const snapshot = await uploadBytes(reference, file);
          return {
            ref: {
              getDownloadURL: () => getDownloadURL(snapshot.ref)
            }
          };
        },
        delete: () => deleteObject(reference),
        getDownloadURL: () => getDownloadURL(reference)
      };
    },
    refFromURL: (url) => {
      try {
        // 從URL解析路徑
        const urlPath = url.split('?')[0]; // 移除查詢參數
        // Google Cloud Storage URLs 通常是 <storageURL>/o/<encoded-path>
        // 我們需要獲取並解碼 <encoded-path> 部分
        const storagePath = decodeURIComponent(urlPath.split('/o/')[1]); 
        
        if (!storagePath) {
          console.error("無法從URL解析路徑:", url);
          throw new Error("無效的Storage URL");
        }
        
        const reference = storageRef(firestoreStorage, storagePath);
        return {
          delete: () => deleteObject(reference)
        };
      } catch (error) {
        console.error("從URL創建引用時出錯:", error);
        return {
          delete: () => Promise.reject(new Error("無效的Storage URL"))
        };
      }
    }
  };

  // 返回完整的相容層
  return {
    app,
    auth: authCompat,
    db: firestoreCompat,
    storage: storageCompat,
    firestore: {
      GeoPoint,
      Timestamp,
      FieldValue: {
        serverTimestamp: () => serverTimestamp(),
        deleteField: () => deleteField(),
        arrayUnion: (...elements) => arrayUnion(...elements),
        arrayRemove: (...elements) => arrayRemove(...elements),
        increment: (number) => increment(number)
      },
      batch: () => firestoreCompat.batch()
    }
  };
}

// 創建並導出相容層
const firebaseCompat = createCompatibilityLayer();
export default firebaseCompat;