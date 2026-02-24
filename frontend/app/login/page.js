'use client';

import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Dlogo from '../Dlogo.png';

// ============================================================================
// ⚠️ FIIRO GAAR AH (AKHRI):
// Si uu koodhku halkan (Preview-ga) si toos ah ugu shaqeeyo isagoon Error keenin,
// waxaan si kumeel-gaar ah u abuuray "Mock" u dhigma 'next/navigation' iyo 'auth'.
//
// MARKA AAD KOODHKAN GEYNAYSO VS CODE, TIRTIR QAYBTAN MACMALKA AH OO
// SOO CELI (UNCOMMENT) IMPORTS-KAAGA RASMIGA AH SIDA HOOS KU QORAN:
//
// import { useRouter } from 'next/navigation';
// import { useAuth } from '../../lib/auth';
// ============================================================================

// --- QAYBTA KUMEEL GAARKA AH (Tirtir markaad geynayso mashruucaaga dhabta ah) ---
const useRouter = () => ({ push: (path) => console.log('Navigating to:', path) });
const useAuth = () => ({ 
  login: async (u, p) => new Promise((resolve) => setTimeout(resolve, 1500)) 
});
// ============================================================================

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    const u = username?.trim();
    if (!u || !password) return toast.error('Fadlan geli username-ka iyo password-ka');
    
    setLoading(true);
    try {
      await login(u, password);
      toast.success('Login successful');
      router.push('/dashboard');
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || 'Login failed';
      const hint = err?.response?.data?.hint;
      
      if (status === 423) toast.error(msg || 'Account temporarily locked. Try again later.');
      else if (status === 403) toast.error(msg || 'Account is deactivated. Contact an administrator.');
      else if (status === 401) toast.error(msg || 'Invalid username or password.');
      else if (err?.message === 'Network Error' || !err?.response) toast.error('Cannot reach server. Check connection.');
      else toast.error(hint ? `${msg} ${hint}` : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    // Background-ka guud ee bogga oo iftiimaya
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-4 sm:p-8 font-sans selection:bg-blue-500/30">
      
      {/* Container-ka weyn (The Centered Card) */}
      <div className="relative w-full max-w-5xl min-h-[600px] bg-[#26303d] rounded-3xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col lg:flex-row">
        
        {/* Qaabka xariiqda Is-goyska ah (Diagonal Split) */}
        <div 
          className="hidden lg:block absolute top-0 left-0 w-[55%] h-full bg-white z-0" 
          style={{ clipPath: 'polygon(0 0, 100% 0, 75% 100%, 0% 100%)' }}
        ></div>
        
        <div 
          className="lg:hidden absolute top-0 left-0 w-full h-[35%] bg-white z-0" 
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0% 100%)' }}
        ></div>

        {/* ========================================================= */}
        {/* LEFT SIDE - LOGO AREA (White Background) */}
        {/* ========================================================= */}
        <div className="relative z-10 w-full lg:w-[50%] h-[35vh] lg:h-auto flex flex-col items-center justify-center p-8 lg:pr-16">
          
          {/* FIIRO GAAR AH: Fadlan hubi in sawirka 'topbarLogo.png' uu ku dhex jiro galka 'public' ee mashruucaaga */}
          <div className="transform hover:scale-105 transition-transform duration-500 bg-white/95 p-4 rounded-2xl shadow-sm">
            <img 
              src={Dlogo.src}
              alt="Hormuud Telecom" 
              className="w-auto h-20 lg:h-28 object-contain" 
              onError={(e) => {
                // Haddii sawirka la waayo, kani wuxuu muujinayaa qoraal kumeel gaar ah
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            {/* Fallback Placeholder (Muuqanaya kaliya haddii sawirku jabin yahay) */}
            <div className="hidden flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 rounded-2xl w-64">
              <div className="text-sm font-bold tracking-widest mb-1">Logoda lama helin</div>
              <div className="text-[10px] text-center">Geli "topbarLogo.png" galka "public"</div>
            </div>
          </div>
          
          <div className="mt-6 text-center hidden lg:block">
            
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT SIDE - LOGIN FORM (Dark #26303d Background) */}
        {/* ========================================================= */}
        <div className="relative z-10 w-full lg:w-[50%] flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16">
          <div className="w-full max-w-[360px]">
            
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Username Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 tracking-wide uppercase">Your email / username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full px-4 py-3 bg-white border-none rounded text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-200 text-sm"
                  autoComplete="username"
                  autoFocus
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 tracking-wide uppercase">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 bg-white border-none rounded text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-200 text-sm pr-12"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-500 transition-colors focus:outline-none"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Form Actions (Remember me & Recover) */}
              <div className="flex items-center justify-between text-xs pt-1 pb-2">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded border-none bg-white text-blue-500 focus:ring-blue-500 focus:ring-offset-[#26303d] cursor-pointer" />
                  <span>Remember me</span>
                </label>
                <a href="#" className="text-blue-400 hover:text-blue-300 transition-colors">Recover password</a>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-[#5479F7] text-white font-bold py-3 px-4 rounded hover:bg-[#4364D6] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none uppercase text-sm tracking-widest"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

          </div>
          
          {/* Footer Area */}
          <div className="absolute bottom-6 text-center w-full lg:w-auto">
            <p className="text-slate-400/60 text-[10px] tracking-wider uppercase">
              &copy; 2026 Hormuud Telecom. All rights reserved.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}