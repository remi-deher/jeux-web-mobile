import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
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

const app = express();
app.use(cors());

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
  gameType: 'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess';
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  gameState: Connect4State | BattleshipState | TicTacToeState | CheckersState | ChessState | null;
  chatMessages: ChatMessage[];
  isPrivate: boolean;
  rematchVotes: string[];
  isLocal?: boolean;
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

  socket.on('acceptChallenge', (data: { challengerSocketId: string; gameType: string }) => {
    const challengerSocket = io.sockets.sockets.get(data.challengerSocketId);
    if (!challengerSocket) {
      return socket.emit('challengeError', 'Le challenger s\'est déconnecté.');
    }

    const roomId = generateRoomId();
    const challengerUsername = onlineUsers[data.challengerSocketId] || 'Joueur 1';
    const opponentUsername = onlineUsers[socket.id] || 'Joueur 2';

    const newRoom: Room = {
      id: roomId,
      gameType: data.gameType as any,
      players: [
        { id: data.challengerSocketId, username: challengerUsername },
        { id: socket.id, username: opponentUsername }
      ],
      status: 'playing',
      gameState: null,
      chatMessages: [],
      isPrivate: true,
      rematchVotes: []
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

  socket.on('createRoom', (data: { gameType: 'connect4' | 'battleship'; username: string; isPrivate?: boolean }, callback) => {
    const roomId = generateRoomId();
    const newRoom: Room = {
      id: roomId,
      gameType: data.gameType,
      players: [{ id: socket.id, username: data.username }],
      status: 'waiting',
      gameState: null,
      chatMessages: [],
      isPrivate: !!data.isPrivate,
      rematchVotes: []
    };

    rooms[roomId] = newRoom;
    socket.join(roomId);

    console.log(`Room created: ${roomId} by ${data.username}`);

    callback({ success: true, roomId, room: newRoom });
    io.emit('roomsList', getPublicRooms());
  });

  socket.on('createLocalRoom', (data: { gameType: 'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess'; username: string; player1Name?: string; player2Name?: string }, callback) => {
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
      rematchVotes: []
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
    }

    broadcastRoomUpdate(room);
    io.emit('roomsList', getPublicRooms());
  });

  socket.on('leaveRoom', (data: { roomId: string }) => {
    handlePlayerLeave(socket, data.roomId);
  });

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
    }
    broadcastRoomUpdate(room);
  }
  io.emit('roomsList', getPublicRooms());
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
      status: r.status
    }));
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
