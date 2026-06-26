import { Injectable, signal, inject, NgZone } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { SoundService } from './sound.service';
import { gameLabel } from '../constants/game-labels';

import type { GameType, GameVariant } from '@sn/shared/game-types';
import { ChatMessage, PrivateMessage, Player, Room, RoomListEntry } from '../models/game.models';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private socket: Socket;
  private soundService = inject(SoundService);
  private ngZone       = inject(NgZone);
  
  // App signals
  public username = signal<string>(localStorage.getItem('username') || '');
  public tempUser = signal<boolean>(localStorage.getItem('tempUser') === 'true');
  public authToken = signal<string>(localStorage.getItem('authToken') || '');
  public currentRoom = signal<Room | null>(null);
  public roomsList = signal<RoomListEntry[]>([]);
  public globalChat = signal<ChatMessage[]>([]);
  public emojiReaction = signal<{ senderId: string; emoji: string } | null>(null);

  // Friends & Social Signals
  public onlineUsers = signal<{ id: string; username: string }[]>([]);
  public friends = signal<string[]>(JSON.parse(localStorage.getItem('friends') || '[]'));
  public incomingChallenges = signal<{ challengerSocketId: string; challengerUsername: string; gameType: string }[]>([]);
  public incomingInvitations = signal<{ hostUsername: string; roomId: string; gameType: string }[]>([]);
  public privateMessages = signal<PrivateMessage[]>(JSON.parse(localStorage.getItem('privateMessages') || '[]'));
  
  // Navigation signals
  public activeView = signal<string>('games');
  public activeGame = signal<GameType | null>(null);

  // ── High-frequency live state ────────────────────────────────────────────────
  // Signals updated ONLY when UI-visible state changes (score, winner, ready…).
  // They are written via ngZone.run() so Angular's change detection fires only
  // for meaningful events — NOT on every 60 Hz physics tick.
  public livePongState   = signal<any>(null);
  public liveSnakeState  = signal<any>(null);
  public liveTetrisState = signal<any>(null);
  public liveAirhockeyState = signal<any>(null);

  // Raw state objects — written directly from socket callbacks (outside Angular
  // zone), read by canvas RAF loops without triggering change detection.
  public _rawPongState:   any = null;
  public _rawSnakeState:  any = null;
  public _rawTetrisState: any = null;
  public _rawAirhockeyState: any = null;

  // Raw callback registries (outside-zone subscribers for physics/rendering)
  private _pongCallbacks:   Array<(s: any) => void> = [];
  private _snakeCallbacks:  Array<(s: any) => void> = [];
  private _tetrisCallbacks: Array<(s: any) => void> = [];
  private _airhockeyCallbacks: Array<(s: any) => void> = [];

  // Last-seen UI values — detect when a zone re-entry is actually needed
  private _lpScoreP1  = 0; private _lpScoreP2  = 0;
  private _lpWinner: number | null = null;
  private _lpP1Ready  = false; private _lpP2Ready = false;
  private _lsWinner: number | null = null;
  private _lsScoreP1 = 0; private _lsScoreP2  = 0;
  private _ltWinner: number | null = null;
  private _ltScoreP1 = 0; private _ltScoreP2  = 0;
  private _lahWinner: number | null = null;
  private _lahScoreP1 = 0; private _lahScoreP2 = 0;
  private _lahP1Ready = false; private _lahP2Ready = false;

  private prevPongVx: number | null = null;
  private prevAirhockeyVx: number | null = null;

  // ── Raw subscription helpers ─────────────────────────────────────────────────
  /** Register a callback that fires on every pong tick OUTSIDE the Angular zone. */
  subscribePongRaw(cb: (s: any) => void): () => void {
    this._pongCallbacks.push(cb);
    return () => { this._pongCallbacks = this._pongCallbacks.filter(x => x !== cb); };
  }
  subscribeSnakeRaw(cb: (s: any) => void): () => void {
    this._snakeCallbacks.push(cb);
    return () => { this._snakeCallbacks = this._snakeCallbacks.filter(x => x !== cb); };
  }
  subscribeTetrisRaw(cb: (s: any) => void): () => void {
    this._tetrisCallbacks.push(cb);
    return () => { this._tetrisCallbacks = this._tetrisCallbacks.filter(x => x !== cb); };
  }
  subscribeAirhockeyRaw(cb: (s: any) => void): () => void {
    this._airhockeyCallbacks.push(cb);
    return () => { this._airhockeyCallbacks = this._airhockeyCallbacks.filter(x => x !== cb); };
  }

  /**
   * WebRTC signaling messages relayed by the server.
   * Any real-time game component can watch this signal to drive the
   * RTCPeerConnection handshake via WebRtcService.handleSignal().
   */
  public rtcSignal = signal<
    | { type: 'offer';  offer:     RTCSessionDescriptionInit }
    | { type: 'answer'; answer:    RTCSessionDescriptionInit }
    | { type: 'ice';    candidate: RTCIceCandidateInit }
    | null
  >(null);
  
  constructor() {
    // In dev mode (ng serve on port 4200), connect directly to backend on port 3001.
    // In production (Docker/nginx), socket.io is proxied via nginx on the same origin.
    const isDev = window.location.port === '4200';
    this.socket = isDev 
      ? io('http://localhost:3001') 
      : io(); // Connects to same origin — nginx proxies /socket.io/ to backend
    
      const savedUsername = this.username();
      const savedToken = this.authToken();

      if (savedUsername) {
        if (savedToken) {
          console.log('Attempting automatic token authentication for:', savedUsername);
          this.socket.emit('loginWithToken', { username: savedUsername, token: savedToken }, (res: any) => {
            if (res.success) {
              console.log('Token login successful.');
              if (res.stats) {
                this.syncStatsFromServer(res.stats);
              }
              if (res.friends) {
                this.friends.set(res.friends);
                localStorage.setItem('friends', JSON.stringify(res.friends));
              }
            } else {
              console.log('Token login failed, logging out.');
              this.logout();
            }
          });
        } else {
          // Si compte invité, on se déclare juste sur le serveur
          this.socket.emit('registerUser', { username: savedUsername, pin: null }, (res: any) => {
            if (!res.success) {
              console.log('Guest register failed:', res.message);
              this.logout();
            }
          });
        }
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
      this.socket.io.on('reconnect', () => {
        const user = this.username();
        const token = this.authToken();
        if (user) {
          if (token) {
            this.socket.emit('loginWithToken', { username: user, token }, (res: any) => {
              if (res && res.success) {
                if (res.friends) {
                  this.friends.set(res.friends);
                  localStorage.setItem('friends', JSON.stringify(res.friends));
                }
              } else {
                this.logout();
              }
            });
          } else {
            this.socket.emit('registerUser', { username: user, pin: null });
          }
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
      // Reset all live state when switching rooms or game types
      if (!room || room.id !== prevRoom?.id || room.gameType !== prevRoom?.gameType) {
        this.livePongState.set(null);
        this.liveSnakeState.set(null);
        this.liveTetrisState.set(null);
        this.liveAirhockeyState.set(null);
        this._rawPongState   = null;
        this._rawSnakeState  = null;
        this._rawTetrisState = null;
        this._rawAirhockeyState = null;
        this._lpScoreP1 = 0; this._lpScoreP2 = 0; this._lpWinner = null;
        this._lpP1Ready = false; this._lpP2Ready = false;
        this._lsWinner = null; this._lsScoreP1 = 0; this._lsScoreP2 = 0;
        this._ltWinner = null; this._ltScoreP1 = 0; this._ltScoreP2 = 0;
        this._lahWinner = null; this._lahScoreP1 = 0; this._lahScoreP2 = 0;
        this._lahP1Ready = false; this._lahP2Ready = false;
      }
      this.currentRoom.set(room);

      // ── Auto-reload for real-time games when the match starts ─────────────────
      // Pong / Snake / Tetris run at 60 Hz / 15 Hz. The Angular component tree
      // built up from the lobby is heavy and causes 60 Hz change detection lag.
      // A page reload gives a minimal fresh tree — exactly what a manual refresh does.
      //
      // Guard: localStorage key `rt_reloaded` stores the last room.id that was
      // already reloaded. Prevents infinite reload loops (post-reload roomUpdate
      // also arrives with status 'playing') and handles local games where the room
      // starts directly with status 'playing' (no waiting→playing transition).
      const REALTIME_GAMES = new Set(['pong', 'snake', 'tetris', 'airhockey']);
      if (room?.status === 'playing' && REALTIME_GAMES.has(room.gameType)) {
        if (localStorage.getItem('rt_reloaded') !== room.id) {
          localStorage.setItem('rt_reloaded', room.id);
          window.location.reload();
          return;
        }
      }

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

    // WebRTC signaling relay (generic — used by any real-time game)
    this.socket.on('rtcOffer',  (d: any) => this.rtcSignal.set({ type: 'offer',  offer:     d.offer     }));
    this.socket.on('rtcAnswer', (d: any) => this.rtcSignal.set({ type: 'answer', answer:    d.answer    }));
    this.socket.on('rtcIce',    (d: any) => this.rtcSignal.set({ type: 'ice',    candidate: d.candidate }));

    // ── High-frequency game updates — registered OUTSIDE Angular zone ────────────
    // Zone.js patches WebSocket events: if these listeners ran in the Angular zone,
    // ApplicationRef.tick() (full change detection) would fire 60 Hz / 15 Hz.
    // runOutsideAngular prevents that. ngZone.run() is called only when UI state
    // actually changes (score, winner, ready status) — rare compared to every tick.
    this.ngZone.runOutsideAngular(() => {

      this.socket.on('tetrisUpdate', (tetrisState: any) => {
        if (this.currentRoom()?.gameType !== 'tetris') return;
        this._rawTetrisState = tetrisState;
        this._tetrisCallbacks.forEach(cb => cb(tetrisState));

        const p1 = tetrisState?.players?.p1;
        const p2 = tetrisState?.players?.p2;
        const uiChanged =
          tetrisState.winner !== this._ltWinner ||
          (p1?.score ?? 0) !== this._ltScoreP1 ||
          (p2?.score ?? 0) !== this._ltScoreP2;
        if (uiChanged) {
          this._ltWinner  = tetrisState.winner;
          this._ltScoreP1 = p1?.score ?? 0;
          this._ltScoreP2 = p2?.score ?? 0;
          this.ngZone.run(() => this.liveTetrisState.set(tetrisState));
        }
      });

      this.socket.on('snakeUpdate', (snakeState: any) => {
        if (this.currentRoom()?.gameType !== 'snake') return;
        this._rawSnakeState = snakeState;
        this._snakeCallbacks.forEach(cb => cb(snakeState));

        const uiChanged =
          snakeState.winner !== this._lsWinner ||
          (snakeState.p1?.score ?? 0) !== this._lsScoreP1 ||
          (snakeState.p2?.score ?? 0) !== this._lsScoreP2;
        if (uiChanged) {
          this._lsWinner  = snakeState.winner;
          this._lsScoreP1 = snakeState.p1?.score ?? 0;
          this._lsScoreP2 = snakeState.p2?.score ?? 0;
          this.ngZone.run(() => this.liveSnakeState.set(snakeState));
        }
      });

      this.socket.on('pongUpdate', (pongState: any) => {
        if (this.currentRoom()?.gameType !== 'pong') return;
        this._rawPongState = pongState;

        // Ball-bounce sound detection (Web Audio API, not zone-sensitive)
        const prevVx = this.prevPongVx;
        this.prevPongVx = pongState.ball?.vx ?? null;

        // Call registered physics callbacks (they also run outside zone)
        this._pongCallbacks.forEach(cb => cb(pongState));

        // Detect UI state changes
        const scoreChanged =
          pongState.scoreP1 !== this._lpScoreP1 ||
          pongState.scoreP2 !== this._lpScoreP2;
        const uiChanged =
          scoreChanged ||
          pongState.winner   !== this._lpWinner  ||
          !!pongState.p1Ready !== this._lpP1Ready ||
          !!pongState.p2Ready !== this._lpP2Ready;

        if (uiChanged) {
          this._lpScoreP1 = pongState.scoreP1 ?? 0;
          this._lpScoreP2 = pongState.scoreP2 ?? 0;
          this._lpWinner  = pongState.winner  ?? null;
          this._lpP1Ready = !!pongState.p1Ready;
          this._lpP2Ready = !!pongState.p2Ready;
          this.ngZone.run(() => {
            this.livePongState.set(pongState);
            if (scoreChanged) {
              this.soundService.playSound('success', 'pong');
              this.prevPongVx = null;
            }
          });
        } else if (prevVx !== null && pongState.ball?.vx !== undefined) {
          const bounced = (prevVx > 0) !== (pongState.ball.vx > 0);
          if (bounced) this.soundService.playSound('click', 'pong');
        }
      });

      this.socket.on('airhockeyUpdate', (airhockeyState: any) => {
        if (this.currentRoom()?.gameType !== 'airhockey') return;
        this._rawAirhockeyState = airhockeyState;

        const prevLastHit = this._rawAirhockeyState?.lastHit;

        // Call registered physics callbacks
        this._airhockeyCallbacks.forEach(cb => cb(airhockeyState));

        // Detect UI state changes
        const scoreChanged =
          airhockeyState.scoreP1 !== this._lahScoreP1 ||
          airhockeyState.scoreP2 !== this._lahScoreP2;
        const uiChanged =
          scoreChanged ||
          airhockeyState.winner   !== this._lahWinner  ||
          !!airhockeyState.p1Ready !== this._lahP1Ready ||
          !!airhockeyState.p2Ready !== this._lahP2Ready;

        if (uiChanged) {
          this._lahScoreP1 = airhockeyState.scoreP1 ?? 0;
          this._lahScoreP2 = airhockeyState.scoreP2 ?? 0;
          this._lahWinner  = airhockeyState.winner  ?? null;
          this._lahP1Ready = !!airhockeyState.p1Ready;
          this._lahP2Ready = !!airhockeyState.p2Ready;
          this.ngZone.run(() => {
            this.liveAirhockeyState.set(airhockeyState);
            if (scoreChanged) {
              this.soundService.playSound('success', 'airhockey');
            }
          });
        } else if (airhockeyState.lastHit && airhockeyState.lastHit !== prevLastHit) {
          this.soundService.playSound('click', 'airhockey');
        }
      });

    }); // end runOutsideAngular

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

    this.socket.on('friendInvitationReceived', (data: { hostUsername: string; roomId: string; gameType: string }) => {
      this.incomingInvitations.update(invitations => [...invitations, data]);
      this.soundService.playSound('warning');
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

  logout() {
    this.username.set('');
    this.authToken.set('');
    this.tempUser.set(false);
    localStorage.removeItem('username');
    localStorage.removeItem('authToken');
    localStorage.removeItem('tempUser');
    localStorage.removeItem('roomId');
    this.currentRoom.set(null);
  }

  syncStatsFromServer(stats: any) {
    if (!stats) return;
    Object.entries(stats).forEach(([game, stat]: [string, any]) => {
      localStorage.setItem(`stats_${game}_wins`, String(stat.wins ?? 0));
      localStorage.setItem(`stats_${game}_losses`, String(stat.losses ?? 0));
      localStorage.setItem(`stats_${game}_draws`, String(stat.draws ?? 0));
    });
  }

  checkUsername(username: string): Promise<{ exists: boolean; requiresPin: boolean }> {
    return new Promise((resolve) => {
      this.socket.emit('checkUsername', { username }, (res: any) => {
        resolve(res || { exists: false, requiresPin: false });
      });
    });
  }

  registerUser(username: string, pin: string | null): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('registerUser', { username, pin }, (res: any) => {
        if (res.success) {
          this.username.set(username.trim());
          localStorage.setItem('username', username.trim());
          if (res.friends) {
            this.friends.set(res.friends);
            localStorage.setItem('friends', JSON.stringify(res.friends));
          }
          if (pin !== null) {
            this.tempUser.set(false);
            localStorage.setItem('tempUser', 'false');
            if (res.token) {
              this.authToken.set(res.token);
              localStorage.setItem('authToken', res.token);
            }
          } else {
            this.tempUser.set(true);
            localStorage.setItem('tempUser', 'true');
            this.authToken.set('');
            localStorage.removeItem('authToken');
          }
        }
        resolve(res);
      });
    });
  }

  loginUser(username: string, pin: string): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      this.socket.emit('loginUser', { username, pin }, (res: any) => {
        if (res.success) {
          this.username.set(username.trim());
          localStorage.setItem('username', username.trim());
          if (res.friends) {
            this.friends.set(res.friends);
            localStorage.setItem('friends', JSON.stringify(res.friends));
          }
          this.tempUser.set(false);
          localStorage.setItem('tempUser', 'false');
          if (res.token) {
            this.authToken.set(res.token);
            localStorage.setItem('authToken', res.token);
          }
          if (res.stats) {
            this.syncStatsFromServer(res.stats);
          }
        }
        resolve(res);
      });
    });
  }

  secureTempUser(pin: string): Promise<{ success: boolean; message?: string }> {
    return new Promise((resolve) => {
      const currentUsername = this.username();
      if (!currentUsername) {
        resolve({ success: false, message: 'Aucun utilisateur connecté.' });
        return;
      }
      this.socket.emit('secureTempUser', { username: currentUsername, pin }, (res: any) => {
        if (res.success) {
          this.tempUser.set(false);
          localStorage.setItem('tempUser', 'false');
          if (res.token) {
            this.authToken.set(res.token);
            localStorage.setItem('authToken', res.token);
          }
          if (res.stats) {
            this.syncStatsFromServer(res.stats);
          }
          // Synchronize local friends to server now that account is secure
          this.socket.emit('syncFriends', { username: currentUsername, friends: this.friends() });
        }
        resolve(res);
      });
    });
  }

  sendGlobalMessage(text: string) {
    if (!text.trim()) return;
    this.socket.emit('globalMessage', { username: this.username(), text });
  }

  createRoom(gameType: GameType, isPrivate: boolean = false, variant?: GameVariant, inviteUsername?: string) {
    this.socket.emit('createRoom', { gameType, username: this.username(), isPrivate, variant }, (res: any) => {
      if (res.success) {
        this.currentRoom.set(res.room);
        localStorage.setItem('roomId', res.roomId);
        if (inviteUsername) {
          this.socket.emit('inviteFriend', { friendUsername: inviteUsername, roomId: res.roomId, gameType });
        }
      } else {
        alert(res.message || 'Error creating room');
      }
    });
  }

  createLocalRoom(gameType: GameType, player1Name?: string, player2Name?: string, variant?: GameVariant) {
    this.socket.emit('createLocalRoom', { gameType, username: this.username() || 'Joueur 1', player1Name, player2Name, variant }, (res: any) => {
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

  // Tetris Actions
  sendTetrisInput(action: string, playerId?: string) {
    const room = this.currentRoom();
    if (room) this.socket.emit('tetrisInput', { roomId: room.id, action, playerId });
  }

  // Snake Actions
  sendSnakeDirection(dir: 'up' | 'down' | 'left' | 'right', playerIndex?: number) {
    const room = this.currentRoom();
    if (room) this.socket.emit('snakeDirection', { roomId: room.id, dir, playerIndex });
  }

  sendPlayerReady(roomId: string) {
    this.socket.emit('playerReady', { roomId });
  }

  // WebRTC signaling — forward SDP/ICE to the server which relays to the other player
  // Generic: works for any game (pong, snake, tetris…)
  sendRtcOffer(roomId: string, offer: RTCSessionDescriptionInit)    { this.socket.emit('rtcOffer',  { roomId, offer  }); }
  sendRtcAnswer(roomId: string, answer: RTCSessionDescriptionInit)  { this.socket.emit('rtcAnswer', { roomId, answer }); }
  sendRtcIce(roomId: string, candidate: RTCIceCandidateInit)        { this.socket.emit('rtcIce',    { roomId, candidate }); }

  sendPongPaddle(yPercent: number, paddleIndex?: number) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('pongMovePaddle', { roomId: room.id, yPercent, paddleIndex });
    }
  }

  sendAirhockeyMallet(xPercent: number, yPercent: number, malletIndex?: number) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('airhockeyMoveMallet', { roomId: room.id, xPercent, yPercent, malletIndex });
    }
  }

  sendPenduGuess(letter: string) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('penduGuess', { roomId: room.id, letter });
    }
  }

  makeDominosMove(tileIndex: number, side: 'left' | 'right' | null, coords?: { x1: number; y1: number; x2: number; y2: number }) {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('dominosPlay', { roomId: room.id, tileIndex, side, coords });
    }
  }

  drawDominosTile() {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('dominosDraw', { roomId: room.id });
    }
  }

  passDominosTurn() {
    const room = this.currentRoom();
    if (room) {
      this.socket.emit('dominosPass', { roomId: room.id });
    }
  }

  // Memory Actions
  sendMemoryFlip(cardId: number) {
    const room = this.currentRoom();
    if (room) this.socket.emit('memoryFlip', { roomId: room.id, cardId });
  }

  // Uno Actions
  sendUnoPlay(cardId: number, chosenColor?: string) {
    const room = this.currentRoom();
    if (room) this.socket.emit('unoPlay', { roomId: room.id, cardId, chosenColor });
  }

  sendUnoDraw() {
    const room = this.currentRoom();
    if (room) this.socket.emit('unoDraw', { roomId: room.id });
  }

  // Blackjack Actions
  sendBlackjackBet(amount: number, playerIndex?: number) {
    const room = this.currentRoom();
    if (room) this.socket.emit('blackjackBet', { roomId: room.id, amount, playerIndex });
  }

  sendBlackjackHit(playerIndex?: number) {
    const room = this.currentRoom();
    if (room) this.socket.emit('blackjackHit', { roomId: room.id, playerIndex });
  }

  sendBlackjackStand(playerIndex?: number) {
    const room = this.currentRoom();
    if (room) this.socket.emit('blackjackStand', { roomId: room.id, playerIndex });
  }

  sendBlackjackDouble(playerIndex?: number) {
    const room = this.currentRoom();
    if (room) this.socket.emit('blackjackDouble', { roomId: room.id, playerIndex });
  }

  sendBlackjackNextRound() {
    const room = this.currentRoom();
    if (room) this.socket.emit('blackjackNextRound', { roomId: room.id });
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
      
      // Sync to server if account is secured
      if (!this.tempUser() && this.username()) {
        this.socket.emit('syncFriends', { username: this.username(), friends: updated });
      }
    }
  }

  removeFriend(name: string) {
    const updated = this.friends().filter(f => f !== name);
    this.friends.set(updated);
    localStorage.setItem('friends', JSON.stringify(updated));
    
    // Sync to server if account is secured
    if (!this.tempUser() && this.username()) {
      this.socket.emit('syncFriends', { username: this.username(), friends: updated });
    }
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
