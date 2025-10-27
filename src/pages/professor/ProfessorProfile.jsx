export default function ProfessorProfile() {
    return (
        <div className="container">
            <h2>👤 Professor Profile</h2>

            <form className="form mt">
                <div className="field">
                    <span>Name</span>
                    <input value="Dr. Alex Johnson" />
                </div>
                <div className="field">
                    <span>Title / Department</span>
                    <input value="Professor of Computer Science" />
                </div>
                <div className="field">
                    <span>Email</span>
                    <input value="alex.johnson@university.edu" />
                </div>
                <div className="field">
                    <span>Office Hours</span>
                    <input value="Mon & Wed 2–4pm" />
                </div>
                <div className="field">
                    <span>Bio</span>
                    <textarea rows={3} value="Dedicated educator passionate about AI and data science." />
                </div>

                <button className="btn btn--primary">Save Changes</button>
            </form>
        </div>
    );
}
