import { createBrowserRouter } from "react-router-dom";
import Feed from "./components/Feed";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    // errorElement: <DefaultErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: "register", element: <SignUp /> },
      { path: "login", element: <Login /> },
      {
        path: "feed",
        element: (
          <ProtectedRoute>
            <Feed />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);

export default router;
