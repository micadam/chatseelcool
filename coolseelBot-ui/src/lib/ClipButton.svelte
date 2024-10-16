<script lang="ts">
	import type { Clip } from '$lib/stream';

	export let clip: Clip;
	export let vodId: string;

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

<a href="http://twitch.tv/videos/{vodId}?t={clip.secondsSinceStart}s" target="_blank">
	<div class="clip">
		<span class="score">{clip.numMessages} pts.</span>
		<span class="time">@{getTimeStr(clip.secondsSinceStart)}</span>
	</div>
</a>

<style>
	.clip {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--border-color);
		margin: 0.5em;
		border-radius: 0.5em;
		background-color: var(--bg-primary);
		overflow: hidden;
		height: 2em;
	}

	.clip:hover {
		background-color: var(--bg-secondary);
	}
	.score {
		padding: 1em 0.5em;
		background-color: var(--bg-accent);
	}
	.time {
		padding: 1em 0.5em;
	}
</style>
