// Собственные пиктограммы поз для упражнений без рисунка в открытых наборах (кардио, борьба — v0.9.4).
// Фигура — толстые линии со скруглёнными концами в стиле спортивных пиктограмм; тренажёр — серым;
// работающие части тела подсвечиваются по мышцам упражнения (основные — красным, вспомогательные — светлым).
// В борцовских — второй человек (партнёр) серым позади: двое в захватах, бросок, борьба в партере.
import type { Muscle } from '../domain/schemas.ts';

type P = [number, number];

interface Body {
  head: P;
  neck: P;
  hip: P;
  /** Ближняя к зрителю рука и нога рисуются поверх, дальняя — бледнее. */
  armNear: [shoulder: P, elbow: P, hand: P];
  armFar: [shoulder: P, elbow: P, hand: P];
  legNear: [knee: P, ankle: P, toe?: P];
  legFar: [knee: P, ankle: P, toe?: P];
}

interface Pose extends Body {
  /** Тренажёр и окружение: пути SVG (серые) и окружности [cx, cy, r]. */
  props?: string[];
  wheels?: [number, number, number][];
  /** Пути «поверх» фигуры (скакалка, ручки). */
  front?: string[];
  /** Партнёр — второй человек серым, рисуется позади. */
  partner?: Body;
  /** Тоньше линии — когда в кадре двое. */
  thin?: boolean;
}

/** Зеркало фигуры по вертикальной оси (партнёр лицом к лицу); dx — сдвиг вправо. */
function mirror(b: Body, dx = 0): Body {
  const m = (q: P): P => [100 - q[0] + dx, q[1]];
  return {
    head: m(b.head),
    neck: m(b.neck),
    hip: m(b.hip),
    armNear: [m(b.armNear[0]), m(b.armNear[1]), m(b.armNear[2])],
    armFar: [m(b.armFar[0]), m(b.armFar[1]), m(b.armFar[2])],
    legNear: [m(b.legNear[0]), m(b.legNear[1]), ...(b.legNear[2] ? [m(b.legNear[2])] : [])] as Body['legNear'],
    legFar: [m(b.legFar[0]), m(b.legFar[1]), ...(b.legFar[2] ? [m(b.legFar[2])] : [])] as Body['legFar'],
  };
}

/** Борец в стойке лицом вправо, руки в захвате (ворот и рукав партнёра). */
const GRIP: Body = {
  head: [33, 22], neck: [35, 29], hip: [32, 54],
  armNear: [[36, 32], [44, 37], [52, 31]], armFar: [[35, 32], [42, 43], [50, 45]],
  legNear: [[38, 70], [36, 86], [42, 87]], legFar: [[27, 69], [23, 85], [29, 86]],
};
/** Борьба за захват: руки выше, на уровне рук партнёра. */
const GRIP_HANDS: Body = { ...GRIP, armNear: [[36, 32], [45, 30], [53, 26]], armFar: [[35, 32], [44, 38], [53, 36]] };
/** Сверху в партере (раскрашивается) и снизу на спине (партнёр). */
const TOP: Body = {
  head: [48, 42], neck: [50, 49], hip: [64, 58],
  armNear: [[51, 52], [44, 60], [37, 67]], armFar: [[50, 52], [41, 62], [31, 71]],
  legNear: [[58, 73], [72, 76], [74, 72]], legFar: [[70, 72], [82, 74], [84, 70]],
};
const BOTTOM: Body = {
  head: [20, 76], neck: [27, 76], hip: [52, 79],
  armNear: [[30, 76], [36, 69], [43, 66]], armFar: [[29, 77], [35, 84], [42, 86]],
  legNear: [[66, 72], [79, 80], [83, 77]], legFar: [[66, 82], [80, 86], [84, 84]],
};
/** Верх тела на канате: обе руки держат канат над головой. */
const ROPE: Pick<Body, 'head' | 'neck' | 'hip' | 'armNear' | 'armFar'> = {
  head: [43, 30], neck: [44, 37], hip: [45, 60],
  armNear: [[46, 40], [53, 31], [50, 18]], armFar: [[45, 40], [53, 40], [50, 30]],
};
const floor = 'M8 90h84';

