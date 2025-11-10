import Card from "../../components/Card";

export default function ProfessorMaterials() {
    const materials = [
        { id: 1, title: "Lecture 1 Notes.pdf", uploaded: "Oct 10, 2025" },
        { id: 2, title: "Exam Review Guide.pdf", uploaded: "Oct 7, 2025" },
    ];

    return (
        <div className="container">
            <h2>📄 Course Materials</h2>

            <div className="field mt">
                <span>Select Class</span>
                <select>
                    <option>Intro to Psychology</option>
                    <option>Advanced Calculus</option>
                </select>
            </div>

            <div className="uploader mt">Drag or click to upload materials</div>

            <div className="grid mt">
                {materials.map((m) => (
                    <Card key={m.id} tone="green">
                        <h4>{m.title}</h4>
                        <p className="muted">Uploaded {m.uploaded}</p>
                    </Card>
                ))}
            </div>
        </div>
    );
}
