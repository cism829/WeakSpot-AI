import { createContext, useState, useContext, useEffect, useMemo, useCallback } from "react";
import { authMe, authLogin, authLogout } from "../lib/api";

export let globalLink = "/dashboard";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; }
    });
    const [loading, setLoading] = useState(true);
    const isLoggedIn = !!user;

    // Hydrate on mount
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const me = await authMe();
                if (!alive) return;
                setUser(me);
                localStorage.setItem("user", JSON.stringify(me));
            } catch {
                // not logged in
                setUser(null);
                localStorage.removeItem("user");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    const login = useCallback(async (username_or_email, password) => {
        const data = await authLogin(username_or_email, password);
        setUser(data);
        localStorage.setItem("user", JSON.stringify(data));
        return data;
    }, []);

    const logout = useCallback(async () => {
        try { await authLogout(); } finally {
            setUser(null);
            localStorage.removeItem("user");
        }
    }, []);

    const value = useMemo(() => ({ user, isLoggedIn, loading, login, logout, setUser }), [user, isLoggedIn, loading, login, logout]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        console.error("AuthContext not found");
        throw new Error("useAuth must be used within AuthProvider");
    }
    console.log("AuthContext:", ctx);
    return ctx;
}
