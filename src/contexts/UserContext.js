import { createContext, useEffect, useState } from "react";
import { App, Credentials } from "realm-web";
import { APP_ID } from "../realm/constants";
import Loading from "../components/Loading";

const app = new App(APP_ID);
export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);

  const setUserName = async (name) => {
    try {
      if (!app.currentUser)
        throw new Error("User is not logged in, cannot add username.");
      const result = await app.currentUser.functions.setName(name);
      await app.currentUser.refreshCustomData();
      if (!result.success) throw new Error(result.error);
      return { success: true };
    } catch (err) {
      console.error(err);
      return { succccess: false, error: err.message };
    }
  };

  const setUserNeighborhood = async (neighborhood) => {
    try {
      if (!app.currentUser)
        throw new Error("User is not logged in, cannot change neighborhood.");
      const result = await app.currentUser.functions.setNeighborhood(
        neighborhood
      );
      await app.currentUser.refreshCustomData();
      if (!result.success) throw new Error(result.error);
      return { success: true };
    } catch (err) {
      console.error(err);
      return { succccess: false, error: err.message };
    }
  };

  const emailPasswordLogin = async (email, password) => {
    try {
      setUserLoading(true);
      await app.logIn(Credentials.emailPassword(email, password));
      await app.currentUser.refreshCustomData();
      app.currentUser.functions.logUserActive();
      setUser(app.currentUser);
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
      if (password !== confirmPassword)
        throw new Error("Password and confirmation did not match.");
      setUserLoading(true);
      await app.emailPasswordAuth.registerUser({ email, password });
      await emailPasswordLogin(email, password);
      await setUserName(name);
      setUserLoading(false);
      return { success: true };
    } catch (error) {
      setUserLoading(false);
      return { success: false, error: error.message };
    }
  };

  const refreshUser = async () => {
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
  };

  const logOutUser = async () => {
    if (!app.currentUser) return false;
    try {
      await app.currentUser.logOut();
      setUser(null);
      setUserLoading(false);
      return true;
    } catch (error) {
      throw error;
    }
  };

  const getValidAccessToken = async () => {
    if (!app.currentUser) {
      await app.logIn(Credentials.anonymous());
    } else {
      await app.currentUser.refreshAccessToken();
    }
    return app.currentUser.accessToken;
  };

  useEffect(() => {
    refreshUser();
  }, []);

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
        logOutUser,
        getValidAccessToken,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
