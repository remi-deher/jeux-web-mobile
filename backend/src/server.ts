import type { GameType, GameVariant } from '@sn/shared/game-types';
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import crypto from 'crypto';
import cors from 'cors';
import { Connect4State, createInitialConnect4State, makeConnect4Move } from './games/connect4';
import {
  BattleshipState,
  createInitialBattleshipState,
  placeShip,
  setPlayerReady,
  fireShot,
  getSanitizedBattleshipState
} from './games/battleship';
import { TicTacToeState, createInitialTicTacToeState, makeTicTacToeMove } from './games/tictactoe';
import { CheckersState, createInitialCheckersState, makeCheckersMove } from './games/checkers';
import { ChessState, createInitialChessState, makeChessMove } from './games/chess';
import { GomokuState, createInitialGomokuState, makeGomokuMove } from './games/gomoku';
import { OthelloState, createInitialOthelloState, makeOthelloMove } from './games/othello';
import { PongState, createInitialPongState, updatePongPhysics } from './games/pong';
import { PenduState, createInitialPenduState, makePenduGuess } from './games/pendu';
import { DominosState, createInitialDominosState, makeDominosMove, drawFromBoneyard, passTurn } from './games/dominos';
import { SnakeState, createInitialSnakeState, updateSnakePhysics, setSnakeDirection, Direction as SnakeDirection } from './games/snake';
import { TetrisState, createInitialTetrisState, updateTetrisPhysics, TetrisAction } from './games/tetris';
import { MemoryState, createInitialMemoryState, flipCard, resolveFlip } from './games/memory';
import { UnoState, createInitialUnoState, unoPlay, unoDraw, UnoColor } from './games/uno';
import { BlackjackState, createInitialBlackjackState, placeBet, bjHit, bjStand, bjDouble, nextRound } from './games/blackjack';

const app = express();
app.use(cors());

/**
 * GET /api/rtc-config
 *
 * Retourne la configuration ICE avec des credentials TURN dynamiques
 * (HMAC-SHA1, valides 1 heure) compatibles avec coturn --use-auth-secret.
 *
 * Format du username : "<timestamp_expiry>:playbox"
 * Format du password : base64( HMAC-SHA1( TURN_SECRET, username ) )
 *
 * Si TURN_SECRET ou TURN_HOST ne sont pas définis, retourne uniquement
 * les serveurs STUN publics (fallback gracieux).
 */
