export class BreadboardModel {
  constructor() {
    this.rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    this.cols = 30;
  }

  isValidPosition(row, col) {
    return this.rows.includes(row) && col >= 1 && col <= this.cols;
  }

  getNetId(posStr) {
    if (posStr.startsWith('power+:')) return 'net:power+';
    if (posStr.startsWith('power-:')) return 'net:power-';

    const row = posStr[0];
    const col = parseInt(posStr.slice(1), 10);

    if (!this.isValidPosition(row, col)) return null;

    if ('abcde'.includes(row)) return `net:top:${col}`;
    if ('fghij'.includes(row)) return `net:bottom:${col}`;

    return null;
  }

  areConnected(pos1, pos2) {
    const net1 = this.getNetId(pos1);
    const net2 = this.getNetId(pos2);
    if (!net1 || !net2) return false;
    return net1 === net2;
  }
}
