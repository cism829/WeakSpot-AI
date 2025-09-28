
import { useAuth } from "../context/Authcontext";
import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { authRegister, authMe } from "../lib/api";

function Register() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        username: "",
        first_name: "",
        last_name: "",
        email: "",
        password: ""
    });
    const [err, setErr] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        setErr("");
        setSubmitting(true);
        try {
        await authRegister(form); // expect 200/201; no token needed
        setForm({
            username: "",
            first_name: "",
            last_name: "",
            email: "",
            password: ""
        });
        // redirect to login and pass a flag to show a success message there
        navigate("/login", { state: { registered: true, emailPrefill: form.email } });
        } catch (e) {
        setErr(e.message || "Registration failed");
        } finally {
        setSubmitting(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-card">
                <h2>Create account</h2>
                {err && <div className="error">{err}</div>}
                <form onSubmit={onSubmit} className="form">
                    <label className="field">
                        <span>Username</span>
                        <input value={form.username} onChange={e=>setForm({...form, username:e.target.value})} required />
                    </label>
                    <label className="field">
                        <span>First name</span>
                        <input value={form.first_name} onChange={e=>setForm({...form, first_name:e.target.value})} required />
                    </label>
                    <label className="field">
                        <span>Last name</span>
                        <input value={form.last_name} onChange={e=>setForm({...form, last_name:e.target.value})} required />
                    </label>
                    <label className="field">
                        <span>Email</span>
                        <input type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required />
                    </label>
                    <label className="field">
                        <span>Password</span>
                        <input type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} required />
                    </label>
                    <button className="btn btn--primary">Register</button>
                    <p className="muted mt">Already have an account? <Link to="/login">Sign in</Link></p>
                </form>
            </div>
        </div>
    );
}
export default Register;


