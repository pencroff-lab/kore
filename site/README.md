# Documentation site

The `@pencroff-lab/kore` documentation website: Hugo with a pinned Hextra
theme, built from the same Markdown the npm package ships, and deployed to
GitHub Pages at <https://kore.lab.pencroff.com/>.

Nothing in this directory ships in the npm package. The package's content
allowlist is `dist`, `docs`, `llms.txt` and `CHANGELOG.md`; `bun run docs:check`
packs a real archive and fails if anything under `site/` leaks into it.

## Setup

Install these exact versions. They are recorded in
[`toolchain.json`](toolchain.json) and validated together — update that file
only after a successful `bun run docs:build` with a new combination.

| Tool | Version | Notes |
| --- | --- | --- |
| Bun | 1.4.2 | `curl -fsSL https://bun.sh/install \| bash` |
| Go | 1.27.1 | Required by Hugo Modules to fetch the theme |
| Hugo | 0.166.0 **extended** | `brew install hugo`; the standard edition will not build the theme |
| Hextra | v0.12.3 | Pinned in `go.mod`/`go.sum`; fetched on first build |

Hextra v0.12.3 requires Hugo 0.146.0 or newer. Then:

```sh
bun install --frozen-lockfile
bun run docs:build          # fetches the pinned theme on first run
```

After the theme is cached, building and serving work offline, and so does the
served site: the built pages reference no CDN, and FlexSearch ships as a local
asset, so search works offline too. The only outbound links are to
`github.com` — the repository link and the release-tag source citations.

## Commands

All commands run from the repository root and dispatch through
`scripts/docs.sh.ts`.

| Command | What it does |
| --- | --- |
| `bun run docs:generate` | Regenerate `docs/api/` and `docs/examples/` from source |
| `bun run docs:check` | Validate source comments, links, freshness, snapshots, and the packed archive |
| `bun run docs:check -- --site build/docs-site/public` | Also validate rendered links and heading anchors |
| `bun run docs:build` | Build and assemble the complete production site |
| `bun run docs:dev` | Serve the combined site at <http://localhost:1313/> with reload |
| `bun run docs:preview` | Serve a production-settings build at <http://localhost:4173/> |
| `bun run docs:snapshot <version>` | Save `site/versions/<version>/` for a finalized release |
| `bun run docs:record-publication <version>` | Record a verified npm release in `published.json` |
| `bun run docs:release-state` | Classify the commit as release, docs-only, or unprepared |

`bun run gen_docs` remains as an alias for `docs:generate`.

Use `--port <number>` to move either local server, `--verbose` for Hugo's own
output, and `--candidate <version>` to preview an unpublished snapshot. Unknown
commands and options fail with usage rather than doing nothing.

### Local addresses

Both local modes serve the whole site on one origin:

```text
http://localhost:1313/              overview, or the latest stable edition
http://localhost:1313/next/         current working-tree documentation
http://localhost:1313/archived/     brief overviews through v0.6.0
http://localhost:1313/v/<version>/  each published snapshot
```

`docs:dev` watches `docs/`, `llms.txt`, `site/`, the root `README.md` and
`CHANGELOG.md`, and `src/`. A Markdown edit rebuilds and reloads in a few
seconds; a `src/` change also reruns `docs:generate` first. Saved snapshots are
never regenerated. A build that fails leaves the previously served site in
place and prints the reason, so the browser keeps working while you fix it.

### Output directories

| Path | Contents |
| --- | --- |
| `build/docs-site/editions/<id>/` | One self-contained Hugo project per edition |
| `build/docs-site/public/` | The complete production artifact — the only thing deployed |
| `build/docs-site-local/dev/` | `docs:dev` host project and served tree |
| `build/docs-site-local/preview/` | `docs:preview` host project and served tree |

`build/` is git-ignored. Each edition renders into its own directory and the
results are merged into a fresh output that is promoted atomically, so one
edition's cleanup can never delete another's, and a failed build never
half-replaces a working site.

## How the site is put together

```text
docs/**.md + llms.txt ─┐
site/versions/<v>/ ────┼─> one Hugo project per edition ─> merge ─> build/docs-site/public/
site/archived/ ────────┘
```

Editions and their routes:

| Edition | Route | Source |
| --- | --- | --- |
| Development | `/next/` | The working tree's `docs/`; carries an unreleased banner and `noindex` |
| Published release | `/v/<version>/` | `site/versions/<version>/`, once recorded in `published.json` |
| Archive | `/archived/` | `site/archived/README.md` |
| Default | `/` | The latest stable snapshot, or the overview before the first release |

Each full edition gets its own sidebar, search index, raw Markdown tree under
`raw/docs/`, `llms.txt`, and `kore:*` provenance meta tags. The default edition
sets a canonical URL pointing at its versioned twin.

### Link resolution is owned by the build

Canonical Markdown links relatively (`../api/flow.md#ok`) so it reads correctly
on GitHub and inside the installed package. The build resolves every
destination through the content manifest and writes the final site path,
including the edition prefix, into the staged Markdown.

Two theme overrides in `layouts/` exist for this and are the only ones:

- `_markup/render-link.html` and `_markup/render-image.html` trust the staged
  destination. Hextra's own hooks re-resolve root-relative destinations against
  the edition base URL, which turns a cross-edition link like `/archived/` into
  `/next/archived/`.
