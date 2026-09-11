import { mkdirSync } from "node:fs";
import { join } from "node:path";

export interface OverviewOptions {
	/** Development edition label, e.g. "0.7.0 (unreleased)". */
	developmentLabel: string;
	/** Newest release covered by the brief archive. */
	lastArchived: string;
	origin: string;
}

// The root edition before any full snapshot is published. It must not present
// unreleased documentation as stable.
export function overviewMarkdown(options: OverviewOptions): string {
	return `# @pencroff-lab/kore

Value-based error handling for TypeScript: the immutable \`Err\` type and
\`flow\`, a tier of free functions over \`ResultTuple<T>\`.

## No stable documentation edition is published yet

Full documentation snapshots begin at v0.7.0. Until v0.7.0 is published to npm
and its publication is verified, this site has no stable edition, and this page
stands in its place. Nothing here describes a released API.

- **[Development documentation](/next/)** — ${options.developmentLabel}.
  Unreleased and subject to change; not published to npm.
- **[Archived releases](/archived/)** — brief overviews of every release
  through v${options.lastArchived}, each linking to its own documentation at
  its Git tag.

## Installing the released library

The most recently published release remains available from npm and ships its
own documentation inside the package:

\`\`\`bash
npm install @pencroff-lab/kore
\`\`\`

After installing, read \`docs/README.md\` and \`llms.txt\` in the package
directory. Those files always describe the version you installed, which is the
authoritative source while this site has no stable edition.
`;
}

export function overviewLlms(options: OverviewOptions): string {
	return `# @pencroff-lab/kore

> Value-based error handling for TypeScript. This site has no stable
> documentation edition yet: full snapshots begin at v0.7.0, which is not
> published. Do not treat anything linked here as a released API.

## Editions

- [Development documentation](/next/): ${options.developmentLabel}, unreleased
- [Archived releases](/archived/): brief historical overviews through v${options.lastArchived}, not an API reference

## Installed package

The published npm package ships its own \`docs/\` directory and \`llms.txt\`.
Prefer those files: they describe the exact installed version.
`;
}

/** Materializes the overview edition's canonical input tree. */
export async function writeOverview(
	dir: string,
	llmsPath: string,
	options: OverviewOptions,
): Promise<void> {
	mkdirSync(dir, { recursive: true });
	await Bun.write(join(dir, "README.md"), overviewMarkdown(options));
	await Bun.write(llmsPath, overviewLlms(options));
}
