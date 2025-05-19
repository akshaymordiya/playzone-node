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

      // Get game details for logging
      const game = await Chess.findById(gameId);
      console.log(`Processing move in game ${gameId} by player ${moveData.color}`);

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

      // Prepare move data for broadcasting
      const moveBroadcast = {
        move: moveData,
        boardState: validation.boardState,
        isCheckmate: validation.isCheckmate,
        currentTurn: validation.boardState.currentTurn,
        lastMoveTime: new Date()
      };

      // Broadcast move to all players and spectators in the game room
      this.io.to(gameId).emit('moveSuccess', moveBroadcast);
      console.log(`Broadcasted move to all players and spectators in game ${gameId}`);

      // If checkmate, end the game
      if (validation.isCheckmate) {
        const winner = game.players.find(p => p.color === moveData.color).userId;
        console.log(`Game ${gameId} ended in checkmate. Winner: ${winner}`);
        
        await this.endGame(gameId, {
          winner,
          method: 'checkmate',
          endTime: new Date()
        });
      }

      // If it's a bot game, make bot move
      if (game.gameMode === 'bot' && !validation.isCheckmate) {
        console.log(`Initiating bot move in game ${gameId}`);
        this.makeBotMove(gameId);
      }

    } catch (error) {
      console.error(`Error handling move in game ${gameId}:`, error);
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

    // Configure Stockfish based on difficulty
    const difficultySettings = {
      easy: {
        skillLevel: 1,
        skillMaxError: 100,
        skillMaxErrorMove: 100,
        skillDepth: 1
      },
      medium: {
        skillLevel: 10,
        skillMaxError: 50,
        skillMaxErrorMove: 50,
        skillDepth: 10
      },
      hard: {
        skillLevel: 20,
        skillMaxError: 0,
        skillMaxErrorMove: 0,
        skillDepth: 20
      }
    };

    const settings = difficultySettings[bot.difficulty || 'medium'];

    // Use stockfish or another chess engine
    const stockfish = spawn('stockfish');
    
    // Configure Stockfish
    stockfish.stdin.write('setoption name Skill Level value ' + settings.skillLevel + '\n');
    stockfish.stdin.write('setoption name Skill Maximum Error value ' + settings.skillMaxError + '\n');
    stockfish.stdin.write('setoption name Skill Maximum Error Move value ' + settings.skillMaxErrorMove + '\n');
    stockfish.stdin.write('setoption name Skill Depth value ' + settings.skillDepth + '\n');

    // Set up move parsing
    let bestMove = null;
    stockfish.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('bestmove')) {
        const move = output.split('bestmove ')[1].split(' ')[0];
        bestMove = this.convertAlgebraicToCoordinates(move);
        stockfish.kill();
      }
    });

    // Send current position to stockfish
    const fen = this.getFENFromBoard(game.boardState);
    stockfish.stdin.write(`position fen ${fen}\n`);
    stockfish.stdin.write(`go depth ${settings.skillDepth}\n`);

    // Wait for move and make it
    const makeMove = async () => {
      if (bestMove) {
        await this.handleMove(gameId, {
          from: bestMove.from,
          to: bestMove.to,
          color: bot.color,
          piece: this.getPieceAtPosition(game.boardState, bestMove.from)
        });
      } else {
        setTimeout(makeMove, 100);
      }
    };

    makeMove();
  }

  // Convert algebraic notation to coordinates
  convertAlgebraicToCoordinates(move) {
    const files = 'abcdefgh';
    const ranks = '87654321';
    
    const fromFile = files.indexOf(move[0]);
    const fromRank = ranks.indexOf(move[1]);
    const toFile = files.indexOf(move[2]);
    const toRank = ranks.indexOf(move[3]);

    return {
      from: { x: fromFile, y: fromRank },
      to: { x: toFile, y: toRank }
    };
  }

  // Get piece at position
  getPieceAtPosition(boardState, position) {
    return boardState.pieces[position.y][position.x];
  }

  // Convert board state to FEN notation
  getFENFromBoard(boardState) {
    let fen = '';
    const pieces = boardState.pieces;
    
    // Convert board to FEN
    for (let rank = 0; rank < 8; rank++) {
      let emptyCount = 0;
      
      for (let file = 0; file < 8; file++) {
        const piece = pieces[rank][file];
        
        if (piece === null) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          
          const pieceChar = piece.type[0].toUpperCase();
          fen += piece.color === 'white' ? pieceChar : pieceChar.toLowerCase();
        }
      }
      
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      
      if (rank < 7) {
        fen += '/';
      }
    }
    
    // Add current turn
    fen += ' ' + (boardState.currentTurn === 'white' ? 'w' : 'b') + ' ';
    
    // Add castling rights
    let castling = '';
    if (boardState.castlingRights) {
      if (boardState.castlingRights.whiteKingSide) castling += 'K';
      if (boardState.castlingRights.whiteQueenSide) castling += 'Q';
      if (boardState.castlingRights.blackKingSide) castling += 'k';
      if (boardState.castlingRights.blackQueenSide) castling += 'q';
    }
    fen += castling || '-';
    
    // Add en passant square
    fen += ' ' + (boardState.enPassantSquare || '-');
    
    // Add halfmove clock and fullmove number
    fen += ' 0 1'; // These would need to be tracked in the game state
    
    return fen;
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
}

module.exports = GameService; 