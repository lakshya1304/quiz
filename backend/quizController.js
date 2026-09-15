const crypto = require('crypto');

module.exports = function (io, db, quizState) {
  let questionTimer = null;
  const QUESTION_DURATION = 15; // 15 seconds

  // Fetch all questions from DB to memory
  let allQuestions = [];
  db.all('SELECT * FROM questions ORDER BY questionNumber ASC', (err, rows) => {
    if (!err) {
      allQuestions = rows;
    }
  });

  const getPublicState = () => {
    const now = Date.now();
    return {
      status: quizState.status,
      currentQuestionIndex: quizState.currentQuestionIndex,
      currentQuestion: quizState.currentQuestion ? {
        id: quizState.currentQuestion.id,
        questionNumber: quizState.currentQuestion.questionNumber,
        questionText: quizState.currentQuestion.questionText,
        optionA: quizState.currentQuestion.optionA,
        optionB: quizState.currentQuestion.optionB,
        optionC: quizState.currentQuestion.optionC,
        optionD: quizState.currentQuestion.optionD
      } : null,
      questionStartedAt: quizState.questionStartedAt,
      questionEndsAt: quizState.questionEndsAt,
      timeRemaining: quizState.questionEndsAt ? Math.max(0, Math.ceil((quizState.questionEndsAt - now) / 1000)) : 15,
      totalParticipants: quizState.totalParticipants,
      activeParticipants: quizState.activeParticipants,
      answersReceivedForCurrent: quizState.answersReceivedForCurrent
    };
  };

  const broadcastState = () => {
    io.emit('quizStateUpdate', getPublicState());
  };

  const broadcastLeaderboard = () => {
    db.all(`
      SELECT id, name, course, score, status 
      FROM participants 
      WHERE status != 'DISQUALIFIED'
      ORDER BY score DESC, registeredAt ASC
    `, (err, rows) => {
      if (!err) {
        io.emit('leaderboardUpdate', rows);
      }
    });
  };

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Give them the current state immediately
    broadcastState();
    broadcastLeaderboard();
    
    // --- PARTICIPANT EVENTS ---

    socket.on('register', (data, callback) => {
      const { name, course } = data;
      const participantId = crypto.randomUUID();
      const now = Date.now();
      const status = quizState.status === 'LIVE' ? 'PLAYING' : 'WAITING';

      db.run(`
        INSERT INTO participants (id, name, course, registeredAt, status) 
        VALUES (?, ?, ?, ?, ?)
      `, [participantId, name, course, now, status], (err) => {
        if (err) {
          if(callback) callback({ success: false, error: err.message });
          return;
        }
        
        quizState.totalParticipants += 1;
        if (quizState.status === 'WAITING' || quizState.status === 'READY' || quizState.status === 'LIVE') {
          quizState.activeParticipants += 1;
        }

        socket.join(participantId);
        broadcastState();
        broadcastLeaderboard();

        if (callback) {
          callback({ success: true, participantId, name, course });
        }
      });
    });

    socket.on('submitAnswer', (data, callback) => {
      console.log('Received submitAnswer:', data);
      const { participantId, selectedOption } = data;
      
      if (quizState.status !== 'LIVE' || !quizState.currentQuestion) {
        console.log('submitAnswer rejected: Quiz not active');
        return callback({ success: false, error: 'Quiz is not active' });
      }

      const now = Date.now();
      if (now > quizState.questionEndsAt) {
        console.log('submitAnswer rejected: Time is up', {now, endsAt: quizState.questionEndsAt});
        return callback({ success: false, error: 'Time is up' });
      }

      // Check if they already answered
      db.get(`SELECT id FROM answers WHERE participantId = ? AND questionId = ?`, 
        [participantId, quizState.currentQuestion.id], (err, row) => {
          if (err || row) {
            return callback({ success: false, error: 'Already answered' });
          }

          const isCorrect = (selectedOption === quizState.currentQuestion.correctAnswer);
          const responseTime = Math.max(0, Math.floor((now - quizState.questionStartedAt) / 1000));
          
          let points = 0;
          let speedBonus = 0;

          if (isCorrect) {
            if (responseTime <= 5) {
              points = 6;
              speedBonus = 2;
            } else {
              points = 4;
            }
          } else {
            points = -1;
          }

          // Insert answer
          db.run(`
            INSERT INTO answers (participantId, questionId, selectedAnswer, isCorrect, responseTime, points, speedBonus, answeredAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [participantId, quizState.currentQuestion.id, selectedOption, isCorrect, responseTime, points, speedBonus, now], (err) => {
            if (!err) {
              // Update participant score
              db.run(`
                UPDATE participants 
                SET score = score + ?, 
                    speedBonuses = speedBonuses + ?,
                    correctAnswers = correctAnswers + ?,
                    wrongAnswers = wrongAnswers + ?
                WHERE id = ?
              `, [points, speedBonus, isCorrect ? 1 : 0, isCorrect ? 0 : 1, participantId], () => {
                quizState.answersReceivedForCurrent += 1;
                broadcastState();
                broadcastLeaderboard();
                
                if (callback) {
                  callback({ 
                    success: true, 
                    isCorrect, 
                    correctAnswer: quizState.currentQuestion.correctAnswer,
                    points,
                    speedBonus
                  });
                }
              });
            }
          });
      });
    });

    socket.on('reportViolation', (data) => {
      const { participantId, type } = data;
      const now = Date.now();
      
      // Mark as disqualified
      db.run(`UPDATE participants SET status = 'DISQUALIFIED' WHERE id = ?`, [participantId], () => {
        db.run(`INSERT INTO violations (participantId, type, questionNumber, timestamp) VALUES (?, ?, ?, ?)`,
          [participantId, type, quizState.currentQuestionIndex + 1, now], () => {
            
            // Recalculate participants (both total and active)
            db.get(`SELECT COUNT(*) as count FROM participants WHERE status != 'DISQUALIFIED'`, (err, row) => {
              if (!err) {
                // total participants now equals active participants (non-disqualified)
                quizState.totalParticipants = row.count;
                quizState.activeParticipants = row.count;
              }
              broadcastState();
              broadcastLeaderboard();
              io.to(participantId).emit('disqualified');
            });
        });
      });
    });

    // --- ADMIN EVENTS ---
    
    socket.on('adminAction', (data, callback) => {
      const { action, passcode } = data;
      // Basic auth check for admin sockets
      if (passcode !== (process.env.ADMIN_PASSCODE || 'admin123')) {
        if(callback) callback({ success: false, error: 'Unauthorized' });
        return;
      }

      if (action === 'PREPARE') {
        quizState.status = 'READY';
        db.all('SELECT * FROM questions ORDER BY questionNumber ASC', (err, rows) => {
          allQuestions = rows;
          broadcastState();
          if(callback) callback({ success: true });
        });
      }

      else if (action === 'START_QUIZ' || action === 'NEXT_QUESTION') {
        const executeStartOrNext = () => {
          if (allQuestions.length === 0) {
            if(callback) callback({ success: false, error: 'No questions in DB' });
            return;
          }

          if (action === 'START_QUIZ') {
            quizState.currentQuestionIndex = 0;
            // Update all active to PLAYING
            db.run(`UPDATE participants SET status = 'PLAYING' WHERE status = 'WAITING'`);
          } else {
            quizState.currentQuestionIndex += 1;
          }

          const advanceQuestion = () => {
            if (quizState.currentQuestionIndex >= allQuestions.length) {
              // Quiz over
              quizState.status = 'COMPLETED';
              quizState.currentQuestion = null;
              quizState.questionStartedAt = null;
              quizState.questionEndsAt = null;
              broadcastState();
              return;
            }

            quizState.status = 'LIVE';
            quizState.currentQuestion = allQuestions[quizState.currentQuestionIndex];
            quizState.questionStartedAt = Date.now();
            quizState.questionEndsAt = quizState.questionStartedAt + (QUESTION_DURATION * 1000);
            quizState.answersReceivedForCurrent = 0;

            broadcastState();

            // Lock question after timer
            if (questionTimer) clearTimeout(questionTimer);
            questionTimer = setTimeout(() => {
              io.emit('questionLocked', {
                questionNumber: quizState.currentQuestion.questionNumber,
                correctAnswer: quizState.currentQuestion.correctAnswer
              });

              // Automatically go to next question after 5 seconds of showing the correct answer
              setTimeout(() => {
                if (quizState.status === 'LIVE') {
                  quizState.currentQuestionIndex += 1;
                  advanceQuestion();
                }
              }, 5000);
            }, QUESTION_DURATION * 1000);
          };

          advanceQuestion();

          if(callback) callback({ success: true });
        };

        if (allQuestions.length === 0) {
          db.all('SELECT * FROM questions ORDER BY questionNumber ASC', (err, rows) => {
            if (!err) {
              allQuestions = rows;
            }
            executeStartOrNext();
          });
        } else {
          executeStartOrNext();
        }
      }

      else if (action === 'END_QUIZ') {
        quizState.status = 'COMPLETED';
        quizState.currentQuestion = null;
        if (questionTimer) clearTimeout(questionTimer);
        broadcastState();
        if(callback) callback({ success: true });
      }

      else if (action === 'RESET_QUIZ') {
        quizState.status = 'WAITING';
        quizState.currentQuestionIndex = -1;
        quizState.currentQuestion = null;
        quizState.answersReceivedForCurrent = 0;
        if (questionTimer) clearTimeout(questionTimer);
        
        // Reset everyone's score
        db.run(`UPDATE participants SET score=0, speedBonuses=0, correctAnswers=0, wrongAnswers=0, unanswered=0, status='WAITING'`, () => {
          db.run(`DELETE FROM answers`, () => {
            db.get(`SELECT COUNT(*) as c FROM participants`, (err, row) => {
              quizState.totalParticipants = row ? row.c : 0;
              quizState.activeParticipants = quizState.totalParticipants;
              broadcastState();
              broadcastLeaderboard();
              if(callback) callback({ success: true });
            });
          });
        });
      }
    });
  });
};
