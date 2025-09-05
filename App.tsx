// AiQo — React Native (Expo) single-file prototype (Rollup-safe, fixed brackets)
// -----------------------------------------------------------------------------
// Paste this file as App.tsx inside a fresh Expo (TypeScript) project.
// Eliminates common syntax mistakes (mismatched braces/JSX tags), avoids
// Rollup/jsDelivr bundling errors by not statically importing native modules.
//
// Quick start:
//   npx create-expo-app aiqo -t blank-typescript
//   cd aiqo
//   npx expo start -c
//
// Optional (device builds only):
//   npx expo install @react-native-async-storage/async-storage
// The app auto-detects AsyncStorage at runtime with a dynamic require.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ------------------------------
// Storage shim (Rollup-safe)
// ------------------------------
// Priority:
//   1) @react-native-async-storage/async-storage, if installed (runtime-detected)
//   2) window.localStorage on web
//   3) in-memory Map fallback

type StorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const KVStorage: StorageLike = (() => {
  try {
    // Avoid static import so Rollup/JSDelivr won't fetch the native module
    const req: any = (globalThis as any).require ?? eval('require');
    const mod = req('@react-native-async-storage/async-storage');
    const native = (mod?.default ?? mod) as StorageLike | undefined;
    if (native && typeof native.getItem === 'function') return native;
  } catch (_) {
    // ignore — module isn't installed or not resolvable in web
  }

  try {
    const ls = (globalThis as any).localStorage as any;
    if (ls && typeof ls.getItem === 'function') {
      return {
        getItem: async (k) => ls.getItem(k),
        setItem: async (k, v) => {
          ls.setItem(k, v);
        },
        removeItem: async (k) => {
          ls.removeItem(k);
        },
      } satisfies StorageLike;
    }
  } catch (_) {
    // ignore
  }

  const mem = new Map<string, string>();
  return {
    getItem: async (k) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: async (k, v) => void mem.set(k, v),
    removeItem: async (k) => void mem.delete(k),
  } satisfies StorageLike;
})();

// ------------------------------
// Types
// ------------------------------

type Gender = 'male' | 'female';

type Goal = 'cut' | 'bulk' | 'maintain';

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';

type DietaryPref = {
  halal?: boolean;
  vegan?: boolean;
  vegetarian?: boolean;
  glutenFree?: boolean;
  lactoseFree?: boolean;
};

type OnboardingData = {
  gender: Gender;
  age: number; // years
  height: number; // cm
  weight: number; // kg
  goal: Goal;
  activity: ActivityLevel;
  mealTimes: { breakfast: string; lunch: string; dinner: string };
  sleepTime: { start: string; end: string };
  diet: DietaryPref;
};

type Meal = {
  id: string;
  title: string;
  kcal: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  timeMins: number;
  ingredients: string[];
  steps: string[];
  tags?: string[]; // e.g., halal, vegan
};

// ------------------------------
// Theme (dark to showcase contrast; easy to flip to light)
// ------------------------------

const COLORS = {
  bg: '#0B0B0E',
  card: '#15151B',
  text: '#F7F7FA',
  subtext: '#C9CAD3',
  accent: '#FFD400', // حمودي يحب الأصفر
  good: '#32D74B',
  warn: '#FF9F0A',
  danger: '#FF453A',
  line: '#26262F',
};

const P = 16;
const TODAY_KEY = () => new Date().toISOString().slice(0, 10);

// ------------------------------
// Utils & Calculators
// ------------------------------

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function calcBMR(gender: Gender, weightKg: number, heightCm: number, ageYears: number) {
  return gender === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
}

function activityMultiplier(level: ActivityLevel) {
  switch (level) {
    case 'sedentary':
      return 1.2;
    case 'light':
      return 1.375;
    case 'moderate':
      return 1.55;
    case 'active':
      return 1.725;
    case 'athlete':
      return 1.9;
  }
}

function tdeeFrom(onb: OnboardingData) {
  const bmr = calcBMR(onb.gender, onb.weight, onb.height, onb.age);
  const tdee = bmr * activityMultiplier(onb.activity);
  if (onb.goal === 'cut') return Math.round(tdee - 400);
  if (onb.goal === 'bulk') return Math.round(tdee + 300);
  return Math.round(tdee);
}

function waterTargetMl(onb: OnboardingData) {
  const base = onb.weight * 35; // ml
  const bump = { sedentary: 0, light: 200, moderate: 400, active: 600, athlete: 800 }[onb.activity];
  return Math.round(base + bump);
}

