import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { io } from 'socket.io-client';
import { Users, LogOut, Copy, Play, CheckCircle2, XCircle, Home } from 'lucide-react';

let socket;

export default function CodeArena() {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();
  const [inRoom, setInRoom] = useState(false);
  const [room, setRoom] = useState(null);
  const [joinId, setJoinId] = useState('');
  
  // Question Bank
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [testResults, setTestResults] = useState([]);

  // Editor State
  const [code, setCode] = useState('// Write your solution here...');
  const [language, setLanguage] = useState('javascript');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  const isTypingRef = useRef(false);

  // Fetch Questions
  useEffect(() => {
    fetch('http://localhost:5001/api/execution/questions', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setAvailableQuestions(data || []))
      .catch(console.error);
  }, [token]);

  // Socket Setup
  useEffect(() => {
    socket = io('http://localhost:5001');

    socket.on('user_joined', (data) => {
      setNotifications(prev => [...prev, data.message]);
      setTimeout(() => setNotifications(prev => prev.filter(msg => msg !== data.message)), 3000);
    });

    socket.on('room_updated', (updatedRoom) => {
      setRoom(updatedRoom);
    });

    socket.on('game_started', (updatedRoom) => {
      setRoom(updatedRoom);
      setNotifications(prev => [...prev, 'Game Started! Good Luck!']);
    });

    socket.on('code_update', (newCode) => {
      isTypingRef.current = false;
      setCode(newCode);
    });

    socket.on('language_update', (newLang) => setLanguage(newLang));

    socket.on('leaderboard_updated', (players) => {
      setRoom(prev => ({ ...prev, players }));
    });

    socket.on('game_over', (players) => {
      setRoom(prev => ({ ...prev, players, status: 'finished' }));
      alert('Game Over! Check the leaderboard for the winner!');
    });

    socket.on('error', (err) => alert(err));

    return () => socket.disconnect();
  }, []);

  const goHome = () => {
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const createRoom = () => {
    if (selectedQuestionIds.length === 0) return alert('Please select at least one question!');

    // Find the full question objects
    const questionsToSend = availableQuestions.filter(q => selectedQuestionIds.includes(q.id));

    const newRoomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    setInRoom(true);
    socket.emit('create_room', { roomId: newRoomId, user: { name: user?.name || 'Anonymous' }, questions: questionsToSend });
  };

  const joinRoom = () => {
    if (!joinId.trim()) return;
    setInRoom(true);
    socket.emit('join_room', { roomId: joinId.toUpperCase(), user: { name: user?.name || 'Anonymous' } });
  };

  const startGame = () => {
    if (room && room.host === socket.id) {
      socket.emit('start_game', room.id);
    }
  };

  const handleEditorChange = (value) => {
    setCode(value);
    if (isTypingRef.current && room) {
      socket.emit('code_change', { roomId: room.id, code: value });
    }
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    if (room) socket.emit('language_change', { roomId: room.id, language: newLang });
  };

  // Run Code against Judge0 Test Cases
  const handleRunCode = async () => {
    setLoading(true);
    setOutput('Executing test cases...');
    setTestResults([]);

    const currentQuestion = room?.questions?.[currentQuestionIndex];
    
    if (!currentQuestion) {
      // Freeform execution (No active question)
      try {
        const response = await fetch('http://localhost:5001/api/execution/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ code, language, input })
        });
        const data = await response.json();
        if (data.compileOutput) setOutput(`Compilation Error:\n${data.compileOutput}`);
        else if (data.stderr) setOutput(`Runtime Error:\n${data.stderr}`);
        else setOutput(`Status: ${data.status}\n\nOutput:\n${data.stdout || 'No output'}`);
      } catch (err) {
        setOutput(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Competitive Execution with Background Auto-Grading Test Cases
    try {
        const response = await fetch('http://localhost:5001/api/execution/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ code, language, problemId: currentQuestion.id })
        });
        const data = await response.json();
        
        if (data.error) {
            setOutput(`Error: ${data.error}`);
            setLoading(false);
            return;
        }

        let outputStr = `Final Status: ${data.status}\nPassed ${data.passedCount}/${data.totalCases} Cases\nTime: ${data.time}s Memory: ${data.memory}KB\n\n`;

        if (data.compileOutput) {
            outputStr += `[COMPILE ERROR]\n${data.compileOutput}\n\n`;
        } else if (data.stderr) {
            outputStr += `[RUNTIME ERROR]\n${data.stderr}\n\n`;
        }

        if (data.details && data.details.length > 0) {
            data.details.forEach(tc => {
                outputStr += `Test Case #${tc.testCaseIndex}: ${tc.status}\n`;
                if (tc.status !== 'Accepted') {
                    outputStr += `  Expected: ${tc.expected || 'N/A'}\n`;
                    outputStr += `  Your Output: ${tc.output || 'N/A'}\n`;
                }
            });
        }

        setOutput(outputStr);

        // Auto-award points if full pass!
        if (data.status === 'Accepted') {
            socket.emit('submit_success', { roomId: room.id, points: 100 });
            
            // Auto advance to next question if possible
            setTimeout(() => {
                if (currentQuestionIndex < room.questions.length - 1) {
                    setCurrentQuestionIndex(prev => prev + 1);
                    setCode('// Moving to next problem...');
                    setOutput('Advanced to next problem! Good luck.');
                }
            }, 3000);
        }

    } catch (err) {
        setOutput(`Error: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  // --- LOBBY SETUP VIEW ---
  if (!inRoom || !room) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center text-white font-sans">
        {/* Header */}
        <header className="w-full bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-emerald-400">DevSphere Arena</h1>
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
              title="Logout"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </header>

        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 p-6 mt-10">
          
          {/* Left: Create Room */}
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl">
            <h2 className="text-2xl font-bold text-emerald-400 mb-2">Create Competitive Room</h2>
            <p className="text-gray-400 text-sm mb-6">Select problems for your arena battle.</p>
            
            <div className="h-64 overflow-y-auto mb-6 bg-gray-950 border border-gray-800 rounded-lg p-2">
              {availableQuestions.map(q => (
                <label key={q.id} className="flex items-start gap-3 p-3 hover:bg-gray-800 rounded cursor-pointer border-b border-gray-800 last:border-0">
                  <input 
                    type="checkbox" 
                    className="mt-1"
                    checked={selectedQuestionIds.includes(q.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedQuestionIds(prev => [...prev, q.id]);
                      else setSelectedQuestionIds(prev => prev.filter(id => id !== q.id));
                    }}
                  />
                  <div>
                    <div className="font-bold">{q.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{q.difficulty} • {q.topics?.join(', ')}</div>
                  </div>
                </label>
              ))}
              {availableQuestions.length === 0 && <div className="p-4 text-center text-gray-500">Loading questions...</div>}
            </div>
            
            <button 
              onClick={createRoom}
              className="w-full bg-emerald-500 text-gray-950 font-bold py-3 rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Create & Host Room
            </button>
          </div>

          {/* Right: Join Room */}
          <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl flex flex-col justify-center">
             <h2 className="text-2xl font-bold text-blue-400 mb-2">Join Existing Room</h2>
             <p className="text-gray-400 text-sm mb-6">Enter a 7-character room code to join a friend.</p>
             
             <input 
              type="text" 
              placeholder="e.g. A1B2C3D" 
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              className="w-full bg-gray-950 border border-gray-800 text-white px-4 py-4 rounded-lg focus:outline-none focus:border-blue-500 mb-4 text-center font-mono text-xl tracking-widest uppercase"
            />
            <button 
              onClick={joinRoom}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors"
            >
              Enter Arena
            </button>
          </div>

        </div>
      </div>
    );
  }

  // --- WAITING ROOM ---
  if (room.status === 'lobby') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col text-white font-sans">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-emerald-400">DevSphere Arena</h1>
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
              title="Logout"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </header>

        <div className="flex flex-col justify-center items-center flex-1 p-6">
        <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl text-center max-w-lg w-full">
           <h2 className="text-3xl font-bold text-emerald-400 mb-2">Waiting Room</h2>
           <p className="text-gray-400 mb-6">Share this code with your friends!</p>
           
           <div className="bg-gray-950 border border-emerald-500/30 p-4 rounded-xl text-4xl font-mono tracking-[0.5em] mb-8 font-black text-white">
             {room.id}
           </div>

           <div className="bg-gray-950 rounded-lg p-4 border border-gray-800 mb-8 text-left">
             <h3 className="font-bold text-gray-300 mb-3 border-b border-gray-800 pb-2">Players Connected ({room.players.length})</h3>
             <ul className="space-y-2">
               {room.players.map(p => (
                 <li key={p.id} className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                   {p.name} {p.id === room.host && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 rounded">HOST</span>}
                 </li>
               ))}
             </ul>
           </div>

           {room.host === socket.id ? (
             <button onClick={startGame} className="w-full bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold py-3 rounded-lg transition-colors">
               Start Match Now
             </button>
           ) : (
             <div className="text-gray-500 italic animate-pulse">Waiting for host to start the match...</div>
           )}
        </div>
        </div>
      </div>
    );
  }

  // --- ACTIVE ARENA ---
  const currentQ = room.questions?.[currentQuestionIndex];

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col font-sans">
      {/* Toast Notifications */}
      <div className="absolute top-20 right-4 z-50 flex flex-col gap-2">
        {notifications.map((msg, i) => (
          <div key={i} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded shadow-lg flex items-center gap-2 animate-fade-in">
            <Users size={16} /> {msg}
          </div>
        ))}
      </div>

      <header className="bg-gray-900 border-b border-gray-800 p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-emerald-400">DevSphere Arena</h1>
          <div className="bg-gray-950 border border-gray-800 px-3 py-1 rounded-md text-sm font-mono tracking-widest">
            ROOM: {room.id}
          </div>
          <span className="text-gray-400 text-sm">{user?.name || 'Anonymous'}</span>
        </div>

        <div className="flex gap-4 items-center">
          <select value={language} onChange={handleLanguageChange} className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm">
            <option value="javascript">JavaScript</option>
            <option value="python">Python 3</option>
            <option value="cpp">C++</option>
          </select>
          <button onClick={handleRunCode} disabled={loading || room.status === 'finished'} className="bg-emerald-500 hover:bg-emerald-400 text-gray-950 px-6 py-2 rounded font-bold transition-colors">
            {loading ? 'Judging...' : 'Submit Code'}
          </button>
          <button onClick={() => setInRoom(false)} className="text-gray-400 hover:text-gray-300 transition-colors" title="Leave Room"><LogOut size={20} /></button>
          <button
            onClick={goHome}
            className="text-blue-400 hover:text-blue-300 transition-colors"
            title="Go to Home"
          >
            <Home size={20} />
          </button>
          <button
            onClick={handleLogout}
            className="text-red-400 hover:text-red-300 transition-colors"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        
        {/* Left: Problem Statement & Leaderboard */}
        <div className="w-1/4 flex flex-col bg-gray-900 border-r border-gray-800 overflow-y-auto">
          <div className="p-6 border-b border-gray-800">
             <h2 className="text-xl font-bold mb-2">{currentQ?.title || 'No Problem Selected'}</h2>
             <div className="text-sm text-gray-400 mb-6 flex gap-2">
                <span className="bg-gray-800 px-2 py-1 rounded">{currentQ?.difficulty || 'N/A'}</span>
             </div>
             {currentQ?.description ? (
                 <div className="prose prose-invert prose-sm" dangerouslySetInnerHTML={{ __html: currentQ.description }} />
             ) : (
                 <p className="text-gray-500 italic">This room was created without any questions in the bank. You are in free-code mode.</p>
             )}
          </div>
          
          <div className="p-6">
            <h3 className="font-bold text-gray-400 mb-4 uppercase tracking-wider text-xs">Live Leaderboard</h3>
            <ul className="space-y-3">
               {[...room.players].sort((a,b) => b.score - a.score).map((p, i) => (
                 <li key={p.id} className="flex justify-between items-center bg-gray-950 p-3 rounded border border-gray-800">
                   <div className="flex items-center gap-3">
                      <span className="text-gray-500 font-mono text-xs">#{i+1}</span>
                      <span className="font-bold">{p.name}</span>
                   </div>
                   <div className="text-emerald-400 font-mono font-bold">{p.score} pts</div>
                 </li>
               ))}
            </ul>
          </div>
        </div>

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col" onKeyDown={() => isTypingRef.current = true}>
          <Editor
            height="100%"
            theme="vs-dark"
            language={language}
            value={code}
            onChange={handleEditorChange}
            options={{ minimap: { enabled: false }, fontSize: 15, fontFamily: "'JetBrains Mono', monospace", padding: { top: 16 } }}
          />
        </div>

        {/* Right: I/O & Output */}
        <div className="w-1/4 flex flex-col bg-gray-900 border-l border-gray-800">
          <div className="flex-1 flex flex-col border-b border-gray-800">
             <div className="px-4 py-2 text-xs font-mono text-gray-400 border-b border-gray-800 bg-gray-950">Standard Input</div>
             <textarea 
                className="flex-1 w-full bg-gray-900 text-gray-300 p-4 font-mono text-sm resize-none focus:outline-none"
                placeholder="Enter input here..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
             />
          </div>
          <div className="flex-1 flex flex-col">
             <div className="px-4 py-2 text-xs font-mono text-gray-400 border-b border-gray-800 bg-gray-950">Console Output</div>
             <div className="flex-1 w-full bg-gray-900 text-emerald-400 p-4 font-mono text-sm overflow-auto whitespace-pre-wrap">
               {output}
             </div>
          </div>
        </div>

      </main>
    </div>
  );
}
