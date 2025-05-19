# PlayZone - Online Chess Platform

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Stockfish Chess Engine

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Install Stockfish Chess Engine:

For macOS:
```bash
brew install stockfish
```

For Ubuntu/Debian:
```bash
sudo apt-get install stockfish
```

For Windows:
- Download Stockfish from the official website: https://stockfishchess.org/download/
- Add the Stockfish executable to your system PATH

4. Create a `.env` file in the root directory with the following variables:
```
MONGODB_URI=your_mongodb_uri
PORT=8812
CLIENT_URL=http://localhost:3000
```

5. Start the server:
```bash
npm run dev
```

## Features

- Real-time multiplayer chess games
- Play against friends using game keys
- Play against online players
- Play against AI with different difficulty levels
- Spectator mode for watching live games
- Game history and statistics

## API Documentation

### REST Endpoints

#### Game Management
- `POST /api/games/friend` - Create a game with a friend
- `POST /api/games/join` - Join a game with a key
- `POST /api/games/online` - Find or create an online game
- `POST /api/games/bot` - Create a game against a bot
- `GET /api/games/:id` - Get game details
- `GET /api/games` - List active games

### Socket Events

#### Client to Server
- `joinGame` - Join a game room
- `leaveGame` - Leave a game room
- `makeMove` - Make a move in the game
- `resignGame` - Resign from the game
- `joinAsSpectator` - Join as a spectator
- `leaveAsSpectator` - Leave as a spectator

#### Server to Client
- `moveSuccess` - Move was successful
- `moveFailed` - Move was invalid
- `gameEnded` - Game has ended
- `error` - Error occurred

## Development

The project uses:
- Express.js for the REST API
- Socket.IO for real-time communication
- MongoDB for data storage
- Stockfish for AI moves 