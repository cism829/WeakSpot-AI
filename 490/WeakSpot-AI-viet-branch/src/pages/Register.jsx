import { useNavigate, Link } from "react-router-dom";
import { useState } from "react";
import { authRegister } from "../lib/api";
import { ROLES, GRADE_LEVELS } from "../lib/grades";

function Register() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        username: "",
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        grade_level: GRADE_LEVELS?.[0] ?? "Other", 
        role: ROLES?.[0] ?? "student",             
    });
    const [err, setErr] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // ✅ shared change handler for inputs/selects
    const onChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    async function onSubmit(e) {
        e.preventDefault();
        setErr("");
        setSubmitting(true);
        try {
            await authRegister(form);
            setForm({
                username: "",
                first_name: "",
                last_name: "",
                email: "",
                password: "",
                grade_level: GRADE_LEVELS?.[0] ?? "Other",
                role: ROLES?.[0] ?? "student",
            });
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
                        <input name="username" value={form.username} onChange={onChange} required />
                    </label>
                    <label className="field">
                        <span>First name</span>
                        <input name="first_name" value={form.first_name} onChange={onChange} required />
                    </label>
                    <label className="field">
                        <span>Last name</span>
                        <input name="last_name" value={form.last_name} onChange={onChange} required />
                    </label>
                    <label className="field">
                        <span>Email</span>
                        <input type="email" name="email" value={form.email} onChange={onChange} required />
                    </label>

                    <label className="field">
                        <span>Grade Level</span>
                        <select name="grade_level" value={form.grade_level} onChange={onChange} required>
                            {/* Optional placeholder:
              <option value="" disabled>Choose grade level…</option> */}
                            {GRADE_LEVELS.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span>Role (e.g., student, professor, tutor)</span>
                        <select name="role" value={form.role} onChange={onChange} required>
                            {/* Optional placeholder:
              <option value="" disabled>Choose role…</option> */}
                            {ROLES.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span>Password</span>
                        <input type="password" name="password" value={form.password} onChange={onChange} required />
                    </label>

                    <button disabled={submitting} className="btn btn--primary">
                        {submitting ? "Registering…" : "Register"}
                    </button>
                    <p className="muted mt">
                        Already have an account? <Link to="/login">Sign in</Link>
                    </p>
                </form>
            </div>
        </div>
    );
}

export default Register;
