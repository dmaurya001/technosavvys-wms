'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Globe from '@/components/Globe';
import { Workshop } from '@/types';

const DEFAULT_SESSIONS = [
  {
    tag: 'WEB DEVELOPMENT',
    title: 'HTML, CSS & JavaScript',
    desc: 'Responsive pages se shuru karke interactive apps tak.',
    time: 'Every Mon & Wed · 5:00 PM',
  },
  {
    tag: 'AI & DATA',
    title: 'Python for Machine Learning',
    desc: 'Data cleaning, models, aur ek chhota real project.',
    time: 'Every Tue & Thu · 6:00 PM',
  },
  {
    tag: 'PROJECT LAB',
    title: 'Build Real Solutions',
    desc: 'Team ke saath ek project, mentor ke review ke saath.',
    time: 'Every Saturday · 11:00 AM',
  },
];

export default function Home() {
  const [registered, setRegistered] = useState<Record<number, boolean>>({});
  const [workshops, setWorkshops] = useState<Workshop[]>([]);

  useEffect(() => {
    async function loadWorkshops() {
      try {
        const res = await fetch('/api/workshops');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.workshops) && data.workshops.length > 0) {
            setWorkshops(data.workshops);
          }
        }
      } catch (err) {
        console.warn('Failed loading workshops:', err);
      }
    }
    loadWorkshops();
  }, []);

  const toggle = (i: number) => {
    setRegistered((r) => ({ ...r, [i]: !r[i] }));
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeSessions = workshops.length > 0
    ? workshops.map((w) => ({
        tag: (w.category || 'WORKSHOP').toUpperCase(),
        title: w.title,
        desc: w.description || 'Hands-on practical workshop by Technosavvys.',
        time: `${w.date || 'Upcoming'} · ${w.time || '10:00 AM - 05:00 PM'}`,
      }))
    : DEFAULT_SESSIONS;

  return (
    <div className="wrap">
      {/* HEADER */}
      <header className="tech-header">
        <Link href="/" className="brand">
          <div className="logo-circle">
            <img src="/logo.png" alt="ST" />
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
          <button className="link" onClick={() => scrollTo('workshop')}>
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
            onClick={() => scrollTo('workshop')}
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
            technosavvys is a technology workshop and learning community that offers practical, project-based sessions, mentorship, and a collaborative space to build real-world solutions.
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

      {/* WORKSHOP SESSIONS */}
      <h2 className="sec-title" id="workshop">
        Workshop Sessions
      </h2>
      <div className="sessions">
        {activeSessions.map((s, i) => (
          <div className="session" key={s.title + i}>
            <div>
              <small>{s.tag}</small>
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
            </div>
            <div>
              <div className="time">🗓 {s.time}</div>
              <button
                className={`reg ${registered[i] ? 'done' : ''}`}
                onClick={() => toggle(i)}
              >
                {registered[i] ? 'Registered ✓' : 'Register'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <footer className="tech-footer">
        &copy; {new Date().getFullYear()} technosavvys &middot; Founded 2023
      </footer>
    </div>
  );
}
