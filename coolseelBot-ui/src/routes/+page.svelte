<script lang="ts">
	import type { StreamStatsObj } from '$lib/stream';
	import type { Segment, Stream, Streamer } from '@prisma/client';
	import { onMount } from 'svelte';
	import StreamStats from '$lib/StreamStats.svelte';
	import '$lib/main.css';

	let streamersPromise: Promise<Streamer[]> = Promise.resolve([]);
	let currentStreamer: Streamer;
	let currentStream: (Stream & { segments: Segment[] }) | undefined;
	let streams: (Stream & { segments: Segment[] })[] = [];
	let streamStatsPromise: Promise<StreamStatsObj> | undefined;

	let theme = 'light';
	let showResetButton = false;

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
	};

	const fetchStreamStats = async (stream: Stream & { segments: Segment[] }) => {
		streamStatsPromise = fetch(`/api/streams/${stream.id}/stats`).then((res) => res.json());
		currentStream = stream;
	};

	const resetStreamStats = () => {
		streamStatsPromise = undefined;
		currentStream = undefined;
	};
</script>

{#await streamersPromise}
	<p>loading...</p>
{:then streamers}
	<div id="main-page">
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
						<h3>
							{new Date(stream.start).toLocaleDateString('default', {
								// day of the week
								weekday: 'long',
								day: 'numeric',
								month: 'long',
								year: 'numeric'
							})}
						</h3>
						<div class="game-names">
							{#each stream.segments as segment}
								<span class="game-name">
									{segment.game}
								</span>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			{#if streamStatsPromise && currentStream}
				<div id="stats">
					<div
						class="reset-button"
						on:click={resetStreamStats}
						on:keypress={resetStreamStats}
						role="button"
						tabindex="0"
					>
					</div>
					<StreamStats
						{streamStatsPromise}
						vodId={currentStream.vodId ?? ''}
						start={new Date(currentStream.start)}
					/>
				</div>
			{/if}
		</div>
	</div>
{:catch error}
	<p>error: {error.message}</p>
{/await}

<style>
	.reset-button {
		position: absolute;
		top: 1em;
		left: -2em;
		width: 2em;
		height: 2em;
		background-color: var(--bg-primary);
		border: 1px solid var(--border-color);
		display: flex;
		justify-content: center;
		align-items: center;
		font-weight: bold;
		cursor: pointer;
	}
</style>
