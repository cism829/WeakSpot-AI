import Card from "../../components/Card";

export default function ProfessorDashboard() {
    return (
        <div className="container">
            <h2>👋 Welcome back, Professor!</h2>
            <p className="muted">Here’s what’s happening in your classes today.</p>

            <div className="grid grid--3 mt">
                <Card tone="blue">
                    <h3>📘 Classes</h3>
                    <p className="stat__value">3 Active</p>
                </Card>

                <Card tone="green">
                    <h3>👨‍🎓 Students</h3>
                    <p className="stat__value">48 Enrolled</p>
                </Card>

                <Card tone="purple">
                    <h3>📄 Materials</h3>
                    <p className="stat__value">27 Uploaded</p>
                </Card>
            </div>

            <Card tone="purple" className="mt">
                <h3>📢 Recent Announcements</h3>
                <ul className="list">
                    <li>Midterm review on Friday</li>
                    <li>Study guide “Exam Prep 2” uploaded</li>
                    <li>New assignment due next week</li>
                </ul>
            </Card>
        </div>
    );
}
