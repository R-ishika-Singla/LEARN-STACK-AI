import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Code2, Globe, ArrowRight } from 'lucide-react';

export default function Onboarding() {
  const [github, setGithub] = useState('');
  const [leetcode, setLeetcode] = useState('');
  const [codeforces, setCodeforces] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { token } = useAuthStore();

  const handleLinkAccounts = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:5001/api/analytics/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          githubHandle: github, 
          leetcodeHandle: leetcode, 
          codeforcesHandle: codeforces 
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to link accounts');
      }
      
      // Successfully linked, go to dashboard
      navigate('/dashboard');
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col justify-center items-center p-6 text-white font-sans">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Link Your Accounts</h1>
          <p className="text-gray-400">We need your handles to fetch your stats and generate your verified AI profile.</p>
        </div>
        
        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded mb-6 text-sm text-center">{error}</div>}
        
        <form onSubmit={handleLinkAccounts} className="space-y-5">
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
              <Globe size={16} className="text-gray-400" /> GitHub Handle
            </label>
            <input 
              type="text"
              required
              placeholder="e.g., torvalds"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
              <Code2 size={16} className="text-gray-400" /> LeetCode Handle
            </label>
            <input 
              type="text"
              required
              placeholder="e.g., coding_ninja"
              value={leetcode}
              onChange={(e) => setLeetcode(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1 flex items-center gap-2">
              <span className="font-serif italic font-bold text-gray-400">CF</span> Codeforces Handle
            </label>
            <input 
              type="text"
              required
              placeholder="e.g., tourist"
              value={codeforces}
              onChange={(e) => setCodeforces(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow text-white"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-gray-950 font-bold py-3 px-4 rounded-lg transition-colors mt-4 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Linking Accounts...' : 'Continue to Dashboard'} <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