app.get('/api/rtc-config', (_req, res) => {
  const secret = process.env.TURN_SECRET;
  const host   = process.env.TURN_HOST;

  const stunFallback = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (!secret || !host) {
    // Pas de TURN configuré → STUN uniquement
    res.json({ iceServers: stunFallback });
    return;
  }

  // Credentials valides 1 heure
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const username  = `${expiresAt}:playbox`;
  const password  = crypto
    .createHmac('sha1', secret)
    .update(username)
    .digest('base64');

  res.json({
    iceServers: [
      // Propre serveur STUN/TURN (priorité)
      { urls: `stun:${host}:3478` },
      {
        urls: [
          `turn:${host}:3478?transport=udp`,
          `turn:${host}:3478?transport=tcp`,
        ],
        username,
        credential: password,
      },
      // STUN publics en fallback si le TURN privé est injoignable
      ...stunFallback,
    ],
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  roomId?: string; // If undefined, it is global
}

interface Player {
  id: string;
  username: string;
  disconnected?: boolean;
}

interface Room {
  id: string;
  gameType: GameType;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished'; // RoomStatus from shared
  gameState: Connect4State | BattleshipState | TicTacToeState | CheckersState | ChessState | GomokuState | OthelloState | PongState | PenduState | DominosState | SnakeState | TetrisState | MemoryState | UnoState | BlackjackState | null;
  chatMessages: ChatMessage[];
  isPrivate: boolean;
  rematchVotes: string[];
  isLocal?: boolean;
  variant?: GameVariant;
}

const rooms: { [id: string]: Room } = {};
const globalChat: ChatMessage[] = [];
const disconnectTimeouts: { [playerId: string]: NodeJS.Timeout } = {};

const onlineUsers: { [socketId: string]: string } = {};

function broadcastOnlineUsers() {
  const list = Object.entries(onlineUsers).map(([id, username]) => ({ id, username }));
  io.emit('onlineUsersList', list);
}

// Helper to generate a 6-letter room ID
function generateRoomId(): string {
  let id = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  do {
    id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[id]);
  return id;
}

io.on('connection', (socket: Socket) => {
  console.log(`User connected: ${socket.id}`);

  // Send global chat history upon connection
  socket.emit('globalChatHistory', globalChat);

  // Send active rooms
  socket.emit('roomsList', getPublicRooms());

  // Send online users
  broadcastOnlineUsers();

  socket.on('registerUsername', (username: string) => {
    if (!username || !username.trim()) return;
    onlineUsers[socket.id] = username.trim();
    broadcastOnlineUsers();
  });

  socket.on('sendChallenge', (data: { targetSocketId: string; gameType: string }) => {
    const challengerUsername = onlineUsers[socket.id] || 'Anonymous';
    io.to(data.targetSocketId).emit('challengeReceived', {
      challengerSocketId: socket.id,
      challengerUsername,
      gameType: data.gameType
    });
  });

  socket.on('declineChallenge', (data: { challengerSocketId: string }) => {
    const opponentUsername = onlineUsers[socket.id] || 'Joueur 2';
    io.to(data.challengerSocketId).emit('challengeDeclined', { opponentUsername });
  });

  socket.on('acceptChallenge', (data: { challengerSocketId: string; gameType: GameType; variant?: GameVariant }) => {
    const challengerUsername = onlineUsers[data.challengerSocketId] || 'Challenger';
    const opponentUsername = onlineUsers[socket.id] || 'Opponent';
    const challengerSocket = io.sockets.sockets.get(data.challengerSocketId);

    if (!challengerSocket) return;

    const roomId = generateRoomId();
    const newRoom: Room = {
      id: roomId,
      gameType: data.gameType,
      players: [
        { id: data.challengerSocketId, username: challengerUsername },
        { id: socket.id, username: opponentUsername }
      ],
      status: 'playing',
      gameState: null,
      chatMessages: [],
      isPrivate: true,
      rematchVotes: [],
      variant: data.variant
    };

    if (data.gameType === 'connect4') {
      newRoom.gameState = createInitialConnect4State();
    } else if (data.gameType === 'battleship') {
      newRoom.gameState = createInitialBattleshipState([data.challengerSocketId, socket.id]);
    } else if (data.gameType === 'tictactoe') {
      newRoom.gameState = createInitialTicTacToeState();
    } else if (data.gameType === 'checkers') {
      newRoom.gameState = createInitialCheckersState();
    } else if (data.gameType === 'chess') {
      newRoom.gameState = createInitialChessState();
    } else if (data.gameType === 'gomoku') {
      newRoom.gameState = createInitialGomokuState();
    } else if (data.gameType === 'othello') {
      newRoom.gameState = createInitialOthelloState();
    } else if (data.gameType === 'pong') {
      newRoom.gameState = createInitialPongState();
      startPongLoop(roomId);
    } else if (data.gameType === 'pendu') {
      newRoom.gameState = createInitialPenduState();
    } else if (data.gameType === 'dominos') {
      newRoom.gameState = createInitialDominosState(data.variant);
    } else if (data.gameType === 'snake') {
      newRoom.gameState = createInitialSnakeState([data.challengerSocketId, socket.id]);
      startSnakeLoop(roomId);
    } else if (data.gameType === 'tetris') {
      newRoom.gameState = createInitialTetrisState([data.challengerSocketId, socket.id]);
      startTetrisLoop(roomId);
    } else if (data.gameType === 'memory') {
      newRoom.gameState = createInitialMemoryState([data.challengerSocketId, socket.id]);
    } else if (data.gameType === 'uno') {
      newRoom.gameState = createInitialUnoState([data.challengerSocketId, socket.id]);
    } else if (data.gameType === 'blackjack') {
      newRoom.gameState = createInitialBlackjackState([data.challengerSocketId, socket.id]);
    }

    rooms[roomId] = newRoom;
    challengerSocket.join(roomId);
    socket.join(roomId);

    io.to(roomId).emit('challengeAccepted', { roomId, room: newRoom });
  });

  socket.on('globalMessage', (data: { username: string; text: string }) => {
    const msg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      username: data.username || 'Anonymous',
      text: data.text,
      timestamp: Date.now()
    };
    globalChat.push(msg);
    if (globalChat.length > 100) globalChat.shift();
    io.emit('globalMessage', msg);
  });

  socket.on('privateMessage', (data: { recipientUsername: string; text: string }) => {
    const senderUsername = onlineUsers[socket.id];
    if (!senderUsername) return;

    const recipientEntry = Object.entries(onlineUsers).find(
      ([_, uname]) => uname.toLowerCase() === data.recipientUsername.toLowerCase()
    );

    const msg = {
      id: Math.random().toString(36).substring(2, 9),
      sender: senderUsername,
      recipient: data.recipientUsername,
      text: data.text,
      timestamp: Date.now()
    };

    if (recipientEntry) {
      io.to(recipientEntry[0]).emit('privateMessage', msg);
    }
    socket.emit('privateMessage', msg);
  });


  socket.on('createRoom', (data: { gameType: GameType; username: string; isPrivate?: boolean; variant?: GameVariant }, callback) => {
    const roomId = generateRoomId();
    const newRoom: Room = {
      id: roomId,
      gameType: data.gameType,
      players: [{ id: socket.id, username: data.username }],
      status: 'waiting',
      gameState: null,
      chatMessages: [],
      isPrivate: !!data.isPrivate,
      rematchVotes: [],
      variant: data.variant
    };

    rooms[roomId] = newRoom;
    socket.join(roomId);

    console.log(`Room created: ${roomId} by ${data.username}`);

    callback({ success: true, roomId, room: newRoom });
    io.emit('roomsList', getPublicRooms());
  });

  socket.on('createLocalRoom', (data: { gameType: GameType; username: string; player1Name?: string; player2Name?: string; variant?: GameVariant }, callback) => {
    const roomId = generateRoomId();
    const newRoom: Room = {
      id: roomId,
      gameType: data.gameType,
      players: [
        { id: socket.id, username: data.player1Name || data.username || 'Joueur 1' },
        { id: 'local-player-2', username: data.player2Name || 'Joueur 2' }
      ],
      status: 'playing',
      gameState: null,
      chatMessages: [],
      isPrivate: true,
      isLocal: true,
      rematchVotes: [],
      variant: data.variant
    };

    if (data.gameType === 'connect4') {
      newRoom.gameState = createInitialConnect4State();
    } else if (data.gameType === 'battleship') {
      newRoom.gameState = createInitialBattleshipState([socket.id, 'local-player-2']);
    } else if (data.gameType === 'tictactoe') {
      newRoom.gameState = createInitialTicTacToeState();
    } else if (data.gameType === 'checkers') {
      newRoom.gameState = createInitialCheckersState();
    } else if (data.gameType === 'chess') {
      newRoom.gameState = createInitialChessState();
    } else if (data.gameType === 'gomoku') {
      newRoom.gameState = createInitialGomokuState();
    } else if (data.gameType === 'othello') {
      newRoom.gameState = createInitialOthelloState();
    } else if (data.gameType === 'pong') {
      newRoom.gameState = createInitialPongState();
      startPongLoop(roomId);
    } else if (data.gameType === 'pendu') {
      newRoom.gameState = createInitialPenduState();
    } else if (data.gameType === 'dominos') {
      newRoom.gameState = createInitialDominosState(data.variant);
    } else if (data.gameType === 'snake') {
      newRoom.gameState = createInitialSnakeState([socket.id, 'local-player-2']);
      startSnakeLoop(roomId);
    } else if (data.gameType === 'tetris') {
      newRoom.gameState = createInitialTetrisState([socket.id, 'local-player-2']);
      startTetrisLoop(roomId);
    } else if (data.gameType === 'memory') {
      newRoom.gameState = createInitialMemoryState([socket.id, 'local-player-2']);
    } else if (data.gameType === 'uno') {
      newRoom.gameState = createInitialUnoState([socket.id, 'local-player-2']);
    } else if (data.gameType === 'blackjack') {
      newRoom.gameState = createInitialBlackjackState([socket.id, 'local-player-2']);
    }

    rooms[roomId] = newRoom;
    socket.join(roomId);

    console.log(`Local room created: ${roomId} with players ${newRoom.players[0].username} and ${newRoom.players[1].username}`);

    callback({ success: true, roomId, room: newRoom });
  });

  socket.on('joinRoom', (data: { roomId: string; username: string }, callback) => {
    const room = rooms[data.roomId?.toUpperCase()];
    if (!room) {
      return callback({ success: false, message: 'Room not found' });
    }
    if (room.players.length >= 2) {
      return callback({ success: false, message: 'Room is full' });
    }

    room.players.push({ id: socket.id, username: data.username });
    socket.join(room.id);

    console.log(`User ${data.username} joined room ${room.id}`);

    // If room is full, start the game
    if (room.players.length === 2) {
      room.status = 'playing';
      if (room.gameType === 'connect4') {
        room.gameState = createInitialConnect4State();
      } else if (room.gameType === 'battleship') {
        room.gameState = createInitialBattleshipState(room.players.map(p => p.id));
      } else if (room.gameType === 'tictactoe') {
        room.gameState = createInitialTicTacToeState();
      } else if (room.gameType === 'checkers') {
        room.gameState = createInitialCheckersState();
      } else if (room.gameType === 'chess') {
        room.gameState = createInitialChessState();
      } else if (room.gameType === 'gomoku') {
        room.gameState = createInitialGomokuState();
      } else if (room.gameType === 'othello') {
        room.gameState = createInitialOthelloState();
      } else if (room.gameType === 'pong') {
        room.gameState = createInitialPongState();
        startPongLoop(room.id);
      } else if (room.gameType === 'pendu') {
        room.gameState = createInitialPenduState();
      } else if (room.gameType === 'dominos') {
        room.gameState = createInitialDominosState(room.variant);
      } else if (room.gameType === 'snake') {
        room.gameState = createInitialSnakeState(room.players.map(p => p.id) as [string, string]);
        startSnakeLoop(room.id);
      } else if (room.gameType === 'tetris') {
        room.gameState = createInitialTetrisState(room.players.map(p => p.id) as [string, string]);
        startTetrisLoop(room.id);
      } else if (room.gameType === 'memory') {
        room.gameState = createInitialMemoryState(room.players.map(p => p.id) as [string, string]);
      } else if (room.gameType === 'uno') {
        room.gameState = createInitialUnoState(room.players.map(p => p.id) as [string, string]);
      } else if (room.gameType === 'blackjack') {
        room.gameState = createInitialBlackjackState(room.players.map(p => p.id) as [string, string]);
      }
    }

    callback({ success: true, roomId: room.id, room });
    broadcastRoomUpdate(room);
    io.emit('roomsList', getPublicRooms());
  });

  socket.on('roomMessage', (data: { roomId: string; username: string; text: string }) => {
    const room = rooms[data.roomId];
    if (!room) return;

    const msg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      username: data.username,
      text: data.text,
      timestamp: Date.now(),
      roomId: room.id
    };

    room.chatMessages.push(msg);
    io.to(room.id).emit('roomMessage', msg);
  });

  // GAME EVENTS: Connect 4
  socket.on('c4Move', (data: { roomId: string; column: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'connect4' || !room.gameState) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const playerNum = room.isLocal ? (room.gameState as Connect4State).currentPlayer : (playerIndex + 1); // 1 or 2
    const success = makeConnect4Move(room.gameState as Connect4State, data.column, playerNum);

    if (success) {
      if ((room.gameState as Connect4State).winner !== null) {
        room.status = 'finished';
      }
      broadcastRoomUpdate(room);
    }
  });

  // GAME EVENTS: Battleship
  socket.on('bsPlaceShip', (data: { roomId: string; shipId: string; row: number; col: number; horizontal: boolean; playerId?: string }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'battleship' || !room.gameState) return;

    const activePlayerId = room.isLocal && data.playerId ? data.playerId : socket.id;
    const success = placeShip(
      room.gameState as BattleshipState,
      activePlayerId,
      data.shipId,
      data.row,
      data.col,
      data.horizontal
    );

    if (success) {
      broadcastRoomUpdate(room);
    }
  });

  socket.on('bsReady', (data: { roomId: string; playerId?: string }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'battleship' || !room.gameState) return;

    const activePlayerId = room.isLocal && data.playerId ? data.playerId : socket.id;
    const success = setPlayerReady(room.gameState as BattleshipState, activePlayerId);
    if (success) {
      broadcastRoomUpdate(room);
    }
  });

  socket.on('bsFire', (data: { roomId: string; row: number; col: number; playerId?: string }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'battleship' || !room.gameState) return;

    const activePlayerId = room.isLocal && data.playerId ? data.playerId : socket.id;
    const result = fireShot(room.gameState as BattleshipState, activePlayerId, data.row, data.col);
    if (result.success) {
      if ((room.gameState as BattleshipState).winnerId !== null) {
        room.status = 'finished';
      }
      broadcastRoomUpdate(room);
    }
  });

  socket.on('tttMove', (data: { roomId: string; cellIndex: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'tictactoe' || !room.gameState) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const playerSign: 'X' | 'O' = room.isLocal ? (room.gameState as TicTacToeState).currentPlayer : (playerIndex === 0 ? 'X' : 'O');
    const success = makeTicTacToeMove(room.gameState as TicTacToeState, data.cellIndex, playerSign);

    if (success) {
      if ((room.gameState as TicTacToeState).winner !== null) {
        room.status = 'finished';
      }
      broadcastRoomUpdate(room);
    }
  });

  socket.on('checkersMove', (data: { roomId: string; fromRow: number; fromCol: number; toRow: number; toCol: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'checkers' || !room.gameState) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const playerNum = room.isLocal ? (room.gameState as CheckersState).currentPlayer : ((playerIndex + 1) as 1 | 2);
    const success = makeCheckersMove(room.gameState as CheckersState, data.fromRow, data.fromCol, data.toRow, data.toCol, playerNum);

    if (success) {
      if ((room.gameState as CheckersState).winner !== null) {
        room.status = 'finished';
      }
      broadcastRoomUpdate(room);
    }
  });

  socket.on('chessMove', (data: { roomId: string; fromRow: number; fromCol: number; toRow: number; toCol: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'chess' || !room.gameState) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const playerNum = room.isLocal ? (room.gameState as ChessState).currentPlayer : ((playerIndex + 1) as 1 | 2);
    const success = makeChessMove(room.gameState as ChessState, data.fromRow, data.fromCol, data.toRow, data.toCol, playerNum);

    if (success) {
      if ((room.gameState as ChessState).winner !== null) {
        room.status = 'finished';
      }
      broadcastRoomUpdate(room);
    }
  });

  socket.on('gomokuMove', (data: { roomId: string; row: number; col: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'gomoku' || !room.gameState) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const playerNum = room.isLocal ? (room.gameState as GomokuState).currentPlayer : (playerIndex + 1);
    const success = makeGomokuMove(room.gameState as GomokuState, data.row, data.col, playerNum);

    if (success) {
      if ((room.gameState as GomokuState).winner !== null) {
        room.status = 'finished';
      }
      broadcastRoomUpdate(room);
    }
  });

  socket.on('othelloMove', (data: { roomId: string; row: number; col: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'othello' || !room.gameState) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const playerNum = room.isLocal ? (room.gameState as OthelloState).currentPlayer : (playerIndex + 1);
    const success = makeOthelloMove(room.gameState as OthelloState, data.row, data.col, playerNum);

    if (success) {
      if ((room.gameState as OthelloState).winner !== null) {
        room.status = 'finished';
      }
      broadcastRoomUpdate(room);
    }
  });

  socket.on('pongMovePaddle', (data: { roomId: string; yPercent: number; paddleIndex?: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'pong' || !room.gameState) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1 && data.paddleIndex === undefined) return;

    const state = room.gameState as PongState;
    const paddleIndex = data.paddleIndex !== undefined ? data.paddleIndex : (playerIndex + 1);
    
    if (paddleIndex === 1) {
      state.p1Y = Math.max(state.paddleHeight / 2, Math.min(100 - state.paddleHeight / 2, data.yPercent));
    } else if (paddleIndex === 2) {
      state.p2Y = Math.max(state.paddleHeight / 2, Math.min(100 - state.paddleHeight / 2, data.yPercent));
    }
  });

  socket.on('penduGuess', (data: { roomId: string; letter: string }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'pendu' || !room.gameState) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const playerNum = room.isLocal ? (room.gameState as PenduState).currentPlayer : (playerIndex + 1);
    const success = makePenduGuess(room.gameState as PenduState, data.letter, playerNum);

    if (success) {
      if ((room.gameState as PenduState).winner !== null) {
        room.status = 'finished';
      }
      broadcastRoomUpdate(room);
    }
  });

  socket.on('dominosPlay', (data: { roomId: string; tileIndex: number; side: 'left' | 'right' | null; coords?: { x1: number; y1: number; x2: number; y2: number } }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'dominos' || !room.gameState) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const playerNum = room.isLocal ? (room.gameState as DominosState).currentPlayer : (playerIndex + 1);
    const success = makeDominosMove(room.gameState as DominosState, data.tileIndex, data.side || null, data.coords || null, playerNum);

    if (success) {
      if ((room.gameState as DominosState).winner !== null) {
        room.status = 'finished';
      }
      broadcastRoomUpdate(room);
    }
  });

  socket.on('dominosDraw', (data: { roomId: string }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'dominos' || !room.gameState) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const playerNum = room.isLocal ? (room.gameState as DominosState).currentPlayer : (playerIndex + 1);
    const success = drawFromBoneyard(room.gameState as DominosState, playerNum);

    if (success) {
      broadcastRoomUpdate(room);
    }
  });

  socket.on('dominosPass', (data: { roomId: string }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'dominos' || !room.gameState) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const playerNum = room.isLocal ? (room.gameState as DominosState).currentPlayer : (playerIndex + 1);
    const success = passTurn(room.gameState as DominosState, playerNum);

    if (success) {
      if ((room.gameState as DominosState).winner !== null) {
        room.status = 'finished';
      }
      broadcastRoomUpdate(room);
    }
  });

  socket.on('sendEmoji', (data: { roomId: string; emoji: string }) => {
    const room = rooms[data.roomId];
    if (!room) return;
    socket.to(room.id).emit('emojiReceived', { senderId: socket.id, emoji: data.emoji });
  });

  socket.on('requestRematch', (data: { roomId: string }) => {
    const room = rooms[data.roomId];
    if (!room || room.status !== 'finished') return;

    if (room.isLocal) {
      // For local play, a rematch is triggered immediately
      room.status = 'playing';
      room.rematchVotes = [];
      if (room.gameType === 'connect4') {
        room.gameState = createInitialConnect4State();
      } else if (room.gameType === 'battleship') {
        room.gameState = createInitialBattleshipState(room.players.map(p => p.id));
      } else if (room.gameType === 'tictactoe') {
        room.gameState = createInitialTicTacToeState();
      } else if (room.gameType === 'checkers') {
        room.gameState = createInitialCheckersState();
      } else if (room.gameType === 'chess') {
        room.gameState = createInitialChessState();
      } else if (room.gameType === 'gomoku') {
        room.gameState = createInitialGomokuState();
      } else if (room.gameType === 'othello') {
        room.gameState = createInitialOthelloState();
      } else if (room.gameType === 'pong') {
        room.gameState = createInitialPongState();
        startPongLoop(room.id);
      } else if (room.gameType === 'pendu') {
        room.gameState = createInitialPenduState();
      } else if (room.gameType === 'dominos') {
        room.gameState = createInitialDominosState(room.variant);
      } else if (room.gameType === 'snake') {
        room.gameState = createInitialSnakeState(room.players.map(p => p.id) as [string, string]);
        startSnakeLoop(room.id);
      } else if (room.gameType === 'tetris') {
        room.gameState = createInitialTetrisState(room.players.map(p => p.id) as [string, string]);
        startTetrisLoop(room.id);
      } else if (room.gameType === 'memory') {
        room.gameState = createInitialMemoryState(room.players.map(p => p.id) as [string, string]);
      } else if (room.gameType === 'uno') {
        room.gameState = createInitialUnoState(room.players.map(p => p.id) as [string, string]);
      } else if (room.gameType === 'blackjack') {
        room.gameState = createInitialBlackjackState(room.players.map(p => p.id) as [string, string]);
      }
    } else {
      if (!room.rematchVotes) room.rematchVotes = [];
      if (!room.rematchVotes.includes(socket.id)) {
        room.rematchVotes.push(socket.id);
      }

      if (room.rematchVotes.length === 2) {
        room.status = 'playing';
        room.rematchVotes = [];
        if (room.gameType === 'connect4') {
          room.gameState = createInitialConnect4State();
        } else if (room.gameType === 'battleship') {
          room.gameState = createInitialBattleshipState(room.players.map(p => p.id));
        } else if (room.gameType === 'tictactoe') {
          room.gameState = createInitialTicTacToeState();
        } else if (room.gameType === 'checkers') {
          room.gameState = createInitialCheckersState();
        } else if (room.gameType === 'chess') {
          room.gameState = createInitialChessState();
        } else if (room.gameType === 'gomoku') {
          room.gameState = createInitialGomokuState();
        } else if (room.gameType === 'othello') {
          room.gameState = createInitialOthelloState();
        } else if (room.gameType === 'pong') {
          room.gameState = createInitialPongState();
          startPongLoop(room.id);
        } else if (room.gameType === 'pendu') {
          room.gameState = createInitialPenduState();
        } else if (room.gameType === 'dominos') {
          room.gameState = createInitialDominosState(room.variant);
        } else if (room.gameType === 'snake') {
          room.gameState = createInitialSnakeState(room.players.map(p => p.id) as [string, string]);
          startSnakeLoop(room.id);
        } else if (room.gameType === 'tetris') {
          room.gameState = createInitialTetrisState(room.players.map(p => p.id) as [string, string]);
          startTetrisLoop(room.id);
        } else if (room.gameType === 'memory') {
          room.gameState = createInitialMemoryState(room.players.map(p => p.id) as [string, string]);
        } else if (room.gameType === 'uno') {
          room.gameState = createInitialUnoState(room.players.map(p => p.id) as [string, string]);
        } else if (room.gameType === 'blackjack') {
          room.gameState = createInitialBlackjackState(room.players.map(p => p.id) as [string, string]);
        }
      }
    }

    broadcastRoomUpdate(room);
  });

  socket.on('reconnectRoom', (data: { roomId: string; username: string }, callback) => {
    const room = rooms[data.roomId?.toUpperCase()];
    if (!room) {
      return callback({ success: false, message: 'Room not found' });
    }
    const player = room.players.find(p => p.username === data.username);
    if (!player || !player.disconnected) {
      return callback({ success: false, message: 'Player not found or not disconnected' });
    }

    const oldId = player.id;
    if (disconnectTimeouts[oldId]) {
      clearTimeout(disconnectTimeouts[oldId]);
      delete disconnectTimeouts[oldId];
    }

    player.id = socket.id;
    player.disconnected = false;
    socket.join(room.id);

    if (room.gameType === 'battleship' && room.gameState) {
      const bsState = room.gameState as BattleshipState;
      if (bsState.players[oldId]) {
        bsState.players[socket.id] = bsState.players[oldId];
        bsState.players[socket.id].playerId = socket.id;
        delete bsState.players[oldId];
      }
      if (bsState.currentPlayerId === oldId) {
        bsState.currentPlayerId = socket.id;
      }
      if (bsState.winnerId === oldId) {
        bsState.winnerId = socket.id;
      }
    }

    console.log(`User ${data.username} reconnected to room ${room.id}`);
    callback({ success: true, room });
    broadcastRoomUpdate(room);
  });

  socket.on('forceEnd', (data: { roomId: string }) => {
    const room = rooms[data.roomId];
    if (!room || room.status !== 'playing') return;

    const hasDisconnected = room.players.some(p => p.disconnected);
    if (!hasDisconnected) return;

    const winner = room.players.find(p => !p.disconnected);
    if (!winner) return;

    room.players.forEach(p => {
      if (p.disconnected && disconnectTimeouts[p.id]) {
        clearTimeout(disconnectTimeouts[p.id]);
        delete disconnectTimeouts[p.id];
      }
    });

    room.status = 'finished';
    if (room.gameType === 'connect4') {
      const state = room.gameState as Connect4State;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = playerIndex !== -1 ? playerIndex + 1 : 1;
      }
    } else if (room.gameType === 'battleship') {
      const state = room.gameState as BattleshipState;
      if (state) {
        state.winnerId = winner.id;
        state.phase = 'finished';
      }
    } else if (room.gameType === 'tictactoe') {
      const state = room.gameState as TicTacToeState;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = playerIndex === 0 ? 'X' : 'O';
      }
    } else if (room.gameType === 'checkers') {
      const state = room.gameState as CheckersState;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = (playerIndex !== -1 ? playerIndex + 1 : 1) as 1 | 2;
      }
    } else if (room.gameType === 'chess') {
      const state = room.gameState as ChessState;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = (playerIndex !== -1 ? playerIndex + 1 : 1) as 1 | 2;
      }
    } else if (room.gameType === 'gomoku') {
      const state = room.gameState as GomokuState;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = playerIndex !== -1 ? playerIndex + 1 : 1;
      }
    } else if (room.gameType === 'othello') {
      const state = room.gameState as OthelloState;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = playerIndex !== -1 ? playerIndex + 1 : 1;
      }
    } else if (room.gameType === 'dominos') {
      const state = room.gameState as DominosState;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = playerIndex !== -1 ? playerIndex + 1 : 1;
        state.winnerReason = "abandon de l'adversaire";
      }
    } else if (room.gameType === 'snake') {
      const state = room.gameState as SnakeState;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = playerIndex !== -1 ? playerIndex + 1 : 1;
      }
      if (snakeIntervals[room.id]) {
        clearInterval(snakeIntervals[room.id]);
        delete snakeIntervals[room.id];
      }
    } else if (room.gameType === 'tetris') {
      const state = room.gameState as TetrisState;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = playerIndex !== -1 ? playerIndex + 1 : 1;
      }
      if (tetrisIntervals[room.id]) {
        clearInterval(tetrisIntervals[room.id]);
        delete tetrisIntervals[room.id];
      }
    } else if (room.gameType === 'memory') {
      const state = room.gameState as MemoryState;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = playerIndex !== -1 ? playerIndex + 1 : 1;
      }
    } else if (room.gameType === 'uno') {
      const state = room.gameState as UnoState;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = playerIndex !== -1 ? playerIndex + 1 : 1;
      }
    } else if (room.gameType === 'blackjack') {
      const state = room.gameState as BlackjackState;
      if (state) {
        const playerIndex = room.players.findIndex(p => p.id === winner.id);
        state.winner = playerIndex !== -1 ? playerIndex + 1 : 1;
      }
    }

    broadcastRoomUpdate(room);
    io.emit('roomsList', getPublicRooms());
  });

  socket.on('leaveRoom', (data: { roomId: string }) => {
    handlePlayerLeave(socket, data.roomId);
  });

  // ── Tetris input ───────────────────────────────────────────────────────────
  socket.on('tetrisInput', (data: { roomId: string; action: TetrisAction; playerId?: string }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'tetris' || !room.gameState) return;
    const state = room.gameState as TetrisState;
    if (state.winner !== null) return;

    // Determine which player sent the action
    let pid: string;
    if (room.isLocal && data.playerId) {
      pid = data.playerId;
    } else {
      pid = socket.id;
    }

    updateTetrisPhysics(state, pid, data.action);
    io.to(data.roomId).emit('tetrisUpdate', state);

    if (state.winner !== null) {
      room.status = 'finished';
      broadcastRoomUpdate(room);
      if (tetrisIntervals[data.roomId]) {
        clearInterval(tetrisIntervals[data.roomId]);
        delete tetrisIntervals[data.roomId];
      }
    }
  });

  // ── Snake direction input ──────────────────────────────────────────────────
  socket.on('snakeDirection', (data: { roomId: string; dir: SnakeDirection; playerIndex?: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'snake' || !room.gameState) return;
    const state = room.gameState as SnakeState;
    if (state.winner !== null) return;

    // Determine player index
    let idx: 0 | 1;
    if (room.isLocal && data.playerIndex !== undefined) {
      idx = data.playerIndex === 0 ? 0 : 1;
    } else {
      const pi = room.players.findIndex(p => p.id === socket.id);
      if (pi === -1) return;
      idx = pi === 0 ? 0 : 1;
    }
    setSnakeDirection(state, idx, data.dir);
  });

  // ── Ready validation for Snake & Pong ──────────────────────────────────────
  socket.on('playerReady', (data: { roomId: string }) => {
    const room = rooms[data.roomId];
    if (!room || !room.gameState) return;

    if (room.gameType === 'snake') {
      const state = room.gameState as SnakeState;
      if (room.isLocal) {
        state.p1Ready = true;
        state.p2Ready = true;
      } else {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === 0) state.p1Ready = true;
        if (playerIndex === 1) state.p2Ready = true;
      }
      broadcastRoomUpdate(room);
    } else if (room.gameType === 'pong') {
      const state = room.gameState as PongState;
      if (room.isLocal) {
        state.p1Ready = true;
        state.p2Ready = true;
      } else {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === 0) state.p1Ready = true;
        if (playerIndex === 1) state.p2Ready = true;
      }
      broadcastRoomUpdate(room);
    }
  });

  // ── Memory ────────────────────────────────────────────────────────────────────
  socket.on('memoryFlip', (data: { roomId: string; cardId: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'memory' || !room.gameState) return;
    const state = room.gameState as MemoryState;
    if (state.winner !== null) return;

    // Check it's this player's turn (in online mode)
    if (!room.isLocal) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) return;
      const playerNum = (playerIndex + 1) as 1 | 2;
      if (state.currentPlayer !== playerNum) return;
    }

    const result = flipCard(state, data.cardId);
    if (result === 'ignored') return;

    if (result === 'mismatch') {
      broadcastRoomUpdate(room);
      // Resolve after 1.5s
      if (memoryTimeouts[data.roomId]) clearTimeout(memoryTimeouts[data.roomId]);
      memoryTimeouts[data.roomId] = setTimeout(() => {
        delete memoryTimeouts[data.roomId];
        if (rooms[data.roomId]) {
          resolveFlip(room.gameState as MemoryState);
          broadcastRoomUpdate(room);
        }
      }, 1500);
    } else {
      if (state.winner !== null) room.status = 'finished';
      broadcastRoomUpdate(room);
    }
  });

  // ── Uno ───────────────────────────────────────────────────────────────────────
  socket.on('unoPlay', (data: { roomId: string; cardId: number; chosenColor?: UnoColor }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'uno' || !room.gameState) return;
    const state = room.gameState as UnoState;

    const playerIndex = room.isLocal
      ? (state.currentPlayer === 1 ? 0 : 1)
      : room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const result = unoPlay(state, playerIndex as 0 | 1, data.cardId, data.chosenColor);
    if (result === 'ok') {
      if (state.winner !== null) room.status = 'finished';
      broadcastRoomUpdate(room);
    }
  });

  socket.on('unoDraw', (data: { roomId: string }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'uno' || !room.gameState) return;
    const state = room.gameState as UnoState;

    const playerIndex = room.isLocal
      ? (state.currentPlayer === 1 ? 0 : 1)
      : room.players.findIndex(p => p.id === socket.id);
    if (playerIndex === -1) return;

    const result = unoDraw(state, playerIndex as 0 | 1);
    if (result === 'ok') broadcastRoomUpdate(room);
  });

  // ── Blackjack ─────────────────────────────────────────────────────────────────
  socket.on('blackjackBet', (data: { roomId: string; amount: number; playerIndex?: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'blackjack' || !room.gameState) return;
    const state = room.gameState as BlackjackState;

    let idx: 0 | 1;
    if (room.isLocal && data.playerIndex !== undefined) {
      idx = data.playerIndex === 0 ? 0 : 1;
    } else {
      const pi = room.players.findIndex(p => p.id === socket.id);
      if (pi === -1) return;
      idx = pi as 0 | 1;
    }

    if (placeBet(state, idx, data.amount)) broadcastRoomUpdate(room);
  });

  socket.on('blackjackHit', (data: { roomId: string; playerIndex?: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'blackjack' || !room.gameState) return;
    const state = room.gameState as BlackjackState;

    let idx: 0 | 1;
    if (room.isLocal && data.playerIndex !== undefined) {
      idx = data.playerIndex === 0 ? 0 : 1;
    } else {
      const pi = room.players.findIndex(p => p.id === socket.id);
      if (pi === -1) return;
      idx = pi as 0 | 1;
    }

    if (bjHit(state, idx)) {
      if (state.winner !== null) room.status = 'finished';
      broadcastRoomUpdate(room);
    }
  });

  socket.on('blackjackStand', (data: { roomId: string; playerIndex?: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'blackjack' || !room.gameState) return;
    const state = room.gameState as BlackjackState;

    let idx: 0 | 1;
    if (room.isLocal && data.playerIndex !== undefined) {
      idx = data.playerIndex === 0 ? 0 : 1;
    } else {
      const pi = room.players.findIndex(p => p.id === socket.id);
      if (pi === -1) return;
      idx = pi as 0 | 1;
    }

    if (bjStand(state, idx)) {
      if (state.winner !== null) room.status = 'finished';
      broadcastRoomUpdate(room);
    }
  });

  socket.on('blackjackDouble', (data: { roomId: string; playerIndex?: number }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'blackjack' || !room.gameState) return;
    const state = room.gameState as BlackjackState;

    let idx: 0 | 1;
    if (room.isLocal && data.playerIndex !== undefined) {
      idx = data.playerIndex === 0 ? 0 : 1;
    } else {
      const pi = room.players.findIndex(p => p.id === socket.id);
      if (pi === -1) return;
      idx = pi as 0 | 1;
    }

    if (bjDouble(state, idx)) {
      if (state.winner !== null) room.status = 'finished';
      broadcastRoomUpdate(room);
    }
  });

  socket.on('blackjackNextRound', (data: { roomId: string }) => {
    const room = rooms[data.roomId];
    if (!room || room.gameType !== 'blackjack' || !room.gameState) return;
    const state = room.gameState as BlackjackState;

    if (nextRound(state)) broadcastRoomUpdate(room);
  });

  // ── WebRTC signaling (pong P2P data channel) ────────────────────────────────
  // The server is just a relay for SDP + ICE messages.
  // All actual game data flows peer-to-peer after the handshake.

  // WebRTC signaling relay — generic, reusable for any real-time game.
  // The server never inspects the SDP/ICE payloads; it just forwards them to
  // the other player(s) in the room.
  socket.on('rtcOffer',  (data: { roomId: string; offer: any })     => { socket.to(data.roomId).emit('rtcOffer',  { offer: data.offer });         });
  socket.on('rtcAnswer', (data: { roomId: string; answer: any })    => { socket.to(data.roomId).emit('rtcAnswer', { answer: data.answer });       });
  socket.on('rtcIce',    (data: { roomId: string; candidate: any }) => { socket.to(data.roomId).emit('rtcIce',    { candidate: data.candidate }); });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    delete onlineUsers[socket.id];
    broadcastOnlineUsers();
    for (const roomId of Object.keys(rooms)) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        
        if (room.status === 'playing') {
          player.disconnected = true;
          broadcastRoomUpdate(room);

          console.log(`Starting reconnection timeout for ${player.username} in room ${room.id}`);
          disconnectTimeouts[socket.id] = setTimeout(() => {
            console.log(`Reconnection timeout expired for ${player.username}`);
            delete disconnectTimeouts[socket.id];
            handlePlayerLeave(socket, room.id);
          }, 30000);
        } else {
          handlePlayerLeave(socket, room.id);
        }
      }
    }
  });
});

