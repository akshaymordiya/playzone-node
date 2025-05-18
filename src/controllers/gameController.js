const Chess = require('../models/Chess');
const Games = require('../models/Games');
const GameService = require('../services/gameService');

class GameController {
  constructor(io) {
    this.gameService = new GameService(io);
  }

  // Create a friend game
  async createFriendGame(req, res) {
    try {
      const { gameType, player } = req.body;
      
      if (!gameType || !player) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const game = await this.gameService.createGame({
        gameMode: 'friend',
        gameType,
        players: [player]
      });

      res.status(201).json(game);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Join game with key
  async joinGameWithKey(req, res) {
    try {
      const { gameKey, player } = req.body;
      
      if (!gameKey || !player) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const game = await this.gameService.joinGameWithKey(gameKey, player);
      res.json(game);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  // Find or create online game
  async findOrCreateOnlineGame(req, res) {
    try {
      const { player } = req.body;
      
      if (!player) {
        return res.status(400).json({ message: 'Missing player data' });
      }

      const game = await this.gameService.findOrCreateOnlineGame(player);
      res.json(game);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Create bot game
  async createBotGame(req, res) {
    try {
      const { player } = req.body;
      
      if (!player) {
        return res.status(400).json({ message: 'Missing player data' });
      }

      const game = await this.gameService.createBotGame(player);
      res.status(201).json(game);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Get game by ID
  async getGame(req, res) {
    try {
      const game = await Chess.findById(req.params.id)
        .populate('players.userId', 'username rating')
        .populate('spectators', 'username');

      if (!game) {
        return res.status(404).json({ message: 'Game not found' });
      }

      res.json(game);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  // Get active games
  async getActiveGames(req, res) {
    try {
      const { mode } = req.query;
      const query = { status: 'active' };
      
      if (mode) {
        query.gameMode = mode;
      }

      const games = await Chess.find(query)
        .populate('players.userId', 'username rating')
        .sort({ createdAt: -1 });

      res.json(games);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = GameController; 