function formatTime(mins: number) {
  if (mins < 60) return `${mins} د`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} س ${m} د`;
}

function id() {
  return Math.random().toString(36).slice(2);
}

function pick<T>(arr: T[], n: number) {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

// ------------------------------
// Simple data models
// ------------------------------

const pantry = {
  proteins: ['صدر دجاج', 'بيض', 'تونة', 'حمص', 'عدس', 'لبن يوناني'],
  carbs: ['رز بسمتي', 'شوفان', 'خبز عربي أسمر', 'بطاطا', 'كينوا', 'تمر'],
  fats: ['أفوكادو', 'زيت زيتون', 'مكسرات', 'طحينة'],
  veggies: ['خس', 'سبانخ', 'طماطة', 'خيار', 'فلفل', 'بروكلي', 'جزر'],
};

function buildMeal(title: string, kcal: number, p: number, c: number, f: number): Meal {
  const prot = pick(pantry.proteins, 1)[0];
  const carb = pick(pantry.carbs, 1)[0];
  const fat = pick(pantry.fats, 1)[0];
  const vegs = pick(pantry.veggies, 2);
  return {
    id: id(),
    title,
    kcal,
    protein: p,
    carbs: c,
    fat: f,
    timeMins: 15 + Math.floor(Math.random() * 15),
    ingredients: [prot, carb, fat, ...vegs],
    steps: [
      `حضّر المكوّنات: ${prot} + ${carb} + ${fat} + ${vegs.join('، ')}`,
      'اطبخ البروتين على نار متوسطة 8–10 د',
      'اسلق/سخّن الكارب حسب التعليمات',
      'رتّب الصحن وأضف الخضار والصلصة',
    ],
    tags: ['halal'],
  };
}

function generateMealsForDay(tdee: number, goal: Goal): { meals: Meal[]; snacks: Meal[] } {
  const dayKcal = tdee;
  const mainKcal = Math.round(dayKcal * 0.75);
  const snackKcal = dayKcal - mainKcal;
  const mealK = Math.round(mainKcal / 3);
  const snackK = Math.round(snackKcal / 2);
  const meals: Meal[] = [
    buildMeal('فطور متوازن', mealK, 30, 50, 15),
    buildMeal('غداء مُرضي', mealK, 35, 55, 18),
    buildMeal('عشاء خفيف', mealK, 28, 45, 12),
  ];
  const snacks: Meal[] = [
    buildMeal('سناك 1', snackK, 12, 15, 8),
    buildMeal('سناك 2', snackK, 10, 18, 6),
  ];
  return { meals, snacks };
}

// ------------------------------
// Storage keys
// ------------------------------

const K = {
  onboarding: 'aiqo_onboarding_v2',
  day: (d: string) => `aiqo_day_${d}`,
  streak: 'aiqo_streak_v2',
  journal: (d: string) => `aiqo_journal_${d}`,
};

// ------------------------------
// Day model
// ------------------------------

type DayData = {
  date: string;
  sleepPct: number;
  sittingHrs: number;
  steps: number;
  stepsGoal: number;
  waterMl: number;
  waterTarget: number;
  kcalConsumed: number;
  kcalTarget: number;
  meals: Meal[];
  snacks: Meal[];
  prayerDone: boolean;
  workoutDone: boolean;
};

function initDay(onb: OnboardingData): DayData {
  const tdee = tdeeFrom(onb);
  const { meals, snacks } = generateMealsForDay(tdee, onb.goal);
  return {
    date: TODAY_KEY(),
    sleepPct: 70,
    sittingHrs: 7,
    steps: 2500,
    stepsGoal: onb.activity === 'sedentary' ? 6000 : 9000,
    waterMl: 0,
    waterTarget: waterTargetMl(onb),
    kcalConsumed: 0,
    kcalTarget: tdee,
    meals,
    snacks,
    prayerDone: false,
    workoutDone: false,
  };
}

// ------------------------------
// Nudges & Halo
// ------------------------------

function pickNudge(day: DayData): string {
  const leftKcal = day.kcalTarget - day.kcalConsumed;
  const waterPct = day.waterMl / Math.max(1, day.waterTarget);
  if (waterPct < 0.5) return 'كأس مي الآن ينعش جسمك 💧';
  if (day.steps < day.stepsGoal / 2) return 'امشِ 10 دقايق — مزاجك يشكرك 🚶‍♂️';
  if (leftKcal > 300) return 'سناك بروتين خفيف قبل التمرين 💪';
  if (!day.prayerDone) return 'ركعتين خفيفة تنوّر يومك 🕊️';
  if (day.sittingHrs > 8) return 'قف دقيقة وتمدد — ظهرِك أهم 🙆‍♂️';
  return 'استمر… تقدمك واضح اليوم ✨';
}

function haloScore(day: DayData) {
  const water = clamp((day.waterMl / Math.max(1, day.waterTarget)) * 100, 0, 100);
  const sleep = clamp(day.sleepPct, 0, 100);
  const steps = clamp((day.steps / Math.max(1, day.stepsGoal)) * 100, 0, 100);
  const faith = day.prayerDone ? 100 : 30;
  const sport = day.workoutDone ? 100 : 40;
  return Math.round((water + sleep + steps + faith + sport) / 5);
}

// ------------------------------
// Root App
// ------------------------------

type Tab = 'Home' | 'Gym' | 'Kitchen' | 'Captain';

export default function App() {
  const [tab, setTab] = useState<Tab>('Home');
  const [onb, setOnb] = useState<OnboardingData | null>(null);
  const [day, setDay] = useState<DayData | null>(null);
  const [streak, setStreak] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await KVStorage.getItem(K.onboarding);
      if (!saved) {
        const defaults: OnboardingData = {
          gender: 'male',
          age: 24,
          height: 175,
          weight: 90,
          goal: 'cut',
          activity: 'light',
          mealTimes: { breakfast: '08:30', lunch: '14:00', dinner: '20:00' },
          sleepTime: { start: '00:00', end: '07:00' },
          diet: { halal: true },
        };
        setOnb(defaults);
        setDay(initDay(defaults));
        setShowOnboarding(true);
      } else {
        const parsed = JSON.parse(saved) as OnboardingData;
        setOnb(parsed);
        const dk = K.day(TODAY_KEY());
        const savedDay = await KVStorage.getItem(dk);
        setDay(savedDay ? (JSON.parse(savedDay) as DayData) : initDay(parsed));
        const s = await KVStorage.getItem(K.streak);
        setStreak(s ? Number(s) : 0);
      }
    })();
  }, []);

  useEffect(() => {
    if (day) KVStorage.setItem(K.day(day.date), JSON.stringify(day));
  }, [day]);

  const completeDay = async () => {
    if (!day) return;
    const ok = day.waterMl >= day.waterTarget * 0.9 && day.steps >= day.stepsGoal * 0.9;
    const prevKey = K.day(new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10));
    const hadPrev = await KVStorage.getItem(prevKey);
    if (ok) {
      setStreak((s) => {
        const next = hadPrev ? s + 1 : 1;
        KVStorage.setItem(K.streak, String(next));
        return next;
      });
      Alert.alert('🔥 سجّل الإنجاز', 'اليوم مكتمل — نقاط نور بجيبك!');
    } else {
      Alert.alert('لسّه نكمل باچر', 'اشرب مي وخطوة صغيرة ونقفل اليوم ✨');
    }
  };

  if (!onb || !day) {
    return (
      <SafeAreaView style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}> 
        <StatusBar barStyle="light-content" />
        <Text style={styles.title}>AiQo</Text>
        <Text style={{ color: COLORS.subtext, marginTop: 8 }}>يتم التحميل…</Text>
      </SafeAreaView>
    );
  }

  const hScore = useMemo(() => haloScore(day), [day]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>AiQo</Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: COLORS.subtext, fontSize: 12 }}>طاقة الهالة</Text>
          <Text style={{ color: COLORS.accent, fontSize: 20, fontWeight: '700' }}>{hScore}%</Text>
        </View>
      </View>

      {tab === 'Home' && (
        <HomeScreen
          day={day}
          onDayChange={setDay}
          onRegenerate={() => setDay((d) => (d ? { ...d, ...generateMealsForDay(tdeeFrom(onb), onb.goal) } : d))}
          onCompleteDay={completeDay}
          streak={streak}
        />
      )}
      {tab === 'Gym' && <GymScreen day={day} onDayChange={setDay} />}
      {tab === 'Kitchen' && (
        <KitchenScreen
          day={day}
          onDayChange={setDay}
          tdee={tdeeFrom(onb)}
          goal={onb.goal}
          onRegenerate={() => setDay((d) => (d ? { ...d, ...generateMealsForDay(tdeeFrom(onb), onb.goal) } : d))}
        />
      )}
      {tab === 'Captain' && <CaptainScreen day={day} onDayChange={setDay} />}

      <BottomNav tab={tab} setTab={setTab} />

      <OnboardingModal
        visible={showOnboarding}
        onClose={async (data) => {
          const merged = data ?? onb;
          setOnb(merged);
          await KVStorage.setItem(K.onboarding, JSON.stringify(merged));
          setDay(initDay(merged));
          setShowOnboarding(false);
        }}
        initial={onb}
      />
    </SafeAreaView>
  );
}

// ------------------------------
// Screens
// ------------------------------

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Row({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

function HomeScreen({
  day,
  onDayChange,
  onRegenerate,
  onCompleteDay,
  streak,
}: {
  day: DayData;
  onDayChange: (d: DayData) => void;
  onRegenerate: () => void;
  onCompleteDay: () => void;
  streak: number;
}) {
  const waterPct = Math.min(100, Math.round((day.waterMl / Math.max(1, day.waterTarget)) * 100));
  const leftKcal = Math.max(0, day.kcalTarget - day.kcalConsumed);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: P }}>
      {/* Quick metrics */}
      <Row style={{ gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>النوم</Text>
          <Text style={styles.big}>{day.sleepPct}%</Text>
          <Text style={styles.dim}>حافظ على روتين نوم ثابت</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>السعرات</Text>
          <Text style={styles.big}>{day.kcalConsumed} / {day.kcalTarget}</Text>
          <Text style={styles.dim}>متبقّي: {leftKcal}</Text>
        </Card>
      </Row>

      <Row style={{ gap: 12, marginTop: 12 }}>
        <Card style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>الجلوس</Text>
          <Text style={styles.big}>{day.sittingHrs} س</Text>
          <Text style={styles.dim}>قُم يتمدّد كل ساعة</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>الخطوات</Text>
          <Text style={styles.big}>{day.steps} / {day.stepsGoal}</Text>
          <Row style={{ gap: 8, marginTop: 8 }}>
            <SmallBtn label="+500" onPress={() => onDayChange({ ...day, steps: day.steps + 500 })} />
            <SmallBtn label="+1k" onPress={() => onDayChange({ ...day, steps: day.steps + 1000 })} />
          </Row>
        </Card>
      </Row>

      {/* Water */}
      <Card style={{ marginTop: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.cardTitle}>الماء</Text>
          <Text style={[styles.cardTitle, { color: COLORS.accent }]}>{waterPct}%</Text>
        </Row>
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={styles.big}>{day.waterMl} / {day.waterTarget} مل</Text>
          <Row style={{ gap: 8 }}>
            <SmallBtn label="+250ml" onPress={() => onDayChange({ ...day, waterMl: day.waterMl + 250 })} />
            <SmallBtn label="+500ml" onPress={() => onDayChange({ ...day, waterMl: day.waterMl + 500 })} />
            <SmallBtn label="تصفير" onPress={() => onDayChange({ ...day, waterMl: 0 })} />
          </Row>
        </Row>
      </Card>

      {/* Meals today */}
      <Card style={{ marginTop: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.cardTitle}>وجبات اليوم</Text>
          <SmallBtn label="إعادة إنشاء" onPress={onRegenerate} />
        </Row>
        {[...day.meals, ...day.snacks].map((m) => (
          <Row key={m.id} style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: COLORS.text, fontWeight: '600' }}>{m.title}</Text>
              <Text style={styles.dim}>{m.kcal} kcal · P{m.protein} C{m.carbs} F{m.fat} · {formatTime(m.timeMins)}</Text>
            </View>
            <SmallBtn label="أكلت" onPress={() => onDayChange({ ...day, kcalConsumed: day.kcalConsumed + m.kcal })} />
          </Row>
        ))}
      </Card>

      {/* Streak + gentle notifications */}
      <Row style={{ gap: 12, marginTop: 12 }}>
        <Card style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>السلسلة اليومية</Text>
          <Text style={styles.big}>{streak} يوم</Text>
          <Text style={styles.dim}>لا تكسر السلسلة 🔗</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>تلميح اليوم</Text>
          <Text style={{ color: COLORS.subtext, marginTop: 8 }}>{pickNudge(day)}</Text>
        </Card>
      </Row>

      <TouchableOpacity style={styles.primaryBtn} onPress={onCompleteDay}>
        <Text style={styles.primaryBtnText}>قفل اليوم وحساب النقاط</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function GymScreen({ day, onDayChange }: { day: DayData; onDayChange: (d: DayData) => void }) {
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState(10);
  const [rest, setRest] = useState(60);
  const [timer, setTimer] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRest = () => {
    if (intervalRef.current) clearInterval(intervalRef.current as any);
    setTimer(rest);
    intervalRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current as any);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const saveWorkout = () => {
    onDayChange({ ...day, workoutDone: true });
    Alert.alert('تم', 'أحسنت! تمرينك اليوم محسوب ✅');
  };

  const doBreath = () => {
    Alert.alert('تنفّس 4-4-4-4', 'خذ شهيق 4 ثواني، احبس 4، زفير 4، احبس 4. كرر 5 مرات ✨');
  };

  const syncHealth = () => {
    if (Platform.OS === 'ios') Alert.alert('HealthKit', 'المزامنة تحتاج HealthKit (placeholder).');
    else Alert.alert('Health Connect', 'المزامنة تحتاج Health Connect/Google Fit (placeholder).');
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: P }}>
      <Card>
        <Text style={styles.cardTitle}>خطة تكيفية</Text>
        <Text style={{ color: COLORS.subtext, marginTop: 6 }}>مستوى: متوسط · معدات: وزن جسم/دمبل</Text>
        <Row style={{ gap: 12, marginTop: 12, justifyContent: 'space-between' }}>
          <Counter label="المجاميع" value={sets} setValue={setSets} />
          <Counter label="التكرارات" value={reps} setValue={setReps} />
          <Counter label="راحة (ث)" value={rest} setValue={setRest} step={15} />
        </Row>
        <Row style={{ gap: 8, marginTop: 12 }}>
          <SmallBtn label={timer ? `الراحة: ${timer}` : 'ابدأ الراحة'} onPress={startRest} />
          <SmallBtn label="حفظ التمرين" onPress={saveWorkout} />
          <SmallBtn label="مزامنة النشاط" onPress={syncHealth} />
        </Row>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.cardTitle}>تمارين اليوم</Text>
        {['سكوات وزن جسم', 'ضغط صدر دمبل', 'سحب ظهر', 'بلانك 45 ثانية'].map((t, i) => (
          <Row key={i} style={{ justifyContent: 'space-between', marginTop: 12 }}>
            <Text style={{ color: COLORS.text }}>{t}</Text>
            <Text style={styles.dim}>{sets}x{reps}</Text>
          </Row>
        ))}
        <Row style={{ gap: 8, marginTop: 12 }}>
          <SmallBtn label="تنفّس سريع" onPress={doBreath} />
          <SmallBtn label="أكملت" onPress={saveWorkout} />
        </Row>
      </Card>
    </ScrollView>
  );
}

function KitchenScreen({
  day,
  onDayChange,
  tdee,
  goal,
  onRegenerate,
}: {
  day: DayData;
  onDayChange: (d: DayData) => void;
  tdee: number;
  goal: Goal;
  onRegenerate: () => void;
}) {
  const [active, setActive] = useState<'meals' | 'filters'>('meals');
  const [filters, setFilters] = useState<DietaryPref>({ halal: true });
  const [timer, setTimer] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCook = (m: Meal) => {
    if (timerRef.current) clearInterval(timerRef.current as any);
    setTimer(m.timeMins * 60);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current as any);
          Alert.alert('بالهناء', 'خلصت الوجبة!');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: P }}>
      <Card>
        <Row style={{ gap: 8 }}>
          <TabPill active={active === 'meals'} onPress={() => setActive('meals')} label="الوجبات" />
          <TabPill active={active === 'filters'} onPress={() => setActive('filters')} label="الفلاتر" />
          <View style={{ flex: 1 }} />
          <SmallBtn label="تبديل الخطة" onPress={onRegenerate} />
        </Row>
        <Text style={{ color: COLORS.subtext, marginTop: 8 }}>هدف اليوم: {tdee} kcal · {goal === 'cut' ? 'تنشيف' : goal === 'bulk' ? 'زيادة' : 'ثبات'}</Text>
      </Card>

      {active === 'filters' && (
        <Card style={{ marginTop: 12 }}>
          <Text style={styles.cardTitle}>الحميات والحساسيات</Text>
          <Row style={{ flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <ToggleChip label="حلال" value={!!filters.halal} onChange={(v) => setFilters({ ...filters, halal: v })} />
            <ToggleChip label="نباتي" value={!!filters.vegan} onChange={(v) => setFilters({ ...filters, vegan: v })} />
            <ToggleChip label="نباتي-لاكتو/أوفو" value={!!filters.vegetarian} onChange={(v) => setFilters({ ...filters, vegetarian: v })} />
            <ToggleChip label="خالٍ من الغلوتين" value={!!filters.glutenFree} onChange={(v) => setFilters({ ...filters, glutenFree: v })} />
            <ToggleChip label="بدون لاكتوز" value={!!filters.lactoseFree} onChange={(v) => setFilters({ ...filters, lactoseFree: v })} />
          </Row>
        </Card>
      )}

      {active === 'meals' && (
        <Card style={{ marginTop: 12 }}>
          <Text style={styles.cardTitle}>٣ وجبات + سناكات</Text>
          {[...day.meals, ...day.snacks].map((m) => (
            <View key={m.id} style={{ borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 12, marginTop: 12 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: COLORS.text, fontWeight: '700' }}>{m.title}</Text>
                  <Text style={styles.dim}>{m.kcal} kcal · P{m.protein} C{m.carbs} F{m.fat} · {formatTime(m.timeMins)}</Text>
                  <Text style={{ color: COLORS.subtext, marginTop: 6 }}>مكوّنات: {m.ingredients.join('، ')}</Text>
                </View>
                <SmallBtn label="ابدأ الطبخ" onPress={() => startCook(m)} />
              </Row>
              {m.steps.map((s, i) => (
                <Text key={i} style={[styles.dim, { marginTop: 6 }]}>• {s}</Text>
              ))}
            </View>
          ))}
          {!!timer && (
            <Row style={{ gap: 8, marginTop: 12 }}>
              <Text style={{ color: COLORS.accent }}>المؤقّت: {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</Text>
              <SmallBtn label="إيقاف" onPress={() => setTimer(0)} />
            </Row>
          )}
        </Card>
      )}
    </ScrollView>
  );
}

function CaptainScreen({ day, onDayChange }: { day: DayData; onDayChange: (d: DayData) => void }) {
  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [note, setNote] = useState('');
  const [tip, setTip] = useState(pickNudge(day));
  const [msg, setMsg] = useState('ها حمودي! مستعد نطير خطوة صغيرة اليوم؟');

  const saveJournal = async () => {
    const key = K.journal(TODAY_KEY());
    await KVStorage.setItem(key, JSON.stringify({ mood, note }));
    Alert.alert('تم الحفظ', 'يومياتك محفوظة.');
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: P }}>
      <Card>
        <Text style={styles.cardTitle}>الكابتن حمّودي</Text>
        <Text style={{ color: COLORS.subtext, marginTop: 6 }}>{msg}</Text>
        <Row style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <SmallBtn label="نصيحة ذكية" onPress={() => setTip(pickNudge(day))} />
          <SmallBtn label={day.prayerDone ? 'تمت الصلاة' : 'ذكّرني بالصلاة'} onPress={() => onDayChange({ ...day, prayerDone: !day.prayerDone })} />
          <SmallBtn label="كوب مي الآن" onPress={() => onDayChange({ ...day, waterMl: day.waterMl + 250 })} />
          <SmallBtn label="مشوار 10 د" onPress={() => onDayChange({ ...day, steps: day.steps + 1000 })} />
        </Row>
        <Card style={{ marginTop: 12 }}>
          <Text style={{ color: COLORS.text, fontWeight: '700' }}>توصية اليوم:</Text>
          <Text style={{ color: COLORS.subtext, marginTop: 6 }}>{tip}</Text>
        </Card>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={styles.cardTitle}>فحص المزاج السريع</Text>
        <Row style={{ gap: 8, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((v) => (
            <Pressable key={v} onPress={() => setMood(v as any)} style={[styles.moodDot, mood === v && { borderColor: COLORS.accent, borderWidth: 2 }]}> 
              <Text style={{ color: COLORS.text }}>{v}</Text>
            </Pressable>
          ))}
        </Row>
        <TextInput
          placeholder="دوّن شعورك بجملة بسيطة…"
          placeholderTextColor={COLORS.subtext}
          value={note}
          onChangeText={setNote}
          style={styles.input}
          multiline
        />
        <Row style={{ gap: 8 }}>
          <SmallBtn label="حفظ اليوميات" onPress={saveJournal} />
          <SmallBtn label="ذكّرني بالشعار" onPress={() => setMsg('إني معي ربي سيهدينِ — ولسوف يعطيك ربك فترضى 💛')} />
        </Row>
      </Card>
    </ScrollView>
  );
}

// ------------------------------
// UI primitives
// ------------------------------

function SmallBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.smallBtn}>
      <Text style={styles.smallBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Counter({ label, value, setValue, step = 1 }: { label: string; value: number; setValue: (n: number) => void; step?: number }) {
  return (
    <View style={styles.counter}>
      <Text style={styles.dim}>{label}</Text>
      <Row style={{ gap: 6, marginTop: 6 }}>
        <TouchableOpacity onPress={() => setValue(Math.max(0, value - step))} style={styles.counterBtn}><Text style={styles.counterBtnText}>-</Text></TouchableOpacity>
        <Text style={{ color: COLORS.text, fontSize: 18, width: 40, textAlign: 'center' }}>{value}</Text>
        <TouchableOpacity onPress={() => setValue(value + step)} style={styles.counterBtn}><Text style={styles.counterBtnText}>+</Text></TouchableOpacity>
      </Row>
    </View>
  );
}

function TabPill({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pill, active && { backgroundColor: COLORS.accent }]}>
      <Text style={[styles.pillText, active && { color: '#000' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ToggleChip({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity onPress={() => onChange(!value)} style={[styles.chip, value && { backgroundColor: COLORS.accent }]}>
      <Text style={[styles.chipText, value && { color: '#000' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { key: Tab; label: string }[] = [
    { key: 'Home', label: 'الرئيسية' },
    { key: 'Gym', label: 'الصالة' },
    { key: 'Kitchen', label: 'المطبخ' },
    { key: 'Captain', label: 'الكابتن' },
  ];
  return (
    <View style={styles.bottomNav}>
      {items.map((it) => (
        <TouchableOpacity key={it.key} style={[styles.navItem, tab === it.key && styles.navItemActive]} onPress={() => setTab(it.key)}>
          <Text style={[styles.navText, tab === it.key && styles.navTextActive]}>{it.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ------------------------------
// Onboarding
// ------------------------------

function OnboardingModal({ visible, onClose, initial }: { visible: boolean; onClose: (data?: OnboardingData) => void; initial: OnboardingData }) {
  const [data, setData] = useState<OnboardingData>(initial);

  useEffect(() => setData(initial), [initial]);

  const save = () => onClose(data);

  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={styles.modalBg}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>جاهز ننطلق؟</Text>
          <Text style={{ color: COLORS.subtext, marginBottom: 12 }}>خلّينا نضبط أهدافك بسرعة.</Text>

          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <ToggleChip label="ذكر" value={data.gender === 'male'} onChange={(v) => v && setData({ ...data, gender: 'male' })} />
            <ToggleChip label="أنثى" value={data.gender === 'female'} onChange={(v) => v && setData({ ...data, gender: 'female' })} />
          </Row>

          <Row style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Field label="العمر" value={String(data.age)} onChange={(v) => setData({ ...data, age: Number(v) || 0 })} />
            <Field label="الطول (سم)" value={String(data.height)} onChange={(v) => setData({ ...data, height: Number(v) || 0 })} />
            <Field label="الوزن (كغ)" value={String(data.weight)} onChange={(v) => setData({ ...data, weight: Number(v) || 0 })} />
          </Row>

          <Row style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <ToggleChip label="تنشيف" value={data.goal === 'cut'} onChange={(v) => v && setData({ ...data, goal: 'cut' })} />
            <ToggleChip label="زيادة" value={data.goal === 'bulk'} onChange={(v) => v && setData({ ...data, goal: 'bulk' })} />
            <ToggleChip label="ثبات" value={data.goal === 'maintain'} onChange={(v) => v && setData({ ...data, goal: 'maintain' })} />
          </Row>

          <Row style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <ToggleChip label="خامل" value={data.activity === 'sedentary'} onChange={(v) => v && setData({ ...data, activity: 'sedentary' })} />
            <ToggleChip label="خفيف" value={data.activity === 'light'} onChange={(v) => v && setData({ ...data, activity: 'light' })} />
            <ToggleChip label="متوسط" value={data.activity === 'moderate'} onChange={(v) => v && setData({ ...data, activity: 'moderate' })} />
            <ToggleChip label="نشِط" value={data.activity === 'active'} onChange={(v) => v && setData({ ...data, activity: 'active' })} />
            <ToggleChip label="رياضي" value={data.activity === 'athlete'} onChange={(v) => v && setData({ ...data, activity: 'athlete' })} />
          </Row>

          <Row style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Field label="فطور" value={data.mealTimes.breakfast} onChange={(v) => setData({ ...data, mealTimes: { ...data.mealTimes, breakfast: v } })} />
            <Field label="غداء" value={data.mealTimes.lunch} onChange={(v) => setData({ ...data, mealTimes: { ...data.mealTimes, lunch: v } })} />
            <Field label="عشاء" value={data.mealTimes.dinner} onChange={(v) => setData({ ...data, mealTimes: { ...data.mealTimes, dinner: v } })} />
          </Row>

          <Row style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Field label="نوم من" value={data.sleepTime.start} onChange={(v) => setData({ ...data, sleepTime: { ...data.sleepTime, start: v } })} />
            <Field label="إلى" value={data.sleepTime.end} onChange={(v) => setData({ ...data, sleepTime: { ...data.sleepTime, end: v } })} />
          </Row>

          <Row style={{ gap: 8, marginTop: 16 }}>
            <TouchableOpacity onPress={() => onClose()} style={[styles.primaryBtn, { flex: 1 }]}>
              <Text style={styles.primaryBtnText}>إغلاق</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} style={[styles.primaryBtn, { flex: 1 }]}>
              <Text style={styles.primaryBtnText}>حفظ</Text>
            </TouchableOpacity>
          </Row>
        </View>
      </View>
    </Modal>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ width: '30%', minWidth: 120 }}>
      <Text style={styles.dim}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} style={styles.input} placeholderTextColor={COLORS.subtext} />
    </View>
  );
}

// ------------------------------
// Styles
// ------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: P,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomColor: COLORS.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800' },
  card: {
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 16,
    borderColor: COLORS.line,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: { color: COLORS.subtext, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6 },
  big: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginTop: 6 },
  dim: { color: COLORS.subtext },
  smallBtn: {
    backgroundColor: '#1E1E25',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderColor: COLORS.line,
    borderWidth: StyleSheet.hairlineWidth,
  },
  smallBtnText: { color: COLORS.text, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  bottomNav: {
    flexDirection: 'row',
    borderTopColor: COLORS.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: 8,
    backgroundColor: COLORS.card,
  },
  navItem: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  navItemActive: { borderTopColor: COLORS.accent, borderTopWidth: 3 },
  navText: { color: COLORS.subtext },
  navTextActive: { color: COLORS.text, fontWeight: '700' },
  pill: {
    backgroundColor: '#1E1E25',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderColor: COLORS.line,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: { color: COLORS.text, fontWeight: '600' },
  chip: {
    backgroundColor: '#1E1E25',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderColor: COLORS.line,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { color: COLORS.text },
  counter: { flex: 1, backgroundColor: '#1E1E25', borderRadius: 12, padding: 12 },
  counterBtn: { backgroundColor: COLORS.card, borderColor: COLORS.line, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  counterBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  input: {
    borderColor: COLORS.line,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    backgroundColor: '#1E1E25',
  },
  moodDot: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1E1E25', alignItems: 'center', justifyContent: 'center' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: COLORS.card, width: '100%', borderRadius: 16, padding: 16, borderColor: COLORS.line, borderWidth: StyleSheet.hairlineWidth },
});

// ------------------------------
// Lightweight runtime tests (DEV)
// ------------------------------

function approxEqual(a: number, b: number, tol = 1e-2) { return Math.abs(a - b) <= tol; }

if (__DEV__) {
  console.assert(approxEqual(calcBMR('male', 90, 175, 24), 1878.75), 'BMR male failed');
  console.assert(approxEqual(calcBMR('female', 60, 165, 30), 1320.25), 'BMR female failed');
  console.assert(clamp(5, 0, 10) === 5 && clamp(-1, 0, 10) === 0 && clamp(11, 0, 10) === 10, 'clamp failed');
  console.assert(activityMultiplier('light') === 1.375, 'activity multiplier failed');

  const o: OnboardingData = { gender: 'male', age: 24, height: 175, weight: 90, goal: 'cut', activity: 'light', mealTimes: { breakfast: '08:30', lunch: '14:00', dinner: '20:00' }, sleepTime: { start: '00:00', end: '07:00' }, diet: { halal: true } };
  const bmr = calcBMR(o.gender, o.weight, o.height, o.age);
  const tdeeExpected = Math.round(bmr * activityMultiplier(o.activity) - 400);
  console.assert(tdeeFrom(o) === tdeeExpected, 'tdeeFrom failed');
  console.assert(waterTargetMl(o) === 3350, 'waterTargetMl failed');
  console.assert(formatTime(45) === '45 د' && formatTime(125).includes('2 س'), 'formatTime failed');

  const gm = generateMealsForDay(2400, 'maintain');
  console.assert(gm.meals.length === 3 && gm.snacks.length === 2, 'meals/snacks count failed');
  const totalK = [...gm.meals, ...gm.snacks].reduce((s, m) => s + m.kcal, 0);
  console.assert(Math.abs(totalK - 2400) <= 60, 'total kcal approx failed');

  const base: DayData = { date: TODAY_KEY(), sleepPct: 50, sittingHrs: 10, steps: 1000, stepsGoal: 8000, waterMl: 0, waterTarget: 2000, kcalConsumed: 0, kcalTarget: 2000, meals: [], snacks: [], prayerDone: false, workoutDone: false };
  console.assert(haloScore({ ...base, waterMl: 2000, steps: 8000, prayerDone: true, workoutDone: true, sleepPct: 90 }) > haloScore(base), 'haloScore monotonicity failed');
  console.assert(pickNudge({ ...base, waterMl: 200, waterTarget: 2000 } as DayData).includes('مي'), 'nudge water failed');

  console.log('[AiQo fixed] All assertions passed ✅');
}