function handlePlayerLeave(socket: Socket, roomId: string) {
  const room = rooms[roomId];
  if (!room) return;

  const leavingPlayerIndex = room.players.findIndex(p => p.id === socket.id);
  room.players = room.players.filter(p => p.id !== socket.id);
  socket.leave(roomId);

  if (room.players.length === 0) {
    delete rooms[roomId];
    console.log(`Room ${roomId} deleted (empty)`);
  } else {
    // Notify remaining player that they won or opponent disconnected
    room.status = 'finished';
    if (room.gameType === 'connect4') {
      const state = room.gameState as Connect4State;
      if (state) {
        state.winner = leavingPlayerIndex === 0 ? 2 : 1;
      }
    } else if (room.gameType === 'battleship') {
      const state = room.gameState as BattleshipState;
      if (state) {
        state.winnerId = room.players[0].id;
        state.phase = 'finished';
      }
    } else if (room.gameType === 'tictactoe') {
      const state = room.gameState as TicTacToeState;
      if (state) {
        state.winner = leavingPlayerIndex === 0 ? 'O' : 'X';
      }
    } else if (room.gameType === 'checkers') {
      const state = room.gameState as CheckersState;
      if (state) {
        state.winner = leavingPlayerIndex === 0 ? 2 : 1;
      }
    } else if (room.gameType === 'chess') {
      const state = room.gameState as ChessState;
      if (state) {
        state.winner = leavingPlayerIndex === 0 ? 2 : 1;
      }
    } else if (room.gameType === 'gomoku') {
      const state = room.gameState as GomokuState;
      if (state) {
        state.winner = leavingPlayerIndex === 0 ? 2 : 1;
      }
    } else if (room.gameType === 'othello') {
      const state = room.gameState as OthelloState;
      if (state) {
        state.winner = leavingPlayerIndex === 0 ? 2 : 1;
      }
    } else if (room.gameType === 'pong') {
      const state = room.gameState as PongState;
      if (state) {
        state.winner = leavingPlayerIndex === 0 ? 2 : 1;
      }
      if (pongIntervals[room.id]) {
        clearInterval(pongIntervals[room.id]);
        delete pongIntervals[room.id];
      }
    } else if (room.gameType === 'pendu') {
      const state = room.gameState as PenduState;
      if (state) {
        state.winner = leavingPlayerIndex === 0 ? 2 : 1;
      }
    } else if (room.gameType === 'dominos') {
      const state = room.gameState as DominosState;
      if (state) {
        state.winner = leavingPlayerIndex === 0 ? 2 : 1;
        state.winnerReason = "forfait (déconnexion)";
      }
    } else if (room.gameType === 'snake') {
      const state = room.gameState as SnakeState;
      if (state) {
        state.winner = leavingPlayerIndex === 0 ? 2 : 1;
      }
      if (snakeIntervals[room.id]) {
        clearInterval(snakeIntervals[room.id]);
        delete snakeIntervals[room.id];
      }
    } else if (room.gameType === 'tetris') {
      const state = room.gameState as TetrisState;
      if (state) {
        state.winner = leavingPlayerIndex === 0 ? 2 : 1;
      }
      if (tetrisIntervals[room.id]) {
        clearInterval(tetrisIntervals[room.id]);
        delete tetrisIntervals[room.id];
      }
    } else if (room.gameType === 'memory') {
      const state = room.gameState as MemoryState;
      if (state) state.winner = leavingPlayerIndex === 0 ? 2 : 1;
    } else if (room.gameType === 'uno') {
      const state = room.gameState as UnoState;
      if (state) state.winner = leavingPlayerIndex === 0 ? 2 : 1;
    } else if (room.gameType === 'blackjack') {
      const state = room.gameState as BlackjackState;
      if (state) state.winner = leavingPlayerIndex === 0 ? 2 : 1;
    }
    broadcastRoomUpdate(room);
  }
  io.emit('roomsList', getPublicRooms());
}

