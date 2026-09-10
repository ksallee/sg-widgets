<script lang="ts">
	/**
	 * What the demos read: the Connect control in Starlight's header.
	 *
	 * One choice, then the rows that choice needs. Mock is the choice and nothing under
	 * it. Live shows the site, the login state and the project, in that order, and each
	 * row carries only the control its state needs. The trigger label carries the state:
	 * `Mock` on fixtures, `Live · <site> · <scope>` on a real site, where only the host
	 * truncates. See docs/proposals/connect-panel.md.
	 *
	 * Source, site, login and project are site-wide and persisted, so every demo on the
	 * page reads the same site. A demo is built once, when its island mounts, so changing
	 * any of them reloads the page rather than rebuilding the widgets underneath.
	 *
	 * The panel is the shadcn Popover, so dismissal, focus return and the enter animation
	 * come from the layer stack: the project picker inside it portals to `<body>` and
	 * closes before the panel without this component knowing about it.
	 */
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import ProjectPicker from '$lib/registry/components/project-picker.svelte';
	import { cn } from '$lib/utils.js';
	import {
		demoProject,
		demoSession,
		demoSiteUrl,
		demoSource,
		liveClient,
		liveState,
		logIn,
		logOut,
		prepareDemoSource,
		setDemoProject,
		setDemoSiteUrl,
		setDemoSource,
		type DemoSource,
		type LiveState,
	} from '../demos/_shared/live';

	/** The row set the panel draws, and what `data-live-state` says. */
	type Mode = 'mock' | 'no-site' | 'signed-out' | 'approving' | 'signed-in' | 'dev' | 'refused';

	let open = $state(false);
	let source = $state<DemoSource>(demoSource());
	/* What this browser last knew, so the first paint is close to the truth; the settled
	   state, with its bearer, arrives from `prepareDemoSource` a tick later. */
	let live = $state<LiveState>({
		...liveState(),
		source: demoSource(),
		siteUrl: demoSiteUrl(),
		session: demoSession(),
		project: demoProject(),
	});
	let settled = $state(false);
	let siteDraft = $state('');
	let editingSite = $state(false);
	let approving = $state(false);
	let refusal = $state<string | null>(null);

	const mode = $derived.by<Mode>(() => {
		if (source !== 'live') return 'mock';
		if (approving) return 'approving';
		if (refusal) return 'refused';
		if (!live.siteUrl) return 'no-site';
		if (live.devToken) return 'dev';
		if (live.session) return 'signed-in';
		return 'signed-out';
	});

	/** Naming the site is a step, not a row: while it runs, nothing under it applies yet. */
	const editing = $derived(source === 'live' && (editingSite || live.siteUrl === ''));

	/** The site as the button names it: the studio, without the suffix every Flow PT host carries. */
	function shortHost(siteUrl: string): string {
		try {
			return new URL(siteUrl).hostname
				.replace(/^www\./, '')
				.replace(/\.(?:shotgrid\.autodesk\.com|shotgunstudio\.com)$/, '');
		} catch {
			return siteUrl;
		}
	}

	const host = $derived(source === 'live' ? shortHost(live.siteUrl) : '');
	const project = $derived(live.project ? (live.project.name ?? `Project ${live.project.id}`) : 'Whole site');
	const scope = $derived.by(() => {
		switch (mode) {
			case 'mock':
				return '';
			case 'no-site':
				return 'no site';
			case 'signed-out':
				return 'signed out';
			case 'approving':
				return 'approving';
			case 'refused':
				return 'not reading';
			default:
				return project;
		}
	});
	const title = $derived(
		source === 'live'
			? `Live · ${live.siteUrl || 'no site'} · ${scope}`
			: 'The demos read fixtures. Open to point them at a site.',
	);
	/** The picker needs a client, so the project row shows only once live mode can read the site. */
	const ready = $derived(settled && live.source === 'live' && live.problem === null);

	const control =
		'inline-flex h-8 items-center justify-center px-2 text-sm text-muted-foreground select-none ' +
		'transition-[color,background-color,opacity,transform] duration-150 ease-out ' +
		'hover:bg-accent hover:text-accent-foreground ' +
		'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
		'active:scale-[0.98] ' +
		'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';
	const segmentClass = `${control} border-l border-border first:border-l-0`;
	const groupClass =
		'inline-flex h-8 w-fit shrink-0 items-center overflow-hidden rounded-md border border-border bg-background';
	const labelClass = 'text-xs font-medium text-muted-foreground';
	const rowClass = 'flex items-center gap-2';
	const noteClass = 'text-sm text-muted-foreground';

	function pickSource(next: DemoSource): void {
		if (next === source) return;
		setDemoSource(next);
		location.reload();
	}

	function editSite(): void {
		siteDraft = live.siteUrl || demoSiteUrl();
		editingSite = true;
	}

	function useSite(): void {
		const value = siteDraft.trim();
		if (!value) return;
		setDemoSiteUrl(value);
		location.reload();
	}

	async function signIn(): Promise<void> {
		refusal = null;
		approving = true;
		try {
			// The launcher hands the token out once, so one poll runs and it runs here.
			await logIn(live.siteUrl, (url) => window.open(url, '_blank', 'noopener'));
			location.reload();
		} catch (error) {
			refusal = error instanceof Error ? error.message : String(error);
		} finally {
			approving = false;
		}
	}

	function signOut(): void {
		logOut();
		location.reload();
	}

	function pickProject(value: { id: number; name?: string } | null): void {
		setDemoProject(value ? { id: value.id, name: value.name } : null);
		location.reload();
	}

	onMount(() => {
		void prepareDemoSource().then((next) => {
			live = next;
			source = next.source;
			settled = true;
		});
	});

	// Each demo states the source its islands were built against.
	$effect(() => {
		for (const figure of document.querySelectorAll<HTMLElement>('[data-sg-demo]')) {
			figure.dataset.source = source;
		}
	});
