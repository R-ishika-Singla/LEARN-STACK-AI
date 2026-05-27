import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { RefreshCw, Code2, Globe, Trophy, BrainCircuit, ArrowRight, Target, AlertTriangle, TrendingUp, Briefcase, LogOut, Home, Edit2, X, Save } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';

export default function CandidateDashboard() {
  const { user, token, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [aiReport, setAiReport] = useState(null);
  const [linkedAccounts, setLinkedAccounts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    githubHandle: '',
    leetcodeHandle: '',
    codeforcesHandle: ''
  });
  const [savingHandles, setSavingHandles] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goHome = () => {
    navigate('/');
  };

  const fetchDashboardData = async () => {
    try {
      const statusRes = await fetch('http://localhost:5001/api/analytics/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const statusData = await statusRes.json();
      
      if(!statusData.linked) {
        navigate('/onboarding');
        return;
      }
      setLinkedAccounts(statusData.accounts);

      const summaryRes = await fetch('http://localhost:5001/api/analytics/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const summaryData = await summaryRes.json();
      
      if (summaryData.aiSummary?.summaryText) {
         try {
             // Parse the massive JSON string we saved
             const parsedReport = JSON.parse(summaryData.aiSummary.summaryText);
             setAiReport(parsedReport);
         } catch (e) {
             console.error("Failed to parse AI Summary JSON", e);
         }
      }
      if (summaryData.profile) setProfile(summaryData.profile);
      
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchDashboardData(); }, [navigate, token]);

  const openEditModal = () => {
    setEditForm({
      githubHandle: linkedAccounts?.githubHandle || '',
      leetcodeHandle: linkedAccounts?.leetcodeHandle || '',
      codeforcesHandle: linkedAccounts?.codeforcesHandle || ''
    });
    setEditModal(true);
  };

  const closeEditModal = () => {
    setEditModal(false);
    setError('');
  };

  const handleSaveHandles = async () => {
    if (!editForm.githubHandle && !editForm.leetcodeHandle && !editForm.codeforcesHandle) {
      setError('Please enter at least one handle');
      return;
    }

    setSavingHandles(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5001/api/analytics/link', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          githubHandle: editForm.githubHandle,
          leetcodeHandle: editForm.leetcodeHandle,
          codeforcesHandle: editForm.codeforcesHandle
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save handles');

      setLinkedAccounts(data.linked);
      closeEditModal();
      alert('Integrations updated successfully! Click "Refresh API Sync" to update your profile.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingHandles(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://localhost:5001/api/analytics/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to sync');
      fetchDashboardData();
      alert('Data successfully synced and Deep AI Evaluation generated!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const radarData = aiReport?.scoreBreakdown ? [
    { subject: 'GitHub', A: aiReport.scoreBreakdown.github, fullMark: 100 },
    { subject: 'DSA', A: aiReport.scoreBreakdown.dsa, fullMark: 100 },
    { subject: 'Projects', A: aiReport.scoreBreakdown.projectQuality, fullMark: 100 },
    { subject: 'Consistency', A: aiReport.scoreBreakdown.consistency, fullMark: 100 },
    { subject: 'Problem Solving', A: aiReport.scoreBreakdown.problemSolving || 50, fullMark: 100 },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">Developer Passport</h1>
          <p className="text-gray-400 text-sm mt-1">Welcome back, {user?.name || user?.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={goHome}
            className="flex items-center gap-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 px-4 py-2 rounded-lg font-medium transition-colors"
            title="Go to Home"
          >
            <Home size={18} />
            Home
          </button>
          <button
            onClick={handleSync} disabled={loading}
            className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            {loading ? 'Aggregating APIs...' : 'Refresh API Sync'}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">

        {/* Featured Services Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Featured Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

            {/* Code Arena Card - MOVED TO TOP */}
            <Link to="/arena" className="group">
              <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-2xl p-8 h-full hover:border-blue-400/60 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20">
                <div className="w-16 h-16 bg-blue-500/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Code2 size={32} className="text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">DevSphere Arena</h3>
                <p className="text-gray-400 text-sm mb-6">Compete live with friends using WebSockets.</p>
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm group-hover:gap-3 transition-all">
                  Enter Multiplayer Arena <ArrowRight size={16} />
                </div>
              </div>
            </Link>

            {/* CodingBuddy Card */}
            <a href="http://localhost:5174" target="_blank" rel="noopener noreferrer" className="group">
              <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 rounded-2xl p-8 h-full hover:border-emerald-400/60 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/20">
                <div className="w-16 h-16 bg-emerald-500/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <BrainCircuit size={32} className="text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Coding Buddy</h3>
                <p className="text-gray-400 text-sm mb-6">Learn from your codebase with AI-powered documentation and analysis.</p>
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm group-hover:gap-3 transition-all">
                  Start Learning <ArrowRight size={16} />
                </div>
              </div>
            </a>

            {/* Developer Passport Card */}
            <div className="group">
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-2xl p-8 h-full hover:border-purple-400/60 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
                <div className="w-16 h-16 bg-purple-500/30 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Trophy size={32} className="text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Developer Passport</h3>
                <p className="text-gray-400 text-sm mb-6">Your unified profile showcasing GitHub, LeetCode, and Codeforces stats.</p>
                <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm group-hover:gap-3 transition-all">
                  View Profile <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Original Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Stats & Integrations */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                <Globe className="text-gray-400" /> Linked Integrations
              </h2>
              <button
                onClick={openEditModal}
                className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded text-sm transition-colors"
              >
                <Edit2 size={14} /> Edit
              </button>
            </div>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="space-y-3">
               <div className="flex justify-between items-center bg-gray-950 p-3 rounded border border-gray-800">
                 <span className="text-sm font-medium">GitHub</span>
                 {linkedAccounts?.githubHandle ? (
                   <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">@{linkedAccounts.githubHandle}</span>
                 ) : (
                   <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">Missing</span>
                 )}
               </div>
               <div className="flex justify-between items-center bg-gray-950 p-3 rounded border border-gray-800">
                 <span className="text-sm font-medium">LeetCode</span>
                 {linkedAccounts?.leetcodeHandle ? (
                   <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">@{linkedAccounts.leetcodeHandle}</span>
                 ) : (
                   <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">Missing</span>
                 )}
               </div>
               <div className="flex justify-between items-center bg-gray-950 p-3 rounded border border-gray-800">
                 <span className="text-sm font-medium">Codeforces</span>
                 {linkedAccounts?.codeforcesHandle ? (
                   <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">@{linkedAccounts.codeforcesHandle}</span>
                 ) : (
                   <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">Missing</span>
                 )}
               </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
             <div className="flex flex-col relative z-10">
               <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-2">
                 <Code2 className="text-emerald-400" /> DevSphere Arena
               </h2>
               <p className="text-gray-400 text-sm mb-4">Compete live with friends using WebSockets.</p>
               <Link to="/arena" className="bg-emerald-500 text-gray-950 font-bold px-6 py-3 rounded-lg hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2">
                 Enter Multiplayer Arena <ArrowRight size={18} />
               </Link>
             </div>
          </div>
        </div>

        {/* Right Column: AI Deep Analytics */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-900 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)] rounded-xl p-8 relative overflow-hidden">
            
            <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-6 relative z-10">
              <BrainCircuit className="text-emerald-400" /> AI Diagnostic Report
            </h2>
            
            {aiReport ? (
              <div className="space-y-8 relative z-10">
                {/* Header Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="bg-gray-950 p-4 border border-gray-800 rounded-lg text-center">
                      <div className="text-3xl font-black text-emerald-400">{aiReport.overallScore}/100</div>
                      <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Overall Score</div>
                   </div>
                   <div className="bg-gray-950 p-4 border border-gray-800 rounded-lg text-center">
                      <div className="text-xl font-bold text-white">{aiReport.careerLevel?.level || 'N/A'}</div>
                      <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Assessed Level</div>
                   </div>
                   <div className="bg-gray-950 p-4 border border-gray-800 rounded-lg text-center">
                      <div className="text-xl font-bold text-white">{aiReport.interviewReadiness?.status || 'N/A'}</div>
                      <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Interview Ready</div>
                   </div>
                   <div className="bg-gray-950 p-4 border border-gray-800 rounded-lg text-center">
                      <div className="text-lg font-bold text-blue-400">{aiReport.developerPersona?.title || 'Engineer'}</div>
                      <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Persona</div>
                   </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                   {/* Radar Chart */}
                   <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 h-64 flex flex-col items-center">
                     <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Skill Distribution</span>
                     <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="#374151" />
                          <PolarAngleAxis dataKey="subject" tick={{fill: '#9CA3AF', fontSize: 10}} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name="Score" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                        </RadarChart>
                     </ResponsiveContainer>
                   </div>
                   
                   {/* Written Summary */}
                   <div>
                     <h3 className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><Briefcase size={16}/> Professional Overview</h3>
                     <p className="text-gray-300 leading-relaxed text-sm mb-4 bg-gray-950 p-4 rounded-lg border border-gray-800">
                       {aiReport.developerPersona?.summary || 'No summary generated.'}
                     </p>
                   </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                   <div className="bg-gray-950 p-5 rounded-lg border border-emerald-500/20">
                     <h3 className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2"><Target size={16}/> Key Strengths</h3>
                     <ul className="space-y-2 text-gray-300 text-sm">
                       {aiReport.strengths?.map((str, idx) => (
                         <li key={idx} className="flex gap-2"><span className="text-emerald-500">✔</span> {str}</li>
                       ))}
                     </ul>
                   </div>
                   <div className="bg-gray-950 p-5 rounded-lg border border-red-500/20">
                     <h3 className="text-red-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2"><AlertTriangle size={16}/> Weaknesses</h3>
                     <ul className="space-y-2 text-gray-300 text-sm">
                       {aiReport.weaknesses?.map((str, idx) => (
                         <li key={idx} className="flex gap-2"><span className="text-red-500">!</span> {str}</li>
                       ))}
                     </ul>
                   </div>
                </div>

                <div className="bg-blue-900/10 border border-blue-500/30 p-5 rounded-lg">
                   <h3 className="text-blue-400 text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-2"><TrendingUp size={16}/> Action Plan</h3>
                   <ul className="space-y-2 text-gray-300 text-sm list-decimal list-inside">
                     {aiReport.actionPlan?.map((str, idx) => <li key={idx}>{str}</li>)}
                   </ul>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 relative z-10">
                <BrainCircuit size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">Deep AI Analytics not available.</p>
                <p className="text-sm text-gray-500 mt-2">Click "Refresh API Sync" to aggregate your data.</p>
              </div>
            )}
          </div>
        </div>
        </div>
      </main>

      {/* Edit Integrations Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-bold text-white">Edit Integrations</h3>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">GitHub Handle</label>
                <input
                  type="text"
                  placeholder="e.g., torvalds"
                  value={editForm.githubHandle}
                  onChange={(e) => setEditForm({...editForm, githubHandle: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">LeetCode Handle</label>
                <input
                  type="text"
                  placeholder="e.g., codesam"
                  value={editForm.leetcodeHandle}
                  onChange={(e) => setEditForm({...editForm, leetcodeHandle: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Codeforces Handle</label>
                <input
                  type="text"
                  placeholder="e.g., tourist"
                  value={editForm.codeforcesHandle}
                  onChange={(e) => setEditForm({...editForm, codeforcesHandle: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={closeEditModal}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveHandles}
                disabled={savingHandles}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-gray-950 px-4 py-2 rounded-lg font-bold transition-colors"
              >
                <Save size={18} />
                {savingHandles ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