// ── Memory mismatch timeouts ──────────────────────────────────────────────────
const memoryTimeouts: { [roomId: string]: NodeJS.Timeout } = {};

// ── Tetris loop (60 Hz) ───────────────────────────────────────────────────────

const tetrisIntervals: { [roomId: string]: NodeJS.Timeout } = {};

function startTetrisLoop(roomId: string) {
  if (tetrisIntervals[roomId]) return;
  console.log(`Starting Tetris loop for room ${roomId}`);
  tetrisIntervals[roomId] = setInterval(() => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.gameType !== 'tetris' || !room.gameState) {
      clearInterval(tetrisIntervals[roomId]);
      delete tetrisIntervals[roomId];
      return;
    }

    const anyDisconnected = room.players.some(p => p.disconnected);
    if (anyDisconnected) return;

    const state = room.gameState as TetrisState;
    // Gravity-only tick (no action)
    updateTetrisPhysics(state, null, null);
    io.to(roomId).emit('tetrisUpdate', state);

    if (state.winner !== null) {
      room.status = 'finished';
      broadcastRoomUpdate(room);
      clearInterval(tetrisIntervals[roomId]);
      delete tetrisIntervals[roomId];
    }
  }, Math.round(1000 / 60)); // 60 Hz
}

// ── Snake loop (Dynamic Speed) ────────────────────────────────────────────────

