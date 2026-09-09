<script lang="ts">
	import type { UrlValue, UrlWriteValue } from '@sg-widgets/core';
	import UrlEditor from '$lib/registry/components/url-editor.svelte';

	let web = $state<UrlValue | null>({
		url: 'https://example.com/plate.mov',
		name: 'plate.mov',
		link_type: 'web'
	});
	let blank = $state<UrlValue | null>(null);

	const local: UrlValue = {
		link_type: 'local',
		name: 'plate.exr',
		local_path_mac: '/Volumes/shows/sh010/plate.exr'
	};

	function keep(next: UrlWriteValue | null): void {
		web = next;
	}

	function keepBlank(next: UrlWriteValue | null): void {
		blank = next;
	}

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>web link</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<UrlEditor
						value={web}
						onValueChange={keep}
						field={{ displayName: 'Uploaded Movie', mandatory: false }}
					/>
					<p class={valueCell}>{JSON.stringify(web)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>unset</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<UrlEditor value={blank} onValueChange={keepBlank} />
					<p class={valueCell}>{JSON.stringify(blank)}</p>
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>local path</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<UrlEditor value={local} />
					<p class={valueCell}>{JSON.stringify(local)}</p>
				</div>
			</td>
		</tr>
	</tbody>
</table>
