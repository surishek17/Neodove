// Import necessary modules
const https = require('https');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const app = express();


// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/chat-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Define User Schema and Model
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
});

const User = mongoose.model('User', userSchema);

// User registration endpoint
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // Hash the password before storing it
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create a new user
  const newUser = new User({
    username,
    email,
    password: hashedPassword,
  });

  await newUser.save();
  res.status(201).send('User registered successfully');
});

// User login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) return res.status(400).send('User not found');

  // Compare password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).send('Invalid credentials');

  // Generate JWT
  const token = jwt.sign({ userId: user._id }, 'a54d5sad51sa2d1');
  res.json({ token });
});

// Create WebSocket server
const wss = new WebSocket.Server({ noServer: true });

// Function to verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, 'a54d5sad51sa2d1');
  } catch (err) {
    return null;
  }
};

// Handle WebSocket connection
wss.on('connection', (ws, request, user) => {
  ws.on('message', (message) => {
    // Broadcast message to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          username: user.username,
          message,
          timestamp: new Date().toISOString(),
        }));
      }
    });
  });
});

// Integrate WebSocket with Express server
const server = app.listen(3000, () => {
  console.log('Server running on port 3000');
});

server.on('upgrade', (request, socket, head) => {
  const token = request.headers['sec-websocket-protocol'];

  // Verify JWT token
  const user = verifyToken(token);
  if (!user) {
    socket.destroy();
    return;
  }

  // Allow WebSocket connection
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, user);
  });
});
