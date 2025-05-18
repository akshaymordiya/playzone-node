const Chess = require('../models/Chess');
const Games = require('../models/Games');
const ChessLogic = require('./chessLogic');
const generateGameKey = require('../utils/gameKeyGenerator');
const { spawn } = require('child_process');

class GameService {
  constructor(io) {
    this.io = io;
  }

  // Create a new game
  async createGame(gameData) {
    const game = new Chess({
      ...gameData,
      gameKey: generateGameKey(),
      status: 'waiting'
    });

    await game.save();
    return game;
  }

  // Join existing game with game key
  async joinGameWithKey(gameKey, playerData) {
    const game = await Chess.findOne({ gameKey, status: 'waiting' });
    if (!game) {
      throw new Error('Game not found or already started');
    }

    if (game.players.length >= 2) {
      throw new Error('Game is full');
    }

    game.players.push(playerData);
    if (game.players.length === 2) {
      game.status = 'active';
    }

    await game.save();
    return game;
  }

  // Find or create online game
  async findOrCreateOnlineGame(playerData) {
    // Try to find a waiting game
    let game = await Chess.findOne({
      gameMode: 'online',
      status: 'waiting',
      'players.0': { $exists: true },
      'players.1': { $exists: false }
    });

    if (game) {
      // Join existing game
      game.players.push(playerData);
      game.status = 'active';
    } else {
      // Create new game
      game = await this.createGame({
        gameMode: 'online',
        players: [playerData]
      });
    }

    await game.save();
    return game;
  }

  // Create bot game
  async createBotGame(playerData) {
    const botData = {
      type: 'bot',
      name: 'Chess Bot',
      avatar: 'bot-avatar.png',
      color: playerData.color === 'white' ? 'black' : 'white',
      rating: 1200,
      difficulty: playerData.difficulty || 'medium' // 'easy', 'medium', 'hard'
    };

    const game = await this.createGame({
      gameMode: 'bot',
      players: [playerData, botData],
      status: 'active'
    });

    return game;
  }

  // Validate move
  async validateMove(gameId, moveData) {
    const game = await Chess.findById(gameId);
    if (!game) {
      throw new Error('Game not found');
    }

    // Create temporary chess logic instance
    const chessLogic = new ChessLogic();
    chessLogic.board = game.boardState.pieces;

    // Validate move
    const isValid = chessLogic.isValidMove(moveData.from, moveData.to, moveData.color);
    if (!isValid) {
      return {
        valid: false,
        error: 'Invalid move'
      };
    }

    // Check if move puts own king in check
    const tempBoard = JSON.parse(JSON.stringify(chessLogic.board));
    chessLogic.makeMove(moveData.from, moveData.to);
    const isInCheck = chessLogic.isInCheck(moveData.color);
    chessLogic.board = tempBoard;

    if (isInCheck) {
      return {
        valid: false,
        error: 'Move would put your king in check'
      };
    }

    // Check for checkmate
    const isCheckmate = chessLogic.isCheckmate(moveData.color === 'white' ? 'black' : 'white');

    return {
      valid: true,
      isCheckmate,
      boardState: chessLogic.getBoardState()
    };
  }

  // Handle move validation and update
  async handleMove(gameId, moveData) {
    try {
      const validation = await this.validateMove(gameId, moveData);
      
      if (!validation.valid) {
        this.io.to(gameId).emit('moveFailed', {
          error: validation.error
        });
        return;
      }

      // Update game state asynchronously
      this.updateGameState(gameId, {
        boardState: validation.boardState,
        move: {
          from: moveData.from,
          to: moveData.to,
          piece: moveData.piece,
          timestamp: new Date()
        }
      });

      // Emit success event
      this.io.to(gameId).emit('moveSuccess', {
        move: moveData,
        boardState: validation.boardState,
        isCheckmate: validation.isCheckmate
      });

      // If checkmate, end the game
      const game = await Chess.findById(gameId);
      if (validation.isCheckmate) {
        await this.endGame(gameId, {
          winner: game.players.find(p => p.color === moveData.color).userId,
          method: 'checkmate',
          endTime: new Date()
        });
      }

      // If it's a bot game, make bot move
      if (game.gameMode === 'bot' && !validation.isCheckmate) {
        this.makeBotMove(gameId);
      }

    } catch (error) {
      this.io.to(gameId).emit('moveFailed', {
        error: error.message
      });
    }
  }

  // Make bot move using external chess engine
  async makeBotMove(gameId) {
    const game = await Chess.findById(gameId);
    const bot = game.players.find(p => p.type === 'bot');
    
    if (!bot) return;

    // Use stockfish or another chess engine
    const stockfish = spawn('stockfish');
    
    stockfish.stdout.on('data', (data) => {
      const move = parseStockfishOutput(data.toString());
      if (move) {
        this.handleMove(gameId, {
          from: move.from,
          to: move.to,
          color: bot.color
        });
        stockfish.kill();
      }
    });

    // Send current position to stockfish
    stockfish.stdin.write(`position fen ${this.getFENFromBoard(game.boardState)}\n`);
    stockfish.stdin.write(`go depth 20\n`);
  }

  // Update game state in database (runs in background)
  async updateGameState(gameId, updateData) {
    try {
      const game = await Chess.findById(gameId);
      if (!game) return;

      if (updateData.boardState) {
        game.boardState = updateData.boardState;
      }

      if (updateData.move) {
        game.gameHistory.push({
          move: updateData.move,
          player: updateData.playerId,
          timeTaken: updateData.timeTaken,
          timestamp: new Date()
        });
        game.boardState.lastMove = updateData.move;
        game.boardState.currentTurn = game.boardState.currentTurn === 'white' ? 'black' : 'white';
      }

      game.lastMoveAt = new Date();
      await game.save();
    } catch (error) {
      console.error('Error updating game state:', error);
    }
  }

  // Handle game completion
  async endGame(gameId, result) {
    const game = await Chess.findById(gameId);
    if (!game) return;

    game.status = 'completed';
    game.result = result;
    await game.save();

    // Notify all players and spectators
    this.io.to(gameId).emit('gameEnded', result);
  }

  // Add spectator to game
  async addSpectator(gameId, userId) {
    const game = await Chess.findById(gameId);
    if (!game) throw new Error('Game not found');

    if (!game.spectators.includes(userId)) {
      game.spectators.push(userId);
      await game.save();
    }
  }

  // Remove spectator from game
  async removeSpectator(gameId, userId) {
    const game = await Chess.findById(gameId);
    if (!game) throw new Error('Game not found');

    game.spectators = game.spectators.filter(id => id.toString() !== userId.toString());
    await game.save();
  }

  // Helper function to convert board state to FEN
  getFENFromBoard(boardState) {
    // Implementation to convert board state to FEN notation
    // This would be used for the chess engine
    return ''; // TODO: Implement FEN conversion
  }
}

module.exports = GameService; 