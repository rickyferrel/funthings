import { useState, useRef, useEffect } from 'react'
import './App.css'
import { WORDLE_WORDS } from './wordlist'

// Color states: 0 = gray, 1 = yellow, 2 = green
const COLORS = ['gray', 'gold', 'limegreen']
const COLOR_NAMES = ['gray', 'yellow', 'green']

function getFilteredWords(guesses: { word: string[]; colors: number[] }[]) {
  // No guesses: return all
  if (guesses.length === 0) return WORDLE_WORDS;
  return WORDLE_WORDS.filter(word => {
    return guesses.every(({ word: guess, colors }) => {
      let used = Array(5).fill(false);
      // Check green
      for (let i = 0; i < 5; i++) {
        if (colors[i] === 2 && word[i] !== guess[i].toLowerCase()) return false;
        if (colors[i] === 2) used[i] = true;
      }
      // Check yellow
      for (let i = 0; i < 5; i++) {
        if (colors[i] === 1) {
          if (word[i] === guess[i].toLowerCase()) return false;
          // Must exist elsewhere
          let found = false;
          for (let j = 0; j < 5; j++) {
            if (!used[j] && word[j] === guess[i].toLowerCase() && guess[j] !== guess[i]) {
              used[j] = true;
              found = true;
              break;
            }
          }
          if (!found) return false;
        }
      }
      // Check gray (improved logic)
      for (let i = 0; i < 5; i++) {
        if (colors[i] === 0) {
          const letter = guess[i].toLowerCase();
          const isElsewhere = guess.some((g, idx) => g === guess[i] && colors[idx] > 0);
          if (!isElsewhere && word.includes(letter)) return false;
          if (isElsewhere && word[i] === letter) return false;
        }
      }
      // Handle repeated letters: count yellow/green per letter
      const letterCounts: Record<string, { guess: number; min: number }> = {};
      for (let i = 0; i < 5; i++) {
        const l = guess[i].toLowerCase();
        if (!letterCounts[l]) letterCounts[l] = { guess: 0, min: 0 };
        letterCounts[l].guess++;
        if (colors[i] > 0) letterCounts[l].min++;
      }
      for (const l in letterCounts) {
        const maxAllowed = letterCounts[l].min;
        const wordCount = word.split('').filter(c => c === l).length;
        if (wordCount > maxAllowed) return false;
      }
      return true;
    });
  });
}

async function getHint(word: string): Promise<string> {
  // Try rhyme first
  const rhymeRes = await fetch(`https://api.datamuse.com/words?rel_rhy=${word}&max=1`);
  const rhymeData = await rhymeRes.json();
  if (rhymeData.length > 0) {
    return `Rhymes with: ${rhymeData[0].word}`;
  }
  // Try association
  const assocRes = await fetch(`https://api.datamuse.com/words?rel_trg=${word}&max=1`);
  const assocData = await assocRes.json();
  if (assocData.length > 0) {
    return `Associated with: ${assocData[0].word}`;
  }
  // Fallback: show the candidate word
  return `Try a word like: ${word.toUpperCase()}`;
}

function App() {
  const [guesses, setGuesses] = useState<{ word: string[]; colors: number[] }[]>([])
  const [currentGuess, setCurrentGuess] = useState<string[]>(['', '', '', '', ''])
  const [currentColors, setCurrentColors] = useState<number[]>([0, 0, 0, 0, 0])
  const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]
  const [hint, setHint] = useState<string>('')

  // Handle typing in a box
  const handleBoxInput = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '')
    if (!val) return
    const newGuess = [...currentGuess]
    newGuess[idx] = val[0]
    setCurrentGuess(newGuess)
    // Move to next box
    if (idx < 4 && val) {
      inputRefs[idx + 1].current?.focus()
    }
  }

  // Handle backspace
  const handleBoxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      if (currentGuess[idx]) {
        const newGuess = [...currentGuess]
        newGuess[idx] = ''
        setCurrentGuess(newGuess)
      } else if (idx > 0) {
        inputRefs[idx - 1].current?.focus()
      }
    }
  }

  // Cycle color on box click
  const handleBoxClick = (idx: number) => {
    setCurrentColors(colors => colors.map((c, i) => i === idx ? (c + 1) % 3 : c))
  }

  // Submit guess
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (currentGuess.some(l => l === '')) return
    setGuesses([...guesses, { word: [...currentGuess], colors: [...currentColors] }])
    setCurrentGuess(['', '', '', '', ''])
    setCurrentColors([0, 0, 0, 0, 0])
    inputRefs[0].current?.focus()
  }

  // Update hint when guesses change
  useEffect(() => {
    const updateHint = async () => {
      const filtered = getFilteredWords(guesses);
      if (filtered.length === 0) {
        setHint('No possible words found.');
        return;
      }
      const candidate = filtered[0];
      const hintText = await getHint(candidate);
      setHint(hintText);
    };
    if (guesses.length > 0) {
      updateHint();
    } else {
      setHint('');
    }
  }, [guesses]);

  return (
    <div className="container">
      <h1>Wordle Helper</h1>
      <form onSubmit={handleSubmit} className="guess-form">
        <div className="tiles-row">
          {[0, 1, 2, 3, 4].map(i => (
            <input
              key={i}
              ref={inputRefs[i]}
              type="text"
              maxLength={1}
              value={currentGuess[i]}
              onChange={e => handleBoxInput(e, i)}
              onKeyDown={e => handleBoxKeyDown(e, i)}
              className="tile tile-input"
              style={{ background: COLORS[currentColors[i]], color: 'white', textAlign: 'center', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '2rem', cursor: 'pointer' }}
              onClick={() => handleBoxClick(i)}
              autoFocus={i === 0}
            />
          ))}
        </div>
        <button type="submit" disabled={currentGuess.some(l => l === '')} className="submit-btn">
          Enter
        </button>
      </form>
      {/* HINT SECTION */}
      <div className="hint-section">
        <h2>Hint</h2>
        <div className="hint-box">{hint || '(A hint will appear here based on your guesses!)'}</div>
      </div>
      <h2>Previous Guesses</h2>
      <div className="guesses-list">
        {guesses.map((g, idx) => (
          <div key={idx} className="tiles-row">
            {g.word.map((ch, i) => (
              <span
                key={i}
                className="tile"
                style={{ background: COLORS[g.colors[i]], color: 'white', fontWeight: 'bold', fontSize: '2rem' }}
                title={COLOR_NAMES[g.colors[i]]}
              >
                {ch}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
