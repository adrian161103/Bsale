export type Seat = {
  seat_id: number;
  seat_row: number;
  seat_column: string; // 'A'...'F'
  seat_type_id: number;
  airplane_id: number;
};

const COLS = ['A','B','C','D','E','F'];
const colIdx = (c: string) => COLS.indexOf(c.toUpperCase());

export function areAdjacent(a: Seat, b: Seat): boolean {
  return a.seat_row === b.seat_row &&
         Math.abs(colIdx(a.seat_column) - colIdx(b.seat_column)) === 1;
}

// Busca dos asientos contiguos en la misma fila 
export function findAdjacentSeats(seats: Seat[]): [Seat, Seat] | null {
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      if (areAdjacent(seats[i], seats[j])) return [seats[i], seats[j]];
    }
  }
  return null;
}

/**
 * Busca un bloque contiguo de tamaño `size` en la MISMA fila
 * (mismas fila y columnas consecutivas, p.ej. A-B-C-D).
 */
export function findContiguousBlockSameRow(seats: Seat[], size: number): Seat[] | null {
  // Agrupar por fila
  const byRow = new Map<number, Seat[]>();
  for (const s of seats) {
    if (!byRow.has(s.seat_row)) byRow.set(s.seat_row, []);
    byRow.get(s.seat_row)!.push(s);
  }
  // Ordenar por columna dentro de cada fila
  for (const [row, arr] of byRow) {
    arr.sort((a, b) => colIdx(a.seat_column) - colIdx(b.seat_column));
  }

  // Slide window para encontrar `size` consecutivos
  for (const arr of byRow.values()) {
    for (let i = 0; i + size - 1 < arr.length; i++) {
      const chunk = arr.slice(i, i + size);
      const ok = chunk.every((s, k) =>
        k === 0 || colIdx(chunk[k].seat_column) - colIdx(chunk[k-1].seat_column) === 1
      );
      if (ok) return chunk;
    }
  }
  return null;
}

/**
 * Fallback: si no hay bloque perfecto, intenta “cercanos”:
 * - misma fila con 1 hueco (p.ej. A, C, D → asigna 3 pegados ignorando un hueco)
 * - o misma columna en filas consecutivas (asientos “en columna”, ej. B20, B21, B22)
 */
export function findNearBlock(seats: Seat[], size: number): Seat[] | null {
  // 1) misma fila con a lo sumo 1 salto
  const byRow = new Map<number, Seat[]>();
  for (const s of seats) {
    if (!byRow.has(s.seat_row)) byRow.set(s.seat_row, []);
    byRow.get(s.seat_row)!.push(s);
  }
  for (const arr of byRow.values()) {
    arr.sort((a, b) => colIdx(a.seat_column) - colIdx(b.seat_column));
    // greedy: tomar los "más juntos" posibles
    const picked: Seat[] = [];
    for (let i = 0; i < arr.length && picked.length < size; i++) {
      if (picked.length === 0) picked.push(arr[i]);
      else {
        const prev = picked[picked.length - 1];
        const diff = colIdx(arr[i].seat_column) - colIdx(prev.seat_column);
        if (diff === 1 || diff === 2) picked.push(arr[i]); // permitimos 1 hueco
      }
    }
    if (picked.length === size) return picked;
  }

  // 2) misma columna, filas consecutivas (vertical)
  const byCol = new Map<string, Seat[]>();
  for (const s of seats) {
    const k = s.seat_column.toUpperCase();
    if (!byCol.has(k)) byCol.set(k, []);
    byCol.get(k)!.push(s);
  }
  for (const arr of byCol.values()) {
    arr.sort((a, b) => a.seat_row - b.seat_row);
    // ventana de filas consecutivas
    for (let i = 0; i + size - 1 < arr.length; i++) {
      const chunk = arr.slice(i, i + size);
      const ok = chunk.every((s, k) => k === 0 || chunk[k].seat_row - chunk[k-1].seat_row === 1);
      if (ok) return chunk;
    }
  }

  return null;
}

/** Quita por id de asiento de cualquier lista (in-place) */
export function removeSeatsFrom(seats: Seat[], removeIds: number[]) {
  const toRemove = new Set(removeIds);
  for (let i = seats.length - 1; i >= 0; i--) {
    if (toRemove.has(seats[i].seat_id)) seats.splice(i, 1);
  }
}
