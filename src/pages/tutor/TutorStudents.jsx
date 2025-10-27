import Card from "../../components/Card";

export default function TutorStudents() {
    return (
        <div className="container">
            <h2>👨‍🎓 My Students</h2>
            <p>View and monitor the progress of your assigned students.</p>
            <Card tone="purple">
                <div className="table mt">
                    <div className="table__head">
                        <div>Name</div>
                        <div>Subject</div>
                        <div>Progress</div>
                    </div>
                    <div className="table__row">
                        <div>Alex Johnson</div>
                        <div>Math</div>
                        <div>85%</div>
                    </div>
                    <div className="table__row">
                        <div>Sara Lee</div>
                        <div>English</div>
                        <div>92%</div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
