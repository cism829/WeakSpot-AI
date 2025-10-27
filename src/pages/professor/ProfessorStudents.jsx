import { useEffect, useState } from "react";
import Card from "../../components/Card";
import { getProfessor, upsertProfessor } from "../../lib/api";
import { useAuth } from "../../context/Authcontext";

export default function ProfessorDashboard() {
    const [prof, setProf] = useState(null);
    const [err, setErr] = useState("");
    const { user } = useAuth();
    const token = user?.token;
    const profId = user?.professor_id || user?.professorId || user?.id;

    useEffect(() => {
        async function load() {
            try {
                if (!profId) throw new Error("Missing professor id");
                const data = await getProfessor(profId, token);
                setProf(data || null);
            } catch (e) {
                // If profile missing, auto-create a blank one for this user, then refetch
                if (String(e?.message || "").includes("404")) {
                    try {
                        await upsertProfessor({ department: "", bio: "", courses: [], office_hours: [], rating: 0 }, token);
                        const data = await getProfessor(profId, token);
                        setProf(data || null);
                    } catch (e2) {
                        setErr(e2.message || "Failed to create professor profile");
                    }
                } else {
                    setErr(e.message || "Failed to load");
                }
            }
        }
        load();
    }, [profId, token]);

    return (
        <div className="container">
            <h2>👋 Welcome back, Professor!</h2>
            {err && <div className="error">{err}</div>}
            <div className="grid grid--3 mt">
                <Card tone="blue">
                    <h3>📘 Classes</h3>
                    <p className="stat__value">{prof?.courses?.length || 0} Active</p>
                </Card>
                <Card tone="green">
                    <h3>👨‍🎓 Students</h3>
                    <p className="stat__value">—</p>
                </Card>
                <Card tone="purple">
                    <h3>⭐ Rating</h3>
                    <p className="stat__value">{prof?.rating ?? 0}</p>
                </Card>
            </div>
            <Card tone="purple" className="mt">
                <h3>📢 Office Hours</h3>
                <ul className="list">
                    {(prof?.office_hours || []).map((o, i) => (
                        <li key={i}>{o.day} {o.start}-{o.end} @ {o.location}</li>
                    ))}
                    {!(prof?.office_hours || []).length && <li className="muted">None configured.</li>}
                </ul>
            </Card>
        </div>
    );
}
