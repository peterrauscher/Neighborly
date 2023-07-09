import { initializeApp } from "firebase/app";
import { getStorage, ref } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { createContext } from "react";

const firebaseConfig = {
  apiKey: "AIzaSyA2jobtHxRZACaZIBb3o4xtJgM-4q-CFQY",
  authDomain: "neighborly-388205.firebaseapp.com",
  projectId: "neighborly-388205",
  storageBucket: "neighborly-388205.appspot.com",
  messagingSenderId: "574116616491",
  appId: "1:574116616491:web:47e1a1d6b392b0a5b7cd6e",
  measurementId: "G-ZF33NWHPH0",
};

export const FirebaseContext = createContext(null);

export const FirebaseProvider = ({ children }) => {
  const firebaseApp = initializeApp(firebaseConfig);
  const firebaseAnalytics = getAnalytics(firebaseApp);
  const firebaseStorage = getStorage(firebaseApp);

  return (
    <FirebaseContext.Provider
      value={{
        firebaseApp,
        firebaseAnalytics,
        firebaseStorage,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};
