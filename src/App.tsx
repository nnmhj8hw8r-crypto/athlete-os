import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { DashboardPage } from './features/dashboard/DashboardPage.tsx';
import { AiSummaryPage } from './features/more/AiSummaryPage.tsx';
import { BackupPage } from './features/more/BackupPage.tsx';
import { ChangelogPage } from './features/more/ChangelogPage.tsx';
import { DevPage } from './features/more/DevPage.tsx';
import { LicensesPage, PermissionsPage } from './features/more/InfoPages.tsx';
import { MorePage } from './features/more/MorePage.tsx';
import { SettingsPage } from './features/more/SettingsPage.tsx';
import { SourcesPage } from './features/more/SourcesPage.tsx';
import { SupplementsPage } from './features/more/SupplementsPage.tsx';
import { useMarkSeenOnFirstRun, WhatsNew } from './features/more/WhatsNew.tsx';
import { useSupplementReminders } from './features/more/useSupplementReminders.ts';
import { OnboardingPage, useFirstRun } from './features/onboarding/OnboardingPage.tsx';
import { useLevel } from './features/onboarding/useProfile.ts';
import { FULL_ONLY_PATHS } from './domain/profile.ts';
import { FoodsPage } from './features/nutrition/FoodsPage.tsx';
import { NutritionPage } from './features/nutrition/NutritionPage.tsx';
import { RecoveryPage } from './features/recovery/RecoveryPage.tsx';
import { SeasonPage } from './features/season/SeasonPage.tsx';
import { ExercisePage } from './features/training/ExercisePage.tsx';
import { ProgramPage } from './features/training/ProgramPage.tsx';
import { SessionPage } from './features/training/SessionPage.tsx';
import { TestPage } from './features/training/TestPage.tsx';
import { TrainingPage } from './features/training/TrainingPage.tsx';
import { FeedbackProvider } from './ui/feedback.tsx';
import { Icons } from './ui/icons.tsx';
import { href, useRoute, type Route } from './ui/router.ts';

const MAIN: { path: string; label: string; icon: ReactNode }[] = [
  { path: '/', label: 'Главная', icon: Icons.home },
  { path: '/nutrition', label: 'Питание', icon: Icons.food },
  { path: '/training', label: 'Тренировки', icon: Icons.training },
  { path: '/recovery', label: 'Восстановление', icon: Icons.recovery },
  { path: '/season', label: 'Сезон', icon: Icons.season },
];
const MORE = { path: '/more', label: 'Ещё', icon: Icons.more };

const PAGES: Record<string, (r: Route) => ReactNode> = {
  '/': () => <DashboardPage />,
  '/nutrition': (r) => <NutritionPage route={r} />,
  '/nutrition/foods': () => <FoodsPage />,
  '/training': (r) => <TrainingPage route={r} />,
  '/training/program': (r) => <ProgramPage route={r} />,
  '/training/session': (r) => <SessionPage route={r} />,
  '/training/exercise': (r) => <ExercisePage route={r} />,
  '/training/test': (r) => <TestPage route={r} />,
  '/recovery': (r) => <RecoveryPage route={r} />,
  '/season': (r) => <SeasonPage route={r} />,
  '/more': () => <MorePage />,
  '/more/supplements': () => <SupplementsPage />,
  '/more/sources': () => <SourcesPage />,
  '/more/backup': () => <BackupPage />,
  '/more/ai': () => <AiSummaryPage />,
  '/more/settings': () => <SettingsPage />,
  '/more/dev': () => <DevPage />,
  '/more/dev/changelog': () => <ChangelogPage />,
  '/more/permissions': () => <PermissionsPage />,
  '/more/licenses': () => <LicensesPage />,
};

function isActive(navPath: string, current: string) {
  return navPath === '/' ? current === '/' : current === navPath || current.startsWith(`${navPath}/`);
}

export function App() {
  const route = useRoute();
  const level = useLevel();
  const firstRun = useFirstRun();
  const main = MAIN.filter((n) => level === 'full' || !FULL_ONLY_PATHS.includes(n.path));
  const render = PAGES[route.path];
  useSupplementReminders();
  useMarkSeenOnFirstRun(firstRun === true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  // Первый запуск: пока не ясно, новый ли пользователь, ничего не показываем, чтобы не мигала главная.
  if (firstRun === undefined) return null;
  if (firstRun || route.path === '/welcome') {
    return (
      <FeedbackProvider>
        <OnboardingPage replay={!firstRun} />
      </FeedbackProvider>
    );
  }

  return (
    <FeedbackProvider>
      <div className="app">
        <WhatsNew />
        <nav className="nav" aria-label="Основные разделы">
          <span className="nav-brand">Personal Athlete OS</span>
          {/* На телефоне — плавающая «таблетка» с разделами и отдельная круглая кнопка «Ещё». */}
          <div
            className="nav-pill"
            style={{ '--nav-i': Math.max(0, main.findIndex((n) => isActive(n.path, route.path))), '--nav-n': main.length } as CSSProperties}
          >
            <span className={`nav-indicator${main.some((n) => isActive(n.path, route.path)) ? '' : ' hidden'}`} aria-hidden="true" />
            {main.map((n) => (
              <a key={n.path} href={href(n.path)} aria-label={n.label} aria-current={isActive(n.path, route.path) ? 'page' : undefined}>
                {n.icon}
                <span className="nav-label">{n.label}</span>
              </a>
            ))}
          </div>
          <a className="nav-more" href={href(MORE.path)} aria-label={MORE.label} aria-current={isActive(MORE.path, route.path) ? 'page' : undefined}>
            {MORE.icon}
            <span className="nav-label">{MORE.label}</span>
          </a>
        </nav>
        <main className="main">
          {render ? (
            // Ключ по адресу: при переходе страница появляется заново с короткой анимацией.
            <div key={route.path} className="route-anim">
              {render(route)}
            </div>
          ) : (
            <div className="empty">
              <p>Страница не найдена.</p>
              <a className="btn" href={href('/')}>
                На главную
              </a>
            </div>
          )}
        </main>
      </div>
    </FeedbackProvider>
  );
}
