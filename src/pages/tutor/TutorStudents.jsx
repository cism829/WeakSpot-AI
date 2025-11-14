import { useEffect, useState } from "react";
import { useAuth } from "../../context/Authcontext";
import { listTutorStudents } from "../../lib/api";
import Card from "../../components/Card";

export default function TutorStudents() {
    const { user } = useAuth();
    const token = user?.token;

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }

        (async () => {
            setErr("");
            setLoading(true);
            try {
                const data = await listTutorStudents(token);
                setStudents(data || []);
            } catch (e) {
                setErr(e.message || "Failed to load students.");
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    return (
        <div className="container">
            <h2>👨‍🎓 My Students</h2>
            <p>Students who requested a session and were accepted by you.</p>

            <Card tone="purple">
                {err && <div className="error mt">{err}</div>}

                {loading ? (
                    <div className="muted mt">Loading students…</div>
                ) : !students.length ? (
                    <div className="muted mt">
                        You don&apos;t have any students yet.
                        Go to the <strong>Requests</strong> page and accept a request to see them here.
                    </div>
                ) : (
                    <div className="table mt">
                        <div className="table__head">
                            <div>Name</div>
                            <div>Email</div>
                            <div>Connected since</div>
                        </div>

                        {students.map((row) => {
                            const s = row.student || {};
                            return (
                                <div className="table__row" key={row.connection_id}>
                                    <div>
                                        {s.first_name} {s.last_name}
                                    </div>
                                    <div>{s.email}</div>
                                    <div>
                                        {row.since
                                            ? new Date(row.since).toLocaleString()
                                            : "—"}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
}
