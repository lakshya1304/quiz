'use client';
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'https://quiz-ds0t.onrender.com';

export default function ParticipantDashboard() {
  const [socket, setSocket] = useState(null);
  
  // States: REGISTER, WAITING, LIVE, RESULT, DISQUALIFIED
  const [localState, setLocalState] = useState('REGISTER');
  
  // Data
  const [participantId, setParticipantId] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [scoreData, setScoreData] = useState({ score: 0, rank: 0, correct: 0, wrong: 0, unanswered: 0, speedBonuses: 0 });
  const [form, setForm] = useState({ name: '', course: '' });
  
  // Live Question Data
  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedOption, setSelectedOption] = useState(null);
  const [lockedOption, setLockedOption] = useState(null);
  const [questionResult, setQuestionResult] = useState(null); // { isCorrect, correctAnswer, points, speedBonus }

  const hasJoinedRef = useRef(false);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('quizStateUpdate', (state) => {
      setQuizState(state);
    });

    newSocket.on('leaderboardUpdate', (leaderboard) => {
      if (hasJoinedRef.current) {
        // Find our rank and score
        const me = leaderboard.findIndex(p => p.id === hasJoinedRef.current);
        if (me !== -1) {
          const myData = leaderboard[me];
          setScoreData({
            score: myData.score,
            rank: me + 1,
            correct: myData.correctAnswers || 0,
            wrong: myData.wrongAnswers || 0,
            unanswered: myData.unanswered || 0,
            speedBonuses: myData.speedBonuses || 0
          });
        }
      }
    });

    newSocket.on('questionLocked', (data) => {
      if (!selectedOption) {
        // Automatically mark unanswered if no option was selected
        // We do this logically by not letting them select anymore
        setLockedOption('TIME_UP');
      }
    });

    newSocket.on('disqualified', () => {
      setLocalState('DISQUALIFIED');
    });

    return () => newSocket.close();
  }, []);

  // Sync Local State with Global Quiz State
  useEffect(() => {
    if (!quizState || !hasJoinedRef.current || localState === 'DISQUALIFIED') return;

    if (quizState.status === 'WAITING' || quizState.status === 'READY') {
      setLocalState('WAITING');
    } else if (quizState.status === 'LIVE') {
      setLocalState('LIVE');
    } else if (quizState.status === 'COMPLETED') {
      setLocalState('RESULT');
    }
  }, [quizState?.status]);

  // Handle new question reset
  useEffect(() => {
    if (quizState?.status === 'LIVE' && quizState.currentQuestion) {
      setSelectedOption(null);
      setLockedOption(null);
      setQuestionResult(null);
    }
  }, [quizState?.currentQuestionIndex]);

  // Handle local timer
  useEffect(() => {
    if (quizState?.status === 'LIVE' && quizState.currentQuestion) {
      // Initialize time left from the server's remaining time estimation
      // We assume the server sends 'timeRemaining' in the state, but if not, fallback to 15
      const initialRemaining = quizState.timeRemaining ?? 15;
      setTimeLeft(initialRemaining);
      
      const interval = setInterval(() => {
        setTimeLeft(prev => {
          const next = Math.max(0, prev - 1);
          if (next === 0 && !lockedOption) {
            setLockedOption('TIME_UP');
          }
          return next;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [quizState?.currentQuestionIndex, quizState?.status]);

  // --- ANTI CHEAT ---
  useEffect(() => {
    const handleViolation = (type) => {
      if (hasJoinedRef.current && (localState === 'WAITING' || localState === 'LIVE')) {
        socket.emit('reportViolation', { participantId: hasJoinedRef.current, type });
        setLocalState('DISQUALIFIED');
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) handleViolation('TAB_SWITCH');
    };

    const onBlur = () => {
      handleViolation('WINDOW_BLUR');
    };

    // document.addEventListener('visibilitychange', onVisibilityChange);
    // window.addEventListener('blur', onBlur);

    return () => {
      // document.removeEventListener('visibilitychange', onVisibilityChange);
      // window.removeEventListener('blur', onBlur);
    };
  }, [localState, socket]);


  const handleRegister = (e) => {
    e.preventDefault();
    if (!form.name || !form.course) return;
    
socket.emit('register', form, (res) => {
        if (res.success) {
          setParticipantId(res.participantId);
          hasJoinedRef.current = res.participantId;
          if (quizState?.status === 'LIVE') {
            setLocalState('LIVE');
          } else {
            setLocalState('WAITING');
          }
        }
      });
  };

  const handleRestart = () => {
    // Reset client side
    setParticipantId(null);
    hasJoinedRef.current = null;
    setLocalState('REGISTER');
  };

  const handleOptionSelect = (option) => {
    if (lockedOption || timeLeft === 0 || !quizState?.currentQuestion) return;
    
    setSelectedOption(option);
    setLockedOption(option);

    socket.emit('submitAnswer', {
      participantId,
      selectedOption: option
    }, (res) => {
      if (res.success) {
        setQuestionResult(res);
      }
    });
  };

  // Renders
  if (localState === 'REGISTER') {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="neon-text" style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>TECHIVE QUIZ</h1>
          <h3 className="text-muted">ENGINEER'S DAY</h3>
          <p style={{ marginTop: '1rem', fontStyle: 'italic' }}>THINK FAST. ANSWER SMART. BE THE SYSTEM CHAMPION.</p>
        </div>

        <form onSubmit={handleRegister} className="hud-panel" style={{ width: '400px', maxWidth: '90%' }}>
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>SYSTEM LOGIN</h2>
          
          <input 
            type="text" 
            placeholder="FULL NAME" 
            className="input-field" 
            value={form.name}
            onChange={(e) => setForm({...form, name: e.target.value})}
            required
          />
                   <input 
            type="text" 
            placeholder="COURSE" 
            className="input-field" 
            value={form.course}
            onChange={(e) => setForm({ ...form, course: e.target.value })}
            required 
            style={{ appearance: 'none', background: 'rgba(0,0,0,0.8)' }} />
          
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
            ENTER THE ARENA
          </button>
        </form>
      </div>
    );
  }

  if (localState === 'WAITING') {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', textAlign: 'center' }}>
        <div className="hud-panel" style={{ width: '500px', maxWidth: '90%' }}>
          <h2 className="text-success" style={{ marginBottom: '1rem' }}>REGISTRATION COMPLETE</h2>
          <h3 className="neon-text">SYSTEM READY</h3>
          
          <div style={{ margin: '2rem 0', padding: '1rem', border: '1px dashed rgba(0, 240, 255, 0.3)' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{form.name}</div>
            <div className="text-muted">{form.course}</div>
          </div>
          
          <p style={{ fontStyle: 'italic', marginBottom: '1rem', animation: 'pulse 1.5s infinite' }}>
            WAITING FOR SYSTEM ACTIVATION...
          </p>
          
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            REGISTERED PARTICIPANTS: <span className="neon-text">{quizState?.totalParticipants || 1}</span>
          </div>
        </div>
      </div>
    );
  }

  if (localState === 'DISQUALIFIED') {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', textAlign: 'center' }}>
        {/* Quiz control buttons removed as per new requirements */}
        <div className="hud-panel">
          <h3 className="text-danger" style={{ marginBottom: '1rem' }}>SYSTEM LOCKOUT</h3>
          <p className="text-muted">You have been disqualified for violation of arena rules.</p>
        </div>
      </div>
    );
  }

  if (localState === 'LIVE' && quizState?.currentQuestion) {
    const q = quizState.currentQuestion;
    return (
      <div className="container" style={{ paddingTop: '2rem', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        
        {/* Header Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', padding: '10px 20px', background: 'var(--panel-bg)', borderBottom: '1px solid var(--accent-cyan)' }}>
          <div style={{ fontSize: '1.2rem' }}>SCORE: <span className="neon-text">{scoreData.score}</span></div>
          <div style={{ fontSize: '1.2rem', color: timeLeft <= 5 ? 'var(--accent-red)' : 'var(--accent-cyan)' }}>
            TIME LEFT: {timeLeft}s
          </div>
        </div>

        {/* Question Area */}
        <div className="hud-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h4 className="text-muted" style={{ marginBottom: '1rem' }}>QUESTION {String(q.questionNumber).padStart(2, '0')}</h4>
          <h2 style={{ fontSize: '2rem', marginBottom: '2rem' }}>{q.questionText}</h2>

          <div className="options-grid">
            {['A', 'B', 'C', 'D'].map(opt => {
              const text = q[`option${opt}`];
              
              let bgColor = 'rgba(0,0,0,0.5)';
              let borderColor = 'rgba(255,255,255,0.2)';
              
              if (questionResult) {
                if (questionResult.correctAnswer === opt) {
                  bgColor = 'rgba(0, 255, 102, 0.2)';
                  borderColor = 'var(--accent-green)';
                } else if (selectedOption === opt && !questionResult.isCorrect) {
                  bgColor = 'rgba(255, 42, 42, 0.2)';
                  borderColor = 'var(--accent-red)';
                }
              } else if (selectedOption === opt) {
                bgColor = 'rgba(0, 240, 255, 0.2)';
                borderColor = 'var(--accent-cyan)';
              }

              return (
                <button
                  style={{
                    background: bgColor,
                    border: `2px solid ${borderColor}`,
                    padding: '1rem',
                    borderRadius: '8px',
                    cursor: selectedOption ? 'default' : 'pointer',
                    opacity: selectedOption ? 0.6 : 1,
                    minWidth: '120px',
                    textAlign: 'left',
                  }}
                  disabled={!!selectedOption}
                  onClick={() => handleOptionSelect(opt)}
                >
                  <span style={{ color: 'var(--accent-cyan)', marginRight: '15px', fontWeight: 'bold' }}>{opt}.</span>
                  {text}
                </button>
              );
            })}
          </div>

          {/* Feedback Area */}
          <div style={{ height: '80px', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {questionResult && (
              <div style={{ textAlign: 'center' }}>
                <h2 className={questionResult.isCorrect ? 'text-success' : 'text-danger'}>
                  {questionResult.isCorrect ? 'CORRECT' : 'WRONG'}
                </h2>
                <div style={{ fontSize: '1.2rem', marginTop: '5px' }}>
                  +{questionResult.points} POINTS
                  {questionResult.speedBonus > 0 && <span className="neon-text" style={{marginLeft: '10px'}}>(+2 SPEED BONUS)</span>}
                </div>
              </div>
            )}
            {lockedOption === 'TIME_UP' && !questionResult && (
              <div style={{ textAlign: 'center' }}>
                <h2 className="text-amber">TIME UP</h2>
                <div style={{ fontSize: '1.2rem', marginTop: '5px' }}>0 POINTS</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (localState === 'RESULT') {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', textAlign: 'center' }}>
        <h1 className="neon-text" style={{ fontSize: '3.5rem', marginBottom: '2rem' }}>QUIZ COMPLETE</h1>
        
        <div className="hud-panel" style={{ width: '600px', maxWidth: '90%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '2rem' }}>
            <div>
              <h4 className="text-muted">YOUR SCORE</h4>
              <div className="neon-text" style={{ fontSize: '4rem', fontWeight: 'bold' }}>{scoreData.score}</div>
            </div>
            <div>
              <h4 className="text-muted">YOUR RANK</h4>
              <div className="neon-text" style={{ fontSize: '4rem', fontWeight: 'bold' }}>#{scoreData.rank}</div>
            </div>
          </div>

          <div className="options-grid" style={{ textAlign: 'left', background: 'rgba(0,0,0,0.5)', padding: '20px', borderRadius: '4px' }}>
            <div>CORRECT ANSWERS: <span className="text-success">{scoreData.correct}</span></div>
            <div>WRONG ANSWERS: <span className="text-danger">{scoreData.wrong}</span></div>
            <div>UNANSWERED: <span className="text-amber">{scoreData.unanswered}</span></div>
            <div>SPEED BONUSES: <span className="neon-text">{scoreData.speedBonuses}</span></div>
          </div>
          
          <h3 style={{ marginTop: '2rem', animation: 'pulse 2s infinite' }}>WATCH THE LIVE LEADERBOARD</h3>
        </div>
      </div>
    );
  }

  // Fallback
  return <div className="flex-center" style={{height: '100vh'}}>LOADING...</div>;
}
