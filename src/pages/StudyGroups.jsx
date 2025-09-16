import React from "react";
import Card from "../components/Card";
import Tabs from "../components/Tabs";

export default function StudyGroups() {
    const myGroups = (
        <ul className="list">
            <li>AP Chem – Unit 3</li>
            <li>Calc II – Friday cram</li>
        </ul>
    );

    const publicGroups = (
        <ul className="list">
            <li>World History – open discussion</li>
            <li>Physics Problem Solving</li>
        </ul>
    );

    const recommended = (
        <ul className="list">
            <li>Biology – Genetics</li>
            <li>Statistics – Inference</li>
        </ul>
    );

    return (
        <div className="container">
            <h2>👥 Study Groups</h2>
            <Card tone="green">
                <Tabs
                    tabs={[
                        { label: "My Groups", content: myGroups },
                        { label: "Public", content: publicGroups },
                        { label: "Recommended", content: recommended },
                    ]}
                />
            </Card>
        </div>
    );
}
