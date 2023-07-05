import { useContext, useEffect, useState } from "react";
import {
  ApolloClient,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import { APP_ID } from "../realm/constants";
import { UserContext } from "../contexts/UserContext";
import Loading from "components/Loading";

const ApolloWrapper = ({ children }) => {
  const [graphqlClient, setGraphqlClient] = useState(null);
  const { user, getValidAccessToken } = useContext(UserContext);

  useEffect(() => {
    const newApolloClient = new ApolloClient({
      link: new HttpLink({
        uri: `https://us-central1.gcp.realm.mongodb.com/api/client/v2.0/app/${APP_ID}/graphql`,
        fetch: async (uri, options) => {
          const accessToken = await getValidAccessToken();
          options.headers.Authorization = `Bearer ${accessToken}`;
          return fetch(uri, options);
        },
      }),
      cache: new InMemoryCache(),
    });
    setGraphqlClient(newApolloClient);
  }, [user, getValidAccessToken]);

  if (!graphqlClient) return <Loading />;

  return <ApolloProvider client={graphqlClient}>{children}</ApolloProvider>;
};

export default ApolloWrapper;
