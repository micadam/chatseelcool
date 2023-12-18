<script lang="ts">
	import type { StreamStatsObj } from '$lib/stream';
	import type { Segment, Stream, Streamer } from '@prisma/client';
	import { onMount } from 'svelte';
	import StreamStats from '$lib/StreamStats.svelte';
	import '$lib/main.css';

	let streamersPromise: Promise<Streamer[]> = Promise.resolve([]);
	let currentStreamer: Streamer;
	let currentStream: Stream & { segments: Segment[] };
	let streams: (Stream & { segments: Segment[] })[] = [];
	let streamStats: StreamStatsObj;
	let streamStatsPromise: Promise<StreamStatsObj>;

	let theme = 'light';

	onMount(() => {
		theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
		streamersPromise = fetch('/api/streamers').then(async (res) => {
			const data = await res.json();
			currentStreamer = data[0];
			fetchStreams(currentStreamer);
			return data;
		});
	});

	const fetchStreams = async (streamer: Streamer) => {
		currentStreamer = streamer;
		const response = await fetch(`/api/streamers/${streamer.id}/streams`);
		const data = await response.json();
		streams = data;
		currentStream = undefined as any;
		streamStats = undefined as any;
	};

	const fetchStreamStats = async (stream: Stream & { segments: Segment[] }) => {
		streamStatsPromise = fetch(`/api/streams/${stream.id}/stats`).then((res) => res.json());
		currentStream = stream;
	};

	const switchTheme = () => {
		if (theme === 'light') {
			theme = 'dark';
		} else {
			theme = 'light';
		}
	};
</script>

<div
	id="dark-mode-toggle"
	role="button"
	tabindex="0"
	class:dark={theme === 'dark'}
	on:click={switchTheme}
	on:keypress={switchTheme}
>
	<span class:theme-active={theme === 'dark'}>d</span>
	|
	<span class:theme-active={theme === 'light'}>l</span>
</div>

{#await streamersPromise}
	<p>loading...</p>
{:then streamers}
	<div id="container" class:dark={theme === 'dark'}>
		{#if streamers.length > 1}
			<div id="streamers">
				{#each streamers as streamer, index}
					<div
						class="streamer"
						role="button"
						tabindex={index}
						class:active={currentStreamer === streamer}
						on:click={() => fetchStreams(streamer)}
						on:keypress={() => fetchStreams(streamer)}
					>
						{streamer.name}
					</div>
				{/each}
			</div>
		{/if}
		<div id="lower-content">
			<div id="streams">
				{#each streams as stream, index}
					<div
						class="stream"
						role="button"
						tabindex={index}
						class:active={currentStream === stream}
						on:click={() => fetchStreamStats(stream)}
						on:keypress={() => fetchStreamStats(stream)}
					>
						<h1>
							{new Date(stream.start).toLocaleDateString('default', {
								day: 'numeric',
								month: 'long',
								year: 'numeric'
							})}
						</h1>
						<div>
							{#each stream.segments as segment}
								<span class="game-name">
									{segment.game}
								</span>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			{#if currentStream}
				<StreamStats {streamStatsPromise} vodId={currentStream.vodId ?? ''} />
			{/if}
		</div>
		<div id="donation">
			If you would like to contribute to this tool's server costs, you can support me
			<a href="https://www.ko-fi.com/coolseel">here</a>
		</div>
	</div>
{:catch error}
	<p>error: {error.message}</p>
{/await}
