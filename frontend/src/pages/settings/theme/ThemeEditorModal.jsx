import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button, Card, CardHeader, Input, Modal, Toggle } from '../../../components/ui'
import ThemeBrandingSection from './ThemeBrandingSection'
import ThemePreviewCard from './ThemePreviewCard'
import ThemeRoleSurfaceSection from './ThemeRoleSurfaceSection'
import ThemeSurfaceSection from './ThemeSurfaceSection'
import ThemeWidgetSection from './ThemeWidgetSection'

function JsonTextarea({ label, value, onChange, error, rows = 7, placeholder }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</label>
      <textarea
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full border rounded-lg px-3 py-2 text-sm text-gray-200 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 transition resize-y ${error ? 'border-red-500/50' : 'border-cyan-500/15'}`}
        style={{ background: 'rgba(0,0,0,0.6)' }}
      />
      {error && <p className="text-xs text-red-400 font-mono">{error}</p>}
    </div>
  )
}

function parseJson(text, fallback) {
  try {
    return JSON.parse(text || fallback)
  } catch {
    return JSON.parse(fallback)
  }
}

function updateJsonText(text, fallback, mutator) {
  const next = parseJson(text, fallback)
  mutator(next)
  return JSON.stringify(next, null, 2)
}

export default function ThemeEditorModal({
  open,
  mode,
  initialForm,
  saving,
  uploadingLogo,
  onClose,
  onSubmit,
  onUploadLogo,
  onRemoveLogo,
}) {
  const [form, setForm] = useState(initialForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')

  const isEdit = mode === 'edit'
  const colors = parseJson(form.colorsText, '{}')
  const layout = parseJson(form.layoutText, '{}')
  const widgets = parseJson(form.widgetsText, '[]')
  const branding = parseJson(form.brandingText, 'null') || {}

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFieldErrors({})
    setFormError('')

    const result = await onSubmit(form)
    if (!result?.ok) {
      setFieldErrors(result?.fieldErrors || {})
      if (result?.formError) setFormError(result.formError)
      return
    }

    onClose()
  }

  const handleColorChange = (key, value) => {
    setForm((prev) => ({ ...prev, colorsText: updateJsonText(prev.colorsText, '{}', (next) => { next[key] = value }) }))
  }

  const handleLayoutChange = (key, value) => {
    setForm((prev) => ({ ...prev, layoutText: updateJsonText(prev.layoutText, '{}', (next) => { next[key] = value }) }))
  }

  const handleBrandingChange = (key, value) => {
    setForm((prev) => ({ ...prev, brandingText: updateJsonText(prev.brandingText, 'null', (next) => { next[key] = value }) }))
  }

  const handleWidgetsChange = (nextWidgets) => {
    setForm((prev) => ({ ...prev, widgetsText: JSON.stringify(nextWidgets, null, 2) }))
  }

  const handleUploadLogo = async (file) => {
    if (!isEdit || !form.id) return
    try {
      const updatedTheme = await onUploadLogo(form.id, file)
      setForm((prev) => ({ ...prev, brandingText: JSON.stringify(updatedTheme.branding ?? null, null, 2) }))
    } catch {
      // Logo upload errors are surfaced by the parent hook.
    }
  }

  const handleRemoveLogo = async () => {
    if (!isEdit || !form.id) return
    try {
      const updatedTheme = await onRemoveLogo(form.id)
      setForm((prev) => ({ ...prev, brandingText: JSON.stringify(updatedTheme.branding ?? null, null, 2) }))
    } catch {
      // Logo removal errors are surfaced by the parent hook.
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Theme' : 'Create Theme'}
      width="max-w-[96vw] 2xl:max-w-[1600px]"
      fullHeight
      bodyClassName="pt-5"
    >
      <form onSubmit={handleSubmit} className="grid min-h-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
        <div className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-mono text-red-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Theme ID"
              value={form.id}
              onChange={(event) => setForm((prev) => ({ ...prev, id: event.target.value }))}
              error={fieldErrors.id}
              disabled={isEdit}
              placeholder="cyber-dark"
            />
            <Input
              label="Theme Name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              error={fieldErrors.name}
              placeholder="Cyber Dark"
            />
          </div>

          <ThemeBrandingSection
            branding={branding}
            disabled={!isEdit}
            uploadingLogo={uploadingLogo}
            onBrandingChange={handleBrandingChange}
            onUploadLogo={handleUploadLogo}
            onRemoveLogo={handleRemoveLogo}
          />

          <ThemeSurfaceSection
            colors={colors}
            layout={layout}
            onColorChange={handleColorChange}
            onLayoutChange={handleLayoutChange}
          />

          <ThemeRoleSurfaceSection layout={layout} onLayoutChange={handleLayoutChange} />

          <ThemeWidgetSection
            widgets={widgets}
            onWidgetsChange={handleWidgetsChange}
          />

          <JsonTextarea label="Colors JSON" value={form.colorsText} onChange={(event) => setForm((prev) => ({ ...prev, colorsText: event.target.value }))} error={fieldErrors.colorsText} placeholder='{"primary":"#06b6d4","background":"#0b1120"}' />
          <JsonTextarea label="Layout JSON" value={form.layoutText} onChange={(event) => setForm((prev) => ({ ...prev, layoutText: event.target.value }))} error={fieldErrors.layoutText} placeholder='{"density":"comfortable","mode":"dark"}' />
          <JsonTextarea label="Widgets JSON" value={form.widgetsText} onChange={(event) => setForm((prev) => ({ ...prev, widgetsText: event.target.value }))} error={fieldErrors.widgetsText} placeholder='["traffic-heatmap","priority-investigations"]' />
          <JsonTextarea label="Branding JSON" value={form.brandingText} onChange={(event) => setForm((prev) => ({ ...prev, brandingText: event.target.value }))} error={fieldErrors.brandingText} placeholder='{"logo_text":"SkyNet","company_name":"SkyNet","tagline":"Threat command center"}' />

          <div className="divide-y divide-cyan-500/10 rounded-xl border border-cyan-500/10 px-4 py-1">
            <Toggle
              label="Theme active"
              description="Inactive themes remain stored but should not be resolved by clients."
              checked={!!form.is_active}
              onChange={(value) => setForm((prev) => ({ ...prev, is_active: value }))}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving} icon={CheckCircle2}>
              {isEdit ? 'Save Theme' : 'Create Theme'}
            </Button>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-0">
          <Card className="h-full">
            <CardHeader>
              <div>
                <p className="text-sm font-medium text-white">Live Preview</p>
                <p className="text-xs text-gray-500 font-mono mt-1">Approximate theme rendering from the current form.</p>
              </div>
            </CardHeader>
            <ThemePreviewCard
              theme={{
                id: form.id,
                name: form.name,
                is_active: form.is_active,
                colors,
                layout,
                widgets,
                branding,
              }}
            />
          </Card>
        </div>
      </form>
    </Modal>
  )
}
