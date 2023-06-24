import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import Feed from "./components/feed/Feed";
import FeedLayout from "./components/feed/FeedLayout";
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
  {
    path: "feed",
    element: <FeedLayout />,
    errorElement: <DefaultErrorPage />,
    children: [{ index: true, element: <Feed /> }],
  },
]);

export default router;
