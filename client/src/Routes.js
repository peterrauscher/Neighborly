import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import DefaultErrorPage from "./pages/DefaultErrorPage";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <DefaultErrorPage />,
    children: [
      { index: true, element: <Home /> },
      { path: "register", element: <SignUp /> },
      { path: "login", element: <Login /> },
    ],
  },
]);

export default router;
