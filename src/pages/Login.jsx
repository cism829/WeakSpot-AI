
import React, { useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { useNavigate, Link } from "react-router-dom";
import { authLogin, authMe } from "../lib/api";

export default function Login() {
    const { login } = useAuth();
    const nav = useNavigate();
    const [username_or_email, setUser] = useState("");
    const [password, setPwd] = useState("");
    const [err, setErr] = useState("");

    async function onSubmit(e) {
        e.preventDefault();
        setErr("");
        try{
            const tok = await authLogin({ username_or_email, password });
            const me = await authMe(tok.access_token);
            login(me, tok.access_token);
            nav("/dashboard");
        }catch(e){
            setErr(e.message || "Login failed");
        }
    }

    return (
        <div className="page-center">
            <Card title="Welcome back">
                {err && <div className="error">{err}</div>}
                <form onSubmit={onSubmit} className="form">
                    <label className="field">
                        <span>Username or Email</span>
                        <input value={username_or_email} onChange={(e) => setUser(e.target.value)} required />
                    </label>
                    <label className="field">
                        <span>Password</span>
                        <input type="password" value={password} onChange={(e) => setPwd(e.target.value)} required />
                    </label>
                    <button className="btn btn--primary">Login</button>
                </form>
                <p className="muted mt">No account? <Link to="/register">Create one</Link></p>
            </Card>
        </div>
    );
}


