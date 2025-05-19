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
      socket.on('joinGame', async ({ gameId, userId, role }) => {
        try {
          // Join the socket to the game room
          socket.join(gameId);
          
          // Store game info in socket for later use
          socket.gameId = gameId;
          socket.userId = userId;
          socket.role = role;

          console.log(`Client ${socket.id} (${role}) joined game room: ${gameId}`);
          
          // Notify others in the room
          socket.to(gameId).emit('playerJoined', {
            userId,
            role,
            timestamp: new Date()
          });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Leave game room
      socket.on('leaveGame', ({ gameId }) => {
        if (socket.gameId === gameId) {
          socket.leave(gameId);
          console.log(`Client ${socket.id} (${socket.role}) left game room: ${gameId}`);
          
          // Notify others in the room
          socket.to(gameId).emit('playerLeft', {
            userId: socket.userId,
            role: socket.role,
            timestamp: new Date()
          });
        }
      });

      // Handle move
      socket.on('makeMove', async ({ gameId, move }) => {
        try {
          if (socket.gameId !== gameId) {
            throw new Error('Not in this game room');
          }
          
          console.log(`Received move from ${socket.id} (${socket.role}) in game ${gameId}`);
          await this.gameService.handleMove(gameId, move);
        } catch (error) {
          socket.emit('moveFailed', { error: error.message });
        }
      });

      // Handle game resignation
      socket.on('resignGame', async ({ gameId, userId }) => {
        try {
          if (socket.gameId !== gameId) {
            throw new Error('Not in this game room');
          }

          console.log(`Player ${userId} resigned from game ${gameId}`);
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
          socket.gameId = gameId;
          socket.userId = userId;
          socket.role = 'spectator';
          
          console.log(`Spectator ${userId} joined game ${gameId}`);
          
          // Notify others in the room
          socket.to(gameId).emit('spectatorJoined', {
            userId,
            timestamp: new Date()
          });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle spectator leaving
      socket.on('leaveAsSpectator', async ({ gameId, userId }) => {
        try {
          if (socket.gameId === gameId && socket.role === 'spectator') {
            await this.gameService.removeSpectator(gameId, userId);
            socket.leave(gameId);
            
            console.log(`Spectator ${userId} left game ${gameId}`);
            
            // Notify others in the room
            socket.to(gameId).emit('spectatorLeft', {
              userId,
              timestamp: new Date()
            });
          }
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        if (socket.gameId) {
          console.log(`Client ${socket.id} (${socket.role}) disconnected from game ${socket.gameId}`);
          
          // Notify others in the room
          socket.to(socket.gameId).emit('playerDisconnected', {
            userId: socket.userId,
            role: socket.role,
            timestamp: new Date()
          });
        }
      });
    });
  }
}

module.exports = GameSocketHandler; 