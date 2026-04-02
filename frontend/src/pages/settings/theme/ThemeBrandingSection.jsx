import { ImagePlus, Trash2 } from 'lucide-react'
import { Button, Input } from '../../../components/ui'

export default function ThemeBrandingSection({
  branding,
  disabled,
  uploadingLogo,
  onBrandingChange,
  onUploadLogo,
  onRemoveLogo,
}) {
  return (
    <div className="space-y-4 rounded-xl border border-cyan-500/10 p-4">
      <div>
        <p className="text-sm font-medium text-white">Branding</p>
        <p className="text-xs text-gray-500 font-mono mt-1">Control title, identity copy, and uploaded logo assets.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Company Name" value={branding.company_name || ''} onChange={(event) => onBrandingChange('company_name', event.target.value)} />
        <Input label="Browser Title" value={branding.title || ''} onChange={(event) => onBrandingChange('title', event.target.value)} />
        <Input label="Logo Text" value={branding.logo_text || ''} onChange={(event) => onBrandingChange('logo_text', event.target.value)} />
        <Input label="Tagline" value={branding.tagline || ''} onChange={(event) => onBrandingChange('tagline', event.target.value)} />
      </div>

      <Input label="Logo URL" value={branding.logo_url || ''} onChange={(event) => onBrandingChange('logo_url', event.target.value)} placeholder="/api/v1/themes/theme-id/logo or https://example.com/logo.png" />

      <div className="rounded-xl border border-cyan-500/10 bg-black/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.18em] text-cyan-400">Logo Asset</p>
            <p className="text-xs text-gray-500 mt-1">Upload PNG, JPEG, WEBP, or GIF up to 2 MB.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium font-mono border ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20'}`}>
              <ImagePlus size={14} />
              Upload Logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={disabled}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) onUploadLogo(file)
                  event.target.value = ''
                }}
              />
            </label>
            <Button variant="danger" size="sm" icon={Trash2} disabled={disabled || !branding.logo_url} loading={uploadingLogo} onClick={onRemoveLogo}>
              Remove
            </Button>
          </div>
        </div>

        {disabled ? (
          <p className="text-xs font-mono text-yellow-300">Create the theme first, then upload or replace its logo asset.</p>
        ) : null}

        {branding.logo_url ? (
          <div className="flex items-center gap-4 rounded-lg border border-cyan-500/10 bg-black/30 p-3">
            <img src={branding.logo_url} alt="" className="h-16 w-16 rounded-xl object-cover border border-white/10" />
            <div className="min-w-0">
              <p className="text-sm text-white truncate">{branding.company_name || branding.logo_text || 'Theme logo'}</p>
              <p className="text-xs text-gray-500 font-mono truncate mt-1">{branding.logo_url}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
