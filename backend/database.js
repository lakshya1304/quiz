const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'quiz.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Questions table
  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    questionNumber INTEGER,
    questionText TEXT,
    optionA TEXT,
    optionB TEXT,
    optionC TEXT,
    optionD TEXT,
    correctAnswer TEXT
  )`);

  // Participants table
  db.run(`CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    name TEXT,
    course TEXT,
    registeredAt INTEGER,
    status TEXT, -- 'WAITING', 'PLAYING', 'DISQUALIFIED', 'COMPLETED'
    score INTEGER DEFAULT 0,
    speedBonuses INTEGER DEFAULT 0,
    correctAnswers INTEGER DEFAULT 0,
    wrongAnswers INTEGER DEFAULT 0,
    unanswered INTEGER DEFAULT 0
  )`);

  // Answers table
  db.run(`CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participantId TEXT,
    questionId INTEGER,
    selectedAnswer TEXT,
    isCorrect BOOLEAN,
    responseTime INTEGER,
    points INTEGER,
    speedBonus INTEGER,
    answeredAt INTEGER
  )`);
  
  // Violations table
  db.run(`CREATE TABLE IF NOT EXISTS violations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participantId TEXT,
    type TEXT,
    questionNumber INTEGER,
    timestamp INTEGER
  )`);

  // Insert dummy questions if none exist
  db.get(`SELECT COUNT(*) as count FROM questions`, (err, row) => {
    if (!err && row.count === 0) {
      const stmt = db.prepare(`INSERT INTO questions (questionNumber, questionText, optionA, optionB, optionC, optionD, correctAnswer) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      stmt.run(1, 'Which protocol is commonly used for IoT communication?', 'HTTP', 'MQTT', 'FTP', 'SMTP', 'B');
      stmt.run(2, 'What does AI stand for?', 'Automated Intelligence', 'Artificial Intelligence', 'Applied Intelligence', 'Algorithmic Interface', 'B');
      stmt.run(3, 'Which programming language is known as the "mother of all languages"?', 'Java', 'C', 'Python', 'Assembly', 'B');
      stmt.run(4, 'What is the full form of MAC address?', 'Media Access Control', 'Memory Access Control', 'Main Access Control', 'Machine Access Control', 'A');
      stmt.run(5, 'Which layer of the OSI model does a router operate on?', 'Physical', 'Data Link', 'Network', 'Transport', 'C');
      stmt.finalize();
    }
  });
});

module.exports = db;