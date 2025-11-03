import React, { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';

const audioUrl = 'kira_death_note.mp3';

// --- Type Definition ---
interface Puzzle {
    fen: string;
    best: string;
}

// --- Helper Functions ---
const parseCsv = (csv: string): Puzzle[] => {
    return csv
        .trim()
        .split('\n')
        .slice(1)
        .map(line => {
            const [fen, best] = line.split(',');
            return { fen, best };
        });
};

const getRandomPuzzle = (puzzles: Puzzle[]): Puzzle => {
    const randomIndex = Math.floor(Math.random() * puzzles.length);
    return puzzles[randomIndex];
};

const fenToBoard = (fen: string): (string | null)[][] => {
    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    const boardState = fen.split(' ')[0];
    const pieceMap: { [key: string]: string } = {
        'p': '♟︎', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
        'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
    };
    let row = 0;
    let col = 0;

    for (const char of boardState) {
        if (char === '/') {
            row++;
            col = 0;
        } else if (/\d/.test(char)) {
            col += parseInt(char, 10);
        } else {
            if (row < 8 && col < 8) {
                board[row][col] = pieceMap[char];
            }
            col++;
        }
    }
    return board;
};
let flagForPiece = false;
let r1;
let r2;

// --- Chessboard Component ---
const Chessboard: React.FC<{ fen: string; currentPuzzle: Puzzle | null; onFeedbackChange: (feedback: 'idle' | 'correct' | 'incorrect') => void; showCongrats: boolean; setShowCongrats: (show: boolean) => void; setCurrentFen: (fen: string) => void }> = ({ fen, currentPuzzle, setFeedback,
    setIsAnswerVisible, setSolveTime, elapsedTime, showCongrats, setShowCongrats, setCurrentFen }) => {

    const [selectedSquare, setSelectedSquare] = useState<{ row: number, col: number } | null>(null);

    const board = fenToBoard(fen);
    const whoToMove = fen.split(' ')[1] === 'w' ? 'White' : 'Black';
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    return (
        <div className="w-full max-w-[512px]">
            <div className="flex">
                <div className="flex flex-col justify-around text-slate-400 text-sm font-bold select-none pr-2">
                    {ranks.map(rank => <div key={rank} className="h-full flex-1 flex items-center justify-center">{rank}</div>)}
                </div>
                <div className="w-full aspect-square flex flex-col shadow-lg rounded-md overflow-hidden bg-slate-700">
                    {board.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex flex-row flex-1">
                            {row.map((piece, colIndex) => {
                                const isLight = (rowIndex + colIndex) % 2 === 0;
                                const squareColor = isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]';
                                const pieceColor = piece && '♔♕♖♗♘♙'.includes(piece) ? 'text-slate-100' : 'text-slate-900';
                                function handleClickOnBlankPiece(rowIndex: number, colIndex: number) {
                                    // throw new Error('Function not implemented.');
                                    console.log("rowIndex", ranks[rowIndex]);
                                    console.log("colIndex", files[colIndex]);
                                    const result = files[colIndex] + ranks[rowIndex];
                                    console.log(result);
                                    console.log(flagForPiece);
                                    if (!flagForPiece) {
                                        console.log("inside if", flagForPiece);
                                        flagForPiece = true;
                                        r1 = result;
                                        setSelectedSquare({ row: rowIndex, col: colIndex });
                                        //when  clicked this button highlight it.
                                        console.log("inside if after ", flagForPiece);
                                    } else {
                                        console.log("inside else", flagForPiece);
                                        r2 = result;
                                        console.log("r:", r1 + r2);
                                        // Implement the check if the result is acceptable or not
                                        if (currentPuzzle) {
                                            // console.log("Correct answer::::", currentPuzzle.best.toLowerCase())
                                            const bestMove = currentPuzzle.best.toLowerCase();
                                            let answer = r1 + r2;
                                            if (answer === bestMove) {
                                                // console.log("correct");
                                                setFeedback('correct');
                                                new Audio(audioUrl).play();
                                                setIsAnswerVisible(false);
                                                setSolveTime(elapsedTime);
                                                setShowCongrats(true);
                                                // Update FEN after correct move
                                                const chess = new Chess(fen);
                                                chess.move(currentPuzzle.best);
                                                setCurrentFen(chess.fen());
                                                // Hide congrats after 3 seconds
                                                setTimeout(() => setShowCongrats(false), 2000);
                                            } else {
                                                // console.log("Incorrect")
                                            }
                                        }
                                        flagForPiece = false;
                                        setSelectedSquare(null);
                                    }
                                }


                                const isSelected = selectedSquare && selectedSquare.row === rowIndex && selectedSquare.col === colIndex;
                                return (
                                    <div
                                        key={`${rowIndex}-${colIndex}`}
                                        style={{ cursor: "pointer" }}
                                        onClick={() => handleClickOnBlankPiece(rowIndex, colIndex)}
                                        className={`flex-1 aspect-square flex items-center justify-center ${squareColor} ${isSelected ? 'ring-4 ring-yellow-400' : ''}`}
                                        role="gridcell"
                                    >
                                        <span style={{ cursor: "pointer" }} className={`text-4xl  sm:text-5xl md:text-6xl ${pieceColor} drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]`}>
                                            {piece}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex">
                <div className="w-6 shrink-0 pr-2"></div>
                <div className="flex flex-1 justify-around text-slate-400 text-sm font-bold select-none pt-1">
                    {files.map(file => <div key={file} className="flex-1 text-center">{file}</div>)}
                </div>
            </div>

            <div className="bg-slate-800 text-center py-1 text-sm font-semibold text-slate-300 mt-2 rounded-md">
                {whoToMove} to move
            </div>
            {showCongrats && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div class="bg-yellow-400 text-gray-900 text-3xl font-bold px-10 py-5 rounded-lg border-4 border-yellow-600 shadow-2xl transform hover:-translate-y-1 transition duration-150">
                        Congratulations! Checkmate!
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Puzzle Interface Component ---
const PuzzleInterface: React.FC<{
    moveInput: string;
    onMoveInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmitMove: (e: React.FormEvent) => void;
    onNextPuzzle: () => void;
    feedback: 'idle' | 'correct' | 'incorrect';
    onShowAnswer: () => void;
    isAnswerShown: boolean;
    correctAnswer: string;
}> = ({
    moveInput,
    onMoveInputChange,
    onSubmitMove,
    onNextPuzzle,
    feedback,
    onShowAnswer,
    isAnswerShown,
    correctAnswer
}) => {
        const feedbackClasses = {
            idle: 'border-slate-600 focus:border-emerald-500 focus:ring-emerald-500',
            correct: 'border-green-500 bg-green-900/50 ring-2 ring-green-500 text-green-300',
            incorrect: 'border-red-500 bg-red-900/50 ring-2 ring-red-500 text-red-300'
        };

        const feedbackMessages = {
            correct: 'Correct! Well done.',
            incorrect: 'Not quite, try again!'
        };

        return (
            <div className="w-full max-w-sm mt-6 text-center">
                <form onSubmit={onSubmitMove} className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative w-full">
                        <input
                            type="text"
                            value={moveInput}
                            onChange={onMoveInputChange}
                            placeholder="e.g., Qf7"
                            className={`w-full px-4 py-3 bg-slate-900/70 border-2 rounded-lg text-lg text-center transition-all duration-300 focus:outline-none ${feedbackClasses[feedback]}`}
                            aria-label="Enter your move"
                            aria-describedby="feedback-message"
                            disabled={feedback === 'correct'}
                        />
                        {feedback !== 'idle' && (
                            <p id="feedback-message" className={`mt-2 text-sm font-medium ${feedback === 'correct' ? 'text-green-400' : 'text-red-400'}`}>
                                {feedbackMessages[feedback]}
                            </p>
                        )}
                    </div>

                    {feedback !== 'correct' && (
                        <button
                            type="submit"
                            className="w-full sm:w-auto px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 transition-transform transform active:scale-95"
                        >
                            Submit
                        </button>
                    )}
                </form>

                <div className="h-8 mt-4 flex items-center justify-center">
                    {feedback !== 'correct' && !isAnswerShown && (
                        <button
                            type="button"
                            onClick={onShowAnswer}
                            className="text-slate-400 hover:text-emerald-400 text-sm font-medium transition-colors underline"
                            aria-label="Show correct answer"
                        >
                            Show Answer
                        </button>
                    )}
                    {isAnswerShown && (
                        <p className="text-lg text-amber-400 font-bold">
                            Correct move: <span className="font-mono">{correctAnswer}</span>
                        </p>
                    )}
                </div>

                <button
                    onClick={onNextPuzzle}
                    className="w-full mt-2 px-6 py-3 bg-slate-700 text-slate-300 font-bold rounded-lg hover:bg-slate-600"
                >
                    {feedback === 'correct' ? 'Next Puzzle' : 'New Puzzle'}
                </button>
            </div>
        );
    };

// --- Main App Component ---
const App: React.FC = () => {
    const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
    const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
    const [moveInput, setMoveInput] = useState<string>('');
    const [feedback, setFeedback] = useState<'idle' | 'correct' | 'incorrect'>('idle');
    const [isAnswerVisible, setIsAnswerVisible] = useState<boolean>(false);
    const [elapsedTime, setElapsedTime] = useState<number>(0);
    const [solveTime, setSolveTime] = useState<number | null>(null);
    const [currentFen, setCurrentFen] = useState<string>('');
    const [showCongrats, setShowCongrats] = useState<boolean>(false);

    useEffect(() => {
        fetch('test.csv')
            .then(res => res.text())
            .then(csv => {
                const parsed = parseCsv(csv);
                setPuzzles(parsed);
                const puzzle = getRandomPuzzle(parsed);
                setCurrentPuzzle(puzzle);
                setCurrentFen(puzzle.fen);
            });
    }, []);

    useEffect(() => {
        if (!currentPuzzle) return;

        const interval = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, [currentPuzzle]);

    const loadNextPuzzle = useCallback(() => {
        setFeedback('idle');
        setMoveInput('');
        setIsAnswerVisible(false);
        setElapsedTime(0);
        setSolveTime(null);
        setShowCongrats(false);
        if (puzzles.length > 0) {
            const puzzle = getRandomPuzzle(puzzles);
            setCurrentPuzzle(puzzle);
            setCurrentFen(puzzle.fen);
        }
    }, [puzzles]);

    const handleMoveInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMoveInput(e.target.value);
        if (feedback !== 'idle') setFeedback('idle');
        if (isAnswerVisible) setIsAnswerVisible(false);
    };

    const handleSubmitMove = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPuzzle || !moveInput.trim()) return;
        if (moveInput.trim().toLowerCase() === currentPuzzle.best.toLowerCase()) {
            setFeedback('correct');
            new Audio(audioUrl).play();
            setIsAnswerVisible(false);
            setSolveTime(elapsedTime);
            setShowCongrats(true);
            // Update FEN after correct move
            const chess = new Chess(currentFen);
            chess.move(currentPuzzle.best);
            setCurrentFen(chess.fen());
            // Hide congrats after 3 seconds
            setTimeout(() => setShowCongrats(false), 3000);
        } else {
            setFeedback('incorrect');
        }
    };

    const handleShowAnswer = () => {
        setIsAnswerVisible(true);
        setFeedback('idle');
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
            <header className="text-center mb-6">
                <h1 className="text-4xl font-bold text-emerald-400">Chess Checkmate Puzzles</h1>
                <p className="text-slate-400 mt-2">Find the mate in one!</p>
            </header>

            <main className="w-full max-w-xl bg-slate-800/50 rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col items-center ring-1 ring-slate-700">
                {!currentPuzzle ? (
                    <div className="text-slate-400">Loading puzzle...</div>
                ) : (
                    <>
                        <Chessboard fen={currentFen}
                            currentPuzzle={currentPuzzle}
                            onFeedbackChange={setFeedback}
                            onSubmitMove={handleSubmitMove}
                            setFeedback={setFeedback}
                            setIsAnswerVisible={setIsAnswerVisible}
                            setSolveTime={setSolveTime}
                            elapsedTime={elapsedTime}
                            showCongrats={showCongrats}
                            setShowCongrats={setShowCongrats}
                            setCurrentFen={setCurrentFen}
                        />
                        <PuzzleInterface
                            moveInput={moveInput}
                            onMoveInputChange={handleMoveInputChange}
                            onSubmitMove={handleSubmitMove}
                            onNextPuzzle={loadNextPuzzle}
                            feedback={feedback}
                            onShowAnswer={handleShowAnswer}
                            isAnswerShown={isAnswerVisible}
                            correctAnswer={currentPuzzle.best}
                        />
                    </>
                )}

            </main>
            <header className="text-center mb-6">
                {currentPuzzle && (
                    <div className="text-slate-300 mt-4 text-lg font-mono">
                        Time: {formatTime(elapsedTime)}
                        {solveTime !== null && (
                            <span className="text-green-400 ml-4">Solved in {formatTime(solveTime)}</span>
                        )}
                    </div>
                )}

            </header>

            <footer className="text-center mt-8 text-slate-500 text-sm">
                <p>Built with React, TypeScript, and Tailwind CSS.</p>
            </footer>
        </div>
    );
};

export default App;
