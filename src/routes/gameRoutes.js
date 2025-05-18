const express = require('express');
const router = express.Router();
const GameController = require('../controllers/gameController');

module.exports = (io) => {
  const gameController = new GameController(io);

  // Friend game routes
  router.post('/friend', gameController.createFriendGame.bind(gameController));
  router.post('/join', gameController.joinGameWithKey.bind(gameController));

  // Online game routes
  router.post('/online', gameController.findOrCreateOnlineGame.bind(gameController));

  // Bot game routes
  router.post('/bot', gameController.createBotGame.bind(gameController));

  // Game management routes
  router.get('/:id', gameController.getGame.bind(gameController));
  router.get('/', gameController.getActiveGames.bind(gameController));

  // // Spectator routes
  // router.post('/:gameId/spectate', gameController.joinAsSpectator.bind(gameController));
  // router.post('/:gameId/spectate/leave', gameController.leaveAsSpectator.bind(gameController));

  return router;
}; 