const snakeIntervals: { [roomId: string]: NodeJS.Timeout } = {};

function startSnakeLoop(roomId: string) {
  if (snakeIntervals[roomId]) return;
  console.log(`Starting Snake physics loop for room ${roomId}`);

  const runTick = () => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.gameType !== 'snake' || !room.gameState) {
      if (snakeIntervals[roomId]) {
        clearTimeout(snakeIntervals[roomId]);
        delete snakeIntervals[roomId];
      }
      return;
    }

    const anyDisconnected = room.players.some(p => p.disconnected);
    if (anyDisconnected) {
      snakeIntervals[roomId] = setTimeout(runTick, 100);
      return;
    }

    const state = room.gameState as SnakeState;
    if (state.p1Ready && state.p2Ready) {
      updateSnakePhysics(state);
    }

    io.to(roomId).emit('snakeUpdate', state);

    if (state.winner !== null) {
      room.status = 'finished';
      broadcastRoomUpdate(room);
      if (snakeIntervals[roomId]) {
        clearTimeout(snakeIntervals[roomId]);
        delete snakeIntervals[roomId];
      }
      return;
    }

    // Determine current speed (10 Hz initial, up to 20 Hz over 1000 ticks)
    const speedHz = (state.p1Ready && state.p2Ready)
      ? Math.min(20, 10 + state.tickCount * 0.01)
      : 15;
    
    state.speedHz = speedHz;

    const delay = Math.round(1000 / speedHz);
    snakeIntervals[roomId] = setTimeout(runTick, delay);
  };

  runTick();
}

