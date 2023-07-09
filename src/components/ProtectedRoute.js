import { useContext } from "react";
import { Navigate, useLocation } from "react-router";
import { Outlet } from "react-router-dom";
import { UserContext } from "../contexts/UserContext";

const ProtectedRoute = () => {
  const { user } = useContext(UserContext);
  const location = useLocation();
  const redirectOnLogin = encodeURI(location.pathname);

  return user ? (
    <Outlet />
  ) : (
    <Navigate to={`/login?redirect=${redirectOnLogin}`} />
  );
};

export default ProtectedRoute;
