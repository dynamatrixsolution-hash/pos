import fs from "fs";
import path from "path";

const filePath = path.resolve("frontend/src/components/dashboard-shell-client.tsx");
let content = fs.readFileSync(filePath, "utf8");

// 1. Inactivity auto-logout redirect fix
content = content.replace(
  `        clearCaches();
        signOut({ callbackUrl: "/auth/login" });`,
  `        clearCaches();
        signOut({ redirect: false }).then(() => {
          window.location.href = "/auth/login";
        });`
);

// 2. Redesign the Logout Confirmation Modal and Inactivity Warning Modal
const oldModalBlock = `      {/* Logout Confirmation Modal */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 no-print animate-in fade-in duration-200">
          <div className="bg-[#FFFCF7] dark:bg-slate-900 border border-[#D8CEC1] dark:border-slate-800 rounded-lg p-6 w-full max-w-sm shadow-sm flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-6 w-6 stroke-[2.5]" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-slate-850 dark:text-slate-100">Confirm Logout</h4>
                <p className="text-xs text-[#71675E] dark:text-[#71675E] leading-relaxed font-semibold">
                  Are you sure you want to log out of your session? You will need to sign in again to access the dashboard.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                disabled={logoutLoading}
                onClick={() => setLogoutConfirmOpen(false)}
                className="flex-1 py-2.5 border border-[#D8CEC1] dark:border-slate-800 text-xs rounded-md hover:bg-[#F7F3EC] dark:hover:bg-slate-800/80 font-bold transition-all cursor-pointer text-[#292320] dark:text-slate-350 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={logoutLoading}
                onClick={async () => {
                  setLogoutLoading(true);
                  clearCaches();
                  await signOut({ callbackUrl: "/auth/login" });
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-md shadow-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {logoutLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Log Out"
                )}
              </button>
            </div>
          </div>
        </div>
      )}`;

const newModalBlock = `      {/* Logout Confirmation Modal */}
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 no-print animate-in fade-in duration-150">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6 w-full max-w-sm shadow-md flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-md bg-[#6B2837]/10 border border-[#6B2837]/20 flex items-center justify-center text-[#6B2837] shrink-0 mt-0.5">
                <LogOut className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#292320]">Sign Out</h4>
                <p className="text-xs text-[#71675E] leading-relaxed">
                  Are you sure you want to end your current session? You will be redirected to the sign-in screen.
                </p>
              </div>
            </div>

            {user?.email && (
              <div className="px-3 py-2 rounded-md bg-[#F7F3EC] border border-[#D8CEC1] flex items-center justify-between text-[11px]">
                <span className="font-medium text-[#292320] truncate max-w-[200px]">{user.email}</span>
                <span className="text-[#6B2837] font-semibold uppercase tracking-wider text-[10px]">
                  {user.role ? user.role.replace("_", " ") : "User"}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D8CEC1]">
              <button
                type="button"
                disabled={logoutLoading}
                onClick={() => setLogoutConfirmOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#F7F3EC] text-[#292320] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={logoutLoading}
                onClick={async () => {
                  setLogoutLoading(true);
                  clearCaches();
                  try {
                    await signOut({ redirect: false });
                  } catch (e) {
                    console.error("Signout error:", e);
                  }
                  window.location.href = "/auth/login";
                }}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-[#6B2837] hover:bg-[#521E2A] text-[#FFFCF7] transition-colors shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {logoutLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Sign Out"
                )}
              </button>
            </div>
          </div>
        </div>
      )}`;

content = content.replace(oldModalBlock.replace(/\r?\n/g, "\r\n"), newModalBlock.replace(/\r?\n/g, "\r\n"));
if (!content.includes("Sign Out</h4>")) {
  content = content.replace(oldModalBlock.replace(/\r?\n/g, "\n"), newModalBlock.replace(/\r?\n/g, "\n"));
}

// 3. Also update Inactivity Warning modal to match theme
const oldInactivityBlock = `      {/* Inactivity Warning Modal */}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 no-print animate-in fade-in duration-200">
          <div className="bg-[#FFFCF7] dark:bg-slate-900 border border-[#D8CEC1] dark:border-slate-800 rounded-lg p-6 w-full max-w-sm shadow-sm flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 animate-pulse">
                <Clock className="h-6 w-6 stroke-[2.5]" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-black text-slate-850 dark:text-slate-100">Inactivity Warning</h4>
                <p className="text-xs text-[#71675E] dark:text-[#71675E] leading-relaxed font-semibold">
                  You have been inactive for a while. You will be logged out automatically in{" "}
                  <span className="text-red-500 font-extrabold text-sm">{inactivityCountdown}</span> seconds.
                </p>
              </div>
            </div>
            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowInactivityWarning(false);
                  localStorage.setItem("pos_last_active", Date.now().toString());
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-md shadow-sm transition-colors cursor-pointer"
              >
                I'm still here
              </button>
            </div>
          </div>
        </div>
      )}`;

const newInactivityBlock = `      {/* Inactivity Warning Modal */}
      {showInactivityWarning && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 no-print animate-in fade-in duration-150">
          <div className="bg-[#FFFCF7] border border-[#D8CEC1] rounded-lg p-6 w-full max-w-sm shadow-md flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-md bg-[#6B2837]/10 border border-[#6B2837]/20 flex items-center justify-center text-[#6B2837] shrink-0 mt-0.5">
                <Clock className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#292320]">Session Inactivity</h4>
                <p className="text-xs text-[#71675E] leading-relaxed">
                  Your session will expire soon due to inactivity. You will be signed out in{" "}
                  <span className="font-mono font-bold text-[#6B2837]">{inactivityCountdown}s</span>.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D8CEC1]">
              <button
                type="button"
                onClick={() => {
                  setShowInactivityWarning(false);
                  localStorage.setItem("pos_last_active", Date.now().toString());
                }}
                className="w-full py-2 text-xs font-semibold rounded-md bg-[#6B2837] hover:bg-[#521E2A] text-[#FFFCF7] transition-colors shadow-xs cursor-pointer"
              >
                Stay Signed In
              </button>
            </div>
          </div>
        </div>
      )}`;

content = content.replace(oldInactivityBlock.replace(/\r?\n/g, "\r\n"), newInactivityBlock.replace(/\r?\n/g, "\r\n"));
if (!content.includes("Session Inactivity</h4>")) {
  content = content.replace(oldInactivityBlock.replace(/\r?\n/g, "\n"), newInactivityBlock.replace(/\r?\n/g, "\n"));
}

fs.writeFileSync(filePath, content, "utf8");
console.log("Patched logout and inactivity modals in dashboard-shell-client.tsx successfully!");

