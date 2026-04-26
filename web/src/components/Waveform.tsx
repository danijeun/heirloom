const WAVE_HEIGHTS = [3,6,10,14,18,14,10,6,3,6,12,16,8,4];

interface Props {
  playing: boolean;
  recording: boolean;
  bars?: number;
}

export function Waveform({ playing, recording, bars = 14 }: Props) {
  const active = playing || recording;
  return (
    <div className="popup-waveform">
      {Array.from({ length: bars }, (_, i) => {
        const h = WAVE_HEIGHTS[i % WAVE_HEIGHTS.length];
        return (
          <div key={i}
            className={`wave-bar${active ? (recording ? ' recording' : ' active') : ''}`}
            style={{
              height: active ? undefined : h * 0.32 + 2,
              animationDuration: active ? `${0.4 + (i % 4) * 0.13}s` : undefined,
              animationDelay:    active ? `${i * 0.035}s` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
