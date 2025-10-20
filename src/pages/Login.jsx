import React, { useState } from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
    const { login } = useAuth();
    const nav = useNavigate();
    const [email, setEmail] = useState("");
    const [pwd, setPwd] = useState("");

    function onSubmit(e) {
        e.preventDefault();
        login({ name: "Alex", email });
        nav("/progress");
    }

    return (
        <div className="container container--narrow">
            <Card title="Welcome back 👋" subtitle="Log in to continue" tone="blue">
                <form onSubmit={onSubmit} className="form">
                    <label className="field">
                        <span>Email</span>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </label>
                    <label className="field">
                        <span>Password</span>
                        <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
                    </label>
                    <button className="btn btn--primary">Login</button>
                </form>
                <p className="muted mt">No account? <Link to="/register">Create one</Link></p>
            </Card>
        </div>
    );
}
