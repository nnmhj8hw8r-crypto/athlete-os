import { useEffect, type ReactNode } from 'react';
import { DashboardPage } from './features/dashboard/DashboardPage.tsx';
import { AiSummaryPage } from './features/more/AiSummaryPage.tsx';
import { BackupPage } from './features/more/BackupPage.tsx';
import { MorePage } from './features/more/MorePage.tsx';
import { SettingsPage } from './features/more/SettingsPage.tsx';
import { SourcesPage } from './features/more/SourcesPage.tsx';
import { SupplementsPage } from './features/more/SupplementsPage.tsx';
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

const NAV: { path: string; label: string; short?: string; icon: ReactNode }[] = [
  { path: '/', label: 'Главная', icon: Icons.home },
  { path: '/nutrition', label: 'Питание', icon: Icons.food },
  { path: '/training', label: 'Тренировки', icon: Icons.training },
  { path: '/recovery', label: 'Восстановление', short: 'Восстан.', icon: Icons.recovery },
  { path: '/season', label: 'Сезон', icon: Icons.season },
  { path: '/more', label: 'Ещё', icon: Icons.more },
];

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
};

function isActive(navPath: string, current: string) {
  return navPath === '/' ? current === '/' : current === navPath || current.startsWith(`${navPath}/`);
}

export function App() {
  const route = useRoute();
  const render = PAGES[route.path];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.path]);

  return (
    <FeedbackProvider>
      <div className="app">
        <nav className="nav" aria-label="Основные разделы">
          <span className="nav-brand">Personal Athlete OS</span>
          {NAV.map((n) => (
            <a key={n.path} href={href(n.path)} aria-label={n.label} aria-current={isActive(n.path, route.path) ? 'page' : undefined}>
              {n.icon}
              {n.short ? (
                <>
                  <span className="nav-full">{n.label}</span>
                  <span className="nav-short">{n.short}</span>
                </>
              ) : (
                <span>{n.label}</span>
              )}
            </a>
          ))}
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
