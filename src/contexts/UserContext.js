import { createContext, useEffect, useState, useCallback, useMemo } from "react";
import { App as RealmApp, Credentials } from "realm-web";
import { APP_ID } from "../realm/constants";
import Loading from "../components/Loading";
import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import {
  getActiveMockUser,
  setActiveMockUser,
  removeActiveMockUser,
  getStoredUsers,
  getMockUser,
  createMockUserObject,
  updateMockUserName,
  updateMockUserNeighborhood,
  INITIAL_USERS,
} from "../realm/mockBackend";

const firebaseConfig = {
  apiKey: "AIzaSyA2jobtHxRZACaZIBb3o4xtJgM-4q-CFQY",
  authDomain: "neighborly-388205.firebaseapp.com",
  projectId: "neighborly-388205",
  storageBucket: "neighborly-388205.appspot.com",
  messagingSenderId: "574116616491",
  appId: "1:574116616491:web:47e1a1d6b392b0a5b7cd6e",
  measurementId: "G-ZF33NWHPH0",
};

export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const useLiveRealm = process.env.REACT_APP_USE_REALM_LIVE === "true";

  const [user, setUser] = useState(() => {
    if (useLiveRealm) return null;
    const saved = getActiveMockUser();
    return saved ? createMockUserObject(saved) : null;
  });
  const [userLoading, setUserLoading] = useState(false);
  const firebaseApp = useMemo(() => {
    try {
      return initializeApp(firebaseConfig);
    } catch (e) {
      return null;
    }
  }, []);

  const firebaseStorage = useMemo(() => {
    try {
      return firebaseApp ? getStorage(firebaseApp) : null;
    } catch (e) {
      return null;
    }
  }, [firebaseApp]);

  // Mock App or Real Realm App
  const app = useMemo(() => {
    if (useLiveRealm) {
      return new RealmApp(APP_ID);
    }

    return {
      get currentUser() {
        const saved = getActiveMockUser();
        return saved ? createMockUserObject(saved) : null;
      },
      logIn: async () => {
        const defaultUser = INITIAL_USERS[0];
        const userObj = createMockUserObject(defaultUser);
        setActiveMockUser(defaultUser);
        return userObj;
      },
      emailPasswordAuth: {
        registerUser: async () => ({ success: true }),
      },
    };
  }, [useLiveRealm]);

  const setUserName = async (name) => {
    try {
      if (!user) throw new Error("User is not logged in, cannot add username.");

      if (useLiveRealm && app.currentUser) {
        const result = await app.currentUser.functions.setName(name);
        await app.currentUser.refreshCustomData();
        if (!result.success) throw new Error(result.error);
        return { success: true };
      }

      updateMockUserName(user.id, name);
      setUser((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          customData: { ...prev.customData, name },
        };
        setActiveMockUser(updated.customData);
        return updated;
      });
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  };

  const setUserNeighborhood = async (neighborhood) => {
    try {
      if (!user)
        throw new Error("User is not logged in, cannot change neighborhood.");

      if (useLiveRealm && app.currentUser) {
        const result = await app.currentUser.functions.setNeighborhood(
          neighborhood
        );
        await app.currentUser.refreshCustomData();
        if (!result.success) throw new Error(result.error);
        return { success: true };
      }

      updateMockUserNeighborhood(user.id, neighborhood);
      setUser((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          customData: { ...prev.customData, neighborhood },
        };
        setActiveMockUser(updated.customData);
        return updated;
      });
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, error: err.message };
    }
  };

  const loginAsDemo = useCallback((accountId = "user_peter") => {
    setUserLoading(true);
    const found = getMockUser(accountId) || INITIAL_USERS[0];
    const userObj = createMockUserObject(found);
    setActiveMockUser(found);
    setUser(userObj);
    setUserLoading(false);
    return { success: true };
  }, []);

  const emailPasswordLogin = async (email, password) => {
    try {
      setUserLoading(true);

      if (useLiveRealm) {
        await app.logIn(Credentials.emailPassword(email, password));
        await app.currentUser.refreshCustomData();
        app.currentUser.functions.logUserActive();
        setUser(app.currentUser);
        setUserLoading(false);
        return { success: true };
      }

      // Mock login: find existing user with email or match by name
      const users = getStoredUsers();
      let matched = users.find(
        (u) => u.email && u.email.toLowerCase() === email.toLowerCase()
      );

      if (!matched) {
        // Auto-create friendly profile for any new email
        const cleanName = email.split("@")[0].replace(/[^a-zA-Z0-9]/g, " ");
        const capitalized = cleanName
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

        matched = {
          accountId: `user_${Date.now()}`,
          name: capitalized || "Neighbor",
          email: email,
          neighborhood: INITIAL_USERS[0].neighborhood,
          bio: "New neighbor on the block!",
          lastActive: new Date(),
        };
      }

      const userObj = createMockUserObject(matched);
      setActiveMockUser(matched);
      setUser(userObj);
      setUserLoading(false);
      return { success: true };
    } catch (error) {
      setUserLoading(false);
      return { success: false, error: error.message };
    }
  };

  const emailPasswordSignup = async (
    name,
    email,
    password,
    confirmPassword
  ) => {
    try {
      if (password !== confirmPassword) {
        throw new Error("Password and confirmation did not match.");
      }
      setUserLoading(true);

      if (useLiveRealm) {
        await app.emailPasswordAuth.registerUser({ email, password });
        await emailPasswordLogin(email, password);
        await setUserName(name);
        setUserLoading(false);
        return { success: true };
      }

      const newUser = {
        accountId: `user_${Date.now()}`,
        name: name || "Neighbor",
        email: email,
        neighborhood: INITIAL_USERS[0].neighborhood,
        bio: "Joined Neighborly to share and connect with my community.",
        lastActive: new Date(),
      };

      const userObj = createMockUserObject(newUser);
      setActiveMockUser(newUser);
      setUser(userObj);
      setUserLoading(false);
      return { success: true };
    } catch (error) {
      setUserLoading(false);
      return { success: false, error: error.message };
    }
  };

  const refreshUser = useCallback(async () => {
    if (useLiveRealm) {
      if (!app.currentUser) return false;
      try {
        setUserLoading(true);
        await app.currentUser.refreshCustomData();
        await app.currentUser.refreshAccessToken();
        app.currentUser.functions.logUserActive();
        setUser(app.currentUser);
        setUserLoading(false);
        return true;
      } catch (error) {
        setUserLoading(false);
        throw error;
      }
    }

    // Mock refresh
    const saved = getActiveMockUser();
    if (saved) {
      const userObj = createMockUserObject(saved);
      setUser(userObj);
      return true;
    }
    return false;
  }, [useLiveRealm, app]);

  const logOutUser = async () => {
    try {
      if (useLiveRealm && app.currentUser) {
        await app.currentUser.logOut();
      } else {
        removeActiveMockUser();
      }
      setUser(null);
      setUserLoading(false);
      return true;
    } catch (error) {
      throw error;
    }
  };

  const getValidAccessToken = async () => {
    if (useLiveRealm) {
      if (!app.currentUser) await app.logIn(Credentials.anonymous());
      else await app.currentUser.refreshAccessToken();
      return app.currentUser.accessToken;
    }
    return "mock-access-token";
  };

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  if (userLoading) return <Loading />;

  return (
    <UserContext.Provider
      value={{
        app,
        user,
        setUser,
        userLoading,
        setUserLoading,
        setUserName,
        setUserNeighborhood,
        refreshUser,
        emailPasswordLogin,
        emailPasswordSignup,
        loginAsDemo,
        logOutUser,
        getValidAccessToken,
        firebaseApp,
        firebaseStorage,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
