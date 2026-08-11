import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { adminApi } from 'src/api/admin';
import { Badge } from 'src/components/ui/Badge';
import { Button } from 'src/components/ui/Button';
import { Field, Select } from 'src/components/ui/Field';
import { Modal } from 'src/components/ui/Modal';
import { PageHeader } from 'src/components/ui/PageHeader';
import { EmptyState } from 'src/components/ui/Spinner';
import { Table, type Column } from 'src/components/ui/Table';
import { toast } from 'src/stores/toastStore';
import type { AdminUser } from 'src/types/api';
import { extractError } from 'src/api/client';

const ROLES = ['user', 'family', 'nurse', 'admin'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function Users() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [nextRole, setNextRole] = useState('user');

  const users = useQuery({
    queryKey: ['admin-users', roleFilter],
    queryFn: () => adminApi.listUsers({ role: roleFilter || undefined, limit: 100 }),
    retry: 1,
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => adminApi.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Role updated');
      setEditing(null);
    },
    onError: err => toast.error('Could not update role', extractError(err)),
  });

  function openEditor(user: AdminUser) {
    setNextRole(user.role);
    setEditing(user);
  }

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: 'Name',
      render: u => <strong>{u.display_name ?? '—'}</strong>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: u => <span className="muted">{u.phone_number}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: u => <Badge>{u.role}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: u => <Badge tone={u.is_active ? 'success' : 'muted'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'created',
      header: 'Joined',
      render: u => <span className="muted">{formatDate(u.created_at)}</span>,
    },
    {
      key: 'actions',
      header: '',
      render: u => (
        <Button size="sm" variant="secondary" onClick={() => openEditor(u)}>
          Change role
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage accounts and roles. The backend enforces admin-only access."
        actions={
          <div className="toolbar">
            <Select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} aria-label="Filter by role">
              <option value="">All roles</option>
              {ROLES.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {users.isLoading && <EmptyState title="Loading users…" />}
      {users.isError && <EmptyState title="Could not load users" detail="Check backend connectivity." />}
      {users.data && (
        <Table columns={columns} rows={users.data} rowKey={u => u.id} emptyMessage="No users match the current filter" />
      )}

      <Modal
        open={editing !== null}
        title="Change role"
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              loading={updateRole.isPending}
              disabled={editing?.role === nextRole}
              onClick={() => editing && updateRole.mutate({ id: editing.id, role: nextRole })}
            >
              Save
            </Button>
          </>
        }
      >
        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>User</div>
              <strong>
                {editing.display_name ?? editing.phone_number}
              </strong>
            </div>
            <Field label="Role">
              <Select value={nextRole} onChange={e => setNextRole(e.target.value)}>
                {ROLES.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
