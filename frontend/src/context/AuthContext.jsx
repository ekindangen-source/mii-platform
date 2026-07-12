import { createContext, useContext, useEffect, useState } from "react";

import {
  login as loginService,
  logout as logoutService,
  getCurrentUser,
  verifySession,
} from "../services/auth";

const AuthContext = createContext();

export function AuthProvider({ children }) {

  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {

    async function initialize() {

      const storedUser = getCurrentUser();

      if (storedUser) {

        setUser(storedUser);

        const verifiedUser = await verifySession();

	if (!verifiedUser) {
	    setUser(null);
	}
      }

      setLoading(false);

    }

    initialize();

  }, []);

  async function login(email, password) {

    const loggedInUser =
      await loginService(email, password);

    setUser(loggedInUser);

  }

  function logout() {

    logoutService();

    setUser(null);

  }

  return (

    <AuthContext.Provider
      value={{

        user,

        login,

        logout,

        loading,

        isAuthenticated: !!user

      }}
    >

      {children}

    </AuthContext.Provider>

  );

}

export function useAuth() {

  return useContext(AuthContext);

}
