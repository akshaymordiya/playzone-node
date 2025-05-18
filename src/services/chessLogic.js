class ChessLogic {
  constructor() {
    this.initializeBoard();
  }

  initializeBoard() {
    this.board = Array(8).fill().map(() => Array(8).fill(null));
    this.setupInitialPieces();
  }

  setupInitialPieces() {
    // Setup pawns
    for (let x = 0; x < 8; x++) {
      this.board[1][x] = { type: 'pawn', color: 'black', hasMoved: false };
      this.board[6][x] = { type: 'pawn', color: 'white', hasMoved: false };
    }

    // Setup other pieces
    const pieces = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    pieces.forEach((piece, x) => {
      this.board[0][x] = { type: piece, color: 'black', hasMoved: false };
      this.board[7][x] = { type: piece, color: 'white', hasMoved: false };
    });
  }

  isValidMove(from, to, color) {
    const piece = this.board[from.y][from.x];
    if (!piece || piece.color !== color) return false;

    switch (piece.type) {
      case 'pawn':
        return this.isValidPawnMove(from, to, color);
      case 'rook':
        return this.isValidRookMove(from, to);
      case 'knight':
        return this.isValidKnightMove(from, to);
      case 'bishop':
        return this.isValidBishopMove(from, to);
      case 'queen':
        return this.isValidQueenMove(from, to);
      case 'king':
        return this.isValidKingMove(from, to);
      default:
        return false;
    }
  }

  isValidPawnMove(from, to, color) {
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;

    // Forward move
    if (from.x === to.x && to.y === from.y + direction && !this.board[to.y][to.x]) {
      return true;
    }

    // Initial two-square move
    if (from.x === to.x && from.y === startRow && 
        to.y === from.y + 2 * direction && 
        !this.board[from.y + direction][from.x] && 
        !this.board[to.y][to.x]) {
      return true;
    }

    // Capture
    if (Math.abs(to.x - from.x) === 1 && to.y === from.y + direction) {
      const targetPiece = this.board[to.y][to.x];
      return targetPiece && targetPiece.color !== color;
    }

    return false;
  }

  isValidRookMove(from, to) {
    if (from.x !== to.x && from.y !== to.y) return false;
    return this.isPathClear(from, to);
  }

  isValidKnightMove(from, to) {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    return (dx === 2 && dy === 1) || (dx === 1 && dy === 2);
  }

  isValidBishopMove(from, to) {
    if (Math.abs(to.x - from.x) !== Math.abs(to.y - from.y)) return false;
    return this.isPathClear(from, to);
  }

  isValidQueenMove(from, to) {
    return this.isValidRookMove(from, to) || this.isValidBishopMove(from, to);
  }

  isValidKingMove(from, to) {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    return dx <= 1 && dy <= 1;
  }

  isPathClear(from, to) {
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    let x = from.x + dx;
    let y = from.y + dy;

    while (x !== to.x || y !== to.y) {
      if (this.board[y][x]) return false;
      x += dx;
      y += dy;
    }

    return true;
  }

  isInCheck(color) {
    // Find king's position
    let kingPos = null;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const piece = this.board[y][x];
        if (piece && piece.type === 'king' && piece.color === color) {
          kingPos = { x, y };
          break;
        }
      }
      if (kingPos) break;
    }

    // Check if any opponent piece can capture the king
    const opponentColor = color === 'white' ? 'black' : 'white';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const piece = this.board[y][x];
        if (piece && piece.color === opponentColor) {
          if (this.isValidMove({ x, y }, kingPos, opponentColor)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  isCheckmate(color) {
    if (!this.isInCheck(color)) return false;

    // Try all possible moves for all pieces
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const piece = this.board[y][x];
        if (piece && piece.color === color) {
          for (let toY = 0; toY < 8; toY++) {
            for (let toX = 0; toX < 8; toX++) {
              if (this.isValidMove({ x, y }, { x: toX, y: toY }, color)) {
                // Try the move
                const tempPiece = this.board[toY][toX];
                this.board[toY][toX] = piece;
                this.board[y][x] = null;

                const stillInCheck = this.isInCheck(color);

                // Undo the move
                this.board[y][x] = piece;
                this.board[toY][toX] = tempPiece;

                if (!stillInCheck) return false;
              }
            }
          }
        }
      }
    }

    return true;
  }

  makeMove(from, to) {
    const piece = this.board[from.y][from.x];
    if (!piece) return false;

    if (!this.isValidMove(from, to, piece.color)) return false;

    // Make the move
    this.board[to.y][to.x] = piece;
    this.board[from.y][from.x] = null;
    piece.hasMoved = true;

    return true;
  }

  getBoardState() {
    return this.board;
  }
}

module.exports = ChessLogic; 