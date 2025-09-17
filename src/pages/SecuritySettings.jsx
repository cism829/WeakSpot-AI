import React from "react";
import Card from "../components/Card";

export default function SecuritySettings() {
    return (
        <div className="container">
            <h2>🔒 Security Settings</h2>
            <Card title="Privacy" tone="blue">
                <label className="switch">
                    <input type="checkbox" defaultChecked />
                    <span>Enable 2FA (stub)</span>
                </label>
                <label className="switch">
                    <input type="checkbox" />
                    <span>Show profile publicly</span>
                </label>
                <button className="btn btn--primary mt">Save Settings</button>
            </Card>
        </div>
    );
}
