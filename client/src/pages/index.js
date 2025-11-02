"use client";

import { useState } from "react";
import Link from "next/link";
import {
  UserCircleIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

export default function Home() {
  const currentYear = new Date().getFullYear();

  const styles = {
    page: { display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f5f6fa", color: "#333", fontFamily: "'Inter', sans-serif" },
    hero: { textAlign: "center", padding: "8rem 2rem", background: "linear-gradient(135deg, #e6f4ff, #cce7ff)" },
    heroIcon: { width: "64px", height: "64px", margin: "0 auto 1.5rem", color: "#1e90ff" },
    heroTitle: { fontSize: "2.75rem", fontWeight: "bold", margin: "0.5rem 0", color: "#1e90ff" },
    heroSubtitle: { fontSize: "1.25rem", margin: "1rem auto", maxWidth: "650px", color: "#333", lineHeight: 1.6 },
    heroButtons: { marginTop: "2rem" },
    btnPrimary: { background: "#2575fc", color: "#fff", textDecoration: "none", transition: "background 0.2s, transform 0.2s", padding: "0.8rem 1.6rem", fontSize: "1rem", borderRadius: "8px", display: "inline-block" },
    features: { padding: "6rem 2rem", textAlign: "center", background: "#fff" },
    sectionTitle: { fontSize: "2rem", marginBottom: "2.5rem", color: "#1e90ff" },
    featureList: { display: "flex", gap: "2rem", flexWrap: "wrap", justifyContent: "center" },
    feature: { background: "#f9f9fb", padding: "2rem", borderRadius: "16px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", flex: "1 1 280px", maxWidth: "320px", transition: "transform 0.25s, box-shadow 0.25s", cursor: "pointer" },
    featureHover: { transform: "translateY(-5px)", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" },
    featureIcon: { display: "block", margin: "0 auto 1rem", color: "#1e90ff" },
    footer: { textAlign: "center", padding: "2rem", background: "#f1f1f5", borderTop: "1px solid #ddd", color: "#555", fontSize: "0.9rem", marginTop: "auto" },
  };

  const FeatureCard = ({ icon: Icon, title, text }) => {
    const [hovered, setHovered] = useState(false);
    return (
      <div
        style={{ ...styles.feature, ...(hovered ? styles.featureHover : {}) }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Icon width={40} height={40} style={styles.featureIcon} />
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <UserCircleIcon style={styles.heroIcon} aria-label="JobTrackr Logo" />
        <h1 style={styles.heroTitle}>JobTrackr</h1>
        <p style={styles.heroSubtitle}>Track your job applications, manage tasks, and stay on top of deadlines — all in one place.</p>

        <div style={styles.heroButtons}>
          <Link href="/login" style={styles.btnPrimary}>Get Started</Link>
        </div>
      </section>

      <section style={styles.features}>
        <h2 style={styles.sectionTitle}>Why Choose JobTrackr?</h2>
        <div style={styles.featureList}>
          <FeatureCard icon={ClipboardDocumentListIcon} title="Organize Tasks" text="Keep your daily tasks structured and easy to manage." />
          <FeatureCard icon={UserCircleIcon} title="Track Applications" text="Monitor job applications and follow up on time." />
          <FeatureCard icon={ClockIcon} title="Meet Deadlines" text="Set reminders and finish work before the deadline." />
        </div>
      </section>

      <footer style={styles.footer}>© {currentYear} JobTrackr. All rights reserved.</footer>
    </div>
  );
}
