function Home() {
    return (
        <div className="container">
            <section className="hero">
                <h1>Study smarter, together.</h1>
                <p className="hero__subtitle">
                    Upload notes, generate flashcards & quizzes, track progress, and join study groups — all powered by AI.
                </p>
                <div className="hero__cta">
                    <a href="/register" className="btn btn--primary">Get Started</a>
                    <a href="/login" className="btn btn--primary">Login</a>
                </div>
            </section>

            <div className="grid grid--3 mt">
                <div className="card card--blue">
                    <div className="card__head">
                        <h3 className="card__title">📄 Notes & OCR</h3>
                        <p className="card__subtitle">Store, search, analyze</p>
                    </div>
                    <div className="card__body">
                        Upload typed or handwritten notes. OCR extracts text and powers search & study tools.
                    </div>
                </div>

                <div className="card card--purple">
                    <div className="card__head">
                        <h3 className="card__title">🧠 Flashcards & Quizzes</h3>
                        <p className="card__subtitle">AI-generated</p>
                    </div>
                    <div className="card__body">
                        Turn notes into personalized flashcards and quizzes. Difficulty adapts as you learn.
                    </div>
                </div>

                <div className="card card--green">
                    <div className="card__head">
                        <h3 className="card__title">📊 Progress & Leaderboards</h3>
                        <p className="card__subtitle">Stay motivated</p>
                    </div>
                    <div className="card__body">
                        Track improvements, earn StudyCoins, and climb the leaderboard.
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
