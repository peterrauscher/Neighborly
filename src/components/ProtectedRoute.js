import { useContext, useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import { Outlet } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";
import Loading from "./Loading";

const ProtectedRoute = () => {
  const { user, userLoading } = useContext(UserContext);
  const location = useLocation();
  const redirectOnLogin = encodeURI(location.pathname);

  if (userLoading) return <Loading />;
  else {
    return user ? (
      <Outlet />
    ) : (
      <Navigate to={`/login?redirect=${redirectOnLogin}`} />
    );
  }
};

export default ProtectedRoute;
