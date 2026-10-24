// Небольшие страницы «Ещё» (v0.10): «Правила и разрешения» и «Источники и лицензии» — вынесены из настроек,
// чтобы настройки оставались короткими.
import { ALL_EXERCISE_PHOTOS } from '../../domain/exercisePhotos.ts';
import { Card, Page } from '../../ui/components.tsx';
import { href } from '../../ui/router.ts';
import { PermissionsPanel } from './PermissionsPanel.tsx';

export function PermissionsPage() {
  return (
    <Page title="Правила и разрешения" subtitle={<a href={href('/more/settings')}>← Настройки</a>}>
      <PermissionsPanel />
      <Card title="Что умеет веб-приложение на iPhone">
        <ul className="onb-points small">
          <li>Работает без интернета, ставится на экран «Домой», открывается как обычное приложение.</li>
          <li>Камера для сканера, уведомления (с экрана «Домой», iOS 16.4+), меню «Поделиться».</li>
          <li>
            Виджеты на экране блокировки и «Здоровье» (Apple Health) веб-приложениям недоступны — для этого нужно отдельное приложение из App Store. Это в
            планах, но не в демо-версии.
          </li>
        </ul>
      </Card>
    </Page>
  );
}

const A = ({ to, children }: { to: string; children: string }) => (
  <a href={to} target="_blank" rel="noreferrer">
    {children}
  </a>
);

export function LicensesPage() {
  return (
    <Page title="Источники и лицензии" subtitle={<a href={href('/more/settings')}>← Настройки</a>}>
      <Card>
        <ul className="sources small">
          <li>Анатомические фигуры (мужская и женская) — изображения, предоставленные автором приложения; женская собрана зеркально, подписи убраны. Разметка мышц — своя.</li>
          <li>
            Рисунки упражнений — <A to="https://github.com/everkinetic/data">Everkinetic</A> (Greg Priday), <A to="https://creativecommons.org/licenses/by-sa/4.0/deed.ru">CC BY-SA 4.0</A>.
            Переименованы файлы, убраны фиксированные размеры.
          </li>
          <li>
            Фото кардио, каната и борьбы — Wikimedia Commons:
            <ul>
              {ALL_EXERCISE_PHOTOS.map((p) => (
                <li key={p.file}>
                  {p.credit.replace(/^(Фото|Рисунок): /, '')}
                  {p.licenseUrl && (
                    <>
                      {' '}
                      · <A to={p.licenseUrl}>лицензия</A>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </li>
          <li>
            Мелкие схемы мышц — Termininja (<A to="https://commons.wikimedia.org/wiki/File:Muscular_system.svg">Wikimedia Commons</A>) через{' '}
            <A to="https://github.com/wger-project/wger">wger</A>, <A to="https://creativecommons.org/licenses/by-sa/3.0/deed.ru">CC BY-SA 3.0</A>; изменён цвет слоёв.
          </li>
          <li>
            Справочник продуктов — <A to="https://fdc.nal.usda.gov">USDA FoodData Central</A> (CC0). Офлайн-база товаров и штрихкоды —{' '}
            <A to="https://world.openfoodfacts.org">Open Food Facts</A> (ODbL 1.0).
          </li>
          <li>
            Шкалы чек-ина — по мотивам анкет самочувствия спортсменов (McLean и соавт., 2010; Hooper и соавт., 1995); формулировки свои, это не валидированный перевод.
          </li>
        </ul>
      </Card>
    </Page>
  );
}
