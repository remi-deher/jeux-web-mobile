const PENDU_WORDS = [
  "ACCORDEON", "AQUARELLE", "AVALANCHE", "BOUQUETIN", "BOUSSOLE", "CATHEDRALE", 
  "CHALET", "COLIBRIS", "DYNAMITE", "ESCALADE", "FALAISE", "GIRAFE", "HORLOGE", 
  "LABYRINTHE", "MARIONNETTE", "NAVIGATEUR", "ORDINATEUR", "PAPILLON", "TOURNESOL", 
  "VALISE", "XYLOPHONE", "ZEBRE", "BICYCLETTE", "CARAVANE", "DOMINO", "ELEPHANT",
  "FROMAGE", "GUITARE", "HEDGEHOG", "IGLOO", "JAGUAR", "KANGOUROU", "LION",
  "MONTGOLFIERE", "NUAGE", "ORAGE", "PARAPLUIE", "QUARTZ", "REQUIN", "SATELLITE",
  "TRAMPOLINE", "VOLCAN", "WAGON", "YACHT"
];

export interface PenduState {
  word: string;
  guessedLetters: string[];
  errors: number;
  maxErrors: number;
  currentPlayer: number; // 1 or 2
  scoreP1: number;
  scoreP2: number;
  winner: number | 'draw' | null;
}

export function createInitialPenduState(): PenduState {
  const randomIndex = Math.floor(Math.random() * PENDU_WORDS.length);
  const selectedWord = PENDU_WORDS[randomIndex].toUpperCase();
  return {
    word: selectedWord,
    guessedLetters: [],
    errors: 0,
    maxErrors: 7,
    currentPlayer: 1,
    scoreP1: 0,
    scoreP2: 0,
    winner: null
  };
}

export function makePenduGuess(state: PenduState, letter: string, playerNum: number): boolean {
  if (state.winner !== null) return false;
  if (playerNum !== state.currentPlayer) return false;

  const upperLetter = letter.toUpperCase();
  if (state.guessedLetters.includes(upperLetter)) return false;

  state.guessedLetters.push(upperLetter);

  const isCorrect = state.word.includes(upperLetter);

  if (isCorrect) {
    // Count occurrences of the letter to award points
    const occurrences = state.word.split("").filter(c => c === upperLetter).length;
    if (playerNum === 1) {
      state.scoreP1 += occurrences * 10;
    } else {
      state.scoreP2 += occurrences * 10;
    }
  } else {
    state.errors += 1;
    if (playerNum === 1) {
      state.scoreP1 = Math.max(0, state.scoreP1 - 5);
    } else {
      state.scoreP2 = Math.max(0, state.scoreP2 - 5);
    }
  }

  // Check if word is fully guessed
  const isWordGuessed = state.word.split("").every(char => state.guessedLetters.includes(char));

  if (isWordGuessed) {
    // Game completed! Winner is the one with the highest score
    if (state.scoreP1 > state.scoreP2) {
      state.winner = 1;
    } else if (state.scoreP2 > state.scoreP1) {
      state.winner = 2;
    } else {
      state.winner = 'draw';
    }
  } else if (state.errors >= state.maxErrors) {
    // Hangman fully drawn, game lost!
    state.winner = 'draw'; // Everybody loses
  } else {
    // Switch turns
    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  }

  return true;
}
