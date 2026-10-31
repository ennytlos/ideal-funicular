'use client';

import React, { useState } from 'react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useApp } from '../context/AppContext';

export type WebReportableContentType =
  | 'book'
  | 'series'
  | 'course'
  | 'media'
  | 'reminder'
  | 'society'
  | 'society_program'
  | 'society_post'
  | 'hadith'
  | 'adhkaar'
  | 'ruqyah'
  | 'quran';

export type WebReportReason = 'inaccurate' | 'stolen' | 'abusive' | 'other';

const REPORT_REASONS: Array<{ value: WebReportReason; label: string; desc: string; icon: string }> = [
  {
    value: 'inaccurate',
    label: 'Inaccurate Aqeedah / Fiqh / Islamic Content',
    desc: 'Mistake in religious rulings, verses, translation, or scholarly claims',
    icon: '🛡️',
  },
  {
    value: 'stolen',
    label: 'Copyright Infringement / Stolen Content',
    desc: 'Material copied or republished without proper permission or author rights',
    icon: '⚖️',
  },
  {
    value: 'abusive',
    label: 'Offensive / Inappropriate / Abusive',
    desc: 'Inappropriate language, derogatory remarks, or sectarian insults',
    icon: '⚠️',
  },
  {
    value: 'other',
    label: 'Other Issue',
    desc: 'Technical defect, broken audio/file, formatting error, or other concern',
    icon: '📝',
  },
];

interface ReportContentButtonProps {
  contentId: string;
  contentTitle: string;
  contentType: WebReportableContentType;
  compact?: boolean;
  iconOnly?: boolean;
  label?: string;
  style?: React.CSSProperties;
}

export function ReportContentButton({
  contentId,
  contentTitle,
  contentType,
  compact = false,
  iconOnly = false,
  label = 'Report Content',
  style,
}: ReportContentButtonProps) {
  const { user } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<WebReportReason>('inaccurate');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) {
      alert('Please provide details about the issue so our moderation team can investigate.');
      return;
    }

    setIsSubmitting(true);
    try {
      const reportRef = doc(collection(db, 'reports'));
      await setDoc(reportRef, {
        id: reportRef.id,
        contentId,
        contentTitle,
        contentType,
        reporterId: user?.uid || 'guest',
        reporterEmail: user?.email || 'guest@noorlibrary.com.ng',
        reason,
        details: details.trim(),
        createdAt: Date.now(),
        status: 'pending',
      });
      alert('JazakAllahu Khayran. Your report has been submitted successfully. Our moderation team will review it shortly.');
      setIsOpen(false);
      setDetails('');
    } catch (err: any) {
      alert(err?.message || 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const buttonStyle: React.CSSProperties = iconOnly
    ? {
        width: '38px',
        height: '38px',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        borderColor: 'var(--border-color)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        ...style,
      }
    : compact
    ? {
        padding: '0.3rem 0.75rem',
        fontSize: '0.78rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        color: 'var(--accent-red)',
        borderColor: 'rgba(229, 9, 20, 0.35)',
        background: 'rgba(229, 9, 20, 0.08)',
        borderRadius: '999px',
        cursor: 'pointer',
        ...style,
      }
    : {
        width: '100%',
        padding: '0.75rem',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        color: 'var(--accent-red)',
        borderColor: 'rgba(229, 9, 20, 0.3)',
        cursor: 'pointer',
        ...style,
      };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        className={compact || iconOnly ? 'btn btn-secondary' : 'btn btn-secondary'}
        title="Report content"
        aria-label="Report content"
        style={buttonStyle}
      >
        <svg
          width={iconOnly ? '16' : compact ? '13' : '16'}
          height={iconOnly ? '16' : compact ? '13' : '16'}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        {!iconOnly && <span>{compact ? 'Report' : label}</span>}
      </button>

      {isOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
          style={{ zIndex: 99999 }}
        >
          <div
            className="glass-card modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '92%' }}
          >
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
                <span style={{ color: 'var(--accent-red)' }}>⚑</span>
                <span>Report Content</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="modal-close-btn"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Reporting: <strong style={{ color: 'var(--text-primary)' }}>{contentTitle}</strong>
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ marginBottom: '0.4rem', display: 'block' }}>
                  Select Reason
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {REPORT_REASONS.map((r) => {
                    const isSelected = reason === r.value;
                    return (
                      <div
                        key={r.value}
                        onClick={() => setReason(r.value)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.65rem',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: isSelected
                            ? '1.5px solid var(--accent-red)'
                            : '1px solid var(--border-color)',
                          backgroundColor: isSelected
                            ? 'rgba(220, 38, 38, 0.08)'
                            : 'var(--bg-primary)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="radio"
                          name="report-reason"
                          checked={isSelected}
                          onChange={() => setReason(r.value)}
                          style={{ marginTop: '0.2rem', accentColor: 'var(--accent-red)', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 600, color: isSelected ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                            <span style={{ marginRight: '0.35rem' }}>{r.icon}</span>
                            {r.label}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem', lineHeight: 1.35 }}>
                            {r.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" htmlFor="report-details-textarea" style={{ marginBottom: '0.35rem', display: 'block' }}>
                  Additional Details
                </label>
                <textarea
                  id="report-details-textarea"
                  className="form-input"
                  rows={3}
                  required
                  placeholder="Describe the issue (e.g. page/lesson number, specific wording, or exact concern)..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  style={{ width: '100%', resize: 'vertical', fontSize: '0.88rem', lineHeight: 1.5 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <span>⚑</span>
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Report'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default ReportContentButton;
