import { createContext, useEffect, useState } from "react";
import { useLocation } from "react-router";

export const NavContext = createContext();

export const NavProvider = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isNavActive, setIsNavActive] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsNavActive(false);
    switch (location.pathname.toLowerCase()) {
      case "/feed":
        document.body.classList.remove(
          "has-background-green",
          "has-navbar-fixed-top"
        );
        break;
      default:
        document.body.classList.add(
          "has-background-green",
          "has-navbar-fixed-top"
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
