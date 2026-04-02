import { Input, Select } from '../../../components/ui'

function ColorRow({ label, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-gray-500 font-mono uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="w-10 h-10 rounded border border-cyan-500/20 cursor-pointer bg-transparent" />
        <Input value={value} onChange={(event) => onChange(event.target.value)} />
      </div>
    </div>
  )
}

export default function ThemeSurfaceSection({ colors, layout, onColorChange, onLayoutChange }) {
  return (
    <div className="space-y-4 rounded-xl border border-cyan-500/10 p-4">
      <div>
        <p className="text-sm font-medium text-white">Shell Surfaces</p>
        <p className="text-xs text-gray-500 font-mono mt-1">Fine-grained control for body, header, navigation, footer, panels, and typography.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ColorRow label="Body Background" value={colors.background || '#050505'} onChange={(value) => onColorChange('background', value)} />
        <Input label="Body Gradient" value={colors.backgroundGradient || ''} onChange={(event) => onColorChange('backgroundGradient', event.target.value)} placeholder="linear-gradient(...)" />
        <ColorRow label="Header Background" value={colors.headerBackground || '#020617'} onChange={(value) => onColorChange('headerBackground', value)} />
        <ColorRow label="Header Border" value={colors.headerBorder || '#164e63'} onChange={(value) => onColorChange('headerBorder', value)} />
        <ColorRow label="Navigation Background" value={colors.navBackground || '#030712'} onChange={(value) => onColorChange('navBackground', value)} />
        <ColorRow label="Navigation Active" value={colors.navTextActive || '#67e8f9'} onChange={(value) => onColorChange('navTextActive', value)} />
        <ColorRow label="Footer Background" value={colors.footerBackground || '#020617'} onChange={(value) => onColorChange('footerBackground', value)} />
        <ColorRow label="Footer Border" value={colors.footerBorder || '#164e63'} onChange={(value) => onColorChange('footerBorder', value)} />
        <ColorRow label="Panel Background" value={colors.panelBackground || '#111827'} onChange={(value) => onColorChange('panelBackground', value)} />
        <ColorRow label="Panel Border" value={colors.panelBorder || '#164e63'} onChange={(value) => onColorChange('panelBorder', value)} />
        <ColorRow label="Accent" value={colors.accent || '#22d3ee'} onChange={(value) => onColorChange('accent', value)} />
        <ColorRow label="Text" value={colors.text || '#f9fafb'} onChange={(value) => onColorChange('text', value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Select label="Density" value={layout.density || 'comfortable'} onChange={(event) => onLayoutChange('density', event.target.value)} options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'spacious', label: 'Spacious' }]} />
        <Select label="Radius" value={layout.radius || 'xl'} onChange={(event) => onLayoutChange('radius', event.target.value)} options={[{ value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }, { value: 'xl', label: 'Extra Large' }]} />
        <Select label="Sidebar" value={layout.sidebar || 'expanded'} onChange={(event) => onLayoutChange('sidebar', event.target.value)} options={[{ value: 'compact', label: 'Compact' }, { value: 'expanded', label: 'Expanded' }]} />
        <Select label="Logo Size" value={layout.logo_size || 'md'} onChange={(event) => onLayoutChange('logo_size', event.target.value)} options={[{ value: 'sm', label: 'Small' }, { value: 'md', label: 'Medium' }, { value: 'lg', label: 'Large' }]} />
        <Select label="Header Align" value={layout.header_alignment || 'left'} onChange={(event) => onLayoutChange('header_alignment', event.target.value)} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }]} />
        <Select label="Nav Style" value={layout.nav_style || 'stacked'} onChange={(event) => onLayoutChange('nav_style', event.target.value)} options={[{ value: 'stacked', label: 'Stacked' }, { value: 'pill', label: 'Pill' }]} />
        <Select label="Footer" value={layout.footer_enabled === false ? 'off' : 'on'} onChange={(event) => onLayoutChange('footer_enabled', event.target.value === 'on')} options={[{ value: 'on', label: 'Enabled' }, { value: 'off', label: 'Hidden' }]} />
        <Input label="Font Family" value={layout.font_family || ''} onChange={(event) => onLayoutChange('font_family', event.target.value)} placeholder="'IBM Plex Sans', sans-serif" />
      </div>
    </div>
  )
}
