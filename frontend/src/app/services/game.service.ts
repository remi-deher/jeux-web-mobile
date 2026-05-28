import { Injectable, signal, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { SoundService } from './sound.service';
import { gameLabel } from '../constants/game-labels';

import { ChatMessage, PrivateMessage, Player, Room, RoomListEntry } from '../models/game.models';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private socket: Socket;
  private soundService = inject(SoundService);
  
  // App signals
  public username = signal<string>(localStorage.getItem('username') || '');
  public currentRoom = signal<Room | null>(null);
  public roomsList = signal<RoomListEntry[]>([]);
  public globalChat = signal<ChatMessage[]>([]);
  public emojiReaction = signal<{ senderId: string; emoji: string } | null>(null);

  // Friends & Social Signals
  public onlineUsers = signal<{ id: string; username: string }[]>([]);
  public friends = signal<string[]>(JSON.parse(localStorage.getItem('friends') || '[]'));
  public incomingChallenges = signal<{ challengerSocketId: string; challengerUsername: string; gameType: string }[]>([]);
  public privateMessages = signal<PrivateMessage[]>(JSON.parse(localStorage.getItem('privateMessages') || '[]'));
  
  // Navigation signals
  public activeView = signal<string>('games');
  public activeGame = signal<'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess' | 'gomoku' | 'othello' | 'pong' | 'pendu' | null>(null);

  private prevPongVx: number | null = null;
  
  constructor() {
    // In dev mode (ng serve on port 4200), connect directly to backend on port 3001.
    // In production (Docker/nginx), socket.io is proxied via nginx on the same origin.
    const isDev = window.location.port === '4200';
    this.socket = isDev 
      ? io('http://localhost:3001') 
      : io(); // Connects to same origin — nginx proxies /socket.io/ to backend
    
      const savedUsername = this.username();
      if (savedUsername) {
        this.socket.emit('registerUsername', savedUsername);
      }
      
      const savedRoomId = localStorage.getItem('roomId');
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

      // ── Reconnexion automatique après coupure réseau ──────────────────────
      // socket.io-client reconnecte tout seul, mais il faut ré-enregistrer
      // le username et re-rejoindre la salle éventuellement en cours.
      this.socket.io.on('reconnect', () => {
        const user = this.username();
        if (user) {
          this.socket.emit('registerUsername', user);
        }
        const roomId = localStorage.getItem('roomId');
        if (roomId && user) {
          this.socket.emit('reconnectRoom', { roomId, username: user }, (res: any) => {
            if (res?.success) {
              this.currentRoom.set(res.room);
            } else {
              localStorage.removeItem('roomId');
              this.currentRoom.set(null);
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
      const prevRoom = this.currentRoom();
      this.currentRoom.set(room);

      // Trigger board move sounds by comparing board states
      try {
        if (room && room.status === 'playing' && prevRoom && prevRoom.status === 'playing') {
          const prevBoard = prevRoom.gameState?.board;
          const newBoard = room.gameState?.board;
          if (prevBoard && newBoard && JSON.stringify(prevBoard) !== JSON.stringify(newBoard)) {
            this.soundService.playSound('click', room.gameType);
          }
        }
      } catch (err) {
        console.error('Error auto-playing game move sound:', err);
      }
    });

    this.socket.on('pongUpdate', (pongState: any) => {
      const room = this.currentRoom();
      if (room && room.gameType === 'pong') {
        const prevScores = (room.gameState as any)?.scoreP1 !== undefined ?
          { p1: (room.gameState as any).scoreP1, p2: (room.gameState as any).scoreP2 } : null;
        const prevVx = this.prevPongVx;
        this.prevPongVx = pongState.ball?.vx ?? null;

        this.currentRoom.set({ ...room, gameState: pongState });

        if (prevScores && (pongState.scoreP1 !== prevScores.p1 || pongState.scoreP2 !== prevScores.p2)) {
          this.soundService.playSound('success', 'pong');
          this.prevPongVx = null;
        } else if (prevVx !== null && pongState.ball?.vx !== undefined) {
          // Only play bounce when the ball's horizontal direction actually reverses
          const bounced = (prevVx > 0) !== (pongState.ball.vx > 0);
          if (bounced) {
            this.soundService.playSound('click', 'pong');
          }
        }
      }
    });

    this.socket.on('roomMessage', (msg: ChatMessage) => {
      const room = this.currentRoom();
      if (room && msg.roomId === room.id) {
        this.currentRoom.update(r => r ? { ...r, chatMessages: [...r.chatMessages, msg] } : null);
      }
    });

    this.socket.on('onlineUsersList', (list: { id: string; username: string }[]) => {
      this.onlineUsers.set(list);
    });

    this.socket.on('challengeReceived', (data: { challengerSocketId: string; challengerUsername: string; gameType: string }) => {
      this.incomingChallenges.update(challenges => [...challenges, data]);
      this.showNativeNotification(data.challengerUsername, data.gameType);
    });

    this.socket.on('challengeAccepted', (data: { roomId: string; room: Room }) => {
      this.currentRoom.set(data.room);
      localStorage.setItem('roomId', data.roomId);
      this.incomingChallenges.set([]);
    });

    this.socket.on('challengeDeclined', (data: { opponentUsername: string }) => {
      alert(`${data.opponentUsername} a décliné votre défi.`);
    });

    this.socket.on('challengeError', (msg: string) => {
      alert(msg);
    });

    this.socket.on('privateMessage', (msg: PrivateMessage) => {
      this.privateMessages.update(msgs => {
        const updated = [...msgs, msg];
        localStorage.setItem('privateMessages', JSON.stringify(updated));
        return updated;
      });
    });
  }

  sendPrivateMessage(recipientUsername: string, text: string) {
    if (!recipientUsername.trim() || !text.trim()) return;
    this.socket.emit('privateMessage', { recipientUsername, text });
  }

  getSocketId(): string | undefined {
    return this.socket.id;
  }

  setUsername(name: string) {
    this.username.set(name);
    localStorage.setItem('username', name);
    if (name) {
      this.socket.emit('registerUsername', name);
    }
  }

  sendGlobalMessage(text: string) {
    if (!text.trim()) return;
    this.socket.emit('globalMessage', { username: this.username(), text });
  }

  createRoom(gameType: 'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess' | 'gomoku' | 'othello' | 'pong' | 'pendu', isPrivate: boolean = false) {
    this.socket.emit('createRoom', { gameType, username: this.username(), isPrivate }, (res: any) => {
      if (res.success) {
        this.currentRoom.set(res.room);
        localStorage.setItem('roomId', res.roomId);
      } else {
        alert(res.message || 'Error creating room');
      }
    });
  }

  createLocalRoom(gameType: 'connect4' | 'battleship' | 'tictactoe' | 'checkers' | 'chess' | 'gomoku' | 'othello' | 'pong' | 'pendu', player1Name?: string, player2Name?: string) {
    this.socket.emit('createLocalRoom', { gameType, username: this.username() || 'Joueur 1', player1Name, player2Name }, (res: any) => {
      if (res.success) {
        this.currentRoom.set(res.room);
        localStorage.setItem('roomId', res.roomId);
      } else {
        alert(res.message || 'Error creating local room');
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
  placeBsShip(shipId: string, row: number, col: number, horizontal: boolean, playerId?: string) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('bsPlaceShip', { roomId: room.id, shipId, row, col, horizontal, playerId });
    }
  }

  setBsReady(playerId?: string) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('bsReady', { roomId: room.id, playerId });
    }
  }

  fireBsShot(row: number, col: number, playerId?: string) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('bsFire', { roomId: room.id, row, col, playerId });
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

  makeGomokuMove(row: number, col: number) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('gomokuMove', { roomId: room.id, row, col });
    }
  }

  makeOthelloMove(row: number, col: number) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('othelloMove', { roomId: room.id, row, col });
    }
  }

  sendPongPaddle(yPercent: number, paddleIndex?: number) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('pongMovePaddle', { roomId: room.id, yPercent, paddleIndex });
    }
  }

  sendPenduGuess(letter: string) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('penduGuess', { roomId: room.id, letter });
    }
  }

  // Social Methods
  addFriend(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const list = this.friends();
    if (!list.includes(trimmed)) {
      const updated = [...list, trimmed];
      this.friends.set(updated);
      localStorage.setItem('friends', JSON.stringify(updated));
    }
  }

  removeFriend(name: string) {
    const updated = this.friends().filter(f => f !== name);
    this.friends.set(updated);
    localStorage.setItem('friends', JSON.stringify(updated));
  }

  sendChallenge(targetSocketId: string, gameType: string) {
    this.socket.emit('sendChallenge', { targetSocketId, gameType });
  }

  acceptChallenge(challengerSocketId: string, gameType: string) {
    this.socket.emit('acceptChallenge', { challengerSocketId, gameType });
    this.incomingChallenges.update(list => list.filter(c => c.challengerSocketId !== challengerSocketId));
  }

  declineChallenge(challengerSocketId: string) {
    this.socket.emit('declineChallenge', { challengerSocketId });
    this.incomingChallenges.update(list => list.filter(c => c.challengerSocketId !== challengerSocketId));
  }

  requestNotificationPermission() {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (e) {
      // iOS Safari may throw if called without user gesture
      console.warn('Notification permission request failed:', e);
    }
  }

  shareInvitationLink(room: Room) {
    const url = `${window.location.origin}/?join=${room.id}`;
    const label = gameLabel(room.gameType);
    if (navigator.share) {
      navigator.share({
        title: 'Rejoins ma partie sur Playbox',
        text: `Rejoins mon salon de jeu ${label} sur Playbox !`,
        url: url
      }).catch(err => console.log('Error sharing:', err));
    } else {
      navigator.clipboard.writeText(url).then(() => {
        alert('Lien d\'invitation copié dans le presse-papiers !');
      });
    }
  }

  private showNativeNotification(challengerUsername: string, gameType: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      if (document.hidden) {
        new Notification('Nouveau défi sur Playbox', {
          body: `${challengerUsername} vous défie au jeu ${gameLabel(gameType)} ! Cliquez pour jouer.`,
          icon: '/favicon.ico'
        });
      }
    }
  }
}