// ── Pong loop (60 Hz) ─────────────────────────────────────────────────────────

const pongIntervals: { [roomId: string]: NodeJS.Timeout } = {};

function startPongLoop(roomId: string) {
  if (pongIntervals[roomId]) return;
  console.log(`Starting Pong physics tick loop for room ${roomId}`);
  pongIntervals[roomId] = setInterval(() => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing' || room.gameType !== 'pong' || !room.gameState) {
      clearInterval(pongIntervals[roomId]);
      delete pongIntervals[roomId];
      return;
    }

    // Pause physics if a player is disconnected
    const anyDisconnected = room.players.some(p => p.disconnected);
    if (anyDisconnected) return;

    const state = room.gameState as PongState;
    updatePongPhysics(state);

    io.to(roomId).emit('pongUpdate', state);

    if (state.winner !== null) {
      room.status = 'finished';
      broadcastRoomUpdate(room);
      clearInterval(pongIntervals[roomId]);
      delete pongIntervals[roomId];
    }
  }, 1000 / 60); // 60 Hz physics + broadcast
}

function broadcastRoomUpdate(room: Room) {
  if (room.gameType === 'battleship' && room.gameState) {
    if (room.isLocal) {
      // For local battleship, send the full unsanitized state so the client can display/manage both players' screens.
      io.to(room.id).emit('roomUpdate', room);
    } else {
      // Send customized sanitised view to each player in battleship
      room.players.forEach(p => {
        const sanitizedState = getSanitizedBattleshipState(room.gameState as BattleshipState, p.id);
        io.to(p.id).emit('roomUpdate', {
          ...room,
          gameState: sanitizedState
        });
      });
    }
  } else {
    io.to(room.id).emit('roomUpdate', room);
  }
}

function getPublicRooms() {
  return Object.values(rooms)
    .filter(r => !r.isPrivate)
    .map(r => ({
      id: r.id,
      gameType: r.gameType,
      playersCount: r.players.length,
      status: r.status,
      variant: r.variant
    }));
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
