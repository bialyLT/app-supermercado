# Task — WSL workspace consolidation
Target: the active checkout becomes `/home/bialylt/workspaces/supermercado`; preserve the previous primary tree at `/home/bialylt/workspaces/supermercado-archive`.
Scope: filesystem and Git worktree metadata only; preserve local changes; no commit, push, or merge.

## Specs

1. S1: “bien, otra cosa antes de avanzar, me gustaria que elimines la carpeta supermercado de workspaces de wsl y que a esta carpeta la llames asi, ya que hayd os acarpetas, solo que la otra esta mas desactualizada, quiero que siempre trabajemos sobre unac arpeta”
2. S2: “Archivar lo viejo”

## Tasks

- T1 (S1-S2) — Archive the old primary worktree, rename the current linked checkout, and restore the nested PR worktree from its temporary relocation path; repair metadata without losing dirty state; route: inline; commit: none (nested-worktree return blocked).
- T2 (S1-S2) — Verify the canonical root, branches, dirty states, nested worktrees, and archive paths after relocation; route: inline; commit: none.

## Log

- L1: bien, otra cosa antes de avanzar, me gustaria que elimines la carpeta supermercado de workspaces de wsl y que a esta carpeta la llames asi, ya que hayd os acarpetas, solo que la otra esta mas desactualizada, quiero que siempre trabajemos sobre unac arpeta
- L2: The owner selected “Archivar lo viejo” rather than discarding the old tree.
- L3: Read-only inventory found `/home/bialylt/workspaces/supermercado` is the primary worktree and common Git directory, with many modified tracked files; `/home/bialylt/workspaces/supermercado-promotions` is linked to that common directory and has a modified `next-env.d.ts`; the nested `operational-ui-completeness` worktree has uncommitted tests/report and a local ignored `.env`. No filesystem paths have been moved.
- L4: Git worktree pointers contain absolute paths. Preserve the old primary tree as `/home/bialylt/workspaces/supermercado-archive` because it owns the common `.git`; repair linked worktree metadata after moving paths. The archive must remain while linked worktrees depend on its Git metadata.
- L5: Moved the PR worktree to `/home/bialylt/workspaces/.operational-ui-move`, archived the old primary at `/home/bialylt/workspaces/supermercado-archive`, repaired Git pointers, and moved the current checkout to `/home/bialylt/workspaces/supermercado`. Current branch `feat/epic7-operations-ui` and its dirty state remained accessible. The parent tool CWD is now the nonexistent old path `/home/bialylt/workspaces/supermercado-promotions`; `session_worktree_register` failed with `Session Git identity changed`, and the worker was rejected before admission. The PR worktree remains intact at the temporary path, including its local `.env` (0600). No code changes, commits, or pushes. Resume in a new Pi session rooted at `/home/bialylt/workspaces/supermercado`, move the PR worktree back with `git worktree move`, and verify all worktrees.