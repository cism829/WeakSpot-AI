import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";
import { getMyExams, startExamById } from "../lib/api";

export default function Exam() {
    const nav = useNavigate();
    const { user, setUser } = useAuth();
    const [data, setData] = useState({ pending: [], started: [], completed: [], coins_balance: 0, exam_cost: 5 });
    const [err, setErr] = useState("");

    async function load() {
        try {
            const d = await getMyExams();
            setData(d);
            // keep coins in sync in the header
            if (user && typeof d.coins_balance === "number") setUser({ ...user, coins_balance: d.coins_balance });
        } catch (e) {
            setErr(e?.message || "Failed to load exams.");
        }
    }

    useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

    async function onStart(id) {
        try {
            const resp = await startExamById(id);
            setUser({ ...user, coins_balance: resp.coins_balance });
            // go take the exam
            nav(`/quiz/${id}`);
        } catch (e) {
            alert(e?.message || "Unable to start exam.");
            await load();
        }
    }

    const canStart = (balance) => balance >= (data.exam_cost || 5);

    if (err) return <div className="container"><Card tone="red">{err}</Card></div>;

    return (
        <div className="container">
            <h2>Final Exams</h2>
            <div className="muted" style={{ marginBottom: 8 }}>
                Cost per exam: {data.exam_cost} • Your balance: {user?.coins_balance ?? data.coins_balance ?? 0}
            </div>

            <div className="grid grid--3">
                <Card title="Pending">
                    {data.pending.length === 0 && <div className="muted">No pending exams.</div>}
                    {data.pending.map((e) => (
                        <div className="table__row" key={e.id}>
                            <div className="grow"><b>{e.title}</b> <span className="muted">· {e.difficulty}</span></div>
                            <button
                                className="btn"
                                disabled={!canStart(user?.coins_balance ?? data.coins_balance ?? 0)}
                                onClick={() => onStart(e.id)}
                            >
                                Start (−{data.exam_cost})
                            </button>
                        </div>
                    ))}
                </Card>

                <Card title="Started">
                    {data.started.length === 0 && <div className="muted">None.</div>}
                    {data.started.map((e) => (
                        <div className="table__row" key={e.id}>
                            <div className="grow"><b>{e.title}</b> <span className="muted">· {e.difficulty}</span></div>
                            <button className="btn" onClick={() => nav(`/quiz/${e.id}`)}>Resume</button>
                        </div>
                    ))}
                </Card>

                <Card title="Completed">
                    {data.completed.length === 0 && <div className="muted">None.</div>}
                    {data.completed.map((e) => (
                        <div className="table__row" key={e.id}>
                            <div className="grow"><b>{e.title}</b> <span className="muted">· {e.difficulty}</span></div>
                            <div className="muted">Finished</div>
                        </div>
                    ))}
                </Card>
            </div>
        </div>
    );
}
