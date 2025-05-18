const mongoose = require('mongoose');

const chessSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Games',
    required: true
  },
  gameKey: {
    type: String,
    required: true,
    unique: true
  },
  gameMode: {
    type: String,
    enum: ['friend', 'online', 'bot'],
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed', 'abandoned'],
    default: 'waiting'
  },
  players: [{
    type: {
      type: String,
      enum: ['user', 'guest', 'bot'],
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function() {
        return this.type === 'user';
      }
    },
    name: {
      type: String,
      required: true
    },
    avatar: {
      type: String,
      default: 'default-avatar.png'
    },
    color: {
      type: String,
      enum: ['white', 'black'],
      required: true
    },
    rating: {
      type: Number,
      default: 1200
    },
    timeRemaining: {
      type: Number, // in seconds
      default: 600 // 10 minutes default
    }
  }],
  boardState: {
    pieces: [{
      type: {
        type: String,
        enum: ['pawn', 'rook', 'knight', 'bishop', 'queen', 'king'],
        required: true
      },
      color: {
        type: String,
        enum: ['white', 'black'],
        required: true
      },
      position: {
        x: {
          type: Number,
          required: true,
          min: 0,
          max: 7
        },
        y: {
          type: Number,
          required: true,
          min: 0,
          max: 7
        }
      },
      hasMoved: {
        type: Boolean,
        default: false
      }
    }],
    currentTurn: {
      type: String,
      enum: ['white', 'black'],
      default: 'white'
    },
    lastMove: {
      from: {
        x: Number,
        y: Number
      },
      to: {
        x: Number,
        y: Number
      },
      piece: String,
      timestamp: Date
    }
  },
  gameHistory: [{
    move: {
      from: {
        x: Number,
        y: Number
      },
      to: {
        x: Number,
        y: Number
      },
      piece: String
    },
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timeTaken: Number, // in milliseconds
    timestamp: Date
  }],
  result: {
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    method: {
      type: String,
      enum: ['checkmate', 'resignation', 'timeout', 'draw']
    },
    endTime: Date
  },
  spectators: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastMoveAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
chessSchema.index({ gameKey: 1 });
chessSchema.index({ status: 1, gameMode: 1 });
chessSchema.index({ 'players.userId': 1 });

const Chess = mongoose.model('Chess', chessSchema);

module.exports = Chess; 