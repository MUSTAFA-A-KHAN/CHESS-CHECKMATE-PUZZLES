import React, { useState, useEffect, useCallback } from 'react';

// --- Type Definition ---
interface Puzzle {
    fen: string;
    best: string;
}

// --- Puzzle Service Logic ---
const puzzleCsv = `fen,best
1rb5/4r3/3p1npb/3kp1P1/1P3P1P/5nR1/2Q1BK2/bN4NR w - - 3 61,c2c4
rn1q2n1/b3k1pr/pp1pB1Qp/2p1p1P1/2P1PP2/5R1P/P2P4/RNB1K3 w - - 1 24,g6f7
8/3r3k/NP1p4/p2QP1P1/1BB3Pp/1R4n1/6K1/5R2 w - - 5 82,d5g8
1nr1r3/n4Q2/P1kp2N1/2p3B4/1pp3P1/6P1/1R2P2R/K5N1 w - - 3 43,f7b7
7Q/3Bk3/2P1p3/4P2P/7b/5K2/B7/1b6 w - - 3 78,h8e8
8/4nB2/7k/3P2R1/p4p2/8/P4K2/6R1 w - - 3 78,g5h5
rnbqkbnr/ppppp2p/8/5pp1/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3,d1h5
r3k3/1q3p1r/pPR1pB2/2p4p/B3b1pP/2p3P1/8/bN2K2R w - - 1 55,c6c8
1rr4q/6k1/2P1QRp1/1p2p1P1/P1P1P2p/3p1b2/P3B3/R1KN2N1 w - - 4 47,e6f7
k7/p4qn1/QPp1r3/1P1r1PB1/3N3P/1K2n3/7P/R4N1R w - - 6 55,a6c8`;

const puzzles: Puzzle[] = puzzleCsv
    .trim()
    .split('\n')
    .slice(1) // Skip header
    .map(line => {
        const [fen, best] = line.split(',');
        return { fen, best };
    });

const getRandomPuzzle = (): Puzzle => {
    const randomIndex = Math.floor(Math.random() * puzzles.length);
    return puzzles[randomIndex];
};

// --- Chessboard Component ---
interface ChessboardProps {
    fen: string;
}

const fenToBoard = (fen: string): (string | null)[][] => {
    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    const fenParts = fen.split(' ');
    const boardState = fenParts[0];

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


const Chessboard: React.FC<ChessboardProps> = ({ fen }) => {
    const board = fenToBoard(fen);
    const whoToMove = fen.split(' ')[1] === 'w' ? 'White' : 'Black';
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    return (
        <div className="w-full max-w-[512px]">
            {/* Board and Rank Labels */}
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
                                
                                return (
                                    <div
                                        key={`${rowIndex}-${colIndex}`}
                                        className={`flex-1 aspect-square flex items-center justify-center ${squareColor}`}
                                        role="gridcell"
                                        aria-label={`Square ${String.fromCharCode(97 + colIndex)}${8 - rowIndex}${piece ? `, piece ${piece}` : ''}`}
                                    >
                                        <span className={`text-4xl sm:text-5xl md:text-6xl ${pieceColor} drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]`}>
                                            {piece}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* File Labels */}
            <div className="flex">
                <div className="w-6 shrink-0 pr-2"></div> {/* Spacer for ranks */}
                <div className="flex flex-1 justify-around text-slate-400 text-sm font-bold select-none pt-1">
                    {files.map(file => <div key={file} className="flex-1 text-center">{file}</div>)}
                </div>
            </div>
            
            <div className="bg-slate-800 text-center py-1 text-sm font-semibold text-slate-300 mt-2 rounded-md">
                {whoToMove} to move
            </div>
        </div>
    );
};

// --- Puzzle Interface Component ---
interface PuzzleInterfaceProps {
    moveInput: string;
    onMoveInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmitMove: (e: React.FormEvent) => void;
    onNextPuzzle: () => void;
    feedback: 'idle' | 'correct' | 'incorrect';
    onShowAnswer: () => void;
    isAnswerShown: boolean;
    correctAnswer: string;
}

const PuzzleInterface: React.FC<PuzzleInterfaceProps> = ({
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
                        className="w-full sm:w-auto px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-emerald-500 transition-transform transform active:scale-95"
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
                className="w-full mt-2 px-6 py-3 bg-slate-700 text-slate-300 font-bold rounded-lg hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-slate-500 transition-colors"
            >
                {feedback === 'correct' ? 'Next Puzzle' : 'New Puzzle'}
            </button>
        </div>
    );
};

// --- Main App Component ---
const App: React.FC = () => {
    const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
    const [moveInput, setMoveInput] = useState<string>('');
    const [feedback, setFeedback] = useState<'idle' | 'correct' | 'incorrect'>('idle');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isAnswerVisible, setIsAnswerVisible] = useState<boolean>(false);

    const loadNextPuzzle = useCallback(() => {
        setIsLoading(true);
        setFeedback('idle');
        setMoveInput('');
        setIsAnswerVisible(false);
        setTimeout(() => {
            setCurrentPuzzle(getRandomPuzzle());
            setIsLoading(false);
        }, 200);
    }, []);

    useEffect(() => {
        loadNextPuzzle();
    }, [loadNextPuzzle]);

    const handleMoveInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMoveInput(e.target.value);
        if (feedback !== 'idle') {
            setFeedback('idle');
        }
        if (isAnswerVisible) {
            setIsAnswerVisible(false);
        }
    };

    const handleSubmitMove = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentPuzzle || !moveInput.trim()) return;

        if (moveInput.trim().toLowerCase() === currentPuzzle.best.toLowerCase()) {
            setFeedback('correct');
            setIsAnswerVisible(false);
        } else {
            setFeedback('incorrect');
        }
    };
    
    const handleShowAnswer = () => {
        setIsAnswerVisible(true);
        setFeedback('idle');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
            <header className="text-center mb-6">
                <h1 className="text-4xl md:text-5xl font-bold text-emerald-400">Chess Checkmate Puzzles</h1>
                <p className="text-slate-400 mt-2">Find the mate in one!</p>
            </header>
            <main className="w-full max-w-lg lg:max-w-xl xl:max-w-2xl bg-slate-800/50 rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col items-center ring-1 ring-slate-700">
                {isLoading || !currentPuzzle ? (
                    <div className="flex items-center justify-center aspect-square w-full max-w-[512px] text-slate-400">
                        Loading puzzle...
                    </div>
                ) : (
                    <>
                        <Chessboard fen={currentPuzzle.fen} />
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
            <footer className="text-center mt-8 text-slate-500 text-sm">
                <p>Built with React, TypeScript, and Tailwind CSS.</p>
            </footer>
        </div>
    );
};

export default App;