- `_partials/navbar.html` and `_partials/navbar-link.html` are the pinned
  theme's files with one change, `or .Params.href .URL`, so cross-edition menu
  links survive Hugo's per-site menu URL canonicalization.

Re-copy the navbar partials from the theme when the Hextra pin moves.

The build also removes each page's first H1, because the theme already renders
the front-matter title. That is not only cosmetic: Goldmark allocates an id for
every heading, so a TypeDoc page carrying both `# err` and `### Err` would
render the class heading as `#err-1` and silently break every `err.md#err`
cross-reference. `docs:check --site` catches that class of regression.

## Adding a release

Run this for every release from v0.7.0 onward, including patch releases. The
example uses `<version>` as a placeholder — never publish a fixture version.

1. **Develop.** Edit `docs/`, run `bun run docs:generate` when source comments
   or examples change, and commit the generated output with its source change.
2. **Prepare.** Finalize `package.json#version` and `CHANGELOG.md`. Generated
   source citations are pinned to `v<version>`, so the version must be final
   before generating. Run `bun run docs:check`.
3. **Snapshot.** `bun run docs:snapshot <version>` copies `docs/`, `llms.txt`,
   the root `README.md` and `CHANGELOG.md`, and `navigation.yaml` into
   `site/versions/<version>/`, writes `release.json` with a SHA-256 per file
   and one content digest, and adds the catalog entry. It refuses a version
   that disagrees with `package.json`, refuses to replace an existing snapshot
   whose content differs, and is a no-op when rerun with identical content.
4. **Commit and merge.** CI classifies the commit as `release`, validates the
   snapshot against the package inputs, rechecks every older snapshot's digest,
   and builds the site before anything is published.
5. **Publish.** CI publishes to npm, verifies that exact version on the
   registry, and creates or verifies `v<version>` at the release commit. A tag
   already pointing at a different commit fails the job.
6. **Finalize.** CI runs `docs:record-publication`, which verifies the registry
   version, its integrity and dist-tag, the tag's commit, and the stored
   snapshot digest, then writes `site/published.json` and uploads it as the
   `publication-receipt-<version>` artifact. **Commit that receipt.** Until it
   is committed, the site keeps serving the previous default edition.
7. **Deploy.** Merging the receipt commit runs the documentation-only path: it
   validates and deploys, and cannot republish npm or move the tag.

The split between step 5 and step 6 is deliberate. A snapshot in
`versions.yaml` records only that content exists; `published.json` is the sole
evidence that a version is published, and it is a normal reviewed commit rather
than an expiring CI cache. An unrecorded snapshot stays out of navigation and
never becomes the default edition.

### Retries and recovery

| Situation | What to do |
| --- | --- |
| npm publish failed | Fix and re-run. The snapshot is still a candidate; nothing was recorded. |
| npm published, deployment failed | Do **not** republish. Re-run the workflow, or use the `deploy_docs_only` dispatch. |
| Receipt never committed | Commit it later; the docs-only path deploys the promotion. |
| Need to deploy between releases | Run the workflow manually with `deploy_docs_only`. |
| An older re-run finishes late | It cannot revert the default: promotion only moves forward, by version order, for a stable release intended as npm `latest`. |

`docs:record-publication <version>` also works after the fact for an
already-published version, and `--dry-run` verifies and prints the patch
without writing anything. Neither form publishes.

## Continuous integration

`.github/workflows/ci.yml` keeps every pre-existing library check in the
`library` job and adds:

- `release_state` — classifies the commit as `release`, `docs-only`, or
  `unprepared`.
- `docs` — validates and builds the site, then uploads the Pages artifact.
  Pull requests upload an inspectable preview artifact instead and never
  deploy. npm and tag secrets are scoped to the release jobs.
- `release_guard` — fails a push whose version is neither published nor
  prepared, so an ordinary commit cannot publish a package by accident.
- `publish` — runs only for a prepared, unpublished version.
- `deploy` — one artifact, the `github-pages` environment, and a single
  `github-pages` concurrency group so deployments serialize.

`/next/` is built from the development source named in
[`versions.yaml`](versions.yaml). Update `development.sourceRef` when the
development branch changes so source citations do not point at a stale branch.

Action versions were checked on 2026-09-10. Newer majors exist
(`checkout@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`,
`deploy-pages@v5`); the workflow pins the established set instead, so bump them
deliberately rather than as a side effect.

## Files in this directory

| File | Purpose |
| --- | --- |
| `hugo.yaml` | Base config every edition extends; holds no `baseURL`, `menu`, or `params.edition` |
| `go.mod`, `go.sum` | The pinned Hextra module |
| `toolchain.json` | Exact validated tool versions |
| `navigation.yaml` | Titles, ordering, and section metadata for the current edition |
| `versions.yaml` | Snapshot catalog and the development source — not publication evidence |
| `published.json` | The only record of what is actually published |
| `archived/README.md` | Brief overviews of every release through v0.6.0 |
| `layouts/` | The four theme overrides described above |
| `versions/<version>/` | Immutable release snapshots |

## Activating the site

Deployment is owner-controlled; see the runbook in the execution plan. In
short: set the repository's Pages source to GitHub Actions, save the custom
domain `kore.lab.pencroff.com` before pointing DNS at it, add
`kore.lab  300  IN  CNAME  pencroff-lab.github.io.` to the manually managed
`pencroff.com.` zone, deploy, then enable HTTPS. The first deployment can be
the overview, the archive, and `/next/`; publishing v0.7.0 is not required to
launch.
