/**
 * WebRtcService — generic P2P data channel, reusable for any real-time game.
 *
 * Usage:
 *   1. Inject WebRtcService in your game component.
 *   2. P1 calls  initAsHost(roomId)   when the room is full.
 *   3. Watch     rtcSignal() from GameService in an effect, pass signals to handleSignal().
 *   4. Call      send({ ...yourPayload })  to push data to the peer.
 *   5. Watch     lastMessage()  signal to react to incoming messages.
 *   6. Call      reset()        in ngOnDestroy (or when leaving the room).
 *
 * Transport: ordered=false, maxRetransmits=0 (UDP-like).
 * Newest message always wins; no head-of-line blocking.
 *
 * Fallback: if ICE negotiation fails within 8 s, status → 'failed' and the
 * game continues over socket.io as before.
 */

import { Injectable, signal } from '@angular/core';

export type RtcStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export type RtcSignal =
  | { type: 'offer';  offer:     RTCSessionDescriptionInit }
  | { type: 'answer'; answer:    RTCSessionDescriptionInit }
  | { type: 'ice';    candidate: RTCIceCandidateInit };

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

@Injectable({ providedIn: 'root' })
export class WebRtcService {
  // ── Public reactive state ──────────────────────────────────────────────────

  /** Current P2P connection status. */
  readonly status = signal<RtcStatus>('idle');

  /**
   * Last message received from the peer (JSON-parsed).
   * Each new message replaces the previous value — watch via effect().
   */
  readonly lastMessage = signal<unknown>(null);

  // ── Private ────────────────────────────────────────────────────────────────

  private pc:  RTCPeerConnection | null = null;
  private dc:  RTCDataChannel    | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private iceTimer:   ReturnType<typeof setTimeout> | null = null;

  /** Callbacks injected by the caller for sending signaling via socket.io. */
  private sendOffer_:  ((o: RTCSessionDescriptionInit) => void) | null = null;
  private sendAnswer_: ((a: RTCSessionDescriptionInit) => void) | null = null;
  private sendIce_:    ((c: RTCIceCandidateInit)       => void) | null = null;

  // ── API ────────────────────────────────────────────────────────────────────

  get isOpen(): boolean {
    return this.dc?.readyState === 'open';
  }

  /**
   * P1 (host) — create offer and start ICE.
   * @param sendOffer  forward offer SDP to peer via socket.io
   * @param sendIce    forward ICE candidate to peer via socket.io
   */
  async initAsHost(
    sendOffer: (o: RTCSessionDescriptionInit) => void,
    sendIce:   (c: RTCIceCandidateInit)       => void,
  ): Promise<void> {
    this.reset();
    this.sendOffer_ = sendOffer;
    this.sendIce_   = sendIce;
    this.setStatus('connecting');

    this.pc = new RTCPeerConnection(ICE_CONFIG);
    this.dc = this.pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 });
    this.wireChannel(this.dc);
    this.wirePc(this.pc);

    this.armTimeout();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    sendOffer(offer);
  }

  /**
   * P2 (guest) — receive offer, send answer.
   * Call this when a 'offer' signal arrives via socket.io.
   * @param sendAnswer forward answer SDP to host via socket.io
   * @param sendIce    forward ICE candidates via socket.io
   */
  async handleSignal(
    sig:        RtcSignal,
    sendAnswer: (a: RTCSessionDescriptionInit) => void,
    sendIce:    (c: RTCIceCandidateInit)       => void,
  ): Promise<void> {
    switch (sig.type) {
      case 'offer':
        this.reset();
        this.sendAnswer_ = sendAnswer;
        this.sendIce_    = sendIce;
        this.setStatus('connecting');

        this.pc = new RTCPeerConnection(ICE_CONFIG);
        this.pc.ondatachannel = e => { this.dc = e.channel; this.wireChannel(this.dc); };
        this.wirePc(this.pc);

        await this.pc.setRemoteDescription(sig.offer);
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        sendAnswer(answer);

        for (const c of this.pendingIce) await this.pc.addIceCandidate(c).catch(() => {});
        this.pendingIce = [];
        this.armTimeout();
        break;

      case 'answer':
        await this.pc?.setRemoteDescription(sig.answer).catch(() => {});
        break;

      case 'ice':
        if (this.pc?.remoteDescription) {
          await this.pc.addIceCandidate(sig.candidate).catch(() => {});
        } else {
          this.pendingIce.push(sig.candidate);
        }
        break;
    }
  }

  /**
   * Send an arbitrary JSON-serialisable payload to the peer.
   * Silently no-ops if the data channel is not open yet.
   */
  send(payload: unknown): void {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(payload));
    }
  }

  /** Tear down the current connection and reset to idle. */
  reset(): void {
    if (this.iceTimer) { clearTimeout(this.iceTimer); this.iceTimer = null; }
    this.dc?.close();
    this.pc?.close();
    this.dc = null;
    this.pc = null;
    this.pendingIce = [];
    this.sendOffer_  = null;
    this.sendAnswer_ = null;
    this.sendIce_    = null;
    this.setStatus('idle');
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private wireChannel(dc: RTCDataChannel): void {
    dc.onopen  = () => { if (this.iceTimer) clearTimeout(this.iceTimer); this.setStatus('connected'); };
    dc.onclose = () => { if (this.status() === 'connected') this.setStatus('failed'); };
    dc.onerror = () => this.setStatus('failed');
    dc.onmessage = e => {
      try { this.lastMessage.set(JSON.parse(e.data as string)); } catch { /* ignore malformed */ }
    };
  }

  private wirePc(pc: RTCPeerConnection): void {
    pc.onicecandidate = e => {
      if (e.candidate) {
        const fn = this.sendIce_;
        if (fn) fn(e.candidate.toJSON());
      }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'failed' || s === 'disconnected' || s === 'closed') {
        this.setStatus('failed');
      }
    };
  }

  /** 8-second timeout — if ICE hasn't connected, mark as failed (graceful fallback). */
  private armTimeout(): void {
    if (this.iceTimer) clearTimeout(this.iceTimer);
    this.iceTimer = setTimeout(() => {
      if (this.status() !== 'connected') {
        console.warn('[WebRtcService] ICE timeout — falling back to socket.io');
        this.setStatus('failed');
      }
    }, 8_000);
  }

  private setStatus(s: RtcStatus): void {
    this.status.set(s);
  }
}
