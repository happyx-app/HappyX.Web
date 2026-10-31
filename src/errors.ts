// How a failed save reads under its button.

import * as api from './api'
import { t } from './i18n'

export function showSaveError(status: HTMLElement, err: unknown) {
  // The demo never saves, which isn't a failure: say so calmly.
  if (err instanceof api.DemoReadOnly) {
    status.className = 'small demo-note'
    status.textContent = t('demo.readonly')
    return
  }
  status.className = 'small error'
  status.textContent = err instanceof api.ApiError && err.status === 400 ? `${t('settings.error')}: ${err.message}` : t('error.generic')
}
