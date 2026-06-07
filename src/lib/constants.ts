export const SUPPORTED_LANGUAGES = [
  { code: 'el', name: 'Greek',      nativeName: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'es', name: 'Spanish',    nativeName: 'Español',   flag: '🇪🇸' },
  { code: 'fr', name: 'French',     nativeName: 'Français',  flag: '🇫🇷' },
  { code: 'it', name: 'Italian',    nativeName: 'Italiano',  flag: '🇮🇹' },
  { code: 'de', name: 'German',     nativeName: 'Deutsch',   flag: '🇩🇪' },
  { code: 'he', name: 'Hebrew',     nativeName: 'עברית',     flag: '🇮🇱' },
  { code: 'ar', name: 'Arabic',     nativeName: 'العربية',   flag: '🇸🇦' },
  { code: 'ja', name: 'Japanese',   nativeName: '日本語',     flag: '🇯🇵' },
  { code: 'zh', name: 'Mandarin',   nativeName: '普通话',     flag: '🇨🇳' },
  { code: 'ko', name: 'Korean',     nativeName: '한국어',     flag: '🇰🇷' },
  { code: 'ru', name: 'Russian',    nativeName: 'Русский',   flag: '🇷🇺' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { code: 'nl', name: 'Dutch',      nativeName: 'Nederlands',flag: '🇳🇱' },
  { code: 'tr', name: 'Turkish',    nativeName: 'Türkçe',    flag: '🇹🇷' },
  { code: 'pl', name: 'Polish',     nativeName: 'Polski',    flag: '🇵🇱' },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',    flag: '🇮🇳' },
] as const

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code']

export const LANGUAGE_LEVELS = [
  { value: 'complete_beginner', label: 'Complete Beginner', description: 'No prior knowledge' },
  { value: 'beginner',          label: 'Beginner',          description: 'Basic words and phrases' },
  { value: 'novice',            label: 'Novice',            description: 'Simple sentences' },
  { value: 'intermediate',      label: 'Intermediate',      description: 'Everyday conversations' },
  { value: 'advanced',          label: 'Advanced',          description: 'Complex topics with ease' },
] as const

export const INTERESTS = [
  { value: 'sports',        label: 'Sports',        emoji: '⚽' },
  { value: 'hiking',        label: 'Hiking',        emoji: '🥾' },
  { value: 'food',          label: 'Food',          emoji: '🍕' },
  { value: 'travel',        label: 'Travel',        emoji: '✈️' },
  { value: 'cars',          label: 'Cars',          emoji: '🚗' },
  { value: 'history',       label: 'History',       emoji: '📜' },
  { value: 'mythology',     label: 'Mythology',     emoji: '🏛️' },
  { value: 'math',          label: 'Math',          emoji: '🔢' },
  { value: 'science',       label: 'Science',       emoji: '🔬' },
  { value: 'music',         label: 'Music',         emoji: '🎵' },
  { value: 'movies',        label: 'Movies',        emoji: '🎬' },
  { value: 'animals',       label: 'Animals',       emoji: '🐾' },
  { value: 'technology',    label: 'Technology',    emoji: '💻' },
  { value: 'fantasy',       label: 'Fantasy',       emoji: '🐉' },
  { value: 'daily_life',    label: 'Daily Life',    emoji: '☀️' },
  { value: 'school',        label: 'School',        emoji: '📚' },
  { value: 'work',          label: 'Work',          emoji: '💼' },
  { value: 'relationships', label: 'Relationships', emoji: '❤️' },
  { value: 'comedy',        label: 'Comedy',        emoji: '😂' },
] as const

export const STORY_LENGTHS = [
  { value: 'very_short', label: 'Very Short', description: '~100 words' },
  { value: 'short',      label: 'Short',      description: '~200 words' },
  { value: 'medium',     label: 'Medium',     description: '~350 words' },
  { value: 'long',       label: 'Long',       description: '~500 words' },
] as const

export const AVATAR_EMOJIS = [
  '😊','😎','🤓','🥸','😄','🤩','🥳','😺',
  '🦊','🐼','🦁','🐸','🦄','🐙','🦋','🌸',
  '🌟','⚡','🎯','🚀','🎭','🎨','🎮','📚',
]
