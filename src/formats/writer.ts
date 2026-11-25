/** Little-endian binary writer used by the PES/PEC encoders. */
export class ByteWriter {
  private data: number[] = [];

  get pos(): number {
    return this.data.length;
  }

  u8(v: number): void {
    this.data.push(v & 0xff);
  }

  i16(v: number): void {
    const n = v & 0xffff;
    this.data.push(n & 0xff, (n >> 8) & 0xff);
  }

  i24(v: number): void {
    const n = v & 0xffffff;
    this.data.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff);
  }

  i32(v: number): void {
    const n = v >>> 0;
    this.data.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
  }

  f32(v: number): void {
    const buf = new DataView(new ArrayBuffer(4));
    buf.setFloat32(0, v, true);
    for (let i = 0; i < 4; i++) this.data.push(buf.getUint8(i));
  }

  ascii(s: string): void {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  }

  zeros(count: number): void {
    for (let i = 0; i < count; i++) this.data.push(0);
  }

  patch16(at: number, v: number): void {
    const n = v & 0xffff;
    this.data[at] = n & 0xff;
    this.data[at + 1] = (n >> 8) & 0xff;
  }

  patch24(at: number, v: number): void {
    const n = v & 0xffffff;
    this.data[at] = n & 0xff;
    this.data[at + 1] = (n >> 8) & 0xff;
    this.data[at + 2] = (n >> 16) & 0xff;
  }

  patch32(at: number, v: number): void {
    const n = v >>> 0;
    this.data[at] = n & 0xff;
    this.data[at + 1] = (n >>> 8) & 0xff;
    this.data[at + 2] = (n >>> 16) & 0xff;
    this.data[at + 3] = (n >>> 24) & 0xff;
  }

  bytes(): Uint8Array {
    return new Uint8Array(this.data);
  }
}
