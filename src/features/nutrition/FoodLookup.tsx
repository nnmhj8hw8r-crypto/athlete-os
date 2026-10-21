// Поиск продукта во внешней базе (по названию и штрихкоду) с обязательным подтверждением
// пользователем перед сохранением в свой каталог.
import { useEffect, useState, type FormEvent } from 'react';
import type { CatalogFood, CatalogResponse } from '../../../shared/catalog.ts';
import { parseEan } from '../../../shared/ean.ts';
import { findFoodByBarcode, saveCatalogFood } from '../../data/foods.ts';
import { unitLabel } from '../../domain/nutrition.ts';
import type { Food } from '../../domain/schemas.ts';
import { Field } from '../../ui/components.tsx';
import { useFeedback } from '../../ui/feedback.tsx';
import { BarcodeScanner, cameraSupport } from './BarcodeScanner.tsx';
import { perekProvider, type FoodCatalogProvider, type ProviderStatus } from './catalogProvider.ts';
import type { FoodPrefill } from './FoodFormDialog.tsx';

function useProviderStatus(provider: FoodCatalogProvider): ProviderStatus | null {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    provider.checkAvailability(ctrl.signal).then(setStatus, () => undefined);
    return () => ctrl.abort();
  }, [provider]);
  return status;
}

const r1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ru-RU');

function Attribution({ food, provider }: { food: CatalogFood; provider: FoodCatalogProvider }) {
  if (!food.url) return <span className="small muted">{provider.attribution}</span>;
  return (
    <a className="small" href={food.url} target="_blank" rel="noopener noreferrer">
      {provider.attribution}
    </a>
  );
}

