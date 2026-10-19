// Biblioteca base de ejercicios (fuente única: también genera worker/migrations/0002_exercises.sql).
// factor: convierte el 1RM estimado del ejercicio al equivalente del levantamiento de referencia del grupo
//         (pecho=press de banca, espalda=remo con barra, piernas=sentadilla, hombros=press militar, brazos=curl con barra).
// bw: el peso corporal forma parte de la carga (dominadas, fondos...). En ese caso "peso" = lastre añadido.
// Mancuernas: se registra el peso de UNA mancuerna.

export const MUSCLES = {
  pecho: 'Pecho', espalda: 'Espalda', piernas: 'Piernas',
  hombros: 'Hombros', brazos: 'Brazos', core: 'Core',
};

export const EXERCISES = [
  // Pecho
  { id: 'bench_press', name: 'Press de banca con barra', muscle: 'pecho', factor: 1 },
  { id: 'incline_bench', name: 'Press inclinado con barra', muscle: 'pecho', factor: 1.18 },
  { id: 'decline_bench', name: 'Press declinado con barra', muscle: 'pecho', factor: 0.95 },
  { id: 'db_bench', name: 'Press con mancuernas', muscle: 'pecho', factor: 2.6 },
  { id: 'incline_db', name: 'Press inclinado con mancuernas', muscle: 'pecho', factor: 3.0 },
  { id: 'chest_fly', name: 'Aperturas con mancuernas', muscle: 'pecho', factor: 5.5 },
  { id: 'cable_crossover', name: 'Cruce de poleas', muscle: 'pecho', factor: 4 },
  { id: 'pec_deck', name: 'Contractora (pec deck)', muscle: 'pecho', factor: 1.3 },
  { id: 'machine_chest_press', name: 'Press de pecho en máquina', muscle: 'pecho', factor: 0.9 },
  { id: 'dips', name: 'Fondos en paralelas', muscle: 'pecho', factor: 0.85, bw: 1 },
  { id: 'pushups', name: 'Lagartijas', muscle: 'pecho', factor: 0.65, bw: 1 },
  // Espalda
  { id: 'barbell_row', name: 'Remo con barra', muscle: 'espalda', factor: 1 },
  { id: 'pendlay_row', name: 'Remo Pendlay', muscle: 'espalda', factor: 1.05 },
  { id: 'deadlift', name: 'Peso muerto', muscle: 'espalda', factor: 0.6 },
  { id: 'rack_pull', name: 'Rack pull', muscle: 'espalda', factor: 0.55 },
  { id: 'pullups', name: 'Dominadas', muscle: 'espalda', factor: 0.9, bw: 1 },
  { id: 'chinups', name: 'Dominadas supinas', muscle: 'espalda', factor: 0.85, bw: 1 },
  { id: 'lat_pulldown', name: 'Jalón al pecho', muscle: 'espalda', factor: 1.15 },
  { id: 'seated_row', name: 'Remo sentado en polea', muscle: 'espalda', factor: 1 },
  { id: 'db_row', name: 'Remo con mancuerna', muscle: 'espalda', factor: 2.2 },
  { id: 'tbar_row', name: 'Remo en T', muscle: 'espalda', factor: 0.9 },
  { id: 'machine_row', name: 'Remo en máquina', muscle: 'espalda', factor: 0.95 },
  { id: 'straight_arm_pulldown', name: 'Pullover en polea', muscle: 'espalda', factor: 2.5 },
  { id: 'inverted_row', name: 'Remo invertido', muscle: 'espalda', factor: 0.6, bw: 1 },
  // Piernas
  { id: 'back_squat', name: 'Sentadilla con barra', muscle: 'piernas', factor: 1 },
  { id: 'front_squat', name: 'Sentadilla frontal', muscle: 'piernas', factor: 1.2 },
  { id: 'goblet_squat', name: 'Sentadilla goblet', muscle: 'piernas', factor: 3 },
  { id: 'hack_squat', name: 'Sentadilla hack', muscle: 'piernas', factor: 0.8 },
  { id: 'leg_press', name: 'Prensa de piernas', muscle: 'piernas', factor: 0.45 },
  { id: 'romanian_deadlift', name: 'Peso muerto rumano', muscle: 'piernas', factor: 1.05 },
  { id: 'sumo_deadlift', name: 'Peso muerto sumo', muscle: 'piernas', factor: 0.75 },
  { id: 'bulgarian_split', name: 'Sentadilla búlgara', muscle: 'piernas', factor: 3.5 },
  { id: 'lunges', name: 'Zancadas con mancuernas', muscle: 'piernas', factor: 4 },
  { id: 'step_up', name: 'Subidas al cajón', muscle: 'piernas', factor: 4.5 },
  { id: 'leg_extension', name: 'Extensión de cuádriceps', muscle: 'piernas', factor: 1.6 },
  { id: 'leg_curl', name: 'Curl femoral', muscle: 'piernas', factor: 2 },
  { id: 'hip_thrust', name: 'Hip thrust', muscle: 'piernas', factor: 0.75 },
  { id: 'calf_raise', name: 'Elevación de talones de pie', muscle: 'piernas', factor: 0.9 },
  { id: 'seated_calf', name: 'Elevación de talones sentado', muscle: 'piernas', factor: 1.4 },
  // Hombros
  { id: 'ohp', name: 'Press militar con barra', muscle: 'hombros', factor: 1 },
  { id: 'push_press', name: 'Push press', muscle: 'hombros', factor: 0.8 },
  { id: 'db_shoulder_press', name: 'Press de hombro con mancuernas', muscle: 'hombros', factor: 2.4 },
  { id: 'arnold_press', name: 'Press Arnold', muscle: 'hombros', factor: 2.6 },
  { id: 'machine_shoulder_press', name: 'Press de hombro en máquina', muscle: 'hombros', factor: 0.9 },
  { id: 'lateral_raise', name: 'Elevaciones laterales', muscle: 'hombros', factor: 5.5 },
  { id: 'front_raise', name: 'Elevaciones frontales', muscle: 'hombros', factor: 4.5 },
  { id: 'rear_delt_fly', name: 'Pájaros (deltoide posterior)', muscle: 'hombros', factor: 6 },
  { id: 'face_pull', name: 'Face pull', muscle: 'hombros', factor: 2 },
  { id: 'upright_row', name: 'Remo al mentón', muscle: 'hombros', factor: 1.1 },
  { id: 'shrugs', name: 'Encogimientos (trapecio)', muscle: 'hombros', factor: 0.4 },
  // Brazos
  { id: 'barbell_curl', name: 'Curl con barra', muscle: 'brazos', factor: 1 },
  { id: 'ez_curl', name: 'Curl con barra Z', muscle: 'brazos', factor: 1 },
  { id: 'db_curl', name: 'Curl con mancuernas', muscle: 'brazos', factor: 2.4 },
  { id: 'hammer_curl', name: 'Curl martillo', muscle: 'brazos', factor: 2.2 },
  { id: 'preacher_curl', name: 'Curl predicador', muscle: 'brazos', factor: 1.15 },
  { id: 'cable_curl', name: 'Curl en polea', muscle: 'brazos', factor: 1.1 },
  { id: 'concentration_curl', name: 'Curl concentrado', muscle: 'brazos', factor: 2.8 },
  { id: 'skull_crusher', name: 'Press francés', muscle: 'brazos', factor: 1.2 },
  { id: 'tricep_pushdown', name: 'Extensión de tríceps en polea', muscle: 'brazos', factor: 1 },
  { id: 'overhead_tricep', name: 'Extensión de tríceps tras nuca', muscle: 'brazos', factor: 1.6 },
  { id: 'close_grip_bench', name: 'Press de banca agarre cerrado', muscle: 'brazos', factor: 0.45 },
  { id: 'bench_dips', name: 'Fondos en banco', muscle: 'brazos', factor: 0.5, bw: 1 },
  // Core (sin rango)
  { id: 'plank', name: 'Plancha (reps = segundos)', muscle: 'core', factor: 0, bw: 1 },
  { id: 'crunch', name: 'Crunch abdominal', muscle: 'core', factor: 0 },
  { id: 'cable_crunch', name: 'Crunch en polea', muscle: 'core', factor: 0 },
  { id: 'hanging_leg_raise', name: 'Elevación de piernas colgado', muscle: 'core', factor: 0, bw: 1 },
  { id: 'russian_twist', name: 'Giros rusos', muscle: 'core', factor: 0 },
  { id: 'ab_wheel', name: 'Rueda abdominal', muscle: 'core', factor: 0, bw: 1 },
];

// Umbrales de rango: (1RM del levantamiento de referencia) / peso corporal
export const RANKS = ['Hierro', 'Bronce', 'Plata', 'Oro', 'Platino'];
export const RANK_THRESHOLDS = {
  pecho: [0, 0.5, 0.8, 1.1, 1.5],
  espalda: [0, 0.5, 0.75, 1.0, 1.35],
  piernas: [0, 0.75, 1.1, 1.5, 2.0],
  hombros: [0, 0.35, 0.55, 0.75, 1.0],
  brazos: [0, 0.25, 0.4, 0.55, 0.75],
};
