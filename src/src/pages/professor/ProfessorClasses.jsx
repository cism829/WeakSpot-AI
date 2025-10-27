import { useState } from "react";
import Card from "../../components/Card";

export default function ProfessorClasses() {
    const [classes, setClasses] = useState([
        { id: 1, title: "Intro to Psychology", description: "Understanding human behavior", students: 25 },
        { id: 2, title: "Advanced Calculus", description: "Differential equations and more", students: 18 },
    ]);

    const [newClass, setNewClass] = useState({ title: "", description: "" });
    const [showForm, setShowForm] = useState(false);

    const addClass = (e) => {
        e.preventDefault();
        setClasses([...classes, { ...newClass, id: Date.now(), students: 0 }]);
        setNewClass({ title: "", description: "" });
        setShowForm(false);
    };

    return (
        <div className="container">
            <h2>📘 My Classes</h2>
            <button className="btn btn--primary mt" onClick={() => setShowForm(!showForm)}>
                {showForm ? "Cancel" : "+ Create Class"}
            </button>

            {showForm && (
                <form className="form mt" onSubmit={addClass}>
                    <div className="field">
                        <span>Class Title</span>
                        <input
                            value={newClass.title}
                            onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="field">
                        <span>Description</span>
                        <input
                            value={newClass.description}
                            onChange={(e) => setNewClass({ ...newClass, description: e.target.value })}
                            required
                        />
                    </div>
                    <button className="btn btn--primary">Create</button>
                </form>
            )}

            <div className="grid grid--2 mt">
                {classes.map((cls) => (
                    <Card key={cls.id} tone="blue">
                        <h3>{cls.title}</h3>
                        <p>{cls.description}</p>
                        <p className="muted">{cls.students} students</p>
                    </Card>
                ))}
            </div>
        </div>
    );
}
