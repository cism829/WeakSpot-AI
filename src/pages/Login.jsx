import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/Authcontext";

export default function Login() {
    const nav = useNavigate();
    const { login } = useAuth();
    const [username_or_email, setUser] = useState("");
    const [password, setPwd] = useState("");
    const [err, setErr] = useState("");

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr("");
        try {
            await login(username_or_email, password);
            nav("/");
        } catch (e) {
            setErr(e.message || "Login failed");
        }
    };

    return (
        <div className="page">
            <h1>Login</h1>
            <form onSubmit={onSubmit}>
                {err && <div className="error">{err}</div>}
                <label>
                    <span>Username or Email</span>
                    <input value={username_or_email} onChange={(e) => setUser(e.target.value)} required />
                </label>
                <label>
                    <span>Password</span>
                    <input type="password" value={password} onChange={(e) => setPwd(e.target.value)} required />
                </label>
                <button>Login</button>
            </form>
        </div>
    );
}
