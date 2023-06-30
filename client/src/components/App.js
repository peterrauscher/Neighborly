import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { UserProvider } from "../contexts/user.context.js";
import Home from "../pages/Home";
import Feed from "../pages/Feed";
import ProtectedRoute from "../components/ProtectedRoute";
import Login from "../pages/Login";
import Register from "../pages/Register";
import DefaultErrorPage from "../pages/DefaultErrorPage";
import Layout from "../components/Layout";

const App = () => {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<DefaultErrorPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/feed" element={<Feed />} />
          </Route>
        </Routes>
      </Router>
    </UserProvider>
  );
};

export default App;
