import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { CategoriesSettings } from "@/components/settings/categories-settings";
import { CyclePresetsSettings } from "@/components/settings/cycle-presets-settings";
import { BackupSettings } from "@/components/settings/backup-settings";
import { NavSettings } from "@/components/settings/nav-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Configuración</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Personaliza tu experiencia en Uxuri.</p>
      </div>
      <AppearanceSettings />
      <NavSettings />
      <CategoriesSettings />
      <CyclePresetsSettings />
      <BackupSettings />
    </div>
  );
}
