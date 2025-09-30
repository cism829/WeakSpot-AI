import { createContext, useState, useContext, useEffect, useMemo, useCallback } from "react";
import { authMe, authLogin, authLogout } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem("user")) || null; } catch { return null; }
    });    const [loading, setLoading] = useState(true);
    const isLoggedIn = !!user;

    // On mount: hydrate from cookie via /auth/me
    useEffect(() => {
        (async () => {
            try {
                const me = await authMe();
                setUser(me);
                localStorage.setItem("user", JSON.stringify(me));

            } catch {
                setUser(null);
                localStorage.removeItem("user");

            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const login = useCallback(async (username_or_email, password) => {
        await authLogin({ username_or_email, password });
        const me = await authMe();
        setUser(me);
        localStorage.setItem("user", JSON.stringify(data));

        return me;
    }, []);

    const logout = useCallback(async () => {
        try { await authLogout(); } catch { }
        setUser(null);
        localStorage.removeItem("user");
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
