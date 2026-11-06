/**
 * Plays one spoken reply from /api/voice/speak (ElevenLabs) and keeps the
 * clock the captions run on.
 *
 * PCM through Web Audio rather than an <audio> element: every chunk is
 * scheduled on the AudioContext's own clock, so the word on screen is the
 * word in the speaker to the millisecond, it starts on the first chunk
 * (~0.4s) instead of after the whole file, and it plays on iOS Safari, which
 * has no MediaSource for streamed mp3 before 17.1.
 */

export interface SpokenWord {
  text: string;
  /** Seconds from the start of the reply. */
  start: number;
  end: number;
}

interface Alignment {
  characters?: string[];
  character_start_times_seconds?: number[];
  character_end_times_seconds?: number[];
}


const SAMPLE_RATE = 24_000;

async function readNdjson(body: ReadableStream<Uint8Array>, onLine: (line: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) onLine(part);
  }
  if (buffer) onLine(buffer);
}

/** Whitespace-split the characters received so far into timed words. */
export function wordsFrom(chars: string[], starts: number[], ends: number[]): SpokenWord[] {
  const words: SpokenWord[] = [];
  let cur: SpokenWord | null = null;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/\s/.test(c)) {
      if (cur) words.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = { text: c, start: starts[i] ?? 0, end: ends[i] ?? 0 };
    else {
      cur.text += c;
      cur.end = ends[i] ?? cur.end;
    }
  }
  if (cur) words.push(cur);
  return words;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class SpeechPlayer {
  private controller = new AbortController();
  private sources = new Set<AudioBufferSourceNode>();
  /** Where each scheduled chunk sits: in the reply, and on the context clock. */
  private segments: { content: number; at: number; dur: number }[] = [];
  private nextAt = 0;
  private contentSoFar = 0;
  private carry: number | null = null;
  private chars: string[] = [];
  private starts: number[] = [];
  private ends: number[] = [];
  private streamDone = false;
  private stopped = false;
  private finished: Promise<void>;
  private resolveFinished!: () => void;
  private analyser: AnalyserNode;
  private gain: GainNode;

  constructor(
    private ctx: AudioContext,
    private onWords: (words: SpokenWord[]) => void,
  ) {
    this.finished = new Promise((r) => (this.resolveFinished = r));
    this.gain = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.gain.connect(this.analyser);
    this.analyser.connect(ctx.destination);
  }

  /** Resolves when the last word has been heard, or on stop(). */
  async play(text: string): Promise<void> {
    const res = await fetch("/api/voice/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: this.controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`speak ${res.status}`);

    await readNdjson(res.body, (line) => this.handle(line));
    this.streamDone = true;
    this.maybeFinish();
    return this.finished;
  }

  private handle(line: string) {
    if (this.stopped || !line.trim()) return;
    let chunk: { audio_base64?: string | null; alignment?: Alignment | null };
    try { chunk = JSON.parse(line); } catch { return; }
    const a = chunk.alignment;
    if (a?.characters?.length) {
      this.chars.push(...a.characters);
      this.starts.push(...(a.character_start_times_seconds ?? []));
      this.ends.push(...(a.character_end_times_seconds ?? []));
      this.onWords(wordsFrom(this.chars, this.starts, this.ends));
    }
    if (chunk.audio_base64) this.schedule(base64ToBytes(chunk.audio_base64));
  }

  private schedule(bytes: Uint8Array) {
    // 16-bit samples can split across chunks; carry the odd byte over.
    let data = bytes;
    if (this.carry !== null) {
      data = new Uint8Array(bytes.length + 1);
      data[0] = this.carry;
      data.set(bytes, 1);
      this.carry = null;
    }
    if (data.length % 2) {
      this.carry = data[data.length - 1];
      data = data.subarray(0, data.length - 1);
    }
    const n = data.length / 2;
    if (!n) return;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const buf = this.ctx.createBuffer(1, n, SAMPLE_RATE);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = view.getInt16(i * 2, true) / 32768;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    // A late chunk leaves a gap; the segment table keeps the captions on it.
    const at = Math.max(this.nextAt, this.ctx.currentTime + 0.04);
    src.start(at);
    this.segments.push({ content: this.contentSoFar, at, dur: buf.duration });
    this.nextAt = at + buf.duration;
    this.contentSoFar += buf.duration;
    this.sources.add(src);
    src.onended = () => {
      this.sources.delete(src);
      this.maybeFinish();
    };
  }

  private maybeFinish() {
    if (this.streamDone && this.sources.size === 0) this.resolveFinished();
  }

  /** Seconds into the reply that are coming out of the speaker now, or -1 before the first chunk. */
  clock(): number {
    const now = this.ctx.currentTime;
    let t = -1;
    for (const s of this.segments) {
      if (s.at > now) break;
      t = s.content + Math.min(now - s.at, s.dur);
    }
    return t;
  }

  /** 0..1 loudness of what is playing, for the orb. */
  level(scratch: Uint8Array<ArrayBuffer>): number {
    this.analyser.getByteTimeDomainData(scratch);
    let sum = 0;
    for (let i = 0; i < scratch.length; i++) {
      const v = (scratch[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / scratch.length) * 3);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.controller.abort();
    for (const s of this.sources) {
      try { s.stop(); } catch { /* already ended */ }
    }
    this.sources.clear();
    this.gain.disconnect();
    this.resolveFinished();
  }
}
