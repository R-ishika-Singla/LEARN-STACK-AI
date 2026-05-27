import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { LogOut, Search, Filter, Users, TrendingUp, Award, BookmarkPlus, Home, Plus, Upload, Download, X, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RecruiterDashboard() {
  const { user, logout, token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('candidates');
  const [searchQuery, setSearchQuery] = useState('');
  const [allCandidates, setAllCandidates] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [appliedFilters, setAppliedFilters] = useState({});
  const [showFilterTabs, setShowFilterTabs] = useState(false);
  const navigate = useNavigate();

  // Manual profile form state - ONLY handles
  const [manualForm, setManualForm] = useState({
    githubHandle: '',
    leetcodeHandle: '',
    codeforcesHandle: ''
  });

  const [loading, setLoading] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState(null);

  // Filter state
  const [filters, setFilters] = useState({
    scoreRange: [0, 100],
    careerLevel: 'all',
    techStack: [],                // multi-select; candidate must have ALL of these (AND)
    domain: 'all',                // "Web" | "Mobile" | "Data / ML" | "DevOps" | "Systems" | "Database" | "all"
    leetcodeMin: 0,               // minimum total solved
    leetcodeDifficulty: 'all',    // "Easy" | "Medium" | "Hard" | "all"  — matches dominantDifficulty
  });

  // Fetch candidate data from backend API (to avoid CORS issues)
  const fetchCandidateData = async (github, leetcode, codeforces) => {
    try {
      setLoading(true);

      console.log('🔍 Starting candidate profile analysis...');
      console.log('Input Handles:', { github, leetcode, codeforces });

      // Call backend API to fetch and calculate scores
      const backendUrl = 'http://localhost:5001/api/analytics/candidate-profile';
      console.log('🔗 Backend URL:', backendUrl);

      const response = await fetch(backendUrl, {
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

      console.log('📡 Backend API Response Status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Backend API Error:', response.status);
        console.error('Error details:', errorText);

        // Fallback: Try individual API calls if backend endpoint doesn't exist
        console.log('📌 Falling back to individual API calls...');
        return await fetchCandidateDataFallback(github, leetcode, codeforces);
      }

      const data = await response.json();
      console.log('✅ Backend Response Data:', data);

      return data;

    } catch (error) {
      console.error('❌ Error fetching candidate data:', error);
      console.error('Error stack:', error.stack);
      alert('Failed to fetch candidate data. Please check the handles and try again.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Fallback function for individual API calls (only GitHub, since LeetCode/CF have CORS issues)
  const fetchCandidateDataFallback = async (github, leetcode, codeforces) => {
    console.log('🔄 Using fallback method with GitHub only (CORS restrictions on LeetCode/Codeforces)');

    let githubData = null;
    if (github) {
      console.log('📊 Fetching GitHub data for:', github);
      try {
        const githubProfileUrl = `https://api.github.com/users/${github}`;
        console.log('🔗 GitHub Profile URL:', githubProfileUrl);

        const githubRes = await fetch(githubProfileUrl);
        console.log('📡 GitHub API Response Status:', githubRes.status);

        if (!githubRes.ok) {
          const errorText = await githubRes.text();
          console.error('❌ GitHub API Error:', githubRes.status);
          console.error('Error Response:', errorText);
        } else {
          const profileData = await githubRes.json();
          console.log('✅ GitHub Profile Data:', profileData);

          const reposUrl = `https://api.github.com/users/${github}/repos?sort=updated&per_page=100`;
          const reposRes = await fetch(reposUrl);
          console.log('📡 GitHub Repos Response Status:', reposRes.status);

          if (reposRes.ok) {
            const reposData = await reposRes.json();
            console.log('✅ Raw repos data length:', reposData.length);

            githubData = {
              followers: profileData.followers,
              publicRepos: profileData.public_repos,
              allRepos: reposData.map(repo => ({
                name: repo.name,
                description: repo.description,
                primaryLanguage: repo.language,
                stars: repo.stargazers_count,
                url: repo.html_url,
                forks: repo.forks_count,
                updatedAt: repo.updated_at
              }))
            };
            console.log('✅ GitHub repos loaded:', reposData.length, 'repositories');
            console.log('Total stars:', githubData.allRepos.reduce((s, r) => s + r.stars, 0));
          }
        }
      } catch (err) {
        console.error('❌ GitHub fetch error:', err);
      }
    }

    // Calculate scores using backend logic
    console.log('🧮 Calculating scores from GitHub data only (fallback)...');

    const totalStars = githubData?.allRepos?.reduce((s, r) => s + r.stars, 0) || 0;
    const repoCount = githubData?.allRepos?.length || 0;
    const githubScore = Math.min(100, totalStars * 1.5 + repoCount * 2);
    console.log('📈 GitHub Score:', githubScore, '(Stars:', totalStars, ', Repos:', repoCount, ')');

    // Without LeetCode/Codeforces data in fallback
    const dsaScore = 0;
    const projectQuality = Math.min(100, repoCount * 3);
    const activeRepos = (githubData?.allRepos || []).filter(r => {
      const updatedDate = new Date(r.updatedAt);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return updatedDate > thirtyDaysAgo;
    }).length;
    const consistencyScore = Math.min(100, activeRepos * 15);

    let overall = 0.3 * githubScore + 0.25 * dsaScore + 0.25 * projectQuality + 0.2 * consistencyScore;
    overall = Math.min(100, overall);
    console.log('📈 Overall Score:', overall, '(GitHub fallback - no LeetCode/Codeforces data)');

    let careerLevel = 'Beginner';
    if (overall >= 80) careerLevel = 'Advanced';
    else if (overall >= 60) careerLevel = 'Intermediate';

    const candidateData = {
      githubHandle: github,
      leetcodeHandle: leetcode,
      codeforcesHandle: codeforces,
      name: github || 'Developer',
      email: `${github}@example.com`,
      overallScore: Math.round(overall),
      github: Math.round(githubScore),
      dsa: 0,
      projectQuality: Math.round(projectQuality),
      consistency: Math.round(consistencyScore),
      careerLevel,
      dateAdded: new Date().toLocaleDateString(),
      repositories: repoCount,
      followers: githubData?.followers || 0,
      problemsSolved: 0,
      codeforcesRating: 0,
      strengths: githubScore > 70 ? ['Strong GitHub presence'] : [],
      weaknesses: ['LeetCode/Codeforces data unavailable - use backend API']
    };

    console.log('✅ Candidate profile (fallback) complete:', candidateData);
    return candidateData;
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();

    console.log('🚀 Form submission started');
    console.log('Current form values:', manualForm);

    if (!manualForm.githubHandle && !manualForm.leetcodeHandle && !manualForm.codeforcesHandle) {
      console.warn('⚠️ No handles provided');
      alert('Please enter at least one handle (GitHub, LeetCode, or Codeforces)');
      return;
    }

    console.log('📍 Starting data fetch for handles:', {
      github: manualForm.githubHandle,
      leetcode: manualForm.leetcodeHandle,
      codeforces: manualForm.codeforcesHandle
    });

    const candidateData = await fetchCandidateData(
      manualForm.githubHandle,
      manualForm.leetcodeHandle,
      manualForm.codeforcesHandle
    );

    if (candidateData) {
      console.log('✅ Candidate data received:', candidateData);

      const newCandidate = {
        id: Date.now(),
        ...candidateData
      };

      console.log('📝 Adding new candidate to list:', newCandidate.id, newCandidate.name);

      setAllCandidates([...allCandidates, newCandidate]);
      setCandidates([...candidates, newCandidate]);
      setSelectedPreview(newCandidate.id);

      console.log('✅ Candidate added successfully. Total candidates:', allCandidates.length + 1);

      // Clear form
      setManualForm({
        githubHandle: '',
        leetcodeHandle: '',
        codeforcesHandle: ''
      });
    } else {
      console.error('❌ Failed to fetch candidate data');
    }
  };

  // Generate Excel template download
  const generateExcelTemplate = () => {
    const template = `Name,Email,GitHub Handle,LeetCode Handle,Codeforces Handle,Overall Score,GitHub Score,DSA Score,Project Quality Score,Consistency Score,Career Level,Technical Strengths,Weaknesses,Action Plan
John Doe,john@example.com,johndoe,johndoe,johndoe,85,90,80,85,75,Intermediate,Strong in web development and system design,Needs improvement in competitive programming,Focus on DSA practice
Jane Smith,jane@example.com,janesmith,janesmith,janesmith,92,88,95,90,92,Advanced,Excellent problem-solving skills,Limited open-source contributions,Build more public repositories

INSTRUCTIONS: Fill in candidate data matching the columns exactly. Scores (0-100) will be auto-calculated by the backend when imported.`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(template));
    element.setAttribute('download', 'candidate_import_template.csv');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Handle file upload - Send to backend for proper parsing
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    console.log('📁 File upload initiated:', file?.name);

    if (!file) {
      console.warn('⚠️ No file selected');
      return;
    }

    if (!['.xlsx', '.xls', '.csv'].some(ext => file.name.toLowerCase().endsWith(ext))) {
      alert('Please upload an Excel (.xlsx, .xls) or CSV file');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('📤 Uploading file to backend:', file.name);
      const response = await fetch('http://localhost:5001/api/analytics/bulk-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('📡 Upload response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Backend parsing result:', result);

      if (result.validCandidates === 0) {
        alert('⚠️ No valid candidates found in file. Please check the format.');
        setLoading(false);
        return;
      }

      // Stage 1: seed the table with stub rows so the recruiter sees something immediately
      const stubs = result.candidates.map((c, idx) => ({
        id: Date.now() + idx,
        name: c.name || c.githubHandle || c.leetcodeHandle || c.codeforcesHandle || 'Unknown',
        email: c.email || '',
        githubHandle: c.githubHandle || '',
        leetcodeHandle: c.leetcodeHandle || '',
        codeforcesHandle: c.codeforcesHandle || '',
        overallScore: 0,
        github: 0,
        dsa: 0,
        projectQuality: 0,
        consistency: 0,
        careerLevel: 'Analyzing…',
        strengths: [],
        weaknesses: [],
        techStack: [],
        domainTags: [],
        leetcodeTotalSolved: 0,
        leetcodeDominantDifficulty: 'None',
        dateAdded: new Date().toLocaleDateString(),
        status: 'analyzing'
      }));

      console.log(`✅ Parsed ${stubs.length} candidates. Starting sequential analysis…`);
      setAllCandidates(prev => [...prev, ...stubs]);
      setCandidates(prev => [...prev, ...stubs]);
      setActiveTab('candidates');

      // Stage 2: analyze them sequentially (GitHub will 403 if we hammer the API)
      let succeeded = 0;
      let failed = 0;
      for (let i = 0; i < stubs.length; i++) {
        const stub = stubs[i];
        const src = result.candidates[i];
        const hasAnyHandle = src.githubHandle || src.leetcodeHandle || src.codeforcesHandle;

        if (!hasAnyHandle) {
          console.warn(`⏭  Row ${i + 1} (${stub.name}) has no handles — skipping analysis`);
          // Mark as skipped so the recruiter can see at a glance
          setAllCandidates(prev => prev.map(c => c.id === stub.id ? { ...c, careerLevel: 'No handles', status: 'skipped' } : c));
          setCandidates(prev => prev.map(c => c.id === stub.id ? { ...c, careerLevel: 'No handles', status: 'skipped' } : c));
          continue;
        }

        console.log(`🔎 Analyzing ${i + 1}/${stubs.length}: ${stub.name}`);
        try {
          const data = await fetchCandidateData(
            src.githubHandle,
            src.leetcodeHandle,
            src.codeforcesHandle
          );
          if (data) {
            // Preserve original name/email from the spreadsheet — those are
            // recruiter-supplied and shouldn't be overwritten by the GitHub login.
            const merged = {
              ...stub,
              ...data,
              id: stub.id,
              name: stub.name,
              email: stub.email || data.email,
              status: 'analyzed'
            };
            setAllCandidates(prev => prev.map(c => c.id === stub.id ? merged : c));
            setCandidates(prev => prev.map(c => c.id === stub.id ? merged : c));
            succeeded++;
          } else {
            setAllCandidates(prev => prev.map(c => c.id === stub.id ? { ...c, careerLevel: 'Analysis failed', status: 'failed' } : c));
            setCandidates(prev => prev.map(c => c.id === stub.id ? { ...c, careerLevel: 'Analysis failed', status: 'failed' } : c));
            failed++;
          }
        } catch (err) {
          console.error(`❌ Analysis crashed for ${stub.name}:`, err);
          failed++;
        }

        // Polite pause between candidates — GitHub probes + repos + pinned analysis
        // is ~6 API calls per candidate; with 5000/hr we can comfortably do ~600/hr
        // but the backend itself sleeps too, so 500 ms here is plenty.
        if (i < stubs.length - 1) await new Promise(r => setTimeout(r, 500));
      }

      console.log(`✅ Bulk analysis complete. Succeeded: ${succeeded}, Failed: ${failed}, Total: ${stubs.length}`);
      alert(`Imported ${stubs.length} candidates.\nAnalyzed successfully: ${succeeded}\nFailed: ${failed}`);

    } catch (error) {
      console.error('❌ Upload error:', error);
      alert(`Error uploading file: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const applyFilters = () => {
    console.log('🔍 Applying filters...');
    console.log('Current filter settings:', filters);
    console.log('Total candidates before filter:', allCandidates.length);

    let filtered = allCandidates;

    // Score range
    if (filters.scoreRange) {
      filtered = filtered.filter(c =>
        (c.overallScore || 0) >= filters.scoreRange[0] &&
        (c.overallScore || 0) <= filters.scoreRange[1]
      );
      console.log('After score range:', filtered.length);
    }

    // Career level (Beginner / Intermediate / Advanced)
    if (filters.careerLevel !== 'all') {
      filtered = filtered.filter(c => c.careerLevel === filters.careerLevel);
      console.log('After career level:', filtered.length);
    }

    // Tech-stack multi-select (AND, case-insensitive)
    if (Array.isArray(filters.techStack) && filters.techStack.length > 0) {
      filtered = filtered.filter(c => {
        const cs = (c.techStack || []).map(t => String(t).toLowerCase());
        return filters.techStack.every(t => cs.includes(String(t).toLowerCase()));
      });
      console.log('After tech stack:', filtered.length);
    }

    // Domain (Web / Mobile / Data-ML / DevOps / Systems / Database)
    if (filters.domain && filters.domain !== 'all') {
      filtered = filtered.filter(c =>
        Array.isArray(c.domainTags) && c.domainTags.includes(filters.domain)
      );
      console.log('After domain:', filtered.length);
    }

    // LeetCode total solved (>= min)
    // Candidates still in 'analyzing' state are kept so they don't vanish
    // from the recruiter's view before their data has loaded.
    if (filters.leetcodeMin > 0) {
      filtered = filtered.filter(c => {
        if (c.status === 'analyzing') return true;
        return (c.leetcodeTotalSolved || 0) >= filters.leetcodeMin;
      });
      console.log('After LeetCode min:', filtered.length);
    }

    // LeetCode dominant difficulty
    if (filters.leetcodeDifficulty && filters.leetcodeDifficulty !== 'all') {
      filtered = filtered.filter(c => {
        if (c.status === 'analyzing') return true;
        return c.leetcodeDominantDifficulty === filters.leetcodeDifficulty;
      });
      console.log('After LC difficulty:', filtered.length);
    }

    console.log('✅ Filters applied. Final count:', filtered.length);

    setCandidates(filtered);
    setAppliedFilters({ ...filters });
    setShowFilterTabs(true);
  };

  // Build the list of tech-stack options dynamically from the candidates that
  // have actually been added — recruiter only sees stacks present in the pool.
  const availableTechStack = React.useMemo(() => {
    const set = new Set();
    allCandidates.forEach(c => (c.techStack || []).forEach(t => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allCandidates]);

  const toggleTechStack = (tech) => {
    setFilters(prev => {
      const has = prev.techStack.includes(tech);
      return {
        ...prev,
        techStack: has ? prev.techStack.filter(t => t !== tech) : [...prev.techStack, tech]
      };
    });
  };

  // Export selected candidates
  const exportCandidates = () => {
    console.log('📤 Starting export process...');
    console.log('Selected candidates count:', selectedCandidates.length);
    console.log('Total available candidates:', allCandidates.length);

    const toExport = selectedCandidates.length > 0 ?
      allCandidates.filter(c => selectedCandidates.includes(c.id)) :
      candidates;

    if (toExport.length === 0) {
      alert('⚠️ No candidates to export. Please select candidates first.');
      return;
    }

    console.log('Exporting candidates:', toExport.length);
    console.log('Export data:', toExport.map(c => ({ name: c.name, score: c.overallScore, level: c.careerLevel })));

    // Build CSV with proper escaping
    const headers = ['Name', 'Email', 'Overall Score', 'Career Level', 'GitHub Score', 'DSA Score', 'Project Quality', 'Consistency', 'GitHub Handle', 'LeetCode Handle', 'Codeforces Handle'];
    const csvRows = [headers.join(',')];

    toExport.forEach(c => {
      const row = [
        `"${c.name || ''}"`,
        `"${c.email || ''}"`,
        c.overallScore || 0,
        `"${c.careerLevel || ''}"`,
        c.github || 0,
        c.dsa || 0,
        c.projectQuality || 0,
        c.consistency || 0,
        `"${c.githubHandle || ''}"`,
        `"${c.leetcodeHandle || ''}"`,
        `"${c.codeforcesHandle || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    const csv = csvRows.join('\n');
    console.log('CSV generated:', csvRows.length, 'lines');

    // Use Blob for better compatibility
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const fileName = `candidates_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.display = 'none';

    document.body.appendChild(link);
    console.log('🔗 Download link created:', url);
    console.log('📥 Triggering download:', fileName);

    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);

    console.log('✅ Export completed:', fileName);
    alert(`✅ Downloaded ${toExport.length} candidates as ${fileName}`);
  };

  const filteredCandidates = candidates.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const avgScore = candidates.length > 0
    ? (candidates.reduce((sum, c) => sum + (c.overallScore || 0), 0) / candidates.length).toFixed(1)
    : '-';

  const topTierCount = candidates.filter(c => (c.overallScore || 0) >= 80).length;

  // Report-tab metrics — always run on the full population, NOT the
  // filtered/searched `candidates` array, so the report doesn't lie about
  // headcount whenever the recruiter narrows the table view.
  const reportPool = allCandidates;
  const reportAvgScore = reportPool.length > 0
    ? (reportPool.reduce((sum, c) => sum + (c.overallScore || 0), 0) / reportPool.length).toFixed(1)
    : '-';
  const reportTopTier = reportPool.filter(c => (c.overallScore || 0) >= 80).length;

  const goHome = () => {
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Get selected preview candidate
  const previewCandidate = selectedPreview ?
    allCandidates.find(c => c.id === selectedPreview) :
    null;

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 p-6 flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400">Recruiter Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Welcome, {user?.name || user?.email}</p>
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
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800 pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('candidates')}
            className={`px-6 py-2 font-medium rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'candidates'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            All Candidates ({allCandidates.length})
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-6 py-2 font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'add'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Plus size={18} /> Add Manually
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-6 py-2 font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'upload'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload size={18} /> Bulk Upload
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-6 py-2 font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'report'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <TrendingUp size={18} /> Report
          </button>
        </div>

        {/* CANDIDATES TAB */}
        {activeTab === 'candidates' && (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <p className="text-gray-400 text-sm">Total Candidates</p>
                <p className="text-3xl font-bold text-white mt-2">{allCandidates.length}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <p className="text-gray-400 text-sm">Showing</p>
                <p className="text-3xl font-bold text-white mt-2">{candidates.length}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <p className="text-gray-400 text-sm">Avg Score</p>
                <p className="text-3xl font-bold text-white mt-2">{avgScore}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <p className="text-gray-400 text-sm">Top Tier (80+)</p>
                <p className="text-3xl font-bold text-white mt-2">{topTierCount}</p>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 text-gray-500" size={20} />
                    <input
                      type="text"
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Overall Score Range</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.scoreRange[1]}
                      onChange={(e) => setFilters({...filters, scoreRange: [0, parseInt(e.target.value)]})}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">0 - {filters.scoreRange[1]}</p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Career Level</label>
                    <select
                      value={filters.careerLevel}
                      onChange={(e) => setFilters({...filters, careerLevel: e.target.value})}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="all">All Levels</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Domain</label>
                    <select
                      value={filters.domain}
                      onChange={(e) => setFilters({...filters, domain: e.target.value})}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="all">All Domains</option>
                      <option value="Web">Web</option>
                      <option value="Mobile">Mobile</option>
                      <option value="Data / ML">Data / ML</option>
                      <option value="DevOps">DevOps</option>
                      <option value="Systems">Systems</option>
                      <option value="Database">Database</option>
                      <option value="Blockchain">Blockchain</option>
                      <option value="GameDev">GameDev</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">LeetCode min solved</label>
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      step="10"
                      value={filters.leetcodeMin}
                      onChange={(e) => setFilters({...filters, leetcodeMin: parseInt(e.target.value)})}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">≥ {filters.leetcodeMin} problems</p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">LeetCode focus</label>
                    <select
                      value={filters.leetcodeDifficulty}
                      onChange={(e) => setFilters({...filters, leetcodeDifficulty: e.target.value})}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="all">Any difficulty</option>
                      <option value="Easy">Mostly Easy</option>
                      <option value="Medium">Mostly Medium</option>
                      <option value="Hard">Mostly Hard</option>
                    </select>
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      onClick={applyFilters}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-gray-950 px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Apply Filters
                    </button>
                    <button
                      onClick={() => {
                        setCandidates(allCandidates);
                        setFilters({
                          scoreRange: [0, 100],
                          careerLevel: 'all',
                          techStack: [],
                          domain: 'all',
                          leetcodeMin: 0,
                          leetcodeDifficulty: 'all'
                        });
                        setShowFilterTabs(false);
                      }}
                      className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Tech-stack chip multi-select */}
                {availableTechStack.length > 0 && (
                  <div className="pt-2">
                    <label className="block text-sm text-gray-400 mb-2">
                      Tech stack
                      <span className="text-xs text-gray-600 ml-2">
                        (candidates must have <span className="text-gray-400">all</span> selected)
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableTechStack.map(tech => {
                        const active = filters.techStack.includes(tech);
                        return (
                          <button
                            key={tech}
                            type="button"
                            onClick={() => toggleTechStack(tech)}
                            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                              active
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : 'bg-gray-950 text-gray-400 border-gray-800 hover:border-gray-600'
                            }`}
                          >
                            {tech}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            {showFilterTabs && Object.keys(appliedFilters).length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-sm text-gray-400">Active Filters:</span>
                {appliedFilters.scoreRange && appliedFilters.scoreRange[1] < 100 && (
                  <div className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg text-sm">
                    Score ≤ {appliedFilters.scoreRange[1]}
                  </div>
                )}
                {appliedFilters.careerLevel && appliedFilters.careerLevel !== 'all' && (
                  <div className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-lg text-sm">
                    {appliedFilters.careerLevel}
                  </div>
                )}
                {appliedFilters.domain && appliedFilters.domain !== 'all' && (
                  <div className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-lg text-sm">
                    Domain: {appliedFilters.domain}
                  </div>
                )}
                {appliedFilters.leetcodeMin > 0 && (
                  <div className="bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 px-3 py-1 rounded-lg text-sm">
                    LC ≥ {appliedFilters.leetcodeMin}
                  </div>
                )}
                {appliedFilters.leetcodeDifficulty && appliedFilters.leetcodeDifficulty !== 'all' && (
                  <div className="bg-orange-500/20 text-orange-300 border border-orange-500/30 px-3 py-1 rounded-lg text-sm">
                    Mostly {appliedFilters.leetcodeDifficulty}
                  </div>
                )}
                {Array.isArray(appliedFilters.techStack) && appliedFilters.techStack.length > 0 && (
                  appliedFilters.techStack.map(t => (
                    <div key={t} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-lg text-sm">
                      {t}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Candidates Table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {filteredCandidates.length === 0 ? (
                <div className="p-12 text-center">
                  <Users size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400 text-lg">No candidates found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-gray-800 bg-gray-950">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCandidates(filteredCandidates.map(c => c.id));
                              } else {
                                setSelectedCandidates([]);
                              }
                            }}
                          />
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Name</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Score</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Level</th>
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Scores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCandidates.map(candidate => (
                        <tr key={candidate.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedCandidates.includes(candidate.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCandidates([...selectedCandidates, candidate.id]);
                                } else {
                                  setSelectedCandidates(selectedCandidates.filter(id => id !== candidate.id));
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="px-6 py-4 text-sm text-white" onClick={() => setSelectedPreview(candidate.id)}>{candidate.name}</td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-3 py-1 rounded-lg font-bold ${
                              (candidate.overallScore || 0) >= 80 ? 'bg-green-500/20 text-green-400' :
                              (candidate.overallScore || 0) >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {candidate.overallScore || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-300">{candidate.careerLevel}</td>
                          <td className="px-6 py-4 text-xs text-gray-400">
                            GH:{candidate.github || 0} DSA:{candidate.dsa || 0} PQ:{candidate.projectQuality || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedCandidates.length > 0 && (
              <div className="mt-6 flex gap-3">
                <button
                  onClick={exportCandidates}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-gray-950 px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  <Download size={18} />
                  Export {selectedCandidates.length} Selected
                </button>
              </div>
            )}
          </>
        )}

        {/* ADD MANUALLY TAB - RESTRUCTURED */}
        {activeTab === 'add' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* LEFT: Input Form */}
            <div className="max-w-xl">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 sticky top-24">
                <h2 className="text-2xl font-bold mb-6 text-emerald-400">Add Candidate</h2>
                <p className="text-gray-400 text-sm mb-6">Enter GitHub, LeetCode, and Codeforces profiles. Scores will be auto-calculated from backend.</p>

                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">GitHub Handle</label>
                    <input
                      type="text"
                      placeholder="e.g., johndoe"
                      value={manualForm.githubHandle}
                      onChange={(e) => setManualForm({...manualForm, githubHandle: e.target.value})}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Your GitHub username</p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">LeetCode Handle</label>
                    <input
                      type="text"
                      placeholder="e.g., johndoe"
                      value={manualForm.leetcodeHandle}
                      onChange={(e) => setManualForm({...manualForm, leetcodeHandle: e.target.value})}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Your LeetCode username</p>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Codeforces Handle</label>
                    <input
                      type="text"
                      placeholder="e.g., johndoe"
                      value={manualForm.codeforcesHandle}
                      onChange={(e) => setManualForm({...manualForm, codeforcesHandle: e.target.value})}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">Your Codeforces username</p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-6 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-gray-950 px-6 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader size={18} className="animate-spin" /> : <Plus size={18} />}
                    {loading ? 'Analyzing Profiles...' : 'Add Candidate'}
                  </button>
                </form>
              </div>
            </div>

            {/* RIGHT: Added Candidates Tabs & Preview */}
            <div>
              {allCandidates.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
                  <Users size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400">Added candidates will appear here as tabs</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Candidate Tabs */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex gap-2 overflow-x-auto pb-4">
                      {allCandidates.map(candidate => (
                        <button
                          key={candidate.id}
                          onClick={() => setSelectedPreview(candidate.id)}
                          className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors text-sm ${
                            selectedPreview === candidate.id
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          {candidate.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview Card */}
                  {previewCandidate && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 space-y-6">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-2xl font-bold text-white">{previewCandidate.name}</h3>
                          <p className="text-gray-400 text-sm mt-1">{previewCandidate.email}</p>
                          <p className="text-gray-500 text-xs mt-2">Added: {previewCandidate.dateAdded}</p>
                        </div>
                        <span className={`px-4 py-2 rounded-lg font-bold text-lg ${
                          (previewCandidate.overallScore || 0) >= 80 ? 'bg-green-500/20 text-green-400' :
                          (previewCandidate.overallScore || 0) >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {previewCandidate.overallScore || 0}
                        </span>
                      </div>

                      {/* Profile Links */}
                      <div className="space-y-2 text-sm">
                        {previewCandidate.githubHandle && (
                          <p className="text-gray-300">
                            <span className="text-gray-500">GitHub:</span> {previewCandidate.githubHandle}
                          </p>
                        )}
                        {previewCandidate.leetcodeHandle && (
                          <p className="text-gray-300">
                            <span className="text-gray-500">LeetCode:</span> {previewCandidate.leetcodeHandle}
                          </p>
                        )}
                        {previewCandidate.codeforcesHandle && (
                          <p className="text-gray-300">
                            <span className="text-gray-500">Codeforces:</span> {previewCandidate.codeforcesHandle}
                          </p>
                        )}
                      </div>

                      <div className="border-t border-gray-800 pt-6">
                        <p className="text-sm text-gray-400 mb-4 font-semibold">Career Level</p>
                        <p className="text-white">{previewCandidate.careerLevel}</p>
                      </div>

                      {/* Score Breakdown */}
                      <div className="border-t border-gray-800 pt-6">
                        <p className="text-sm text-gray-400 mb-4 font-semibold">Score Breakdown</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-950 rounded-lg p-4">
                            <p className="text-xs text-gray-500">GitHub</p>
                            <p className="text-2xl font-bold text-blue-400">{previewCandidate.github || 0}</p>
                          </div>
                          <div className="bg-gray-950 rounded-lg p-4">
                            <p className="text-xs text-gray-500">DSA</p>
                            <p className="text-2xl font-bold text-purple-400">{previewCandidate.dsa || 0}</p>
                          </div>
                          <div className="bg-gray-950 rounded-lg p-4">
                            <p className="text-xs text-gray-500">Project Quality</p>
                            <p className="text-2xl font-bold text-emerald-400">{previewCandidate.projectQuality || 0}</p>
                          </div>
                          <div className="bg-gray-950 rounded-lg p-4">
                            <p className="text-xs text-gray-500">Consistency</p>
                            <p className="text-2xl font-bold text-orange-400">{previewCandidate.consistency || 0}</p>
                          </div>
                        </div>
                      </div>

                      {/* GitHub Stats */}
                      {previewCandidate.githubAnalysis && (
                        <div className="border-t border-gray-800 pt-6">
                          <p className="text-sm text-gray-400 mb-4 font-semibold">GitHub Stats</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="bg-gray-950 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Repositories</p>
                              <p className="text-xl font-bold text-blue-400">{previewCandidate.githubAnalysis.projectCount || 0}</p>
                            </div>
                            <div className="bg-gray-950 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Stars</p>
                              <p className="text-xl font-bold text-yellow-400">{previewCandidate.githubAnalysis.totalStars || 0}</p>
                            </div>
                            <div className="bg-gray-950 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Forks</p>
                              <p className="text-xl font-bold text-cyan-400">{previewCandidate.githubAnalysis.totalForks || 0}</p>
                            </div>
                            <div className="bg-gray-950 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Followers</p>
                              <p className="text-xl font-bold text-pink-400">{previewCandidate.githubAnalysis.followers || 0}</p>
                            </div>
                            <div className="bg-gray-950 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Active (30d)</p>
                              <p className="text-xl font-bold text-emerald-400">{previewCandidate.githubAnalysis.recentActivity || 0}</p>
                            </div>
                            <div className="bg-gray-950 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Avg ★ / Repo</p>
                              <p className="text-xl font-bold text-orange-400">{previewCandidate.githubAnalysis.avgStarsPerRepo ?? '–'}</p>
                            </div>
                          </div>

                          {Array.isArray(previewCandidate.githubAnalysis.languages) && previewCandidate.githubAnalysis.languages.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs text-gray-500 mb-2">Languages</p>
                              <div className="flex flex-wrap gap-2">
                                {previewCandidate.githubAnalysis.languages.map((l) => (
                                  <span key={l.name} className="bg-blue-500/10 text-blue-300 text-xs px-3 py-1 rounded-lg border border-blue-500/20">
                                    {l.name} <span className="text-gray-500">×{l.count}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {Array.isArray(previewCandidate.githubAnalysis.frameworks) && previewCandidate.githubAnalysis.frameworks.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-500 mb-2">Frameworks / Libraries</p>
                              <div className="flex flex-wrap gap-2">
                                {previewCandidate.githubAnalysis.frameworks.map((f) => (
                                  <span key={f} className="bg-purple-500/10 text-purple-300 text-xs px-3 py-1 rounded-lg border border-purple-500/20">
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tech Stack + Domains (top-level for quick scanning) */}
                      {(Array.isArray(previewCandidate.techStack) && previewCandidate.techStack.length > 0) || (Array.isArray(previewCandidate.domainTags) && previewCandidate.domainTags.length > 0) ? (
                        <div className="border-t border-gray-800 pt-6">
                          <p className="text-sm text-gray-400 mb-3 font-semibold">Tech Stack & Domains</p>
                          {Array.isArray(previewCandidate.domainTags) && previewCandidate.domainTags.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs text-gray-500 mb-2">Domains</p>
                              <div className="flex flex-wrap gap-2">
                                {previewCandidate.domainTags.map((d) => (
                                  <span key={d} className="bg-indigo-500/10 text-indigo-300 text-xs px-3 py-1 rounded-lg border border-indigo-500/20">
                                    {d}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {Array.isArray(previewCandidate.techStack) && previewCandidate.techStack.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500 mb-2">Full stack</p>
                              <div className="flex flex-wrap gap-2">
                                {previewCandidate.techStack.map((t) => (
                                  <span key={t} className="bg-emerald-500/10 text-emerald-300 text-xs px-3 py-1 rounded-lg border border-emerald-500/20">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}

                      {/* LeetCode Breakdown */}
                      {previewCandidate.leetcodeAnalysis && previewCandidate.leetcodeAnalysis.totalSolved > 0 && (
                        <div className="border-t border-gray-800 pt-6">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-sm text-gray-400 font-semibold">LeetCode</p>
                            <span className="text-xs text-gray-500">
                              Level: <span className="text-white">{previewCandidate.leetcodeAnalysis.level}</span>
                              {previewCandidate.leetcodeAnalysis.dominantDifficulty && previewCandidate.leetcodeAnalysis.dominantDifficulty !== 'None' && (
                                <> • Mostly <span className="text-white">{previewCandidate.leetcodeAnalysis.dominantDifficulty}</span></>
                              )}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-gray-950 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total Solved</p>
                              <p className="text-xl font-bold text-white">{previewCandidate.leetcodeAnalysis.totalSolved}</p>
                            </div>
                            <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
                              <p className="text-[10px] text-green-400 uppercase tracking-wider">Easy</p>
                              <p className="text-xl font-bold text-green-300">{previewCandidate.leetcodeAnalysis.easyCount}</p>
                            </div>
                            <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
                              <p className="text-[10px] text-yellow-400 uppercase tracking-wider">Medium</p>
                              <p className="text-xl font-bold text-yellow-300">{previewCandidate.leetcodeAnalysis.mediumCount}</p>
                            </div>
                            <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
                              <p className="text-[10px] text-red-400 uppercase tracking-wider">Hard</p>
                              <p className="text-xl font-bold text-red-300">{previewCandidate.leetcodeAnalysis.hardCount}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="bg-gray-950 text-gray-300 px-3 py-1 rounded-lg border border-gray-800">
                              Medium+Hard: {previewCandidate.leetcodeAnalysis.mediumHardPercentage}
                            </span>
                            {previewCandidate.leetcodeAnalysis.contestRating > 0 && (
                              <span className="bg-gray-950 text-gray-300 px-3 py-1 rounded-lg border border-gray-800">
                                Contest rating: {previewCandidate.leetcodeAnalysis.contestRating}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Codeforces */}
                      {previewCandidate.codeforcesAnalysis && previewCandidate.codeforcesAnalysis.rating > 0 && (
                        <div className="border-t border-gray-800 pt-6">
                          <p className="text-sm text-gray-400 mb-4 font-semibold">Codeforces</p>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-gray-950 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Rating</p>
                              <p className="text-xl font-bold text-white">{previewCandidate.codeforcesAnalysis.rating}</p>
                            </div>
                            <div className="bg-gray-950 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Rank</p>
                              <p className="text-sm font-bold text-purple-300 mt-1 capitalize">{previewCandidate.codeforcesAnalysis.rank}</p>
                            </div>
                            <div className="bg-gray-950 rounded-lg p-3">
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Solved</p>
                              <p className="text-xl font-bold text-emerald-400">{previewCandidate.codeforcesAnalysis.problemsSolved}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Strengths */}
                      {previewCandidate.strengths && (typeof previewCandidate.strengths === 'string' ? previewCandidate.strengths.length > 0 : previewCandidate.strengths.length > 0) && (
                        <div className="border-t border-gray-800 pt-6">
                          <p className="text-sm text-gray-400 mb-3 font-semibold">Strengths</p>
                          <div className="flex flex-wrap gap-2">
                            {(typeof previewCandidate.strengths === 'string' ?
                              previewCandidate.strengths.split(',') :
                              Array.isArray(previewCandidate.strengths) ?
                              previewCandidate.strengths : []
                            ).map((strength, idx) => (
                              <span key={idx} className="bg-green-500/10 text-green-400 text-xs px-3 py-1 rounded-lg border border-green-500/20">
                                {strength.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Weaknesses */}
                      {previewCandidate.weaknesses && (typeof previewCandidate.weaknesses === 'string' ? previewCandidate.weaknesses.length > 0 : previewCandidate.weaknesses.length > 0) && (
                        <div className="border-t border-gray-800 pt-6">
                          <p className="text-sm text-gray-400 mb-3 font-semibold">Areas to Improve</p>
                          <div className="flex flex-wrap gap-2">
                            {(typeof previewCandidate.weaknesses === 'string' ?
                              previewCandidate.weaknesses.split(',') :
                              Array.isArray(previewCandidate.weaknesses) ?
                              previewCandidate.weaknesses : []
                            ).map((w, idx) => (
                              <span key={idx} className="bg-red-500/10 text-red-400 text-xs px-3 py-1 rounded-lg border border-red-500/20">
                                {String(w).trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI Summary one-liner */}
                      {previewCandidate.summary && (
                        <div className="border-t border-gray-800 pt-6">
                          <p className="text-sm text-gray-400 mb-2 font-semibold">Summary</p>
                          <p className="text-gray-300 text-sm leading-relaxed">{previewCandidate.summary}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BULK UPLOAD TAB */}
        {activeTab === 'upload' && (
          <div className="max-w-2xl space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
              <h2 className="text-2xl font-bold mb-4 text-purple-400">Bulk Upload Candidates</h2>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                <p className="text-blue-400 text-sm mb-2">📋 Excel Format Guide:</p>
                <p className="text-gray-300 text-xs leading-relaxed">
                  The Excel sheet should have columns: Name, Email, GitHub Handle, LeetCode Handle, Codeforces Handle, and optional scores/details
                </p>
              </div>

              <button
                onClick={generateExcelTemplate}
                className="w-full mb-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Download size={20} />
                Download Excel Template
              </button>

              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="block w-full border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-500 hover:bg-gray-950 transition-colors"
                >
                  <Upload className="mx-auto text-gray-600 mb-2" size={32} />
                  <p className="text-white font-medium">Click to upload CSV file</p>
                  <p className="text-gray-500 text-sm mt-1">or drag and drop</p>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* REPORT TAB */}
        {activeTab === 'report' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-6">
              <h2 className="text-2xl font-bold text-yellow-400 mb-4">Candidate Analysis Report</h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Total Candidates</p>
                  <p className="text-3xl font-bold mt-2">{reportPool.length}</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Average Score</p>
                  <p className="text-3xl font-bold text-emerald-400 mt-2">{reportAvgScore}</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Top Tier (80+)</p>
                  <p className="text-3xl font-bold text-green-400 mt-2">{reportTopTier}</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Career Levels</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>B: {reportPool.filter(c => c.careerLevel === 'Beginner').length}</p>
                    <p>I: {reportPool.filter(c => c.careerLevel === 'Intermediate').length}</p>
                    <p>A: {reportPool.filter(c => c.careerLevel === 'Advanced').length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Score Distribution */}
            {reportPool.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Score Distribution</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="bg-gray-950 rounded-lg p-4 text-center">
                    <p className="text-yellow-400 font-bold">Excellent</p>
                    <p className="text-2xl mt-2">{reportPool.filter(c => (c.overallScore || 0) >= 90).length}</p>
                    <p className="text-xs text-gray-500 mt-1">90-100</p>
                  </div>
                  <div className="bg-gray-950 rounded-lg p-4 text-center">
                    <p className="text-green-400 font-bold">Very Good</p>
                    <p className="text-2xl mt-2">{reportPool.filter(c => (c.overallScore || 0) >= 80 && (c.overallScore || 0) < 90).length}</p>
                    <p className="text-xs text-gray-500 mt-1">80-90</p>
                  </div>
                  <div className="bg-gray-950 rounded-lg p-4 text-center">
                    <p className="text-blue-400 font-bold">Good</p>
                    <p className="text-2xl mt-2">{reportPool.filter(c => (c.overallScore || 0) >= 70 && (c.overallScore || 0) < 80).length}</p>
                    <p className="text-xs text-gray-500 mt-1">70-80</p>
                  </div>
                  <div className="bg-gray-950 rounded-lg p-4 text-center">
                    <p className="text-orange-400 font-bold">Average</p>
                    <p className="text-2xl mt-2">{reportPool.filter(c => (c.overallScore || 0) >= 60 && (c.overallScore || 0) < 70).length}</p>
                    <p className="text-xs text-gray-500 mt-1">60-70</p>
                  </div>
                  <div className="bg-gray-950 rounded-lg p-4 text-center">
                    <p className="text-red-400 font-bold">Below Avg</p>
                    <p className="text-2xl mt-2">{reportPool.filter(c => (c.overallScore || 0) < 60).length}</p>
                    <p className="text-xs text-gray-500 mt-1">0-60</p>
                  </div>
                </div>
              </div>
            )}

            {/* Top Performers */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">🏆 Top 5 Performers</h3>
              {[...reportPool]
                .sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))
                .slice(0, 5)
                .map((candidate, idx) => (
                  <div key={candidate.id} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                    <div>
                      <p className="text-white font-medium">#{idx + 1} {candidate.name}</p>
                      <p className="text-gray-500 text-sm">{candidate.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 font-bold text-lg">{candidate.overallScore || 0}</p>
                      <p className="text-gray-500 text-xs">{candidate.careerLevel}</p>
                    </div>
                  </div>
                ))}
            </div>

            {reportPool.length > 0 && (
              <button
                onClick={exportCandidates}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-gray-950 px-6 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Download size={20} />
                Export All Candidates
              </button>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
