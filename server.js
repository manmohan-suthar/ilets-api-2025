require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const examAssignmentRoutes = require('./routes/exam-assignments');
const listeningRoutes = require('./routes/listening');
const speakingRoutes = require('./routes/speaking');
const writingRoutes = require('./routes/writing');
const readingRoutes = require('./routes/reading');
const agentRoutes = require('./routes/agents');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - Content-Type: ${req.headers['content-type']}`);
  next();
});
app.use('/uploads', express.static('uploads'));

// Root route to check API status
app.get('/', (req, res) => {
  res.json({ message: 'API is working right now update v 1.0.1' });
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://admin:<db_password>@ilets-exam-0.bnlsm9u.mongodb.net/?appName=ILETS-EXAM-0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/exam-assignments', examAssignmentRoutes);
app.use('/listening', listeningRoutes);
app.use('/speaking', speakingRoutes); // Student access to speaking papers
app.use('/reading', readingRoutes); // Student access to reading papers
app.use('/writing', writingRoutes); // Student access to writing papers
app.use('/admin/speaking-papers', speakingRoutes); // Admin access
app.use('/admin/writing-papers', writingRoutes);
app.use('/admin/reading-papers', readingRoutes); // Admin access
app.use('/agents', agentRoutes);

// Socket.IO for video call signaling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join exam room
  socket.on('join-exam-room', (examId) => {
    socket.join(examId);
    console.log(`User ${socket.id} joined exam room ${examId}`);
  });

  // Agent join event
  socket.on('agent-joined', (examId) => {
    socket.to(examId).emit('agent-joined');
  });

  // Student joined event
  socket.on('student-joined', (examId) => {
    socket.to(examId).emit('student-joined', socket.id);
  });

  // Grant permission event
  socket.on('grant-permission', (examId) => {
    socket.to(examId).emit('permission-granted');
  });

  // Agent control events
  socket.on('change-section', (data) => {
    socket.to(data.examId).emit('change-section', data.section);
  });

  socket.on('change-passage', (data) => {
    socket.to(data.examId).emit('change-passage', data.passage);
  });

  socket.on('end-exam', (examId) => {
    socket.to(examId).emit('end-exam');
  });

  // WebRTC signaling
  socket.on('join', ({ room, role }) => {
    socket.role = role;
    socket.join(room);
    console.log(`${socket.id} joined ${room} as ${role}`);
    // notify other peers
    socket.to(room).emit('peer-joined', { id: socket.id, role });
    // notify the new peer about existing peers
    const roomSockets = io.sockets.adapter.rooms.get(room);
    if (roomSockets) {
      roomSockets.forEach(clientId => {
        if (clientId !== socket.id) {
          const clientSocket = io.sockets.sockets.get(clientId);
          if (clientSocket) {
            socket.emit('peer-joined', { id: clientId, role: clientSocket.role });
          }
        }
      });
    }
  });

  socket.on('offer', data => {
    // data: { room, sdp, from }
    socket.to(data.room).emit('offer', data);
  });

  socket.on('answer', data => {
    socket.to(data.room).emit('answer', data);
  });

  socket.on('ice', data => {
    socket.to(data.room).emit('ice', data);
  });

  socket.on('leave', ({ room }) => {
    socket.leave(room);
    socket.to(room).emit('peer-left', { id: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});