const treadmill = ['M18 84h62', 'M76 84L82 48', 'M82 48h-9'];

const POSES: Record<string, Pose> = {
  run: {
    head: [58, 16], neck: [56, 24], hip: [49, 49],
    armNear: [[55, 28], [64, 36], [69, 28]], armFar: [[54, 28], [45, 37], [39, 45]],
    legNear: [[62, 60], [59, 77], [66, 79]], legFar: [[42, 63], [31, 69], [28, 63]],
  },
  sprint: {
    head: [64, 19], neck: [60, 26], hip: [47, 47],
    armNear: [[58, 29], [68, 33], [75, 25]], armFar: [[57, 29], [47, 37], [39, 44]],
    legNear: [[63, 54], [60, 72], [67, 75]], legFar: [[39, 60], [27, 55], [23, 49]],
    props: ['M12 30h12', 'M8 40h14', 'M12 50h10'],
  },
  'treadmill-run': {
    head: [52, 15], neck: [50, 23], hip: [45, 47],
    armNear: [[49, 27], [58, 34], [63, 27]], armFar: [[48, 27], [40, 35], [35, 42]],
    legNear: [[56, 58], [54, 74], [60, 77]], legFar: [[39, 60], [29, 66], [27, 61]],
    props: treadmill,
  },
  'treadmill-walk': {
    head: [50, 14], neck: [50, 22], hip: [49, 47],
    armNear: [[50, 26], [55, 37], [60, 44]], armFar: [[49, 26], [45, 37], [42, 46]],
    legNear: [[55, 63], [60, 80], [65, 81]], legFar: [[46, 64], [40, 80], [44, 81]],
    props: treadmill,
  },
  bike: {
    head: [61, 16], neck: [55, 23], hip: [40, 43],
    armNear: [[54, 26], [62, 33], [70, 38]], armFar: [[53, 26], [61, 33], [68, 39]],
    legNear: [[56, 51], [54, 69], [59, 71]], legFar: [[51, 57], [62, 72], [66, 73]],
    props: ['M28 88h56', 'M40 46l6 30', 'M46 76l20-4', 'M70 38l-4 34', 'M66 37h8', 'M34 44h12'],
    wheels: [[66, 72, 9]],
  },
  airbike: {
    head: [57, 16], neck: [52, 23], hip: [38, 44],
    armNear: [[51, 26], [56, 32], [62, 30]], armFar: [[50, 26], [57, 35], [64, 40]],
    legNear: [[52, 52], [52, 69], [57, 71]], legFar: [[48, 58], [60, 71], [64, 72]],
    props: ['M24 88h62', 'M38 47l6 30', 'M44 77l22-6', 'M62 30l6 40', 'M64 40l3 30', 'M32 45h12'],
    wheels: [[70, 66, 14]],
  },
  rower: {
    head: [29, 41], neck: [32, 49], hip: [40, 72],
    armNear: [[33, 52], [27, 62], [42, 61]], armFar: [[32, 52], [28, 64], [44, 63]],
    legNear: [[56, 58], [70, 74], [73, 70]], legFar: [[55, 60], [69, 76], [72, 72]],
    props: ['M14 82h72', 'M34 77h12', 'M44 61l30 3', 'M70 82l6-12'],
    wheels: [[80, 66, 8]],
  },
  'jump-rope': {
    head: [50, 18], neck: [50, 26], hip: [50, 50],
    armNear: [[51, 29], [60, 38], [64, 50]], armFar: [[49, 29], [40, 38], [36, 50]],
    legNear: [[54, 63], [54, 76], [59, 78]], legFar: [[46, 63], [46, 76], [51, 78]],
    props: ['M30 88h40'],
    front: ['M36 50C22 34 30 4 50 5C70 4 78 34 64 50'],
  },
  elliptical: {
    head: [50, 14], neck: [50, 22], hip: [49, 46],
    armNear: [[51, 26], [58, 32], [63, 36]], armFar: [[49, 26], [43, 33], [40, 39]],
    legNear: [[57, 60], [61, 75], [67, 76]], legFar: [[44, 61], [41, 77], [47, 78]],
    props: ['M22 86h60', 'M30 86l8-6h30l8 6', 'M63 36l4 44', 'M40 39l-4 41', 'M74 86V50'],
  },
  stepper: {
    head: [46, 13], neck: [47, 21], hip: [47, 45],
    armNear: [[48, 25], [55, 33], [53, 42]], armFar: [[46, 25], [40, 34], [42, 42]],
    legNear: [[58, 53], [59, 64], [64, 64]], legFar: [[48, 62], [43, 76], [48, 76]],
    props: ['M22 88H42V76H54V64H66V52H78V40H88'],
  },

  // ---------- Борьба: двое в захватах, бросок, партер, мост, канат ----------
  technique: { ...GRIP, partner: mirror(GRIP), thin: true, props: [floor] },
  'randori-standing': { ...GRIP, partner: mirror(GRIP), thin: true, props: [floor] },
  sparring: { ...GRIP, partner: mirror(GRIP), thin: true, props: [floor] },
  uchikomi: {
    ...GRIP,
    hip: [36, 54],
    legNear: [[44, 68], [46, 86], [52, 87]], legFar: [[30, 70], [26, 86], [32, 87]],
    partner: mirror(GRIP, 4), thin: true, props: [floor],
  },
  'grip-fight': { ...GRIP_HANDS, partner: mirror(GRIP_HANDS), thin: true, props: [floor] },
  nagekomi: {
    head: [42, 33], neck: [44, 40], hip: [37, 61],
    armNear: [[46, 43], [56, 39], [62, 33]], armFar: [[45, 43], [52, 50], [60, 48]],
    legNear: [[43, 75], [41, 88], [47, 89]], legFar: [[31, 75], [27, 88], [33, 89]],
    partner: {
      head: [76, 33], neck: [69, 30], hip: [46, 24],
      armNear: [[67, 30], [66, 38], [62, 42]], armFar: [[68, 31], [74, 39], [76, 45]],
      legNear: [[33, 16], [22, 10], [18, 13]], legFar: [[34, 26], [21, 24], [18, 28]],
    },
    thin: true, props: [floor],
  },
  'ne-waza-drill': { ...TOP, partner: BOTTOM, thin: true, props: [floor] },
  'randori-ground': { ...TOP, partner: BOTTOM, thin: true, props: [floor] },
  bridge: {
    head: [24, 82], neck: [29, 74], hip: [57, 58],
    armNear: [[32, 71], [40, 68], [47, 66]], armFar: [[31, 72], [39, 71], [46, 70]],
    legNear: [[70, 70], [76, 86], [82, 87]], legFar: [[66, 73], [71, 86], [77, 87]],
    props: [floor],
  },
  'rope-climb': { ...ROPE, legNear: [[54, 70], [50, 82], [56, 84]], legFar: [[40, 71], [50, 80]], props: ['M50 2V98'] },
  'rope-climb-nolegs': { ...ROPE, legNear: [[47, 76], [47, 91]], legFar: [[44, 76], [43, 91]], props: ['M50 2V98'] },
  'warmup-acrobatics': {
    head: [40, 72], neck: [44, 65], hip: [58, 56],
    armNear: [[46, 66], [42, 78], [38, 88]], armFar: [[45, 66], [49, 78], [52, 88]],
    legNear: [[52, 44], [63, 40], [67, 44]], legFar: [[57, 46], [67, 44], [71, 48]],
    props: [floor],
  },
};