function RemoteFoodConfirm({
  food,
  exact,
  provider,
  onConfirm,
  onBack,
  onManual,
  busy,
}: {
  food: CatalogFood;
  exact: boolean;
  provider: FoodCatalogProvider;
  onConfirm: () => void;
  onBack?: () => void;
  onManual: () => void;
  busy: boolean;
}) {
  const u = unitLabel(food.basis);
  return (
    <div className="card">
      {!exact && (
        <p className="notice warn">
          Точного совпадения нет — это похожий продукт. Сравните название и цифры с упаковкой перед сохранением.
        </p>
      )}
      <div className="title">
        <b>{food.name}</b>
        {food.brand && <span className="muted"> · {food.brand}</span>}
      </div>
      <div className="macros">
        <div>
          <b>{r1(food.per100.kcal)}</b>
          <span>ккал/100 {u}</span>
        </div>
        <div>
          <b>{r1(food.per100.protein)}</b>
          <span>Б, г</span>
        </div>
        <div>
          <b>{r1(food.per100.fat)}</b>
          <span>Ж, г</span>
        </div>
        <div>
          <b>{r1(food.per100.carbs)}</b>
          <span>У, г</span>
        </div>
      </div>
      {food.servings && food.servings.length > 0 && (
        <p className="small muted">Порции у источника: {food.servings.map((s) => `${s.label} — ${r1(s.grams)} г`).join('; ')}</p>
      )}
      <Attribution food={food} provider={provider} />
      <div className="row">
        <button type="button" className="btn primary" onClick={onConfirm} disabled={busy}>
          Это мой продукт — сохранить
        </button>
        {onBack && (
          <button type="button" className="btn" onClick={onBack}>
            Назад к списку
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onManual}>
          Ввести вручную
        </button>
      </div>
    </div>
  );
}

function ErrorNotice({ response }: { response: Extract<CatalogResponse, { status: 'error' }> }) {
  return (
    <p className={`notice ${response.code === 'not_found' ? 'warn' : 'error'}`} role="alert">
      {response.message}
    </p>
  );
}

interface LookupProps {
  onSelected: (food: Food) => void;
  onManual: (prefill: FoodPrefill) => void;
  provider?: FoodCatalogProvider;
}

/** Поиск по названию во внешней базе. */
export function ExternalSearch({ onSelected, onManual, provider = perekProvider, initialQuery = '' }: LookupProps & { initialQuery?: string }) {
  const { notify } = useFeedback();
  const status = useProviderStatus(provider);
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CatalogResponse | null>(null);
  const [picked, setPicked] = useState<CatalogFood | null>(null);
  const [saving, setSaving] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setResponse({ status: 'error', code: 'invalid_request', message: 'Введите хотя бы 2 символа' });
      return;
    }
    setLoading(true);
    setPicked(null);
    try {
      setResponse(await provider.searchByName(q));
    } finally {
      setLoading(false);
    }
  }

  async function confirm(food: CatalogFood) {
    setSaving(true);
    try {
      const saved = await saveCatalogFood(food);
      notify('Продукт сохранён в ваш каталог');
      onSelected(saved);
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (status === null) return <p className="muted">Проверка доступности {provider.label}…</p>;
  if (!status.available) {
    return (
      <div className="stack">
        <p className="notice info">{status.message}</p>
        <button type="button" className="btn" onClick={() => onManual({ name: query })}>
          Ввести продукт вручную
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      <form className="row" onSubmit={search} role="search">
        <label className="visually-hidden" htmlFor="ext-q">
          Название продукта
        </label>
        <input id="ext-q" className="input" style={{ flex: 1, minWidth: 160 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Например, кефир 2,5%" />
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? 'Поиск…' : 'Найти'}
        </button>
      </form>

      {response?.status === 'error' && <ErrorNotice response={response} />}

      {picked && response?.status === 'ok' ? (
        <RemoteFoodConfirm
          food={picked}
          exact={response.exact}
          provider={provider}
          busy={saving}
          onConfirm={() => confirm(picked)}
          onBack={() => setPicked(null)}
          onManual={() => onManual({ name: picked.name })}
        />
      ) : (
        response?.status === 'ok' && (
          <>
            {!response.exact && response.foods.length > 0 && (
              <p className="notice warn">Точных совпадений нет, показаны похожие продукты.</p>
            )}
            {response.foods.length === 0 ? (
              <div className="empty">
                <p>Ничего не найдено.</p>
                <button type="button" className="btn" onClick={() => onManual({ name: query })}>
                  Создать продукт вручную
                </button>
              </div>
            ) : (
              <ul className="list">
                {response.foods.map((f) => (
                  <li key={f.externalId}>
                    <button type="button" className="list-item selectable" onClick={() => setPicked(f)}>
                      <span className="grow">
                        <span className="title">{f.name}</span>
                        <span className="meta">
                          {f.brand ? `${f.brand} · ` : ''}
                          {r1(f.per100.kcal)} ккал / 100 {unitLabel(f.basis)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {response.foods.length > 0 && <p className="small muted">{provider.attribution}. Выберите продукт, чтобы проверить данные.</p>}
          </>
        )
      )}
    </div>
  );
}

/** Поиск по штрихкоду: сначала свой каталог (работает офлайн), затем внешняя база. */
export function BarcodeLookup({ onSelected, onManual, provider = perekProvider }: LookupProps) {
  const { notify } = useFeedback();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ ean: string; response: CatalogResponse } | null>(null);
  const [saving, setSaving] = useState(false);
  const camera = cameraSupport();

  async function lookup(raw: string) {
    setError(undefined);
    setResult(null);
    const ean = parseEan(raw);
    if (!ean) {
      setError('Некорректный штрихкод: нужно 8 или 13 цифр с верной контрольной цифрой');
      return;
    }
    setCode(ean);
    setLoading(true);
    try {
      const local = await findFoodByBarcode(ean);
      if (local) {
        notify('Продукт найден в вашем каталоге');
        onSelected(local);
        return;
      }
      const status = await provider.checkAvailability();
      if (!status.available) {
        setResult({ ean, response: { status: 'error', code: 'disabled', message: `В вашем каталоге такого штрихкода нет. ${status.message}` } });
        return;
      }
      setResult({ ean, response: await provider.lookupBarcode(ean) });
    } finally {
      setLoading(false);
    }
  }

  async function confirm(food: CatalogFood) {
    setSaving(true);
    try {
      onSelected(await saveCatalogFood(food));
      notify('Продукт сохранён в ваш каталог');
    } catch (e) {
      notify((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const response = result?.response;
  const found = response?.status === 'ok' ? response.foods[0] : undefined;

  return (
    <div className="stack">
      {scanning ? (
        <BarcodeScanner
          onDetected={(ean) => {
            setScanning(false);
            void lookup(ean);
          }}
          onCancel={() => setScanning(false)}
        />
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(code);
          }}
        >
          <Field label="Штрихкод (EAN-13 или EAN-8)" error={error}>
            {(p) => (
              <input {...p} className="input" inputMode="numeric" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder="4600000000000" />
            )}
          </Field>
          <div className="row">
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? 'Поиск…' : 'Найти'}
            </button>
            {camera.ok && (
              <button type="button" className="btn" onClick={() => setScanning(true)}>
                Сканировать камерой
              </button>
            )}
          </div>
          {!camera.ok && <p className="small muted">{camera.message}</p>}
        </form>
      )}

      {response?.status === 'error' && (
        <>
          <ErrorNotice response={response} />
          <button type="button" className="btn" onClick={() => onManual({ barcode: result!.ean, name: response.productName })}>
            Ввести продукт вручную
          </button>
        </>
      )}
      {response?.status === 'ok' && !found && (
        <>
          <p className="notice warn">Продукт не найден.</p>
          <button type="button" className="btn" onClick={() => onManual({ barcode: result!.ean })}>
            Ввести продукт вручную
          </button>
        </>
      )}
      {response?.status === 'ok' && found && (
        <RemoteFoodConfirm
          food={found}
          exact={response.exact}
          provider={provider}
          busy={saving}
          onConfirm={() => confirm(found)}
          onManual={() => onManual({ barcode: result!.ean, name: found.name })}
        />
      )}
    </div>
  );
}
