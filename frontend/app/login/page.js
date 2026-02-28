'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, CheckCircle, ArrowRight, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import Dlogo from '../Dlogo.png';
import api from '../../lib/api';
import { useAuth } from '../../lib/auth';

// no OTP cooldown

/* ─── Inline styles ─── */
const styles = `
  :root {
    --ink:    #0f172a;
    --paper:  #f0f4ff;
    --muted:  #9a9490;
    --accent: #2563EB;
    --panel:  #0f1829;
    --border: rgba(37,99,235,0.15);
    --ring:   rgba(37,99,235,0.25);
    --error:  #e07070;
    --ok:     #6eb894;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .login-root {
    font-family: 'Plus Jakarta Sans', sans-serif;
    min-height: 100svh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--paper);
    padding: 1.5rem;
    transition: background 0.4s;
  }

  .dark .login-root {
    background-color: #080d1a;
  }

  /* ── Card ── */
  .card {
    width: 100%;
    max-width: 920px;
    min-height: 580px;
    display: flex;
    border-radius: 24px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px var(--border),
      0 32px 80px rgba(15,17,23,0.12),
      0 8px 24px rgba(15,17,23,0.06);
    animation: cardIn 0.7s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes cardIn {
    from { opacity:0; transform:translateY(28px) scale(0.97); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }

  /* ── Left panel ── */
  .panel-left {
    display: none;
    position: relative;
    flex-direction: column;
    justify-content: space-between;
    background: var(--panel);
    padding: 3rem 3rem 2.5rem;
    overflow: hidden;
  }
  @media (min-width: 800px) { .panel-left { display: flex; width: 44%; } }

  .panel-bg-orb { display: none; }
  .orb1 { display: none; }
  .orb2 { display: none; }

  .panel-grid { display: none; }

  .panel-top { position: relative; z-index: 1; }

  .brand-mark {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 2.5rem;
  }
  .brand-icon {
    width: 42px; height: 42px;
    background: rgba(37,99,235,0.12);
    border: 1px solid rgba(37,99,235,0.22);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .brand-icon img { width: 20px; height: 20px; object-fit: contain; filter: brightness(0) saturate(100%) invert(75%) sepia(30%) saturate(500%) hue-rotate(200deg) brightness(110%) saturate(150%); }
  .brand-name { font-family: 'Nunito', sans-serif; font-size: 1.1rem; font-weight: 500; color: #fff; letter-spacing: 0.02em; }
  .brand-sub  { font-size: 0.65rem; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-top: 1px; }

  .panel-headline {
    font-family: 'Nunito', sans-serif;
    font-size: 2.4rem;
    font-weight: 500;
    line-height: 1.12;
    color: #fff;
    letter-spacing: -0.005em;
  }
  .panel-headline em { color: var(--accent); font-style: normal; }
  .panel-sub {
    margin-top: 1rem;
    font-size: 0.75rem;
    color: var(--muted);
    line-height: 1.65;
    max-width: 220px;
  }

  .deco-rule {
    margin-top: 2rem;
    width: 40px; height: 1px;
    background: rgba(255,255,255,0.15);
  }

  .panel-bottom { position: relative; z-index: 1; }
  .panel-stat-row {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }
  .panel-stat { display: flex; flex-direction: column; gap: 2px; }
  .stat-value { font-family: 'Nunito', sans-serif; font-size: 1.4rem; color: var(--accent); font-weight: 500; }
  .stat-label { font-size: 0.6rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
  .panel-copyright { font-size: 0.6rem; color: rgba(255,255,255,0.18); }

  /* ── Right panel ── */
  .panel-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.5rem 2rem;
    background: #fff;
    position: relative;
  }
  .dark .panel-right { background: #13161e; }

  .mobile-brand {
    position: absolute;
    top: 1.5rem; left: 1.5rem;
    display: flex; align-items: center; gap: 8px;
  }
  @media (min-width: 800px) { .mobile-brand { display: none; } }
  .mobile-brand img { width: 20px; height: 20px; object-fit: contain; }
  .mobile-brand span { font-size: 0.72rem; font-weight: 500; color: var(--ink); }
  .dark .mobile-brand span { color: #e8e6e0; }

  .form-wrap {
    width: 100%;
    max-width: 320px;
    animation: formIn 0.5s 0.15s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes formIn {
    from { opacity:0; transform:translateX(12px); }
    to   { opacity:1; transform:translateX(0); }
  }

  .form-heading { margin-bottom: 2rem; }
  .form-title {
    font-family: 'Nunito', sans-serif;
    font-size: 1.9rem;
    font-weight: 500;
    color: var(--ink);
    letter-spacing: -0.005em;
    line-height: 1.1;
  }
  .dark .form-title { color: #f0ede6; }
  .form-desc { font-size: 0.72rem; color: var(--muted); margin-top: 4px; }

  /* ── Field ── */
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field + .field { margin-top: 1rem; }
  .field-label {
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--muted);
  }
  .field-wrap { position: relative; }
  .field-input {
    width: 100%;
    padding: 11px 36px 11px 14px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 0.8rem;
    border-radius: 10px;
    border: 1px solid #e2dfd8;
    background: #faf9f7;
    color: var(--ink);
    outline: none;
    transition: border 0.2s, box-shadow 0.2s, background 0.2s;
    letter-spacing: 0.01em;
  }
  .dark .field-input {
    background: #1a1e28;
    border-color: #2a2e3a;
    color: #e8e6e0;
  }
  .field-input::placeholder { color: #b8b3ac; }
  .dark .field-input::placeholder { color: #4a4e5a; }
  .field-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--ring);
    background: #fff;
  }
  .dark .field-input:focus { background: #1e2230; }
  .field-input.otp-input {
    text-align: center;
    letter-spacing: 0.5em;
    font-size: 1.1rem;
    font-family: 'Nunito', sans-serif;
    padding: 14px 14px;
  }

  .field-icon {
    position: absolute;
    right: 10px;
    top: 50%; transform: translateY(-50%);
    display: flex; align-items: center; justify-content: center;
    width: 24px; height: 24px;
    color: var(--muted);
  }
  .field-icon-btn {
    background: none; border: none; cursor: pointer; padding: 0;
    color: var(--muted);
    transition: color 0.15s;
  }
  .field-icon-btn:hover { color: var(--ink); }
  .dark .field-icon-btn:hover { color: #e8e6e0; }
  .check-icon { color: var(--ok) !important; }

  /* ── Remember row ── */
  .meta-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 1rem;
  }
  .remember-label {
    display: flex; align-items: center; gap: 6px; cursor: pointer;
    font-size: 0.72rem; color: var(--muted);
    user-select: none;
  }
  .remember-label input[type=checkbox] { display: none; }
  .check-box {
    width: 14px; height: 14px;
    border: 1.5px solid #ccc;
    border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, border-color 0.15s;
    flex-shrink: 0;
  }
  .check-box.checked { background: var(--accent); border-color: var(--accent); }
  .check-box.checked::after {
    content: '';
    width: 7px; height: 4px;
    border-left: 1.5px solid #fff;
    border-bottom: 1.5px solid #fff;
    transform: rotate(-45deg) translateY(-1px);
    display: block;
  }
  .secure-badge {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.6rem; color: var(--ok); letter-spacing: 0.04em;
  }
  .secure-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--ok); }

  /* ── Submit button ── */
  .btn-primary {
    margin-top: 1.5rem;
    width: 100%;
    padding: 12px 20px;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    background: var(--accent);
    color: #fff;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    box-shadow: 0 2px 10px rgba(37,99,235,0.28);
  }
  .btn-primary:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 4px 18px rgba(37,99,235,0.35); }
  .btn-primary:active:not(:disabled) { transform: translateY(0); opacity: 1; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  .btn-icon { transition: transform 0.2s; }
  .btn-primary:hover:not(:disabled) .btn-icon { transform: translateX(3px); }

  /* ── OTP actions row ── */
  .otp-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 1.2rem;
    font-size: 0.72rem;
  }
  .link-btn {
    background: none; border: none; cursor: pointer; padding: 0;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 0.72rem;
    color: var(--muted);
    transition: color 0.15s;
  }
  .link-btn:hover:not(:disabled) { color: var(--ink); }
  .dark .link-btn:hover:not(:disabled) { color: #e8e6e0; }
  .link-btn.accent { color: var(--accent); }
  .link-btn.accent:hover:not(:disabled) { color: #d4b87c; }
  .link-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── OTP sent pill ── */
  .otp-pill {
    margin-top: 6px;
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px 2px 5px;
    border-radius: 100px;
    background: rgba(110,184,148,0.1);
    border: 1px solid rgba(110,184,148,0.25);
    font-size: 0.62rem;
    color: var(--ok);
    letter-spacing: 0.03em;
  }

  .enterprise-note {
    text-align: center;
    margin-top: 1.5rem;
    font-size: 0.6rem;
    color: #ccc;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .dark .enterprise-note { color: #3a3e4a; }

  /* ── Step transition ── */
  .step-enter {
    animation: stepIn 0.4s cubic-bezier(0.22,1,0.36,1) both;
  }
  @keyframes stepIn {
    from { opacity:0; transform:translateX(16px); }
    to   { opacity:1; transform:translateX(0); }
  }

  /* ── Progress dots ── */
  .progress-dots {
    display: flex; gap: 6px; margin-bottom: 1.6rem;
  }
  .progress-dot {
    height: 3px; border-radius: 2px;
    transition: width 0.4s cubic-bezier(0.22,1,0.36,1), background 0.3s;
  }
  .dot-active  { width: 20px; background: var(--accent); }
  .dot-done    { width: 8px;  background: var(--ok); }
  .dot-pending { width: 8px;  background: #e0ddd8; }
  .dark .dot-pending { background: #2a2e3a; }
`;

