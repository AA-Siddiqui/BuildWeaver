import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { Project } from '../types/api';

const formDefaults = { name: '', description: '' };

const GlowOrb = ({ className }: { className?: string }) => (
  <div
    className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
    aria-hidden
  />
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-bw-crimson/20 to-bw-clay/20">
      <span className="text-2xl text-bw-sand">+</span>
    </div>
    <h3 className="mb-2 text-lg font-semibold text-white">No projects yet</h3>
    <p className="max-w-xs text-sm text-bw-platinum/60">
      Create your first project to start building amazing applications.
    </p>
  </div>
);

const ProjectCard = ({
  project,
  onOpen,
  onEdit,
  onDelete,
  isDeleting
}: {
  project: Project;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) => (
  <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5 transition-all duration-300 hover:border-bw-sand/20 hover:shadow-lg hover:shadow-bw-crimson/5">
    <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-bw-crimson/5 blur-2xl transition-all duration-500 group-hover:bg-bw-sand/10" />
    <div className="relative">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="mb-1 text-lg font-bold text-white">{project.name}</h3>
          <p className="line-clamp-2 text-sm text-bw-platinum/60">
            {project.description || 'No description'}
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-bw-crimson to-bw-clay text-sm font-bold text-white">
          {project.name.charAt(0).toUpperCase()}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex-1 rounded-xl bg-gradient-to-r from-bw-sand to-bw-amber px-4 py-2 text-sm font-semibold text-bw-ink transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-bw-sand/20"
          onClick={onOpen}
        >
          Open Project
        </button>
        <button
          type="button"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:border-white/20 hover:bg-white/10"
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm text-red-300 transition hover:border-red-500/40 hover:bg-red-500/10"
          onClick={onDelete}
          disabled={isDeleting}
        >
          {isDeleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  </article>
);

export const WorkspacePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isBusy = useMemo(
    () => createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    [createMutation.isPending, updateMutation.isPending, deleteMutation.isPending]
  );

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background Effects */}
      <GlowOrb className="-left-40 top-20 h-96 w-96 bg-bw-crimson/10" />
      <GlowOrb className="-right-40 bottom-20 h-80 w-80 bg-bw-sand/10" />

      {/* Header */}
      <header className="relative border-b border-white/5 bg-bw-ink/50 backdrop-blur">
        <div className="bw-container flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-bw-crimson to-bw-clay text-lg font-black text-white">
              BW
            </div>
            <span className="text-lg font-bold text-white">BuildWeaver</span>
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <span className="hidden text-sm text-bw-platinum/60 sm:block">
                {user.email}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/20 hover:bg-white/10"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="bw-container relative py-12">
        {/* Page Header */}
        <div className="mb-10">
          <span className="mb-3 inline-block text-sm font-bold uppercase tracking-widest text-bw-amber">
            Workspace
          </span>
          <h1 className="mb-3 text-4xl font-black text-white">Your Projects</h1>
          <p className="max-w-xl text-bw-platinum/60">
            Manage and build your applications from a single dashboard. Each project is an isolated sandbox ready for development.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Total Projects', value: projects.length },
            { label: 'Export Targets', value: '3' },
            { label: 'Components', value: '50+' },
            { label: 'Status', value: 'Active' }
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center"
            >
              <div className="text-2xl font-bold text-bw-sand">{stat.value}</div>
              <div className="text-xs uppercase tracking-wider text-bw-platinum/50">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Projects List */}
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">All Projects</h2>
              {projectsQuery.isLoading && (
                <span className="text-sm text-bw-platinum/50">Loading...</span>
              )}
            </div>

            {projectsQuery.isError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                <p className="text-sm text-red-300">Unable to load projects. Please try again.</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent">
                <EmptyState />
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => navigate(`/app/${project.id}`)}
                    onEdit={() => handleEdit(project)}
                    onDelete={() => handleDelete(project)}
                    isDeleting={deleteMutation.isPending && project.id === (deleteMutation.variables as string)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Create/Edit Form */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-transparent p-8 shadow-xl">
              <div className="mb-6">
                <h2 className="mb-2 text-xl font-bold text-white">
                  {editingId ? 'Update Project' : 'Create New Project'}
                </h2>
                <p className="text-sm text-bw-platinum/60">
                  {editingId
                    ? 'Modify your project details below.'
                    : 'Start a new project to begin building your application.'}
                </p>
              </div>

              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                <div>
                  <label className="mb-2 block text-sm font-medium text-bw-platinum/80">
                    Project Name
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    placeholder="My Awesome App"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-bw-platinum/30 transition-all focus:border-bw-sand/50 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-bw-sand/20"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-bw-platinum/80">
                    Description
                  </label>
                  <textarea
                    placeholder="Brief description of your project..."
                    className="h-28 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-bw-platinum/30 transition-all focus:border-bw-sand/50 focus:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-bw-sand/20"
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="group relative flex-1 overflow-hidden rounded-xl bg-gradient-to-r from-bw-crimson to-bw-clay px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-bw-crimson/20 disabled:opacity-60 disabled:hover:scale-100"
                  >
                    <span className="relative z-10">
                      {isBusy ? 'Saving...' : editingId ? 'Save Changes' : 'Create Project'}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-bw-clay to-bw-crimson opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-bw-platinum/70 transition hover:border-white/20 hover:bg-white/10"
                      onClick={resetForm}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
