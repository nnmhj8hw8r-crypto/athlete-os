// Граница для будущего подключаемого ИИ. В v0.1 реализаций нет и приложение от них не зависит:
// сводку пользователь копирует вручную (src/features/more/AiSummaryPage.tsx).
//
// Будущая реализация должна:
// - вызываться только через локальный сервер (ключ провайдера — серверная переменная окружения);
// - отправлять только текст, который пользователь увидел и подтвердил (результат buildSummary);
// - возвращать ответ как текст для просмотра, без автоматических изменений данных.
// Выбор провайдера, расходы, доступность из России и условия хранения данных — отдельное решение
// (см. docs/ROADMAP.md).

export interface AiAnalysisRequest {
  /** Текст, подтверждённый пользователем. */
  prompt: string;
}

export interface AiAnalysisResult {
  text: string;
  provider: string;
  model: string;
}

export interface AiAdapter {
  readonly id: string;
  analyze(request: AiAnalysisRequest, signal?: AbortSignal): Promise<AiAnalysisResult>;
}
