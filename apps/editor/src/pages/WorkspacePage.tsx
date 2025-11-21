import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { Project } from '../types/api';

const formDefaults = { name: '', description: '' };

export const WorkspacePage = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [form, setForm] = useState(() => ({ ...formDefaults }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const projects = projectsQuery.data?.projects ?? [];

  const resetForm = () => {
    setForm({ ...formDefaults });
    setEditingId(null);
    setError('');
  };

  const invalidateProjects = () => queryClient.invalidateQueries({ queryKey: ['projects'] });

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      invalidateProjects();
      resetForm();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Unable to save project')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name?: string; description?: string } }) =>
      projectsApi.update(id, payload),
    onSuccess: () => {
      invalidateProjects();
      resetForm();
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Unable to update project')
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => invalidateProjects(),
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Unable to delete project')
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const payload = { name: form.name.trim(), description: form.description.trim() };
    if (!payload.name) {
      setError('Project name is required.');
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingId(project.id);
    setForm({ name: project.name, description: project.description ?? '' });
  };

  const handleDelete = (project: Project) => {
    if (window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(project.id);
    }
  };

  const isBusy = useMemo(
    () => createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    [createMutation.isPending, updateMutation.isPending, deleteMutation.isPending]
  );

  return (
    <section className="bw-container py-12">
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-sm uppercase tracking-widest text-bw-amber">Workspace</p>
        <h1 className="text-3xl font-semibold text-white">Projects dashboard</h1>
        <p className="text-bw-platinum/70">Manage every generated project from a single secure surface.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Your projects</h2>
            {user && <p className="text-sm text-bw-platinum/70">Signed in as {user.email}</p>}
          </div>
          {projectsQuery.isLoading ? (
            <p className="mt-6 text-sm text-bw-platinum/70">Loading projects…</p>
          ) : projectsQuery.isError ? (
            <p className="mt-6 text-sm text-red-300">Unable to load projects. Please try again.</p>
          ) : projects.length === 0 ? (
            <p className="mt-6 text-sm text-bw-platinum/70">No projects yet. Create your first one on the right.</p>
          ) : (
            <div className="mt-6 space-y-4">
              {projects.map((project) => (
                <article key={project.id} className="rounded-2xl border border-white/5 bg-bw-ink/60 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                      <p className="text-sm text-bw-platinum/70">{project.description || 'No description yet'}</p>
                    </div>
                    <div className="flex gap-2 text-sm">
                      <button
                        type="button"
                        className="rounded-full border border-white/20 px-3 py-1 text-white transition hover:bg-white/10"
                        onClick={() => handleEdit(project)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-red-300/40 px-3 py-1 text-red-200 transition hover:bg-red-500/10"
                        onClick={() => handleDelete(project)}
                        disabled={deleteMutation.isPending && project.id === (deleteMutation.variables as string)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white">
            {editingId ? 'Update project' : 'Create a new project'}
          </h2>
          <p className="text-sm text-bw-platinum/70">
            Projects are isolated sandboxes that power your generated applications.
          </p>
          <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="text-sm font-medium text-bw-platinum/80">
              Name
              <input
                type="text"
                required
                minLength={3}
                className="mt-1 w-full rounded-xl border border-white/10 bg-bw-ink px-3 py-2 text-white focus:border-bw-sand focus:outline-none"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-bw-platinum/80">
              Description
              <textarea
                className="mt-1 h-24 w-full rounded-xl border border-white/10 bg-bw-ink px-3 py-2 text-white focus:border-bw-sand focus:outline-none"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isBusy}
                className="rounded-xl bg-bw-sand px-4 py-2 font-semibold text-bw-ink transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {editingId ? 'Save changes' : 'Create project'}
              </button>
              {editingId && (
                <button type="button" className="text-sm text-bw-platinum/70" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
