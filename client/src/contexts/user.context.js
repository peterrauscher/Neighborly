import { createContext, useEffect, useState } from "react";
import { App, Credentials } from "realm-web";
import {
  APP_ID,
  ATLAS_SERVICE,
  CUSTOM_USER_DATA_COLLECTION,
  DATABASE_NAME,
} from "../realm/constants";

const app = new App(APP_ID);
export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(false);
  const [mongoClient, setMongoClient] = useState(null);
  const [userCollection, setUserCollection] = useState(null);

  const emailPasswordLogin = async (email, password) => {
    try {
      setUserLoading(true);
      const authedUser = await app.logIn(
        Credentials.emailPassword(email, password)
      );
      console.assert(authedUser.id === app.currentUser.id);
      setUser(app.currentUser);
      let newMongoClient = app.currentUser.mongoClient(ATLAS_SERVICE);
      setMongoClient(newMongoClient);
      setUserCollection(
        newMongoClient.db(DATABASE_NAME).collection(CUSTOM_USER_DATA_COLLECTION)
      );
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
      setUserLoading(true);
      await app.emailPasswordAuth.registerUser({ email, password });
      await emailPasswordLogin(email, password);
      // await addUserMetadata(name, registerDate, registerIP);
      setUserLoading(false);
      return { success: true };
    } catch (error) {
      setUserLoading(false);
      return { success: false, error: error.message };
    }
  };

  const fetchUser = async () => {
    setUserLoading(true);
    if (!app.currentUser) return false;
    try {
      await app.currentUser.refreshCustomData();
      setUser(app.currentUser);
      let newMongoClient = app.currentUser.mongoClient(ATLAS_SERVICE);
      setMongoClient(newMongoClient);
      setUserCollection(
        newMongoClient.db(DATABASE_NAME).collection(CUSTOM_USER_DATA_COLLECTION)
      );
      setUserLoading(false);
      return app.currentUser;
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
      setUserCollection(null);
      setMongoClient(null);
      return true;
    } catch (error) {
      throw error;
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        userLoading,
        setUserLoading,
        fetchUser,
        emailPasswordLogin,
        emailPasswordSignup,
        logOutUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
