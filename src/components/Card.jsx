import React from "react";
export default function Card({ title, subtitle, children, footer, tone = "default" }) {
    return (
        <section className={`card card--${tone}`}>
            {(title || subtitle) && (
                <header className="card__head">
                    {title && <h3 className="card__title">{title}</h3>}
                    {subtitle && <p className="card__subtitle">{subtitle}</p>}
                </header>
            )}
            <div className="card__body">{children}</div>
            {footer && <footer className="card__foot">{footer}</footer>}
        </section>
    );
}
