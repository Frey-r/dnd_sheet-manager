
export function SettingsPage() {
  return (
    <div className="min-h-screen flex flex-col pt-16">
      <header className="bg-surface-container-lowest border-b border-border-low-contrast fixed top-0 w-full z-50 flex justify-between items-center px-4 h-16">
        <div className="flex items-center gap-3">
          <button className="text-on-surface-variant hover:bg-surface-container p-2 rounded-full">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="font-headline-md text-headline-md font-extrabold text-primary">Settings</h1>
        </div>
        <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container">
          <span className="material-symbols-outlined text-secondary">person</span>
        </div>
      </header>

      <main className="flex-1 pt-20 pb-20 px-4 md:px-10 md:max-w-4xl md:mx-auto w-full flex flex-col gap-8">
        {/* Profile Overview */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Avatar & Identity */}
          <div className="md:col-span-1 bg-surface-container-lowest rounded-xl border border-border-low-contrast p-6 flex flex-col items-center justify-center text-center gap-4">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-surface-container border-2 border-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant">person</span>
              </div>
              <button className="absolute bottom-0 right-0 bg-primary-container text-on-primary rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:bg-surface-tint transition-colors">
                <span className="material-symbols-outlined text-[16px]">edit</span>
              </button>
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Alex Mercer</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">Level 12 Dungeon Master</p>
            </div>
          </div>

          {/* Core Details */}
          <div className="md:col-span-2 bg-surface-container-lowest rounded-xl border border-border-low-contrast p-6 flex flex-col gap-4 justify-center">
            <div className="flex flex-col gap-1">
              <label className="font-label-bold text-label-bold text-on-surface-variant">Display Name</label>
              <input
                className="w-full bg-surface-subtle border-0 border-b border-border-low-contrast focus:border-primary focus:ring-0 px-4 py-2 font-body-md text-body-md text-on-surface rounded-t"
                type="text"
                defaultValue="Alex Mercer"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-bold text-label-bold text-on-surface-variant">Email Address (Read Only)</label>
              <div className="w-full bg-surface-subtle border-0 border-b border-border-low-contrast px-4 py-2 font-body-md text-body-md text-on-surface-variant rounded-t cursor-not-allowed flex justify-between items-center">
                <span>alex.mercer@campaignmaster.app</span>
                <span className="material-symbols-outlined text-[18px]">lock</span>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="bg-surface-container-lowest rounded-xl border border-border-low-contrast overflow-hidden">
          <div className="p-4 border-b border-border-low-contrast bg-surface-subtle">
            <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">shield</span>
              Security
            </h3>
          </div>
          <div className="p-4 flex flex-col gap-4">
            <button className="w-full text-left py-4 flex justify-between items-center group border-b border-border-low-contrast last:border-0">
              <div>
                <div className="font-body-lg text-body-lg text-on-surface">Change Password</div>
                <div className="font-body-md text-body-md text-on-surface-variant">Last changed 3 months ago</div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary">chevron_right</span>
            </button>
            <div className="w-full text-left py-4 flex justify-between items-center">
              <div>
                <div className="font-body-lg text-body-lg text-on-surface">Two-Factor Authentication</div>
                <div className="font-body-md text-success-active">Enabled</div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="bg-surface-container-lowest rounded-xl border border-border-low-contrast overflow-hidden">
          <div className="p-4 border-b border-border-low-contrast bg-surface-subtle">
            <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">tune</span>
              Preferences
            </h3>
          </div>
          <div className="flex flex-col">
            {/* Theme Selector */}
            <div className="p-4 flex justify-between items-center border-b border-border-low-contrast">
              <div>
                <div className="font-body-lg text-body-lg text-on-surface">App Theme</div>
                <div className="font-body-md text-body-md text-on-surface-variant">Choose your visual aesthetic</div>
              </div>
              <div className="flex bg-surface-container rounded-lg p-1">
                <button className="px-4 py-2 rounded-md bg-surface-container-lowest shadow-sm font-label-bold text-label-bold text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px]">light_mode</span>
                  Light
                </button>
                <button className="px-4 py-2 rounded-md text-on-surface-variant hover:text-on-surface font-label-bold text-label-bold flex items-center gap-1 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">dark_mode</span>
                  Dark
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="p-4 flex justify-between items-center border-b border-border-low-contrast">
              <div>
                <div className="font-body-lg text-body-lg text-on-surface">Push Notifications</div>
                <div className="font-body-md text-body-md text-on-surface-variant">Session reminders and chat alerts</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-low-contrast after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success-active" />
              </label>
            </div>

            {/* Email Newsletter */}
            <div className="p-4 flex justify-between items-center border-b border-border-low-contrast">
              <div>
                <div className="font-body-lg text-body-lg text-on-surface">Email Newsletter</div>
                <div className="font-body-md text-body-md text-on-surface-variant">Weekly campaign stats and updates</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-surface-variant rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-low-contrast after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success-active" />
              </label>
            </div>

            {/* Danger Zone */}
            <div className="p-4 flex justify-between items-center">
              <div>
                <div className="font-body-lg text-body-lg text-hp-danger">Danger Zone</div>
                <div className="font-body-md text-body-md text-on-surface-variant">Delete account and all campaign data</div>
              </div>
              <button className="px-4 py-2 border border-hp-danger text-hp-danger font-label-bold text-label-bold rounded-lg hover:bg-error-container hover:text-on-error-container transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </section>

        {/* Save Action */}
        <div className="flex justify-end pt-4">
          <button className="w-full md:w-auto bg-primary-container text-on-primary font-label-bold text-label-bold px-8 py-4 rounded-lg hover:bg-surface-tint transition-colors shadow-sm">
            Save Changes
          </button>
        </div>
      </main>
    </div>
  );
}