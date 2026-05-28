/**
 * WebRtcService — generic P2P data channel, reusable for any real-time game.
 *
 * Usage:
 *   1. Inject WebRtcService in your game component.
 *   2. P1 calls  initAsHost(sendOffer, sendIce)  when the room is full.
 *   3. Watch     rtcSignal() from GameService in an effect → pass to handleSignal().
 *   4. Call      send({ ...yourPayload })  to push JSON data to the peer.
 *   5. Watch     lastMessage()  signal to react to incoming messages.
 *   6. Call      reset()        in ngOnDestroy (or when leaving the room).
 *
 * ICE config is fetched dynamically from /api/rtc-config (backend).
 * The backend returns STUN + TURN credentials (HMAC, 1h TTL) when coturn
 * is configured, or STUN-only when TURN_SECRET is absent.
 *
 * Transport: ordered=false, maxRetransmits=0  →  UDP-like, no head-of-line blocking.
 * Fallback: ICE timeout 8s → status='failed', game continues over socket.io.
 */

import { Injectable, signal } from '@angular/core';

export type RtcStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export type RtcSignal =
  | { type: 'offer';  offer:     RTCSessionDescriptionInit }
  | { type: 'answer'; answer:    RTCSessionDescriptionInit }
  | { type: 'ice';    candidate: RTCIceCandidateInit };

/** STUN-only fallback used if /api/rtc-config is unreachable. */
const STUN_FALLBACK: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
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

  private sendIce_: ((c: RTCIceCandidateInit) => void) | null = null;

  // ── API ────────────────────────────────────────────────────────────────────

  get isOpen(): boolean { return this.dc?.readyState === 'open'; }

  /**
   * P1 (host) — fetch ICE config, create offer, start ICE negotiation.
   */
  async initAsHost(
    sendOffer: (o: RTCSessionDescriptionInit) => void,
    sendIce:   (c: RTCIceCandidateInit)       => void,
  ): Promise<void> {
    this.reset();
    this.sendIce_ = sendIce;
    this.setStatus('connecting');

    const iceConfig = await this.fetchIceConfig();
    this.pc = new RTCPeerConnection(iceConfig);
    this.dc = this.pc.createDataChannel('game', { ordered: false, maxRetransmits: 0 });
    this.wireChannel(this.dc);
    this.wirePc(this.pc);

    this.armTimeout();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    sendOffer(offer);
  }

  /**
   * Handle an incoming WebRTC signal (offer / answer / ice).
   * P2 passes sendAnswer + sendIce only on the first 'offer' signal.
   */
  async handleSignal(
    sig:        RtcSignal,
    sendAnswer: (a: RTCSessionDescriptionInit) => void,
    sendIce:    (c: RTCIceCandidateInit)       => void,
  ): Promise<void> {
    switch (sig.type) {

      case 'offer': {
        this.reset();
        this.sendIce_ = sendIce;
        this.setStatus('connecting');

        const iceConfig = await this.fetchIceConfig();
        this.pc = new RTCPeerConnection(iceConfig);
        this.pc.ondatachannel = e => { this.dc = e.channel; this.wireChannel(this.dc); };
        this.wirePc(this.pc);

        await this.pc.setRemoteDescription(sig.offer);
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        sendAnswer(answer);

        // Flush ICE candidates that arrived before setRemoteDescription
        for (const c of this.pendingIce) await this.pc.addIceCandidate(c).catch(() => {});
        this.pendingIce = [];
        this.armTimeout();
        break;
      }

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
    this.dc       = null;
    this.pc       = null;
    this.sendIce_ = null;
    this.pendingIce = [];
    this.setStatus('idle');
  }

  // ── ICE config (dynamic, from backend) ────────────────────────────────────

  /**
   * Fetch ICE server config from the backend.
   * Returns STUN + TURN credentials when coturn is configured.
   * Falls back to public STUN-only on any error.
   */
  private async fetchIceConfig(): Promise<RTCConfiguration> {
    try {
      const res = await fetch('/api/rtc-config', { cache: 'no-store' });
      if (res.ok) {
        const cfg = await res.json() as RTCConfiguration;
        console.debug('[WebRtcService] ICE config:', cfg.iceServers);
        return cfg;
      }
    } catch (err) {
      console.warn('[WebRtcService] /api/rtc-config unreachable, using STUN fallback', err);
    }
    return STUN_FALLBACK;
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
      if (e.candidate) this.sendIce_?.(e.candidate.toJSON());
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'failed' || s === 'disconnected' || s === 'closed') this.setStatus('failed');
    };
  }

  /** 8 s timeout — if ICE hasn't connected yet, mark as failed (graceful socket.io fallback). */
  private armTimeout(): void {
    if (this.iceTimer) clearTimeout(this.iceTimer);
    this.iceTimer = setTimeout(() => {
      if (this.status() !== 'connected') {
        console.warn('[WebRtcService] ICE timeout — falling back to socket.io');
        this.setStatus('failed');
      }
    }, 8_000);
  }

  private setStatus(s: RtcStatus): void { this.status.set(s); }
}
