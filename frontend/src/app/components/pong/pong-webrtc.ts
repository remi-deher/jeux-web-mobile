/**
 * WebRTC peer-to-peer data channel for Pong.
 *
 * Purpose: relay each player's paddle position directly to the opponent,
 * bypassing the server round-trip. The server remains authoritative for
 * ball physics and scoring; WebRTC is the low-latency input transport.
 *
 * Channel config: ordered=false, maxRetransmits=0  →  UDP-like,
 * newest paddle position always wins, no head-of-line blocking.
 *
 * Fallback: if WebRTC fails (strict NAT, ICE timeout…) the game keeps
 * working via socket.io with the existing server-broadcast pipeline.
 */

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export type PaddleMsg = { y: number };
export type RtcStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export class PongWebRTC {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;

  status: RtcStatus = 'idle';

  /** Called when the opponent sends a paddle position via the data channel. */
  onOpponentPaddle: ((y: number) => void) | null = null;
  /** Called whenever the connection status changes. */
  onStatusChange: ((s: RtcStatus) => void) | null = null;

  get isOpen(): boolean {
    return this.dc?.readyState === 'open';
  }

  // ── Host (P1): create offer ─────────────────────────────────────────────────

  async initAsHost(
    sendOffer: (offer: RTCSessionDescriptionInit) => void,
    sendIce:   (c: RTCIceCandidateInit) => void,
  ): Promise<void> {
    this.setStatus('connecting');
    this.pc = new RTCPeerConnection(ICE_CONFIG);

    this.dc = this.pc.createDataChannel('pong', {
      ordered: false,
      maxRetransmits: 0,
    });
    this.wireDataChannel(this.dc);

    this.pc.onicecandidate = e => {
      if (e.candidate) sendIce(e.candidate.toJSON());
    };

    this.pc.onconnectionstatechange = () => this.handleConnectionState();

    this.armTimeout();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    sendOffer(offer);
  }

  // ── Guest (P2): handle offer, send answer ──────────────────────────────────

  async handleOffer(
    offer:      RTCSessionDescriptionInit,
    sendAnswer: (a: RTCSessionDescriptionInit) => void,
    sendIce:    (c: RTCIceCandidateInit) => void,
  ): Promise<void> {
    this.setStatus('connecting');
    this.pc = new RTCPeerConnection(ICE_CONFIG);

    this.pc.ondatachannel = e => {
      this.dc = e.channel;
      this.wireDataChannel(this.dc);
    };

    this.pc.onicecandidate = e => {
      if (e.candidate) sendIce(e.candidate.toJSON());
    };

    this.pc.onconnectionstatechange = () => this.handleConnectionState();

    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    sendAnswer(answer);

    // Flush buffered ICE candidates that arrived before remote description
    for (const c of this.pendingCandidates) {
      await this.pc.addIceCandidate(c).catch(() => {});
    }
    this.pendingCandidates = [];
    this.armTimeout();
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc?.setRemoteDescription(answer).catch(() => {});
  }

  async addIceCandidate(c: RTCIceCandidateInit): Promise<void> {
    if (this.pc?.remoteDescription) {
      await this.pc.addIceCandidate(c).catch(() => {});
    } else {
      this.pendingCandidates.push(c);
    }
  }

  // ── Send own paddle position ─────────────────────────────────────────────────

  /** Send own paddle Y (0-100%) to opponent. Silently no-ops if channel not open. */
  sendPaddle(y: number): void {
    if (this.dc?.readyState === 'open') {
      this.dc.send(y.toFixed(2));
    }
  }

  // ── Teardown ──────────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
    this.dc?.close();
    this.pc?.close();
    this.dc = null;
    this.pc = null;
    this.pendingCandidates = [];
    this.setStatus('idle');
  }

  // ── Internal ──────────────────────────────────────────────────────────────────

  private wireDataChannel(dc: RTCDataChannel): void {
    dc.onopen = () => {
      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      this.setStatus('connected');
    };
    dc.onclose = () => {
      if (this.status === 'connected') this.setStatus('failed');
    };
    dc.onerror = () => {
      this.setStatus('failed');
    };
    dc.onmessage = e => {
      const y = parseFloat(e.data as string);
      if (!isNaN(y) && this.onOpponentPaddle) {
        this.onOpponentPaddle(y);
      }
    };
  }

  private handleConnectionState(): void {
    const s = this.pc?.connectionState;
    if (s === 'connected') {
      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      // Data channel open event will call setStatus('connected')
    } else if (s === 'failed' || s === 'disconnected' || s === 'closed') {
      this.setStatus('failed');
    }
  }

  /** ICE negotiation should complete in under 8 seconds; mark as failed otherwise. */
  private armTimeout(): void {
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
    this.connectionTimeout = setTimeout(() => {
      if (this.status !== 'connected') {
        console.warn('[PongWebRTC] ICE timeout — falling back to socket.io');
        this.setStatus('failed');
      }
    }, 8_000);
  }

  private setStatus(s: RtcStatus): void {
    this.status = s;
    this.onStatusChange?.(s);
  }
}
