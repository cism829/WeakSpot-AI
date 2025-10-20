import { useAuth } from "../context/Authcontext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

function Register() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        grade: "",
        role: "",
        subjects: [],
    });

    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const subjects = ["Math", "Science", "History", "English", "Computer Science"];

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const toggleSubject = (subject) => {
        setSelectedSubjects((prev) =>
            prev.includes(subject)
                ? prev.filter((s) => s !== subject)
                : [...prev, subject]
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const userData = {
            name: form.name,
            email: form.email,
            grade: form.grade,
            role: form.role,
            subjects: selectedSubjects,
        };

        login(userData);

        // Redirect based on role
        if (form.role === "Professor") {
            navigate("/professor/dashboard");
        } else if (form.role === "Tutor") {
            navigate("/tutor/dashboard");
        } else {
            navigate("/dashboard");
        }
    };


    return (
        <div className="auth-page">
            <div className="auth-card">
                <h2>Create Account</h2>
                <form onSubmit={handleSubmit} className="form">
                    <div className="field">
                        <span>Name</span>
                        <input name="name" value={form.name} onChange={handleChange} required />
                    </div>
                    <div className="field">
                        <span>Email</span>
                        <input type="email" name="email" value={form.email} onChange={handleChange} required />
                    </div>
                    <div className="field">
                        <span>Password</span>
                        <input type="password" name="password" value={form.password} onChange={handleChange} required />
                    </div>
                    <div className="field">
                        <span>Grade Level</span>
                        <select name="grade" value={form.grade} onChange={handleChange} required>
                            <option value="">Select...</option>
                            <option value="Middle School">Middle School</option>
                            <option value="High School">High School</option>
                            <option value="College">College</option>
                        </select>
                    </div>
                    <div className="field">
                        <span>Role</span>
                        <select name="role" value={form.role} onChange={handleChange} required>
                            <option value="">Select...</option>
                            <option value="Student">Student</option>
                            <option value="Professor">Professor</option>
                            <option value="Tutor">Tutor</option>
                        </select>
                    </div>


                    <div className="field">
                        <span>Subjects</span>
                        <div className="subjects">
                            {subjects.map((subject) => (
                                <button
                                    key={subject}
                                    type="button"
                                    className={`subject-pill ${selectedSubjects.includes(subject) ? "selected" : ""}`}
                                    onClick={() => toggleSubject(subject)}
                                >
                                    {subject}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button className="btn btn--primary">Register</button>
                </form>
            </div>
        </div>
    );
}

export default Register;
