import Card from "../../components/Card";

export default function ProfessorStudents() {
    const students = [
        { id: 1, name: "John Doe", class: "Intro to Psychology", progress: 80, lastActive: "2d ago" },
        { id: 2, name: "Jane Smith", class: "Advanced Calculus", progress: 92, lastActive: "1h ago" },
    ];

    return (
        <div className="container">
            <h2>👨‍🎓 Students Progress</h2>

            <Card tone="blue" className="mt">
                <div className="table">
                    <div className="table__head">
                        <div>Name</div><div>Class</div><div>Progress</div><div>Last Active</div>
                    </div>
                    {students.map((s) => (
                        <div className="table__row" key={s.id}>
                            <div>{s.name}</div>
                            <div>{s.class}</div>
                            <div>{s.progress}%</div>
                            <div>{s.lastActive}</div>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
