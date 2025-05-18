const GameService = require('../services/gameService');

class GameSocketHandler {
  constructor(io) {
    this.io = io;
    this.gameService = new GameService(io);
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('New client connected:', socket.id);

      // Join game room
      socket.on('joinGame', async ({ gameId }) => {
        try {
          socket.join(gameId);
          console.log(`Client ${socket.id} joined game room: ${gameId}`);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Leave game room
      socket.on('leaveGame', ({ gameId }) => {
        socket.leave(gameId);
        console.log(`Client ${socket.id} left game room: ${gameId}`);
      });

      // Handle move
      socket.on('makeMove', async ({ gameId, move }) => {
        try {
          await this.gameService.handleMove(gameId, move);
        } catch (error) {
          socket.emit('moveFailed', { error: error.message });
        }
      });

      // Handle game resignation
      socket.on('resignGame', async ({ gameId, userId }) => {
        try {
          await this.gameService.endGame(gameId, {
            winner: userId === 'white' ? 'black' : 'white',
            method: 'resignation',
            endTime: new Date()
          });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle spectator joining
      socket.on('joinAsSpectator', async ({ gameId, userId }) => {
        try {
          await this.gameService.addSpectator(gameId, userId);
          socket.join(gameId);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle spectator leaving
      socket.on('leaveAsSpectator', async ({ gameId, userId }) => {
        try {
          await this.gameService.removeSpectator(gameId, userId);
          socket.leave(gameId);
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }
}

module.exports = GameSocketHandler; 