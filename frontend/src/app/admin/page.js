'use client';
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://quiz-ds0t.onrender.com';

export default function AdminDashboard() {
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [socket, setSocket] = useState(null);
  
  const [quizState, setQuizState] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  // New Question Form
  const [form, setForm] = useState({
    questionNumber: '',
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A'
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });
    const data = await res.json();
    if (data.success) {
      setIsAuthenticated(true);
      initSocket();
      fetchQuestions();
    } else {
      alert('Invalid Passcode');
    }
  };

  const initSocket = () => {
    const newSocket = io(API_URL);
    setSocket(newSocket);
    newSocket.on('quizStateUpdate', (state) => {
      setQuizState(state);
    });
  };

  const fetchQuestions = async () => {
    const res = await fetch(`${API_URL}/api/questions`);
    const data = await res.json();
    setQuestions(data);
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    await fetch(`${API_URL}/api/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setForm({ ...form, questionNumber: '', questionText: '' });
    fetchQuestions();
  };

  const handleDeleteQuestion = async (id) => {
    if (confirm('Are you sure?')) {
      await fetch(`${API_URL}/api/questions/${id}`, { method: 'DELETE' });
    }
  };

  const adminAction = (action) => {
    if (socket) {
      socket.emit('adminAction', { action, passcode }, (res) => {
        if (!res.success) alert(res.error || 'Action failed');
      });
    }
  };

// Delete all registrations
const handleDeleteAllRegistrations = async () => {
  if (confirm('Are you sure you want to delete all registrations?')) {
    const res = await fetch(`${API_URL}/api/participants`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert('All registrations deleted.');
    } else {
      alert('Failed to delete registrations.');
    }
  }
};

  if (!isAuthenticated) {
    return (
      <div className="flex-center" style={{ height: '100vh', flexDirection: 'column' }}>
        <form onSubmit={handleLogin} className="hud-panel" style={{ width: '400px' }}>
          <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>ADMIN LOGIN</h2>
          <input 
            type="password" 
            placeholder="PASSCODE" 
            className="input-field"
            value={passcode}
            onChange={e => setPasscode(e.target.value)}
          />
          <button type="submit" className="btn-primary" style={{ width: '100%' }}>LOGIN</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1 className="neon-text" style={{ marginBottom: '2rem' }}>ADMIN COMMAND CENTER</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* Left Col: Controls & Stats */}
        <div>
          <div className="hud-panel" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>SYSTEM STATUS</h3>
            {quizState ? (
              <div>
                <p><strong>Status:</strong> <span className="neon-text">{quizState.status}</span></p>
                <p><strong>Total Registered:</strong> {quizState.totalParticipants}</p>
                <p><strong>Active Players:</strong> {quizState.activeParticipants}</p>
                <p><strong>Current Question:</strong> {quizState.currentQuestionIndex + 1} / 20</p>
                <p><strong>Answers Received:</strong> {quizState.answersReceivedForCurrent}</p>
              </div>
            ) : <p>Loading state...</p>}
          </div>

          <div className="hud-panel">
            <h3 style={{ marginBottom: '1rem' }}>QUIZ CONTROLS</h3>
            <p className="text-muted">Controls are now managed automatically. No manual admin actions required.</p>
            <button className="btn-primary" style={{ marginTop: '1rem', width: '100%' }} onClick={handleDeleteAllRegistrations}>Delete All Registrations</button>
          </div>
        </div>

        {/* Right Col: Questions */}
        <div>
          <div className="hud-panel" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>ADD QUESTION</h3>
            <form onSubmit={handleAddQuestion} style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '10px' }}>
              <input type="number" placeholder="#" required className="input-field" value={form.questionNumber} onChange={e => setForm({...form, questionNumber: e.target.value})} />
              <input type="text" placeholder="Question Text" required className="input-field" value={form.questionText} onChange={e => setForm({...form, questionText: e.target.value})} />
              
              <div style={{ gridColumn: '1 / span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input type="text" placeholder="Option A" required className="input-field" value={form.optionA} onChange={e => setForm({...form, optionA: e.target.value})} />
                <input type="text" placeholder="Option B" required className="input-field" value={form.optionB} onChange={e => setForm({...form, optionB: e.target.value})} />
                <input type="text" placeholder="Option C" required className="input-field" value={form.optionC} onChange={e => setForm({...form, optionC: e.target.value})} />
                <input type="text" placeholder="Option D" required className="input-field" value={form.optionD} onChange={e => setForm({...form, optionD: e.target.value})} />
              </div>

              <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label>Correct Answer:</label>
                <select className="input-field" style={{ width: '100px', marginBottom: 0, background: 'rgba(0,0,0,0.8)' }} value={form.correctAnswer} onChange={e => setForm({...form, correctAnswer: e.target.value})}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
                <button type="submit" className="btn-primary" style={{ marginLeft: 'auto' }}>Add Question</button>
              </div>
            </form>
          </div>

          <div className="hud-panel" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>QUESTION BANK ({questions.length}/20)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                  <th style={{ padding: '10px' }}>#</th>
                  <th style={{ padding: '10px' }}>Question</th>
                  <th style={{ padding: '10px' }}>Ans</th>
                  <th style={{ padding: '10px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map(q => (
                  <tr key={q.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '10px' }}>{q.questionNumber}</td>
                    <td style={{ padding: '10px' }}>{q.questionText}</td>
                    <td style={{ padding: '10px', color: 'var(--accent-green)' }}>{q.correctAnswer}</td>
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => handleDeleteQuestion(q.id)} style={{ background: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)', padding: '5px 10px', cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