export default function LoginPage() {
  const router = useRouter();
  const { login, completeLogin } = useAuth();

  const [step, setStep]               = useState('password');
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [otpCode, setOtpCode]         = useState('');
  const [tempAuthId, setTempAuthId]   = useState('');
  const [showPass, setShowPass]       = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingOtp, setLoadingOtp]   = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpSent, setOtpSent]         = useState(false);
  const [stepKey, setStepKey]         = useState(0);
  const [otpAttempts, setOtpAttempts] = useState({ wrong: 0, left: null });

  // prefetch dashboard so navigation is instant
  useEffect(() => { router.prefetch('/dashboard'); }, [router]);

  // auto-submit removed — user must press Enter or click button

  const canResend = !resendingOtp;

  function goToStep(s) {
    setStep(s);
    setStepKey(k => k + 1);
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    const cleanUsername = username?.trim();
    if (!cleanUsername || !password) { toast.error('Fadlan geli username-ka iyo password-ka'); return; }
    setLoadingPassword(true);
    try {
      const result = await login(cleanUsername, password);
      if (result?.requiresOtp && result?.tempAuthId) {
        setTempAuthId(result.tempAuthId);
        setOtpCode('');
        setOtpAttempts({ wrong: 0, left: null });
        goToStep('otp');
        setOtpSent(true);
        toast.success(result.message || 'OTP sent');
        return;
      }
      if (result?.token && result?.user) { completeLogin(result); router.replace('/dashboard'); return; }
      toast.error('Login failed');
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || 'Login failed';
      if      (status === 423) toast.error(msg || 'Account temporarily locked.');
      else if (status === 403) toast.error(msg || 'Account deactivated.');
      else if (status === 401) toast.error(msg || 'Invalid credentials.');
      else if (status === 429) toast.error(msg || 'Too many requests.');
      else if (!err?.response)  toast.error('Cannot reach server.');
      else                      toast.error(msg);
    } finally { setLoadingPassword(false); }
  }

  // core OTP submission — called by auto-submit & button
  async function submitOtp(code) {
    if (!tempAuthId) { toast.error('Session expired. Please sign in again.'); goToStep('password'); return; }
    setLoadingOtp(true);
    try {
      const response = await api.post('/auth/verify-otp', { otp: code, tempAuthId });
      completeLogin(response.data); // non-blocking — starts permissions fetch in bg
      router.replace('/dashboard');  // replace keeps history clean & is faster
    } catch (err) {
      const data = err?.response?.data || {};
      const errorMessage = data.error || 'OTP verification failed.';
      const isSessionDead = data.blocked ||
        (typeof errorMessage === 'string' &&
          (errorMessage.includes('expired') || errorMessage.includes('invalid or expired') ||
           errorMessage.includes('log in again')));

      if (isSessionDead) {
        toast.error(errorMessage);
        backToPassword();
      } else {
        // wrong OTP — clear input, auto-send a fresh OTP
        setOtpCode('');
        setOtpAttempts({ wrong: 0, left: null });
        try {
          const resend = await api.post('/auth/resend-otp', { tempAuthId, force: true });
          const next = resend?.data?.tempAuthId;
          if (next) setTempAuthId(next);
          toast.error('Wrong code. A new OTP has been sent to your phone.');
        } catch {
          toast.error('Wrong code. Please try again or request a new code.');
        }
      }
    } finally { setLoadingOtp(false); }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    const code = otpCode?.trim();
    if (!code || code.length !== 6) { toast.error('Enter the 6-digit OTP.'); return; }
    await submitOtp(code);
  }

  async function handleResendOtp() {
    if (!canResend || !tempAuthId) return;
    setResendingOtp(true);
    try {
      const response = await api.post('/auth/resend-otp', { tempAuthId, force: true });
      const next = response?.data?.tempAuthId;
      if (next) setTempAuthId(next);
      setOtpCode('');
      setOtpSent(true);
      setOtpAttempts({ wrong: 0, left: null });
      toast.success('New OTP sent to your phone.');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to resend OTP.');
    } finally { setResendingOtp(false); }
  }

  function backToPassword() {
    goToStep('password');
    setOtpCode(''); setTempAuthId(''); setOtpSent(false);
    setOtpAttempts({ wrong: 0, left: null });
  }

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="login-root">
        <div className="card">

          {/* ── Left decorative panel ── */}
          <div className="panel-left">
            <div className="panel-bg-orb orb1" />
            <div className="panel-bg-orb orb2" />
            <div className="panel-grid" />

            <div className="panel-top">
              <div className="brand-mark">
                <div className="brand-icon">
                  <img src={Dlogo.src} alt="Logo" />
                </div>
                <div>
                  <div className="brand-name">Hormuud</div>
                  <div className="brand-sub">Asset Management</div>
                </div>
              </div>

              <h1 className="panel-headline">
                Secure<br/>
                <em>Access</em><br/>
                Portal
              </h1>
              <p className="panel-sub">Enterprise-grade authentication with end-to-end encryption and two-factor verification.</p>
              <div className="deco-rule" />
            </div>

            <div className="panel-bottom">
              <div className="panel-stat-row">
                <div className="panel-stat">
                  <span className="stat-value">2FA</span>
                  <span className="stat-label">Protected</span>
                </div>
                <div className="panel-stat">
                  <span className="stat-value">256</span>
                  <span className="stat-label">AES Bit</span>
                </div>
                <div className="panel-stat">
                  <span className="stat-value">SSO</span>
                  <span className="stat-label">Ready</span>
                </div>
              </div>
              <p className="panel-copyright">© 2026 Hormuud Telecom</p>
            </div>
          </div>

          {/* ── Right form panel ── */}
          <div className="panel-right">
            <div className="mobile-brand">
              <img src={Dlogo.src} alt="Logo" />
              <span>Hormuud</span>
            </div>

            <div className="form-wrap">
              {/* Progress dots */}
              <div className="progress-dots">
                <div className={`progress-dot ${step === 'password' ? 'dot-active' : 'dot-done'}`} />
                <div className={`progress-dot ${step === 'otp' ? 'dot-active' : 'dot-pending'}`} />
              </div>

              {step === 'password' ? (
                <div key={stepKey} className="step-enter">
                  <div className="form-heading">
                    <h2 className="form-title">Sign in</h2>
                    <p className="form-desc">Enter your credentials to continue</p>
                  </div>

                  <form onSubmit={handlePasswordSubmit}>
                    <div className="field">
                      <label className="field-label">Username</label>
                      <div className="field-wrap">
                        <input
                          type="text"
                          className="field-input"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                          onFocus={() => setFocusedField('username')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Enter username"
                          autoComplete="username"
                          autoFocus
                          disabled={loadingPassword}
                        />
                        {username.length > 0 && (
                          <span className="field-icon">
                            <CheckCircle size={14} className="check-icon" style={{color:'var(--ok)'}} />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="field">
                      <label className="field-label">Password</label>
                      <div className="field-wrap">
                        <input
                          type={showPass ? 'text' : 'password'}
                          className="field-input"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          onFocus={() => setFocusedField('password')}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Enter password"
                          autoComplete="current-password"
                          disabled={loadingPassword}
                        />
                        <span className="field-icon">
                          <button
                            type="button"
                            className="field-icon-btn"
                            onClick={() => setShowPass(v => !v)}
                            disabled={loadingPassword}
                            tabIndex={-1}
                          >
                            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </span>
                      </div>
                    </div>

                    <div className="meta-row">
                      <label className="remember-label">
                        <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                        <div className={`check-box ${rememberMe ? 'checked' : ''}`} />
                        Remember me
                      </label>
                      <div className="secure-badge">
                        <div className="secure-dot" />
                        Secured
                      </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loadingPassword}>
                      {loadingPassword ? (
                        <><Loader2 size={14} style={{animation:'spin 1s linear infinite'}} /></>
                      ) : (
                        <><span>Continue</span><ArrowRight size={14} className="btn-icon" /></>
                      )}
                    </button>
                  </form>

                  <p className="enterprise-note">Enterprise · 2FA Enabled</p>
                </div>
              ) : (
                <div key={stepKey} className="step-enter">
                  <div className="form-heading">
                    <h2 className="form-title">Verify</h2>
                    <p className="form-desc">Enter the 6-digit code sent to your phone</p>
                  </div>

                  <form onSubmit={handleVerifyOtp}>
                    <div className="field">
                      <label className="field-label">One-Time Password</label>
                      <div className="field-wrap">
                        <input
                          type="text"
                          className="field-input otp-input"
                          value={otpCode}
                          onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="— — — — — —"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          autoFocus
                        />
                      </div>
                      {otpSent && (
                        <div>
                          <span className="otp-pill">
                            <CheckCircle size={10} /> Code sent
                          </span>
                        </div>
                      )}
                    </div>

                    <button type="submit" className="btn-primary" disabled={loadingOtp || otpCode.length !== 6}>
                      {loadingOtp ? (
                        <><Loader2 size={14} style={{animation:'spin 1s linear infinite'}} /> Verifying…</>
                      ) : (
                        <><Shield size={13} /><span>Verify &amp; Sign in</span></>
                      )}
                    </button>
                  </form>

                  <div className="otp-row">
                    <button type="button" className="link-btn" onClick={backToPassword} disabled={loadingOtp}>
                      ← Back
                    </button>
                    <button type="button" className={`link-btn accent`} onClick={handleResendOtp} disabled={!canResend}>
                      {resendingOtp ? 'Sending…' : 'Resend code'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}' }} />
    </>
  );
}