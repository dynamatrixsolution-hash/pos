import UsersClient from "./users-client";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-6 rounded-2xl">
        <div>
          <h1 className="text-xl font-bold">Users & Roles</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your employees, assign roles, and define branch access.
          </p>
        </div>
      </div>

      <UsersClient />
    </div>
  );
}
