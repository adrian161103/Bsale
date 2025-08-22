import { prisma } from '../index';
import camelcaseKeys from 'camelcase-keys';
import { groupBy } from '../utils/groupBy';
import { findAdjacentSeats, removeSeatsFrom, findContiguousBlockSameRow, findNearBlock } from '../utils/seatUtils';
export async function getCheckinSimulation(flightId: number) {
  const flight = await prisma.flight.findUnique({
    where: { flight_id: flightId },
    include: { airplane: true },
  });

  if (!flight) return null;

  const boardingPasses = await prisma.boarding_pass.findMany({
    where: { flight_id: flightId },
    include: {
      passenger: true,
      seat: true,
    },
  });

  const allSeats = await prisma.seat.findMany({
    where: { airplane_id: flight.airplane_id }, // Asientos del avión, no del vuelo
    orderBy: [{ seat_row: 'asc' }, { seat_column: 'asc' }],
  });

  const takenSeatIds = boardingPasses
    .map(bp => bp.seat_id)
    .filter((seatId): seatId is number => seatId !== null);

  const availableSeats = allSeats.filter(
    seat => !takenSeatIds.includes(seat.seat_id)
  );

  const groups = groupBy(boardingPasses, bp => bp.purchase_id);

  for (const group of Object.values(groups)) {
    const groupSize = group.length;
    const seatTypeId = group[0].seat_type_id;

// Separar menores y adultos
const minors = group.filter(bp => bp.passenger.age < 18);
const adults = group.filter(bp => bp.passenger.age >= 18);

// Asientos compatibles por tipo
const compatibleSeats = availableSeats.filter(
  seat => seat.seat_type_id === seatTypeId
);

// 1) Intentar sentar a cada menor junto a un adulto
for (const minor of minors) {
  // Peek (no sacamos del array todavía)
  const adult = adults[0];
  if (!adult) continue; // no hay acompañante

  // Buscar dos asientos contiguos (misma fila y columnas adyacentes)
  const pair = findAdjacentSeats(compatibleSeats);
  if (!pair) continue; // no hay pares disponibles ahora

  // Asignar asientos
  minor.seat_id = pair[0].seat_id;
  adult.seat_id = pair[1].seat_id;

  // Consumimos recién ahora al adulto usado
  adults.shift();

  // Remover de disponibles (compatibleSeats y availableSeats)
  const rmIds = new Set([pair[0].seat_id, pair[1].seat_id]);
  const removeFrom = (arr: typeof availableSeats) => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (rmIds.has(arr[i].seat_id)) arr.splice(i, 1);
    }
  };
  removeFrom(compatibleSeats);
  removeFrom(availableSeats);
}

// 2) BLOQUES CONTIGUOS PARA EL RESTO DEL GRUPO
const remainingGroup = group.filter(bp => !bp.seat_id);
if (remainingGroup.length > 0) {
  // Solo asientos compatibles por tipo aún disponibles
  const comp = availableSeats.filter(s => s.seat_type_id === seatTypeId);

  // Intentar bloque perfecto (misma fila, columnas consecutivas)
  let block = findContiguousBlockSameRow(comp as any, remainingGroup.length);

  // Fallback: bloque “cercano” (misma fila con 1 hueco o vertical consecutivo)
  if (!block) block = findNearBlock(comp as any, remainingGroup.length);

  if (block) {
    // Asignación directa a los restantes
    for (let i = 0; i < remainingGroup.length; i++) {
      remainingGroup[i].seat_id = block[i].seat_id;
    }
    // Quitar de disponibles
    removeSeatsFrom(availableSeats as any, block.map(s => s.seat_id));
  } else {
    // Último fallback: asignación simple (lo que haya)
    for (let i = 0; i < remainingGroup.length && i < comp.length; i++) {
      remainingGroup[i].seat_id = comp[i].seat_id;
      const idx = availableSeats.findIndex(s => s.seat_id === comp[i].seat_id);
      if (idx !== -1) availableSeats.splice(idx, 1);
    }
  } 
}

  const passengers = boardingPasses.map(bp => ({
    passengerId: bp.passenger.passenger_id,
    dni: bp.passenger.dni,
    name: bp.passenger.name,
    age: bp.passenger.age,
    country: bp.passenger.country,
    boardingPassId: bp.boarding_pass_id,
    purchaseId: bp.purchase_id,
    seatTypeId: bp.seat_type_id,
    seatId: bp.seat_id,
  }));

  return camelcaseKeys(
    {
      flightId: flight.flight_id,
      takeoffDateTime: flight.takeoff_date_time,
      takeoffAirport: flight.takeoff_airport,
      landingDateTime: flight.landing_date_time,
      landingAirport: flight.landing_airport,
      airplaneId: flight.airplane_id,
      passengers,
    },
    { deep: true }
  );
}
}
