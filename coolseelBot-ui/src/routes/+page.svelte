<script lang="ts">
	import type { StreamStatsObj } from '$lib/stream';
	import { Category } from '$lib/stream';
	import type { Segment, Stream, Streamer } from '@prisma/client';
	import { onMount } from 'svelte';

	let streamersPromise: Promise<Streamer[]>;
	let currentStreamer: Streamer;
	let currentStream: Stream & { segments: Segment[] };
	let streams: (Stream & { segments: Segment[] })[] = [];
	let streamStats: StreamStatsObj;
	let currentCategory: string = '0';

	onMount(() => {
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
		const response = await fetch(`/api/streams/${stream.id}/stats`);
		streamStats = await response.json();
		currentStream = stream;
	};

	const getTimeStr = (seconds: number) => {
		let str = '';
		if (seconds >= 3600) {
			str += `${Math.floor(seconds / 3600)}h`;
			seconds %= 3600;
		}
		if (seconds >= 60) {
			str += `${Math.floor(seconds / 60)}m`;
			seconds %= 60;
		}
		str += `${seconds}s`;
		return str;
	};
</script>

{#if streamersPromise}
	{#await streamersPromise}
		<p>loading...</p>
	{:then streamers}
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
			<div id="stream-stats">
				{#if streamStats}
					<div class="category-selector">
						{#each Object.keys(Category).filter((k) => !isNaN(Number(k))) as category}
							<input
								type="radio"
								checked={currentCategory === category[0]}
								on:click={() => (currentCategory = category[0])}
								on:keypress={() => (currentCategory = category[0])}
								id={category[0]}
							/>
							<label for={category[0]}>{Category[category]}</label>
						{/each}
					</div>
					<p>
						Here are the top clips from this stream from the {Category[currentCategory]} category
					</p>
					<ol>
						{#each streamStats.categoryStats[currentCategory].topClips as clip}
							<li>
								<a
									href="http://twitch.tv/videos/{currentStream.twitchId}?t={clip.secondsSinceStart}s"
								>
									Time: {getTimeStr(clip.secondsSinceStart)}, hits: {clip.numMessages}
								</a>
							</li>
						{/each}
					</ol>
				{/if}
			</div>
		</div>
	{:catch error}
		<p>error: {error.message}</p>
	{/await}
{/if}

<style>
	:global(body) {
		font-family: 'Roboto', sans-serif;
		display: flex;
		flex-direction: column;
		height: 100vh;
		margin: 0;
		background-color: #f4f4f4;
		color: #333;
	}

	#streamers {
		display: flex;
		justify-content: space-around;
		padding: 20px;
		background-color: #fff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	#upper-content {
		margin: 0;
	}

	.streamer.active {
		background-color: #ddd;
	}
	
	#lower-content {
		display: flex;
		flex-direction: row;
		flex-grow: 1;
	}

	#streams {
		border-right: 1px solid #ddd;
		width: 25%;
		overflow: auto;
		padding: 20px;
		background-color: #fff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.game-name {
		font-size: 0.9em;
		position: relative;
		color: #666;
	}

	.game-name:not(:last-child)::after {
		content: '|';
		user-select: none;
	}

	.stream {
		border: 1px solid #ddd;
		margin: 0;
		padding: 20px;
		background-color: #fff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		animation: fadein 0.5s;
	}
	.stream:hover {
		background-color: #f4f4f4;
	}
	.stream.active {
		background-color: #ddd;
	}

	.streamer {
		margin: 0;
		padding: 0.5em;
		border: 1px solid #ddd;
		font-size: 2.5em;
		color: #333;
	}

	#stream-stats {
		padding: 1em;
		flex-grow: 1;
		align-items: left;
		justify-content: center;
		background-color: #fff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.category-selector {
		display: flex;
		font-size: 1.5em;
		font-weight: lighter;
	}

	input[type='radio'] {
		display: none;
	}

	label {
		display: inline-block;
		padding: 5px 10px;
		margin: 0;
		border: 1px solid #ddd;
		background-color: #f4f4f4;
		color: #333;
		cursor: pointer;
		transition: background-color 0.3s ease;
	}

	label:hover {
		background-color: #ddd;
	}

	input[type='radio']:checked + label {
		background-color: #ddd;
	}
</style>