</script>

<div
	class="sg-connect"
	data-sg-connect
	data-source={source}
	data-live-state={mode}
	data-open={open ? '' : undefined}
>
	<Popover.Root
		bind:open={
			() => open,
			(next) => {
				open = next;
				// Naming the site is a step; a closed panel starts from its settled row again.
				if (!next) editingSite = false;
			}
		}
	>
		<Popover.Trigger class="sg-connect-trigger" data-connect-trigger {title}>
			<svg
				class="sg-connect-icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
				<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
			</svg>
			<span class="sg-connect-label" data-connect-label>
				<span data-connect-lead>{source === 'live' ? 'Live' : 'Mock'}</span>
				{#if host}
					<span class="sg-connect-sep" aria-hidden="true">&middot;</span>
					<span class="sg-connect-host" data-connect-host>{host}</span>
				{/if}
				{#if scope}
					<span class="sg-connect-sep" aria-hidden="true">&middot;</span>
					<span data-connect-scope>{scope}</span>
				{/if}
			</span>
		</Popover.Trigger>

		<!--
			Fixed, so the panel is placed against the viewport rather than the header's own
			stacking context, and anchored to the trigger's end so it never leaves the page.
		-->
		<Popover.Content
			data-connect-panel
			data-source={source}
			data-live-state={mode}
			strategy="fixed"
			align="end"
			sideOffset={8}
			aria-label="What the demos read"
			class={cn('p-0', source === 'live' ? 'w-96' : 'w-auto')}
			onOpenAutoFocus={(event) => {
				// The url field is the one input the panel has, and only in the site step.
				const input = document.querySelector<HTMLInputElement>('#sg-connect-panel [data-live-site]');
				if (!input) return;
				event.preventDefault();
				input.focus({ preventScroll: true });
			}}
		>
			<div id="sg-connect-panel" class="flex flex-col gap-3 p-4">
				<div class={groupClass} role="group" aria-label="Data source">
					<button
						type="button"
						class={segmentClass}
						data-source-pick="mock"
						aria-pressed={source === 'mock'}
						onclick={() => pickSource('mock')}
					>
						Mock
					</button>
					<button
						type="button"
						class={segmentClass}
						data-source-pick="live"
						aria-pressed={source === 'live'}
						onclick={() => pickSource('live')}
					>
						Live
					</button>
				</div>

				{#if source === 'live'}
					<div class="flex flex-col gap-1.5" data-connect-row="site">
						<span class={labelClass}>Site</span>
						{#if editing}
							<div class={rowClass}>
								<Input
									bind:value={siteDraft}
									data-live-site=""
									type="url"
									spellcheck="false"
									autocomplete="off"
									placeholder="https://studio.example.com"
									aria-label="Site url"
									onkeydown={(event) => {
										if (event.key === 'Enter') useSite();
									}}
								/>
								<Button data-live-site-use onclick={useSite}>Use site</Button>
							</div>
						{:else}
							<div class={rowClass}>
								<span class="min-w-0 flex-1 truncate text-sm" title={live.siteUrl}>{host}</span>
								<Button variant="outline" size="sm" data-live-site-change onclick={editSite}>Change</Button>
							</div>
						{/if}
					</div>

					{#if !editing}
						<div class={mode === 'refused' ? 'flex flex-col gap-2' : rowClass} data-connect-row="login">
							{#if mode === 'dev'}
								<span class={noteClass} data-live-dev>Reading with the dev key</span>
							{:else if mode === 'signed-in'}
								<span class="min-w-0 flex-1 truncate text-sm" data-live-session>
									Signed in as {live.session?.login}
								</span>
								<Button variant="outline" data-live-logout onclick={signOut}>Sign out</Button>
							{:else if mode === 'approving'}
								<Button disabled aria-busy="true" data-live-login>
									<svg
										class="size-4 animate-spin"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										aria-hidden="true"
									>
										<path d="M21 12a9 9 0 1 1-6.219-8.56" />
									</svg>
									Sign in
								</Button>
								<span class={noteClass}>Approve the request in the tab that opened.</span>
							{:else if mode === 'refused'}
								<span class="text-sm text-destructive" data-live-refusal>{refusal}</span>
								<Button class="w-fit" data-live-login onclick={signIn}>Sign in</Button>
							{:else}
								<Button data-live-login onclick={signIn}>Sign in</Button>
								<span class={noteClass}>Sign in to read the site.</span>
							{/if}
						</div>
					{/if}

					{#if !editing && ready && (mode === 'dev' || mode === 'signed-in')}
						<div class="flex flex-col gap-1.5" data-connect-row="project" data-live-project-field>
							<span class={labelClass}>Project</span>
							<div class="w-full" data-live-project>
								<ProjectPicker
									client={liveClient()}
									size="sm"
									placeholder="Whole site"
									clearable
									value={live.project ? { type: 'Project', id: live.project.id, name: live.project.name } : null}
									onValueChange={pickProject}
								/>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</Popover.Content>
	</Popover.Root>
</div>

<style>
	/*
	 * The trigger is the shape of Starlight's search button and wears the header's own
	 * `--sl-color-*`, so the header still reads as the header. Everything inside the
	 * panel is a shadcn token, through the popover surface.
	 */
	.sg-connect {
		display: flex;
		align-items: center;
	}

	.sg-connect :global(.sg-connect-trigger) {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: 18rem;
		height: 2rem;
		padding-inline: 0.75rem;
		border: 1px solid var(--sl-color-gray-5);
		border-radius: 0.5rem;
		background-color: var(--sl-color-black);
		color: var(--sl-color-gray-2);
		font-family: inherit;
		font-size: var(--sl-text-sm);
		cursor: pointer;
	}

	.sg-connect :global(.sg-connect-trigger:hover) {
		border-color: var(--sl-color-gray-2);
		color: var(--sl-color-white);
	}

	.sg-connect :global(.sg-connect-icon) {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.sg-connect :global(.sg-connect-label) {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		white-space: nowrap;
	}

	/* The one thing on the site allowed to truncate. */
	.sg-connect :global(.sg-connect-host) {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
