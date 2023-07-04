import { createContext, useEffect, useState } from "react";
import { App, Credentials } from "realm-web";
import { APP_ID, ATLAS_SERVICE } from "../realm/constants";
import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

const app = new App(APP_ID);
export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [graphqlClient, setGraphqlClient] = useState(null);

  const updatedApolloClient = () => {
    return new ApolloClient({
      link: new HttpLink({
        uri: `https://us-central1.gcp.realm.mongodb.com/api/client/v2.0/app/${APP_ID}/graphql`,
        fetch: async (uri, options) => {
          await app.currentUser.refreshAccessToken();
          options.headers.Authorization = `Bearer ${app.currentUser.accessToken}`;
          return fetch(uri, options);
        },
      }),
      cache: new InMemoryCache(),
    });
  };

  const emailPasswordLogin = async (email, password) => {
    try {
      setUserLoading(true);
      const authedUser = await app.logIn(
        Credentials.emailPassword(email, password)
      );
      console.assert(authedUser.id === app.currentUser.id);
      setUser(app.currentUser);
      const client = updatedApolloClient();
      setGraphqlClient(client);
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
      await app.currentUser.refreshAccessToken();
      setUser(app.currentUser);
      const client = updatedApolloClient();
      setGraphqlClient(client);
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
      setGraphqlClient(null);
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
        graphqlClient,
        setGraphqlClient,
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
