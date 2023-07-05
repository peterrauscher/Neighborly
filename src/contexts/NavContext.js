import { createContext, useEffect, useState } from "react";
import { useLocation } from "react-router";

export const NavContext = createContext(null);

export const NavProvider = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isNavActive, setIsNavActive] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsNavActive(false);
    switch (location.pathname.toLowerCase()) {
      case "/feed":
        document.body.classList.add("not-scrollable");
        document.documentElement.classList.add("not-scrollable");
        document.body.classList.remove("has-navbar-fixed-top");
        break;
      default:
        document.body.classList.remove("not-scrollable");
        document.documentElement.classList.remove("not-scrollable");
        document.body.classList.add(
          "has-navbar-fixed-top",
          "has-background-green"
        );
    }
  }, [location.pathname]);

  return (
    <NavContext.Provider
      value={{
        isMobile,
        setIsMobile,
        isNavActive,
        setIsNavActive,
      }}
    >
      {children}
    </NavContext.Provider>
  );
};
