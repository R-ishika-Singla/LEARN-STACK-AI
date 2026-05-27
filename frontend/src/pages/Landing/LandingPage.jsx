import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrainCircuit, Code2, Globe, Trophy, ArrowRight, ShieldCheck, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import AnimatedGlobe from '../../components/AnimatedGlobe';

export default function LandingPage() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goToDashboard = () => {
    navigate('/dashboard');
  };

  const handleProtectedLink = (destination) => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      navigate(destination);
    }
  };

  const handleCodingBuddyLink = () => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      window.open('http://localhost:5174', '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-emerald-500/30">
      
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/')}>
            <BrainCircuit className="text-emerald-500" size={28} />
            <span className="text-2xl font-bold tracking-tight">DevSphere</span>
          </div>
          <div className="flex gap-4 items-center">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 text-gray-300">
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <span className="text-emerald-400 font-bold text-sm">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">
                    {user?.name || 'User'}
                  </span>
                </div>
                <button
                  onClick={goToDashboard}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold transition-transform hover:scale-105 active:scale-95"
                >
                  Dashboard
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-gray-300 hover:text-red-400 font-medium transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-300 hover:text-white font-medium transition-colors">
                  Login
                </Link>
                <Link to="/register" className="bg-emerald-500 hover:bg-emerald-600 text-gray-950 px-5 py-2 rounded-lg font-bold transition-transform hover:scale-105 active:scale-95">
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section with Gradient */}
      <section className="bg-gradient-to-b from-transparent via-emerald-500/5 to-cyan-500/5 py-20">
        <main className="max-w-7xl mx-auto px-6">
          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">

            {/* Left Column (1/3) - Content */}
            <div className="lg:col-span-1 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8 animate-fade-in">
                <ShieldCheck size={16} />
                The Ultimate Developer Passport
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
                Unify Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">Coding Identity</span>.
              </h1>

              <p className="text-base md:text-lg text-gray-400 mb-8 leading-relaxed">
                {isAuthenticated
                  ? `Welcome back, ${user?.name || 'Developer'}! Access your tools and start coding today.`
                  : "Connect your GitHub, LeetCode, and Codeforces accounts. Let our Gemini AI analyze your stats, summarize your strengths, and instantly generate a recruiter-ready verified portfolio."}
              </p>

              <div className="flex flex-col gap-3">
                {isAuthenticated && (
                  <button
                    onClick={goToDashboard}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold text-base transition-all flex items-center gap-2 w-full sm:w-auto justify-start"
                  >
                    <Globe size={18} /> View GitHub Passport
                  </button>
                )}
                {!isAuthenticated && (
                  <Link to="/register" className="bg-white text-gray-950 px-6 py-3 rounded-xl font-bold text-base hover:bg-gray-100 transition-all flex items-center gap-2 w-full sm:w-auto justify-start">
                    Build Your Passport <ArrowRight size={18} />
                  </Link>
                )}
                <button
                  onClick={() => handleProtectedLink('/arena')}
                  className="bg-gray-900 border border-gray-800 text-white px-6 py-3 rounded-xl font-bold text-base hover:bg-gray-800 transition-all flex items-center gap-2 w-full sm:w-auto justify-start"
                >
                  <Code2 size={18} className="text-emerald-400" /> {isAuthenticated ? 'Open' : 'Enter'} Code Arena
                </button>
                <button
                  onClick={handleCodingBuddyLink}
                  className="bg-emerald-500 hover:bg-emerald-600 text-gray-950 px-6 py-3 rounded-xl font-bold text-base transition-all flex items-center gap-2 w-full sm:w-auto justify-start"
                >
                  <BrainCircuit size={18} /> {isAuthenticated ? 'Open' : 'Try'} Coding Buddy
                </button>
              </div>
            </div>

            {/* Right Column (2/3) - Animation */}
            <div className="lg:col-span-2 flex justify-center lg:justify-end">
              <AnimatedGlobe />
            </div>

          </div>
        </main>
      </section>

      {/* Features Grid */}
      <section className="bg-gray-900/50 border-t border-gray-800 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl hover:border-emerald-500/50 transition-colors">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                <Globe className="text-blue-400" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Global Aggregation</h3>
              <p className="text-gray-400 leading-relaxed">
                Automatically pull your open-source contributions from GitHub, problem-solving stats from LeetCode, and competitive ratings from Codeforces into one unified dashboard.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl hover:border-emerald-500/50 transition-colors relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <BrainCircuit size={100} />
              </div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 relative z-10">
                <BrainCircuit className="text-purple-400" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3 relative z-10">AI-Powered Profiles</h3>
              <p className="text-gray-400 leading-relaxed relative z-10">
                Our advanced Gemini AI analyzes your commit history and problem-solving patterns to generate a highly professional, recruiter-ready profile summary.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl hover:border-emerald-500/50 transition-colors">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6">
                <Trophy className="text-emerald-400" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-3">Code Arena</h3>
              <p className="text-gray-400 leading-relaxed">
                Prove your skills in real-time. Jump into our integrated Monaco-powered Code Arena and execute solutions directly against the Judge0 compilation engine.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950 py-12 text-center text-gray-500">
        <p>© 2026 DevSphere. All rights reserved.</p>
      </footer>
    </div>
  );
}
