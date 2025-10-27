import React from "react";
import Card from "../components/Card";
import { useAuth } from "../context/Authcontext";

export default function Profile() {
    const { user } = useAuth();
    return (
        <div className="container">
            <h2>👤 Profile</h2>
            <Card tone="purple">
                <div className="profile">
                    <div className="avatar">🙂</div>
                    <div>
                        <div><strong>Name:</strong> {user?.name || "Student"}</div>
                        <div><strong>Email:</strong> {user?.email || "student@example.com"}</div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