export const PICTOGRAM_SLUGS: readonly string[] = Object.keys(POSES);

/** Есть ли пиктограмма у встроенного упражнения (lib:<слаг>). */
export function hasPictogram(exerciseId: string): boolean {
  return exerciseId.startsWith('lib:') && exerciseId.slice(4) in POSES;
}

const LEG: ReadonlySet<Muscle> = new Set(['quads', 'hamstrings', 'glutes', 'adductors']);
const SHIN: ReadonlySet<Muscle> = new Set(['calves']);
const UPPER_ARM: ReadonlySet<Muscle> = new Set(['biceps', 'triceps', 'delts', 'rearDelts']);
const FOREARM: ReadonlySet<Muscle> = new Set(['forearms']);
const TORSO: ReadonlySet<Muscle> = new Set(['abs', 'obliques', 'chest', 'lats', 'traps', 'lowerBack']);

function tone(set: ReadonlySet<Muscle>, primary: readonly Muscle[], secondary: readonly Muscle[]): string {
  if (primary.some((m) => set.has(m))) return 'pg-primary';
  if (secondary.some((m) => set.has(m))) return 'pg-secondary';
  return '';
}

const line = (a: P, b: P) => `M${a[0]} ${a[1]}L${b[0]} ${b[1]}`;

type Tones = Record<'leg' | 'shin' | 'upper' | 'fore' | 'torso', string>;

