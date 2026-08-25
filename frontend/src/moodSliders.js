export const MOOD_SLIDERS = [
  { key: "energy", label: "Energy", lo: "Calm", hi: "Intense" },
  { key: "valence", label: "Mood", lo: "Sad", hi: "Happy" },
  { key: "danceability", label: "Danceability", lo: "Still", hi: "Groovy" },
  { key: "acousticness", label: "Acousticness", lo: "Electronic", hi: "Acoustic" },
  { key: "liveness", label: "Liveness", lo: "Studio", hi: "Live" },
  { key: "speechiness", label: "Speechiness", lo: "Music", hi: "Spoken" },
];

export const DEFAULT_MOOD_VALUES = {
  energy: 0.5,
  valence: 0.5,
  danceability: 0.5,
  acousticness: 0.5,
  liveness: 0.5,
  speechiness: 0.5,
};
