import type { GapAnswer, Member, Payment, Refuel, Reservation, Trip } from './domain';

export interface SessionUser {
  email: string;
  displayName: string;
}

export interface Snapshot {
  members: Member[];
  trips: Trip[];
  refuels: Refuel[];
  payments: Payment[];
  reservations: Reservation[];
  gapAnswers: GapAnswer[];
}

export interface GapAnswerInput {
  fromKm: number;
  toKm: number;
  used: boolean;
  km: number;
  day: string | null;
}

export interface Evidence {
  id: string;
  owner: string;
  kind: 'odometer' | 'receipt';
  data: string; // JPEG en base64 (sin prefijo data:)
  createdAt: number;
}

export interface TripInput {
  date: number;
  startKm: number;
  startPhotoId: string | null;
  endKm: number | null;
  endPhotoId: string | null;
  note: string;
  /** Acompañantes con los que se reparte el viaje. */
  with?: string[];
  /** Fecha y hora de llegada (con el km final). */
  endDate?: number | null;
}

export interface RefuelInput {
  date: number;
  amountCents: number;
  priceMilli: number;
  odometerKm: number;
  odometerPhotoId: string | null;
  receiptPhotoId: string;
  note: string;
}

export interface ReservationInput {
  day: string;
  endDay: string;
  note: string;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out'; error?: string }
  | { status: 'forbidden'; email: string }
  | { status: 'ready'; user: SessionUser; member: Member };

/** Contrato entre la interfaz y el almacenamiento. La seguridad real vive en las reglas de Firestore. */
export interface Backend {
  onAuth(cb: (s: AuthState) => void): void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  subscribe(cb: (s: Snapshot) => void, onError: (e: unknown) => void): () => void;
  addTrip(input: TripInput): Promise<void>;
  /** Apuntar km a nombre de otra persona (que se olvidó): queda pendiente de que lo confirme. */
  addTripFor(driver: string, input: TripInput): Promise<void>;
  /** «Es correcto»: quien fue apuntado por otro o añadido como acompañante lo confirma. */
  confirmTrip(id: string): Promise<void>;
  /** «No iba»: un acompañante se quita del viaje. */
  leaveTrip(id: string): Promise<void>;
  updateTrip(id: string, input: TripInput): Promise<void>;
  deleteTrip(id: string): Promise<void>;
  /**
   * Guarda el repostaje. Con `splitTrip`, a la vez (todo o nada) termina ese viaje en curso en el km
   * del repostaje y empieza otro desde ahí, con los mismos acompañantes.
   */
  addRefuel(input: RefuelInput, splitTrip?: Trip | null): Promise<void>;
  deleteRefuel(id: string): Promise<void>;
  markSent(refuelId: string, creditor: string, amountCents: number): Promise<void>;
  /** Bizum de ajuste de un reparto ya pagado que ha cambiado. */
  sendAdjustment(refuelId: string, creditor: string, amountCents: number, seq: number): Promise<void>;
  undoSent(paymentId: string): Promise<void>;
  /** «No me ha llegado»: quien lo iba a recibir rechaza un Bizum marcado como enviado. */
  rejectPayment(paymentId: string): Promise<void>;
  /** «Ya me lo pagó»: quien recibió un Bizum que no se marcó lo anota como recibido. */
  recordReceived(refuelId: string, debtor: string, amountCents: number, adjustSeq?: number): Promise<void>;
  confirmPayment(paymentId: string): Promise<void>;
  /** Respuesta a unos km misterio: si usó el coche en esas fechas, qué día y cuántos km. Se puede cambiar. */
  answerGap(input: GapAnswerInput): Promise<void>;
  addReservation(input: ReservationInput): Promise<void>;
  updateReservation(id: string, input: ReservationInput): Promise<void>;
  deleteReservation(id: string): Promise<void>;
  addEvidence(kind: Evidence['kind'], base64Jpeg: string): Promise<string>;
  getEvidence(id: string): Promise<Evidence | null>;
}
