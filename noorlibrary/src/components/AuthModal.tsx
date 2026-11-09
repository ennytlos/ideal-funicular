"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApp } from "../context/AppContext";

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const { login, loginWithGoogle, register } = useApp();
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!isLoginTab && !name) {
      setError("Please tell us your name.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLoginTab) {
        await login(email, password);
      } else {
        await register(email, name, password);
      }
      setSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Make Firebase error messages friendlier
        const msg = err.message;
        if (
          msg.includes("user-not-found") ||
          msg.includes("wrong-password") ||
          msg.includes("invalid-credential")
        ) {
          setError("Invalid email or password. Please try again.");
        } else if (msg.includes("email-already-in-use")) {
          setError("This email is already registered. Try signing in instead.");
        } else if (msg.includes("too-many-requests")) {
          setError("Too many attempts. Please wait a moment and try again.");
        } else {
          setError("Something went wrong. Please try again.");
        }
      } else {
        setError("Authentication failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      setSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      const code = err?.code || "";
      const msg = err?.message || "";
      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request" ||
        msg.includes("popup-closed") ||
        msg.includes("cancelled")
      ) {
        // User closed or cancelled popup window intentionally
        return;
      }
      console.error("Google sign-in error:", err);
      if (code === "auth/popup-blocked") {
        setError(
          "Popup was blocked by your browser. Please allow popups for this site and try again.",
        );
        return;
      }
      if (code === "auth/unauthorized-domain") {
        setError(
          "This domain is not authorized in Firebase Auth Console (Authentication > Settings > Authorized Domains).",
        );
        return;
      }
      if (code === "auth/operation-not-allowed") {
        setError(
          "Google Sign-In is disabled in Firebase Console (Authentication > Sign-in method).",
        );
        return;
      }
      if (code === "auth/account-exists-with-different-credential") {
        setError(
          "An account already exists with the same email using a different sign-in method.",
        );
        return;
      }
      setError(msg || "Google sign-in failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(8px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        overflowY: "auto",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "430px",
          maxHeight: "calc(100dvh - 2rem)",
          overflowY: "auto",
          background: "var(--bg-secondary)",
          border: "1px solid rgba(220, 38, 38, 0.3)",
          borderRadius: "var(--radius-lg)",
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(220, 38, 38, 0.05)",
          padding: "1.5rem 1.75rem",
          margin: "auto",
          position: "relative",
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top glow bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "var(--accent-red-gradient)",
          }}
        />

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "0.85rem",
            right: "1rem",
            background: "transparent",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: "1.5rem",
            lineHeight: 1,
          }}
          onMouseOver={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseOut={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
        >
          &times;
        </button>

        {success ? (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "rgba(34, 197, 94, 0.15)",
                color: "#22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem auto",
                border: "1px solid rgba(34, 197, 94, 0.3)",
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <h3
              style={{
                fontFamily: "Outfit",
                fontSize: "1.5rem",
                marginBottom: "0.5rem",
              }}
            >
              Welcome!
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
              You are now signed in to Noor Library.
            </p>
          </div>
        ) : (
          <>
            {/* Title */}
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <h2
                style={{
                  fontFamily: "Outfit",
                  fontSize: "1.5rem",
                  marginBottom: "0.25rem",
                }}
              >
                Join <span style={{ color: "var(--accent-red)" }}>Noor</span>{" "}
                Library
              </h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: 0 }}>
                Unlock access to authentic Islamic writings.
              </p>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                background: "rgba(0,0,0,0.03)",
                borderRadius: "var(--radius-md)",
                padding: "4px",
                marginBottom: "1rem",
                border: "1px solid var(--border-color)",
              }}
            >
              {(["Sign In", "Register"] as const).map((label, i) => {
                const active = i === 0 ? isLoginTab : !isLoginTab;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setIsLoginTab(i === 0)}
                    style={{
                      flex: 1,
                      padding: "0.5rem",
                      fontFamily: "Outfit",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      background: active
                        ? "var(--accent-red-gradient)"
                        : "transparent",
                      color: active
                        ? "#ffffff"
                        : "var(--text-secondary)",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Google Sign-In */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={isSubmitting}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                padding: "0.625rem 0.75rem",
                background: "transparent",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                fontFamily: "Outfit",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
                marginBottom: "0.85rem",
                transition: "border-color 0.2s ease",
                opacity: isSubmitting ? 0.6 : 1,
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.borderColor = "rgba(220,38,38,0.5)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.borderColor = "var(--border-color)")
              }
            >
              {/* Google "G" SVG */}
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.08-6.08C34.46 2.99 29.49 1 24 1 14.82 1 7.06 6.49 3.6 14.27l7.1 5.52C12.38 13.58 17.72 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.2 24.5c0-1.64-.15-3.22-.42-4.74H24v8.97h12.47c-.54 2.9-2.17 5.36-4.63 7.01l7.12 5.53C43.27 37.15 46.2 31.32 46.2 24.5z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.7 28.21A14.6 14.6 0 0 1 9.5 24c0-1.46.25-2.87.7-4.21l-7.1-5.52A23.02 23.02 0 0 0 1 24c0 3.77.9 7.34 2.6 10.48l7.1-6.27z"
                />
                <path
                  fill="#34A853"
                  d="M24 47c5.49 0 10.1-1.82 13.46-4.95l-7.12-5.53c-1.97 1.32-4.48 2.1-6.34 2.1-6.28 0-11.62-4.08-13.3-9.62l-7.1 6.27C7.06 41.51 14.82 47 24 47z"
                />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                marginBottom: "0.85rem",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  background: "var(--border-color)",
                }}
              />
              <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                or
              </span>
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  background: "var(--border-color)",
                }}
              />
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#f87171",
                  padding: "0.6rem 0.85rem",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.85rem",
                  marginBottom: "0.85rem",
                }}
              >
                {error}
              </div>
            )}

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
              }}
            >
              {!isLoginTab && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="auth-name" className="form-label" style={{ marginBottom: "0.35rem" }}>
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    className="form-input"
                    style={{ padding: "0.65rem 0.9rem" }}
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="auth-email" className="form-label" style={{ marginBottom: "0.35rem" }}>
                  Email Address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  className="form-input"
                  style={{ padding: "0.65rem 0.9rem" }}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="auth-password" className="form-label" style={{ marginBottom: "0.35rem" }}>
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  className="form-input"
                  style={{ padding: "0.65rem 0.9rem" }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  marginTop: "0.25rem",
                  padding: "0.65rem 1.25rem",
                  display: "flex",
                  justifyContent: "center",
                  opacity: isSubmitting ? 0.7 : 1,
                }}
              >
                {isSubmitting
                  ? "Please wait..."
                  : isLoginTab
                    ? "Sign In"
                    : "Create Account"}
              </button>

              <p
                style={{
                  textAlign: "center",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: "0.25rem",
                  marginBottom: 0,
                  lineHeight: "1.4",
                }}
              >
                By continuing, you agree to our{" "}
                <Link
                  href="/privacy"
                  onClick={onClose}
                  style={{
                    color: "var(--gold-main)",
                    textDecoration: "underline",
                  }}
                >
                  Privacy Policy
                </Link>{" "}
                & Terms.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
