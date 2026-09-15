require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./database');
const quizController = require('./quizController');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Admin Passcode from ENV or default
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'admin123';

// Initialize global quiz state
let quizState = {
  status: 'WAITING', // WAITING, READY, LIVE, COMPLETED
  currentQuestionIndex: -1,
  currentQuestion: null,
  questionStartedAt: null,
  questionEndsAt: null,
  totalParticipants: 0,
  activeParticipants: 0,
  answersReceivedForCurrent: 0
};

// Start the Socket.io server logic
quizController(io, db, quizState);

// Simple Admin Authentication Endpoint
app.post('/api/admin/login', (req, res) => {
  const { passcode } = req.body;
  if (passcode === ADMIN_PASSCODE) {
    res.json({ success: true, token: 'admin-token-xyz' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid passcode' });
  }
});

// API to get all questions (Admin only)
app.get('/api/questions', (req, res) => {
  db.all(`SELECT * FROM questions ORDER BY questionNumber ASC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// API to add a question
app.post('/api/questions', (req, res) => {
  const { questionNumber, questionText, optionA, optionB, optionC, optionD, correctAnswer } = req.body;
  db.run(
    `INSERT INTO questions (questionNumber, questionText, optionA, optionB, optionC, optionD, correctAnswer) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [questionNumber, questionText, optionA, optionB, optionC, optionD, correctAnswer],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

// API to delete a question
app.delete('/api/questions/:id', (req, res) => {
  db.run(`DELETE FROM questions WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// API to delete all registrations
app.delete('/api/participants', (req, res) => {
  db.run(`DELETE FROM participants`, [], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    // Reset participant counts
    quizState.totalParticipants = 0;
    quizState.activeParticipants = 0;
    // Emit updated state to admin UI
    io.emit('quizStateUpdate', {
      status: quizState.status,
      currentQuestionIndex: quizState.currentQuestionIndex,
      currentQuestion: null,
      questionStartedAt: null,
      questionEndsAt: null,
      totalParticipants: quizState.totalParticipants,
      activeParticipants: quizState.activeParticipants,
      answersReceivedForCurrent: quizState.answersReceivedForCurrent
    });
    res.json({ success: true });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
