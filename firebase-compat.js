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
    deleteField, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    serverTimestamp, 
    Timestamp, 
    GeoPoint,
    limit,
    startAfter
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
      if (!docSnap.exists) {
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
  
    // Firestore 相容層
    const firestoreCompat = {
      collection: (collectionPath) => {
        const collectionRef = collection(firestoreDb, collectionPath);
        
        return {
          doc: (docId) => {
            const docRef = doc(firestoreDb, collectionPath, docId);
            
            return {
              get: async () => {
                const docSnap = await getDoc(docRef);
                return wrapDocumentSnapshot(docSnap);
              },
              update: (data) => updateDoc(docRef, data),
              set: (data) => setDoc(docRef, data),
              delete: () => deleteDoc(docRef)
            };
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
          add: (data) => addDoc(collectionRef, data),
          FieldValue: {
            serverTimestamp: () => serverTimestamp(),
            deleteField: () => deleteField()  // 添加這一行
          }
        };
      },
      // 添加Firestore數據類型
      GeoPoint: GeoPoint,
      Timestamp: Timestamp,
      FieldValue: {
        serverTimestamp: () => serverTimestamp()
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
        const reference = storageRef(firestoreStorage, url);
        return {
          delete: () => deleteObject(reference)
        };
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
          serverTimestamp: () => serverTimestamp()
        }
      }
    };
  }
  
  // 創建並導出相容層
  const firebaseCompat = createCompatibilityLayer();
  export default firebaseCompat;