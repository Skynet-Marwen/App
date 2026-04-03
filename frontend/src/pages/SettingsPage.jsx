import { useEffect, useState } from 'react'
import DashboardLayout from '../components/layout/DashboardLayout'
import { useSettings } from '../hooks/useSettings'
import { useAuthStore, useRuntimeSettingsStore } from '../store/useAppStore'
import SettingsCategorySidebar from './settings/SettingsCategorySidebar'
import SettingsFeatureStatusSummary from './settings/SettingsFeatureStatusSummary'
import SettingsSectionContent from './settings/SettingsSectionContent'
import SettingsSectionIntro from './settings/SettingsSectionIntro'
import { summarizeFeatureStatus } from './settings/featureStatus'
import { getSettingsSection, SETTINGS_SECTIONS } from './settings/settingsCatalog'
import { isUiVisible, mergeUiVisibility } from '../services/uiVisibility'

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const {
    settings,
    setSettings,
    securityConfig,
    setSecurityConfig,
    blockPage,
    setBlockPage,
    loading,
    saving,
    saveSettings,
    saveSecuritySettings,
    saveBlockPage,
  } = useSettings()
  const [sectionKey, setSectionKey] = useState('security-detection')
  const [saved, setSaved] = useState('')
  const applyRuntimeSettings = useRuntimeSettingsStore((state) => state.applyRuntimeSettings)
  const isThemeAdmin = ['admin', 'superadmin'].includes(user?.role)
  const section = getSettingsSection(sectionKey)
  const featureSummary = summarizeFeatureStatus(SETTINGS_SECTIONS)
  const uiVisibility = mergeUiVisibility(settings.ui_visibility)
  const showFeatureStatusSummary = !!settings.developer_mode_enabled && isUiVisible(uiVisibility, 'settings.feature_status_summary')
  const showFeatureStatusDetails = !!settings.developer_mode_enabled && isUiVisible(uiVisibility, 'settings.feature_status_details')

  useEffect(() => {
    if (Object.keys(settings || {}).length > 0) {
      applyRuntimeSettings(settings)
    }
  }, [settings, applyRuntimeSettings])

  const saveSettingsGroup = async (savedKey, payload = settings) => {
    try {
      await saveSettings(payload)
      applyRuntimeSettings(payload)
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

  const saveSecurityGroup = async (savedKey = 'security') => {
    try {
      await saveSecuritySettings(settings, securityConfig)
      setSaved(savedKey)
      window.setTimeout(() => setSaved(''), 2000)
    } catch {
      return
    }
  }

  return (
    <DashboardLayout title="Settings" fullWidth>
      <div className="space-y-4 pb-8">
        <SettingsCategorySidebar sections={SETTINGS_SECTIONS} activeKey={sectionKey} onSelect={setSectionKey} />
        {showFeatureStatusSummary ? <SettingsFeatureStatusSummary summary={featureSummary} /> : null}
        <SettingsSectionIntro section={section} loading={loading} showFeatureStatusDetails={showFeatureStatusDetails} />
        <SettingsSectionContent
          sectionKey={sectionKey}
          settings={settings}
          setSettings={setSettings}
          securityConfig={securityConfig}
          setSecurityConfig={setSecurityConfig}
          blockPage={blockPage}
          setBlockPage={setBlockPage}
          saving={saving}
          saved={saved}
          isThemeAdmin={isThemeAdmin}
          showFeatureStatusDetails={showFeatureStatusDetails}
          onSaveSettings={saveSettingsGroup}
          onSaveSecurity={saveSecurityGroup}
          onSaveBlockPage={saveBlockGroup}
        />
      </div>
    </DashboardLayout>
  )
}
