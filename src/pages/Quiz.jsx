import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import ProgressBar from "../components/ProgressBar";
import { useAuth } from "../context/Authcontext";
import { useNavigate } from "react-router-dom";

const BANK = [
    {
        q: "Which process produces ATP in cellular respiration?",
        choices: ["Glycolysis", "Transcription", "Replication", "Translation"],
        answer: 0,
        explain: "Glycolysis and later steps (Krebs + ETC) generate ATP; transcription/translation are gene expression."
    },
    {
        q: "Derivative of sin(x) is…",
        choices: ["cos(x)", "-cos(x)", "sin(x)", "-sin(x)"],
        answer: 0,
        explain: "d/dx[sin x] = cos x."
    },
    {
        q: "In WWII, D-Day refers to…",
        choices: [
            "Attack on Pearl Harbor",
            "Allied invasion of Normandy",
            "Fall of Berlin",
            "Signing of the Treaty of Versailles"
        ],
        answer: 1,
        explain: "D-Day was the Allied invasion of Normandy, June 6, 1944."
    }
];

export default function Quiz() {
    const nav = useNavigate();
    const { addCoins } = useAuth();
    const [i, setI] = useState(0);
    const [picked, setPicked] = useState(null);
    const [answers, setAnswers] = useState([]);

    const total = BANK.length;
    const pct = useMemo(() => ((i) / total) * 100, [i, total]);

    const current = BANK[i];

    function pick(idx) {
        setPicked(idx);
    }

    function next() {
        if (picked == null) return;
        const correct = picked === current.answer;
        setAnswers(a => [...a, { pick: picked, correct }]);
        setPicked(null);

        if (i < total - 1) {
            setI(i + 1);
        } else {

            const score = Math.round(answers.concat({ correct }).filter(x => x.correct).length / total * 100);
            const reward = Math.max(5, Math.round(score / 10));
            addCoins(reward);
            nav("/quiz-feedback", {
                state: {
                    items: BANK.map((q, idx) => ({
                        q: q.q,
                        correct: (idx < answers.length ? answers[idx].correct : (picked === current.answer)),
                        why: q.explain,
                        your: (idx < answers.length ? q.choices[answers[idx].pick] : q.choices[picked]),
                        correctAns: q.choices[q.answer]
                    })),
                    score, reward
                }
            });
        }
    }

    return (
        <div className="container">
            <h2>🧪 Quick Quiz</h2>
            <Card tone="blue" subtitle={`Question ${i + 1} of ${total}`}>
                <div className="mt-sm"><ProgressBar value={pct} /></div>
                <h3 style={{ marginTop: 12 }}>{current.q}</h3>

                <div className="grid grid--2" style={{ marginTop: 12 }}>
                    {current.choices.map((c, idx) => {
                        const isSel = picked === idx;
                        return (
                            <button
                                key={idx}
                                onClick={() => pick(idx)}
                                className="choice"
                                aria-pressed={isSel}
                            >
                                <span className="choice__bullet">{String.fromCharCode(65 + idx)}</span>
                                <span>{c}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt">
                    <button className="btn btn--primary" disabled={picked == null} onClick={next}>
                        {i === total - 1 ? "Finish" : "Next"}
                    </button>
                </div>
            </Card>
        </div>
    );
}
