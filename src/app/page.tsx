'use client';

import React from 'react';
import Link from 'next/link';
import Globe from '@/components/Globe';

export default function Home() {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="wrap">
      {/* HEADER */}
      <header className="tech-header">
        <Link href="/" className="brand">
          <div className="logo-circle">
            <img src="/logo.png" alt="technosavvys logo" />
          </div>
          <div className="brand-div" />
          <div>
            <h2>technosavvys</h2>
            <p>creating smarter tomorrow!</p>
          </div>
        </Link>
        <nav className="tech-nav">
          <button className="link" onClick={() => scrollTo('about')}>
            About
          </button>
          <button className="link" onClick={() => scrollTo('portals')}>
            Workshop
          </button>
          <button className="pbtn" onClick={() => scrollTo('portals')}>
            👤 Login Portal
          </button>
        </nav>
      </header>

      {/* HERO */}
      <div className="hero">
        <div>
          <h1>
            Learn technology.<br />
            Build what&apos;s next.
          </h1>
          <div className="ul-bar" />
          <p>
            A hands-on workshop and community to learn modern technologies, build real projects, and grow together as future-ready creators.
          </p>
          <button
            className="cta"
            onClick={() => scrollTo('about')}
          >
            Explore Workshop &rarr;
          </button>
        </div>
        <Globe />
      </div>

      {/* ABOUT */}
      <section className="about" id="about">
        <div>
          <h3>About the Workshop</h3>
          <p>
            Technosavvys Education Technology began in 2023 with a simple observation—many students were learning concepts but not gaining the confidence to apply them. What started as a small initiative quickly evolved into a learning space where curiosity drives progress.
          </p>
          <p style={{ marginTop: '10px' }}>
            From the beginning, our mission has been to bridge the gap between classroom learning and real-world execution.
          </p>
        </div>
        <div className="founded">
          <small>Founded</small>
          <b>2023</b>
        </div>
      </section>

      {/* CHOOSE YOUR PORTAL */}
      <h2 className="sec-title" id="portals">
        Choose your portal
      </h2>
      <div className="portals">
        <div className="pcard">
          <div>
            <h3>Admin Login</h3>
            <p>Access workshop management, participants, and resources.</p>
          </div>
          <Link href="/teacher/login" className="gbtn">
            Admin Login &rarr;
          </Link>
        </div>
        <div className="pcard">
          <div>
            <h3>Student Login</h3>
            <p>Join the workshop, access your materials, and track your progress.</p>
          </div>
          <Link href="/student/login" className="gbtn">
            Student Login &rarr;
          </Link>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="tech-footer">
        &copy; {new Date().getFullYear()} technosavvys &middot; Founded 2023
      </footer>
    </div>
  );
}
