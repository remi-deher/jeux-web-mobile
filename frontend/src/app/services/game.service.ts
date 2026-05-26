import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  roomId?: string;
}

export interface Player {
  id: string;
  username: string;
  disconnected?: boolean;
}

export interface Room {
  id: string;
  gameType: 'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess';
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
  gameState: any;
  chatMessages: ChatMessage[];
  rematchVotes?: string[];
}

export interface RoomListEntry {
  id: string;
  gameType: 'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess';
  playersCount: number;
  status: 'waiting' | 'playing' | 'finished';
}

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private socket: Socket;
  
  // App signals
  public username = signal<string>(localStorage.getItem('username') || '');
  public currentRoom = signal<Room | null>(null);
  public roomsList = signal<RoomListEntry[]>([]);
  public globalChat = signal<ChatMessage[]>([]);
  public emojiReaction = signal<{ senderId: string; emoji: string } | null>(null);
  
  constructor() {
    // Dynamically connect to the backend (port 3000 in dev/docker or via reverse proxy)
    const serverUrl = window.location.port === '4200' 
      ? 'http://localhost:3001' 
      : `${window.location.protocol}//${window.location.hostname}:3001`;
      
    this.socket = io(serverUrl);
    
    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server:', this.socket.id);
      
      const savedRoomId = localStorage.getItem('roomId');
      const savedUsername = this.username();
      if (savedRoomId && savedUsername) {
        console.log('Attempting automatic reconnection for room:', savedRoomId);
        this.socket.emit('reconnectRoom', { roomId: savedRoomId, username: savedUsername }, (res: any) => {
          if (res.success) {
            this.currentRoom.set(res.room);
          } else {
            console.log('Reconnection failed:', res.message);
            localStorage.removeItem('roomId');
          }
        });
      }
    });

    this.socket.on('roomsList', (list: RoomListEntry[]) => {
      this.roomsList.set(list);
    });

    this.socket.on('globalChatHistory', (history: ChatMessage[]) => {
      this.globalChat.set(history);
    });

    this.socket.on('globalMessage', (msg: ChatMessage) => {
      this.globalChat.update(chats => [...chats, msg]);
    });

    this.socket.on('emojiReceived', (data: { senderId: string; emoji: string }) => {
      this.emojiReaction.set(data);
    });

    this.socket.on('roomUpdate', (room: Room) => {
      this.currentRoom.set(room);
    });

    this.socket.on('roomMessage', (msg: ChatMessage) => {
      const room = this.currentRoom();
      if (room && msg.roomId === room.id) {
        this.currentRoom.update(r => r ? { ...r, chatMessages: [...r.chatMessages, msg] } : null);
      }
    });
  }

  getSocketId(): string | undefined {
    return this.socket.id;
  }

  setUsername(name: string) {
    this.username.set(name);
    localStorage.setItem('username', name);
  }

  sendGlobalMessage(text: string) {
    if (!text.trim()) return;
    this.socket.emit('globalMessage', { username: this.username(), text });
  }

  createRoom(gameType: 'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess', isPrivate: boolean = false) {
    this.socket.emit('createRoom', { gameType, username: this.username(), isPrivate }, (res: any) => {
      if (res.success) {
        this.currentRoom.set(res.room);
        localStorage.setItem('roomId', res.roomId);
      } else {
        alert(res.message || 'Error creating room');
      }
    });
  }

  joinRoom(roomId: string) {
    this.socket.emit('joinRoom', { roomId, username: this.username() }, (res: any) => {
      if (res.success) {
        this.currentRoom.set(res.room);
        localStorage.setItem('roomId', res.roomId);
      } else {
        alert(res.message || 'Error joining room');
      }
    });
  }

  leaveRoom() {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('leaveRoom', { roomId: room.id });
      this.currentRoom.set(null);
      localStorage.removeItem('roomId');
    }
  }

  sendRoomMessage(text: string) {
    const room = this.currentRoom();
    if (!room || !text.trim()) return;
    this.socket.emit('roomMessage', { roomId: room.id, username: this.username(), text });
  }

  // Connect 4 Actions
  makeC4Move(column: number) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('c4Move', { roomId: room.id, column });
    }
  }

  // Battleship Actions
  placeBsShip(shipId: string, row: number, col: number, horizontal: boolean) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('bsPlaceShip', { roomId: room.id, shipId, row, col, horizontal });
    }
  }

  setBsReady() {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('bsReady', { roomId: room.id });
    }
  }

  fireBsShot(row: number, col: number) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('bsFire', { roomId: room.id, row, col });
    }
  }

  requestRematch() {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('requestRematch', { roomId: room.id });
    }
  }

  forceEnd() {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('forceEnd', { roomId: room.id });
    }
  }

  sendEmoji(emoji: string) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('sendEmoji', { roomId: room.id, emoji });
    }
  }

  makeTttMove(cellIndex: number) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('tttMove', { roomId: room.id, cellIndex });
    }
  }

  makeCheckersMove(fromRow: number, fromCol: number, toRow: number, toCol: number) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('checkersMove', { roomId: room.id, fromRow, fromCol, toRow, toCol });
    }
  }

  makeChessMove(fromRow: number, fromCol: number, toRow: number, toCol: number) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('chessMove', { roomId: room.id, fromRow, fromCol, toRow, toCol });
    }
  }
}
