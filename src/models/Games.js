const mongoose = require('mongoose');

const gamesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['chess', 'checkers', 'ludo'], // Add more games as needed
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'disabled'],
    default: 'active'
  },
  minPlayers: {
    type: Number,
    required: true
  },
  maxPlayers: {
    type: Number,
    required: true
  },
  hasBotSupport: {
    type: Boolean,
    default: false
  },
  hasOnlinePlay: {
    type: Boolean,
    default: true
  },
  hasFriendPlay: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const Games = mongoose.model('Games', gamesSchema);

module.exports = Games; 