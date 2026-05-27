import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Search, MapPin, Building, Trophy, Code2, Users, SlidersHorizontal, BrainCircuit, Star } from 'lucide-react';

export default function RecruiterPortal() {
  const { user, token, logout } = useAuthStore();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('relevant');

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const response = await fetch('http://localhost:5001/api/analytics/candidates', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        // Parse the JSON inside summaryText for easy access later
        const parsedCandidates = data.map(c => {
           let parsedAI = null;
           try {
             parsedAI = JSON.parse(c.aISummary?.summaryText || '{}');
           } catch (e) {
             console.error("Could not parse AI JSON for", c.name);
           }
           return { ...c, parsedAI };
        });
        
        setCandidates(parsedCandidates);
      } catch (error) {
        console.error('Failed to fetch candidates:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCandidates();
  }, [token]);

  const filteredCandidates = candidates.filter(c => {
    const query = searchQuery.toLowerCase();
    const nameMatch = c.name?.toLowerCase().includes(query) || false;
    const summaryMatch = c.parsedAI?.developerPersona?.summary?.toLowerCase().includes(query) || false;
    const strengthsMatch = c.parsedAI?.strengths?.some(s => s.toLowerCase().includes(query)) || false;
    return nameMatch || summaryMatch || strengthsMatch;
  }).sort((a, b) => {
    if (sortBy === 'codeforces') {
      const aRating = a.profileSnapshot?.codeforcesData?.rating || 0;
      const bRating = b.profileSnapshot?.codeforcesData?.rating || 0;
      return bRating - aRating;
    }
    if (sortBy === 'leetcode') {
      const aSolved = a.profileSnapshot?.leetcodeData?.totalSolved || 0;
      const bSolved = b.profileSnapshot?.leetcodeData?.totalSolved || 0;
      return bSolved - aSolved;
    }
    if (sortBy === 'overallScore') {
       return (b.parsedAI?.overallScore || 0) - (a.parsedAI?.overallScore || 0);
    }
    return 0;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 font-sans flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-blue-400">DevSphere Recruiter Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Discover verified engineering talent.</p>
        </div>
        <div className="flex gap-4 items-center">
          <span className="text-sm bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 font-medium">
            Recruiter Mode Active
          </span>
          <button onClick={logout} className="text-sm bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded transition-colors">
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        
        <div className="mb-8 bg-gray-900 p-6 rounded-xl border border-gray-800">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="relative flex-1 w-full">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Search Talent</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by skill (e.g. React, Node.js), name, or summary..." 
                  className="w-full bg-gray-950 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            
            <div className="w-full md:w-48">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sort By</label>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
              >
                <option value="relevant">Most Relevant</option>
                <option value="overallScore">Highest AI Overall Score</option>
                <option value="codeforces">Highest Codeforces Rating</option>
                <option value="leetcode">Most LeetCode Solved</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="text-blue-400" /> Talent Directory
            </h2>
            <span className="text-sm text-gray-400">{filteredCandidates.length} Candidates Found</span>
          </div>
          
          {loading ? (
             <div className="text-center py-20 text-gray-500 animate-pulse">Loading verified candidates...</div>
          ) : filteredCandidates.length === 0 ? (
             <div className="text-center py-20 bg-gray-900 rounded-xl border border-gray-800">
               <p className="text-gray-400">No candidates match your search criteria.</p>
             </div>
          ) : (
            filteredCandidates.map(candidate => (
              <div key={candidate.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-blue-500/50 transition-all shadow-lg group">
                <div className="flex flex-col lg:flex-row justify-between gap-8">
                  
                  <div className="lg:w-1/3 flex flex-col justify-between">
                    <div>
                      <h3 className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors">{candidate.name || 'Anonymous User'}</h3>
                      <p className="text-blue-400 text-sm mb-1 font-bold tracking-wide uppercase">{candidate.parsedAI?.developerPersona?.title || 'Engineer'}</p>
                      <p className="text-gray-500 text-xs mb-6">{candidate.email}</p>
                      
                      <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-gray-950 p-4 rounded-lg border border-emerald-500/20 flex flex-col items-center justify-center text-center">
                          <Star size={20} className="text-emerald-400 mb-2" />
                          <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">AI Score</div>
                          <div className="text-lg font-bold text-white">{candidate.parsedAI?.overallScore || 'N/A'}/100</div>
                        </div>
                        <div className="bg-gray-950 p-4 rounded-lg border border-blue-500/20 flex flex-col items-center justify-center text-center">
                          <Trophy size={20} className="text-blue-400 mb-2" />
                          <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Codeforces</div>
                          <div className="text-lg font-bold text-white">{candidate.profileSnapshot?.codeforcesData?.rating || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                    
                    <button className="w-full bg-white text-gray-900 hover:bg-gray-200 py-3 rounded-lg font-bold transition-colors">
                      View Full Profile
                    </button>
                  </div>

                  <div className="lg:w-2/3 bg-gray-950 p-6 rounded-xl border border-gray-800 relative">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-3 flex items-center gap-2">
                       <BrainCircuit size={16} /> Verified AI Summary
                    </h4>
                    <p className="text-gray-300 text-sm leading-relaxed mb-6">
                      {candidate.parsedAI?.developerPersona?.summary || 'No summary available.'}
                    </p>
                    
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Core Engineering Strengths</h4>
                      <div className="flex flex-wrap gap-2">
                        {candidate.parsedAI?.strengths?.map((skill, idx) => (
                           <span key={idx} className="bg-blue-500/10 text-blue-300 text-xs px-3 py-1.5 rounded-md border border-blue-500/20 font-medium">
                              {skill}
                           </span>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
