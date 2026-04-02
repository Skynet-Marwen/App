import { useState } from 'react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { useSettings } from '../hooks/useSettings'
import { useAuthStore } from '../store/useAppStore'
import SettingsCategorySidebar from './settings/SettingsCategorySidebar'
import SettingsFeatureStatusSummary from './settings/SettingsFeatureStatusSummary'
import SettingsSectionContent from './settings/SettingsSectionContent'
import SettingsSectionIntro from './settings/SettingsSectionIntro'
import { summarizeFeatureStatus } from './settings/featureStatus'
import { getSettingsSection, SETTINGS_SECTIONS } from './settings/settingsCatalog'

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const { settings, setSettings, blockPage, setBlockPage, loading, saving, saveSettings, saveBlockPage } = useSettings()
  const [sectionKey, setSectionKey] = useState('security-detection')
  const [saved, setSaved] = useState('')
  const isThemeAdmin = user?.role === 'admin'
  const section = getSettingsSection(sectionKey)
  const featureSummary = summarizeFeatureStatus(SETTINGS_SECTIONS)

  const saveSettingsGroup = async (savedKey, payload = settings) => {
    try {
      await saveSettings(payload)
      setSaved(savedKey)
      window.setTimeout(() => setSaved(''), 2000)
    } catch {
      return
    }
  }

  const saveBlockGroup = async () => {
    try {
      await saveBlockPage(blockPage)
      setSaved('block')
      window.setTimeout(() => setSaved(''), 2000)
    } catch {
      return
    }
  }

  return (
    <DashboardLayout title="Settings" fullWidth>
      <div className="grid grid-cols-1 gap-6 xl:items-start xl:grid-cols-[320px_minmax(0,1fr)]">
        <SettingsCategorySidebar sections={SETTINGS_SECTIONS} activeKey={sectionKey} onSelect={setSectionKey} />

        <div className="min-w-0 space-y-4 pb-8">
          <SettingsFeatureStatusSummary summary={featureSummary} />
          <SettingsSectionIntro section={section} loading={loading} />
          <SettingsSectionContent
            sectionKey={sectionKey}
            settings={settings}
            setSettings={setSettings}
            blockPage={blockPage}
            setBlockPage={setBlockPage}
            saving={saving}
            saved={saved}
            isThemeAdmin={isThemeAdmin}
            onSaveSettings={saveSettingsGroup}
            onSaveBlockPage={saveBlockGroup}
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
