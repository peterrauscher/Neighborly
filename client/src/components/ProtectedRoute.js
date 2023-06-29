import { useContext, useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { UserContext } from "../contexts/user.context";
import Loading from "./Loading";

const ProtectedRoute = () => {
  const { user, userLoading } = useContext(UserContext);
  const location = useLocation();
  const redirectOnLogin = encodeURI(location.pathname);

  useEffect(() => {}, [user, userLoading]);

  if (userLoading) return <Loading />;
  return user ? (
    <Outlet />
  ) : (
    <Navigate to={`/login?redirect=${redirectOnLogin}`} />
  );
};

export default ProtectedRoute;
