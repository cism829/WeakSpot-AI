import React from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/Authcontext";

export default function Layout({ children }) {
    const { user } = useAuth();

    return (
        <div className="flex h-screen bg-gray-100">

            {user && (
                <aside className="w-64 bg-gradient-to-b from-indigo-600 to-purple-600 text-white shadow-lg">
                    <Sidebar />
                </aside>
            )}


            <div className="flex flex-col flex-1">
                <Navbar />
                <main className="flex-1 p-6 overflow-y-auto">{children}</main>
            </div>
        </div>
    );
}