/** Одна фигура: дальние рука и нога, корпус с головой, ближние рука и нога. */
function Figure({ body, t, head }: { body: Body; t: Tones; head: number }) {
  const limb = (side: 'near' | 'far') => {
    const arm = side === 'near' ? body.armNear : body.armFar;
    const leg = side === 'near' ? body.legNear : body.legFar;
    return (
      <g className={side === 'far' ? 'pg-far' : 'pg-near'}>
        <path className={t.leg} d={line(body.hip, leg[0])} />
        <path className={t.shin} d={line(leg[0], leg[1])} />
        {leg[2] && <path className={t.shin} d={line(leg[1], leg[2])} strokeWidth={5} />}
        <path className={t.upper} d={line(arm[0], arm[1])} strokeWidth={6.5} />
        <path className={t.fore} d={line(arm[1], arm[2])} strokeWidth={5.5} />
      </g>
    );
  };
  return (
    <>
      {limb('far')}
      <g className="pg-near">
        <path className={t.torso} d={line(body.neck, body.hip)} strokeWidth={10} />
        <circle className="pg-head" cx={body.head[0]} cy={body.head[1]} r={head} />
      </g>
      {limb('near')}
    </>
  );
}

export function Pictogram({ exerciseId, primary, secondary = [] }: { exerciseId: string; primary: readonly Muscle[]; secondary?: readonly Muscle[] }) {
  const pose = POSES[exerciseId.replace(/^lib:/, '')];
  if (!pose) return null;
  const t = {
    leg: tone(LEG, primary, secondary),
    shin: tone(SHIN, primary, secondary),
    upper: tone(UPPER_ARM, primary, secondary),
    fore: tone(FOREARM, primary, secondary),
    torso: tone(TORSO, primary, secondary),
  };
  const plain: Tones = { leg: '', shin: '', upper: '', fore: '', torso: '' };
  const head = pose.thin ? 5.5 : 6.5;
  return (
    <svg className={pose.thin ? 'pictogram pg-thin' : 'pictogram'} viewBox="0 0 100 100" aria-hidden="true">
      <g className="pg-props">
        {pose.props?.map((d) => <path key={d} d={d} />)}
        {pose.wheels?.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
      </g>
      {pose.partner && (
        <g className="pg-partner">
          <Figure body={pose.partner} t={plain} head={head} />
        </g>
      )}
      <Figure body={pose} t={t} head={head} />
      {pose.front && (
        <g className="pg-props pg-front">
          {pose.front.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      )}
    </svg>
  );
}
