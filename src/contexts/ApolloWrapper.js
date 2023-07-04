import { useContext } from "react";
import { ApolloProvider } from "@apollo/client";
import { UserContext } from "../contexts/UserContext";
import Loading from "components/Loading";

const ApolloWrapper = ({ children }) => {
  const { graphqlClient } = useContext(UserContext);

  if (!graphqlClient) return <Loading />;

  return <ApolloProvider client={graphqlClient}>{children}</ApolloProvider>;
};

export default ApolloWrapper;
