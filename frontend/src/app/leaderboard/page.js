'use client';
import { useState, useEffect } from 'react';
import io from 'socket.io-client';
// Admin passcode state for starting quiz from leaderboard

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'https://quiz-ds0t.onrender.com';

export default function LeaderboardDashboard() {
  const [socket, setSocket] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [showTop3, setShowTop3] = useState(false);
  const [top3RevealStep, setTop3RevealStep] = useState(0);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('quizStateUpdate', (state) => {
      setQuizState(state);
    });

    newSocket.on('leaderboardUpdate', (lb) => {
      setLeaderboard(lb);
    });

    return () => newSocket.close();
  }, []);

  // Admin start quiz handler
  const handleStartQuiz = () => {
    const pass = prompt('Enter admin passcode to start quiz:');
    if (!pass) return;
    if (socket) {
      socket.emit('adminAction', { action: 'START_QUIZ', passcode: pass }, (res) => {
        if (!res.success) alert(res.error || 'Failed to start quiz');
      });
    }
  };

  // Admin stop quiz handler
  const handleStopQuiz = () => {
    const pass = prompt('Enter admin passcode to stop quiz:');
    if (!pass) return;
    if (socket) {
      socket.emit('adminAction', { action: 'STOP_QUIZ', passcode: pass }, (res) => {
        if (!res.success) alert(res.error || 'Failed to stop quiz');
      });
    }
  };

  // Admin restart quiz handler
  const handleRestartQuiz = () => {
    const pass = prompt('Enter admin passcode to restart quiz:');
    if (!pass) return;
    if (socket) {
      socket.emit('adminAction', { action: 'RESET_QUIZ', passcode: pass }, (res) => {
        if (!res.success) alert(res.error || 'Failed to restart quiz');
      });
    }
  };

  // Top 3 reveal sequence
  useEffect(() => {
    if (quizState?.status === 'COMPLETED') {
      setTimeout(() => setShowTop3(true), 3000);
    } else {
      setShowTop3(false);
      setTop3RevealStep(0);
    }
  }, [quizState?.status]);

  useEffect(() => {
    if (showTop3) {
      const timers = [
        setTimeout(() => setTop3RevealStep(1), 1000), // Reveal #3
        setTimeout(() => setTop3RevealStep(2), 4000), // Reveal #2
        setTimeout(() => setTop3RevealStep(3), 8000), // Reveal #1
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [showTop3]);


  if (!quizState) return <div className="flex-center" style={{height:'100vh'}}><h1 className="neon-text">INITIALIZING SYSTEM...</h1></div>;

  // 1. REGISTRATION PHASE
  if (quizState.status === 'WAITING' || quizState.status === 'READY') {
    return (
      <div style={{ padding: '2rem', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="neon-text" style={{ fontSize: '3rem' }}>TECHIVE QUIZ</h1>
            <h3 className="text-muted">LIVE ARENA</h3>
          </div>
          <div className="hud-panel" style={{ textAlign: 'center' }}>
            <h4 className="text-muted">PARTICIPANTS ONLINE</h4>
            <div className="neon-text" style={{ fontSize: '3rem', fontWeight: 'bold' }}>{quizState.totalParticipants}</div>
          </div>
        </div>
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button onClick={handleStartQuiz} className="neon-button" style={{ padding: '0.8rem 1.5rem', fontSize: '1.2rem', borderRadius: '8px', background: 'var(--accent-cyan)', color: '#000', border: 'none', cursor: 'pointer', marginRight: '10px' }}>START QUIZ</button>
          <button onClick={handleStopQuiz} className="neon-button" style={{ padding: '0.8rem 1.5rem', fontSize: '1.2rem', borderRadius: '8px', background: 'var(--accent-red)', color: '#000', border: 'none', cursor: 'pointer' }}>STOP QUIZ</button>
        </div>

        <div style={{ flex: 1, position: 'relative', marginTop: '2rem' }}>
          {leaderboard.map((p, i) => (
            <div 
              key={p.id}
              style={{
                position: 'absolute',
                // Randomish position for effect (based on index)
                top: `${(i * 37) % 80}%`,
                left: `${(i * 53) % 80}%`,
                padding: '10px 20px',
                background: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: '20px',
                animation: 'pulse 2s infinite',
                opacity: 0.8
              }}
            >
              ROBOT INCOMING... <strong className="neon-text">{p.name}</strong>
            </div>
          ))}
        </div>

        {quizState.status === 'READY' && (
          <div className="flex-center" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 10 }}>
            <div className="hud-panel" style={{ textAlign: 'center' }}>
              <h1 className="text-danger" style={{ fontSize: '4rem', animation: 'pulse-red 1s infinite' }}>SYSTEM ARMED</h1>
              <h2 style={{ marginTop: '1rem' }}>{quizState.totalParticipants} PARTICIPANTS READY</h2>
              <h3 className="neon-text" style={{ marginTop: '2rem' }}>AWAITING START SIGNAL...</h3>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. LIVE QUIZ PHASE
  if (quizState.status === 'LIVE') {
    return (
      <div className="responsive-layout">
        
        {/* Left Side: Question Status */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="hud-panel" style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <h3 className="text-muted">QUESTION {String(quizState.currentQuestionIndex + 1).padStart(2, '0')} / 20</h3>
            <div style={{ fontSize: '2rem', margin: '1.5rem 0', fontWeight: 'bold' }}>
              {quizState.currentQuestion?.questionText}
            </div>
            
            {quizState.currentQuestion && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', textAlign: 'left' }}>
                {['A', 'B', 'C', 'D'].map(opt => (
                  <div key={opt} style={{
                    background: 'rgba(0,0,0,0.5)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '1rem',
                    borderRadius: '8px'
                  }}>
                    <span style={{ color: 'var(--accent-cyan)', marginRight: '15px', fontWeight: 'bold' }}>{opt}.</span>
                    {quizState.currentQuestion[`option${opt}`]}
                  </div>
                ))}
              </div>
            )}
          </div>



          <div className="hud-panel" style={{ textAlign: 'center' }}>
            <h3 className="text-muted">ANSWERS RECEIVED</h3>
            <div className="neon-text" style={{ fontSize: '3rem', fontWeight: 'bold' }}>
              {quizState.answersReceivedForCurrent} / {quizState.activeParticipants}
            </div>
          </div>

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <button onClick={handleStopQuiz} className="neon-button" style={{ padding: '0.8rem 1.5rem', fontSize: '1.2rem', borderRadius: '8px', background: 'var(--accent-red)', color: '#000', border: 'none', cursor: 'pointer' }}>STOP QUIZ</button>
          </div>
        </div>

        {/* Right Side: Leaderboard List */}
        <div className="hud-panel" style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(0,240,255,0.3)', paddingBottom: '10px' }}>LIVE RANKINGS</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 100px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '10px', padding: '0 10px' }}>
            <div>RANK</div>
            <div>NAME</div>
            <div>COURSE</div>
            <div style={{ textAlign: 'right' }}>SCORE</div>
          </div>

          <div style={{ overflowY: 'hidden', flex: 1 }}>
            {leaderboard.slice(0, 15).map((p, index) => (
              <div 
                key={p.id} 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '60px 1fr 1fr 100px', 
                  padding: '12px 10px', 
                  marginBottom: '8px',
                  background: index === 0 ? 'rgba(0, 240, 255, 0.15)' : 'rgba(0,0,0,0.4)',
                  border: index === 0 ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  alignItems: 'center',
                  transition: 'all 0.5s ease',
                  fontSize: '1.2rem'
                }}
              >
                <div className="neon-text" style={{ fontWeight: 'bold' }}>#{index + 1}</div>
                <div style={{ fontWeight: index === 0 ? 'bold' : 'normal', color: index === 0 ? 'var(--accent-cyan)' : 'white' }}>{p.name}</div>
                <div className="text-muted">{p.course}</div>
                <div className="neon-text" style={{ textAlign: 'right', fontWeight: 'bold' }}>{p.score}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 3. FINAL RESULTS PHASE
  if (quizState.status === 'COMPLETED') {
    if (!showTop3) {
      return (
        <div className="flex-center" style={{ height: '100vh', flexDirection: 'column' }}>
          <h1 className="neon-text" style={{ fontSize: '4rem', animation: 'pulse 1s infinite' }}>CALCULATING FINAL RESULTS...</h1>
          <div className="scan-line"></div>
        </div>
      );
    }

    const top3 = leaderboard.slice(0, 3);
    const champion = top3[0];
    const second = top3[1];
    const third = top3[2];

    return (
      <div className="responsive-layout">
        
        {/* Left Side: Top 3 Podium */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <button onClick={handleRestartQuiz} className="neon-button" style={{ position: 'absolute', top: 0, left: 0, padding: '0.5rem 1rem', fontSize: '1rem', borderRadius: '4px', background: 'var(--accent-red)', color: '#000', border: 'none', cursor: 'pointer', zIndex: 100 }}>RESTART QUIZ</button>
          <h1 className="neon-text" style={{ fontSize: '3rem', letterSpacing: '5px', marginBottom: '4rem', animation: 'pulse 1s infinite' }}>SYSTEM CHAMPIONS</h1>
          
          <div className="podium-container">
            
            {/* #2 Place */}
            {top3RevealStep >= 2 && second && (
              <div className="hud-panel" style={{ width: '250px', textAlign: 'center', borderColor: 'var(--accent-purple)', height: '250px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h2 style={{ fontSize: '3rem', color: 'var(--accent-purple)', textShadow: '0 0 10px var(--accent-purple)' }}>#2</h2>
                <h3 style={{ fontSize: '1.5rem', margin: '10px 0' }}>{second.name}</h3>
                <div className="text-muted">{second.course}</div>
                <div className="neon-text" style={{ fontSize: '2rem', marginTop: '10px' }}>{second.score} PTS</div>
              </div>
            )}

            {/* #1 Champion */}
            {top3RevealStep >= 3 && champion && (
              <div className="hud-panel" style={{ width: '320px', padding: '30px', textAlign: 'center', background: 'rgba(0, 240, 255, 0.1)', borderColor: 'var(--accent-cyan)', boxShadow: '0 0 50px rgba(0,240,255,0.5)', height: '350px', display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 10 }}>
                <h2 style={{ fontSize: '4rem', color: 'var(--accent-cyan)', marginBottom: '10px' }}>#1</h2>
                <h3 style={{ fontSize: '2.2rem', margin: '10px 0' }}>{champion.name}</h3>
                <div className="text-muted" style={{ fontSize: '1.2rem' }}>{champion.course}</div>
                <div className="neon-text" style={{ fontSize: '3.5rem', marginTop: '15px', fontWeight: 'bold' }}>{champion.score} PTS</div>
              </div>
            )}

            {/* #3 Place */}
            {top3RevealStep >= 1 && third && (
              <div className="hud-panel" style={{ width: '250px', textAlign: 'center', height: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h2 className="text-amber" style={{ fontSize: '2.5rem' }}>#3</h2>
                <h3 style={{ fontSize: '1.5rem', margin: '10px 0' }}>{third.name}</h3>
                <div className="text-muted">{third.course}</div>
                <div className="neon-text" style={{ fontSize: '1.8rem', marginTop: '10px' }}>{third.score} PTS</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Top 10 List */}
        <div className="hud-panel" style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(0,240,255,0.3)', paddingBottom: '10px' }}>TOP 10 RANKINGS</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 80px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '10px', padding: '0 10px' }}>
            <div>RANK</div>
            <div>NAME</div>
            <div>COURSE</div>
            <div style={{ textAlign: 'right' }}>SCORE</div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {leaderboard.slice(0, 10).map((p, index) => (
              <div 
                key={p.id} 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '60px 1fr 1fr 80px', 
                  padding: '12px 10px', 
                  marginBottom: '8px',
                  background: index === 0 ? 'rgba(0, 240, 255, 0.15)' : (index < 3 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.4)'),
                  border: index === 0 ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  alignItems: 'center',
                  fontSize: '1.1rem'
                }}
              >
                <div className="neon-text" style={{ fontWeight: 'bold', color: index === 0 ? 'var(--accent-cyan)' : (index === 1 ? 'var(--accent-purple)' : (index === 2 ? 'var(--accent-amber)' : 'white')) }}>#{index + 1}</div>
                <div style={{ fontWeight: index < 3 ? 'bold' : 'normal', color: index === 0 ? 'var(--accent-cyan)' : 'white' }}>{p.name}</div>
                <div className="text-muted">{p.course}</div>
                <div className="neon-text" style={{ textAlign: 'right', fontWeight: 'bold' }}>{p.score}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
