import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { useGyroscope } from './hooks/useGyroscope';
const audioUrl = 'kira_death_note.mp3';

// --- Type Definition ---
interface Puzzle {
    fen: string;
    best: string;
}

type GameMode = 'one' | 'two' | 'engine-easy';

const ENGINE_EASY_PUZZLE: Puzzle = {
    fen: new Chess().fen(),
    best: ''
};

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

const getEasyEngineMove = (chess: Chess) => {
    const legalMoves = chess.moves({ verbose: true });
    const captures = legalMoves.filter(move => move.captured);
    const candidateMoves = captures.length > 0 && Math.random() < 0.35 ? captures : legalMoves;
    return candidateMoves[Math.floor(Math.random() * candidateMoves.length)];
};

type PromotionPiece = 'q' | 'r' | 'b' | 'n';

const announceMove = (chess: Chess, move: { from: string; to: string; promotion?: string }) => {
    if (!('speechSynthesis' in window)) return;
    const pieceNames: Record<string, string> = {
        p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king'
    };
    const piece = chess.get(move.from);
    const name = pieceNames[piece?.type ?? 'p'];
    const promotion = move.promotion ? `, promoting to ${pieceNames[move.promotion]}` : '';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(`${name} moves from ${move.from} to ${move.to}${promotion}`));
};

const fenToBoard = (fen: string): (string | null)[][] => {
    const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    const pieceMap: { [key: string]: string } = {
        'p': '♟︎', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
        'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
    };
    const boardState = fen.split(' ')[0];
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
const Chessboard: React.FC<{ fen: string; currentPuzzle: Puzzle | null; mode: GameMode; currentMoveIndex: number; moves: string[]; setFeedback: (feedback: 'idle' | 'correct' | 'incorrect') => void; setIsAnswerVisible: (visible: boolean) => void; setSolveTime: (time: number) => void; elapsedTime: number; showCongrats: boolean; setShowCongrats: (show: boolean) => void; setCurrentFen: (fen: string) => void; setCurrentMoveIndex: (index: number) => void; motionMode: boolean; gyroscopeData: { alpha: number | null; beta: number | null; gamma: number | null; isAvailable: boolean; isListening: boolean; error: string | null; }; requestGyroAccess: () => Promise<boolean>; stopGyroListening: () => void; }> = ({ fen, currentPuzzle, mode, currentMoveIndex, moves, setFeedback, setIsAnswerVisible, setSolveTime, elapsedTime, showCongrats, setShowCongrats, setCurrentFen, setCurrentMoveIndex, motionMode, gyroscopeData, requestGyroAccess, stopGyroListening }) => {

    const [selectedSquare, setSelectedSquare] = useState<{ row: number, col: number } | null>(null);
    const [motionCursor, setMotionCursor] = useState<{ row: number, col: number }>({ row: 4, col: 4 }); // Start in center
    const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(null);
    const previousFen = useRef(fen);
    const [animatedSquare, setAnimatedSquare] = useState<{ row: number; col: number } | null>(null);

    const board = fenToBoard(fen);
    const whoToMove = fen.split(' ')[1] === 'w' ? 'White' : 'Black';
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    useEffect(() => {
        if (previousFen.current !== fen) {
            const previousBoard = fenToBoard(previousFen.current);
            const nextBoard = fenToBoard(fen);
            let destination: { row: number; col: number } | null = null;
            nextBoard.forEach((row, rowIndex) => row.forEach((piece, colIndex) => {
                if (piece && piece !== previousBoard[rowIndex][colIndex]) destination = { row: rowIndex, col: colIndex };
            }));
            setAnimatedSquare(destination);
            previousFen.current = fen;
        }
    }, [fen]);

    const isPromotionMove = (from: string, to: string) => {
        const chess = new Chess(fen);
        const piece = chess.get(from as `${string}${number}`);
        return piece?.type === 'p' && (to[1] === '1' || to[1] === '8');
    };

    const choosePromotion = (promotion: PromotionPiece) => {
        if (!pendingPromotion) return;
        const { from, to } = pendingPromotion;
        setPendingPromotion(null);
        flagForPiece = false;
        setSelectedSquare(null);
        if (mode === 'engine-easy') {
            const chess = new Chess(fen);
            try {
                const move = chess.move({ from, to, promotion });
                announceMove(new Chess(fen), move);
                setCurrentFen(chess.fen());
                setFeedback('correct');
                setTimeout(() => {
                    const engine = new Chess(chess.fen());
                    const engineMove = getEasyEngineMove(engine);
                    if (engineMove) {
                        announceMove(new Chess(chess.fen()), engineMove);
                        engine.move(engineMove);
                        setCurrentFen(engine.fen());
                    }
                    setFeedback('idle');
                }, 450);
            } catch (e) {
                setFeedback('incorrect');
            }
        } else if (currentPuzzle) {
            const chess = new Chess(fen);
            const candidate = `${from}${to}${promotion}`;
            const expected = (mode === 'one' ? currentPuzzle.best : moves[currentMoveIndex] ?? '')
                .toLowerCase()
                .replace(/[+#]$/, '');
            if (candidate !== expected) {
                setFeedback('incorrect');
                return;
            }

            try {
                const move = chess.move({ from, to, promotion });
                announceMove(new Chess(fen), move);
                setCurrentFen(chess.fen());
                setFeedback('correct');
                if (mode === 'one') {
                    setSolveTime(elapsedTime);
                    setShowCongrats(true);
                    setTimeout(() => setShowCongrats(false), 2000);
                } else {
                    const newIndex = currentMoveIndex + 1;
                    setCurrentMoveIndex(newIndex);
                    if (newIndex === 1 && moves[1]) {
                        const response = new Chess(chess.fen());
                        const responseMove = /^[a-h][1-8][a-h][1-8]/.test(moves[1])
                            ? response.move({ from: moves[1].slice(0, 2), to: moves[1].slice(2, 4) })
                            : response.move(moves[1]);
                        if (responseMove) {
                            announceMove(new Chess(chess.fen()), responseMove);
                            setCurrentFen(response.fen());
                        }
                        setCurrentMoveIndex(2);
                    } else if (newIndex === moves.length) {
                        setSolveTime(elapsedTime);
                        setShowCongrats(true);
                        setTimeout(() => setShowCongrats(false), 2000);
                    }
                }
            } catch (e) {
                setFeedback('incorrect');
            }
        }
    };

    // Motion-based input logic
    useEffect(() => {
        if (!motionMode || !gyroscopeData.isListening) return;

        const { beta, gamma } = gyroscopeData;
        if (beta !== null && gamma !== null) {
            // Map tilt to cursor movement
            // Beta (pitch): forward/backward tilt -> row change
            // Gamma (roll): left/right tilt -> col change
            const sensitivity = 10; // Degrees per square
            const deltaRow = Math.round(beta / sensitivity);
            const deltaCol = Math.round(gamma / sensitivity);

            setMotionCursor(prev => ({
                row: Math.max(0, Math.min(7, prev.row + deltaRow)),
                col: Math.max(0, Math.min(7, prev.col + deltaCol))
            }));
        }
    }, [gyroscopeData, motionMode]);

    // Handle motion-based move confirmation (e.g., double tilt or shake)
    const handleMotionConfirm = useCallback(() => {
        if (!motionMode || !currentPuzzle) return;

        const { row, col } = motionCursor;
        const result = files[col] + ranks[row];
        console.log("Motion selected:", result);

        if (!flagForPiece) {
            flagForPiece = true;
            r1 = result;
            setSelectedSquare({ row, col });
        } else {
            r2 = result;
            if (isPromotionMove(r1, r2)) {
                setPendingPromotion({ from: r1, to: r2 });
                return;
            }
            const answer = r1 + r2;
            // Similar logic as click-based
            if (mode === 'engine-easy') {
                const chess = new Chess(fen);
                try {
                    const move = chess.move({ from: r1, to: r2 });
                    announceMove(new Chess(fen), move);
                    setCurrentFen(chess.fen());
                    setFeedback('correct');
                    setTimeout(() => {
                        const engine = new Chess(chess.fen());
                        const engineMove = getEasyEngineMove(engine);
                        if (engineMove) {
                            engine.move(engineMove);
                            setCurrentFen(engine.fen());
                        }
                        setFeedback('idle');
                    }, 450);
                } catch (e) {
                    setFeedback('incorrect');
                }
            } else if (mode === 'one') {
                const bestMove = currentPuzzle.best.toLowerCase();
                if (answer === bestMove) {
                    setFeedback('correct');
                    new Audio(audioUrl).play();
                    setIsAnswerVisible(false);
                    setSolveTime(elapsedTime);
                    setShowCongrats(true);
                    const chess = new Chess(fen);
                    chess.move(currentPuzzle.best);
                    setCurrentFen(chess.fen());
                    setTimeout(() => setShowCongrats(false), 2000);
                } else {
                    setFeedback('incorrect');
                }
            } else if (mode === 'two') {
                // Similar two-move logic
                const chess = new Chess(fen);
                try {
                    const move = chess.move({ from: r1, to: r2 });
                    if (move && r1 + r2 === moves[currentMoveIndex].toLowerCase()) {
                        setFeedback('correct');
                        setCurrentFen(chess.fen());
                        const newIndex = currentMoveIndex + 1;
                        setCurrentMoveIndex(newIndex);
                        if (newIndex === 1) {
                            const chess2 = new Chess(chess.fen());
                            const moveStr = moves[1];
                            let blackMove;
                            if (/^[a-h][1-8][a-h][1-8]/.test(moveStr)) {
                                blackMove = chess2.move({ from: moveStr.slice(0, 2), to: moveStr.slice(2, 4) });
                            } else {
                                blackMove = chess2.move(moveStr);
                            }
                            if (!blackMove) console.warn("Invalid move:", moveStr);
                            setCurrentFen(chess2.fen());
                            setCurrentMoveIndex(2);
                        } else if (newIndex === moves.length) {
                            new Audio(audioUrl).play();
                            setIsAnswerVisible(false);
                            setSolveTime(elapsedTime);
                            setShowCongrats(true);
                            setTimeout(() => setShowCongrats(false), 2000);
                        }
                    } else {
                        setFeedback('incorrect');
                    }
                } catch (e) {
                    setFeedback('incorrect');
                }
            }
            flagForPiece = false;
            setSelectedSquare(null);
        }
    }, [motionMode, motionCursor, currentPuzzle, mode, moves, currentMoveIndex, setFeedback, setIsAnswerVisible, setSolveTime, elapsedTime, setShowCongrats, setCurrentFen, setCurrentMoveIndex, fen]);

    // Detect shake or specific tilt for confirmation
    useEffect(() => {
        if (!motionMode || !gyroscopeData.isListening) return;

        const { beta, gamma } = gyroscopeData;
        if (beta !== null && gamma !== null) {
            // Simple shake detection: large change in gamma
            if (Math.abs(gamma) > 45) { // Tilt more than 45 degrees
                handleMotionConfirm();
            }
        }
    }, [gyroscopeData, motionMode, handleMotionConfirm]);

    return (
        <div className="w-full max-w-[512px]">
            <style>{`
                @keyframes pieceSlide {
                    0% { transform: translate3d(-18px, -18px, 0) scale(.72); opacity: .15; }
                    65% { transform: translate3d(4px, 4px, 0) scale(1.04); opacity: 1; }
                    100% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
                }
                @keyframes promotionPop {
                    0% { opacity: 0; transform: translateY(10px) scale(.96); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
            <div className="flex">
                <div className="flex flex-col justify-around text-slate-400 text-sm font-bold select-none pr-2">
                    {ranks.map(rank => <div key={rank} className="h-full flex-1 flex items-center justify-center">{rank}</div>)}
                </div>
                <div className="relative w-full aspect-square flex flex-col shadow-lg rounded-md overflow-hidden bg-slate-700 ring-1 ring-white/10 transition-shadow duration-500 hover:shadow-emerald-900/40">
                    {board.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex flex-row flex-1">
                            {row.map((piece, colIndex) => {
                                const isLight = (rowIndex + colIndex) % 2 === 0;
                                const squareColor = isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]';
                                const pieceColor = piece && '♔♕♖♗♘♙'.includes(piece) ? 'text-slate-100' : 'text-slate-900';
                                function handleClickOnBlankPiece(rowIndex: number, colIndex: number) {
                                    if (motionMode) return; // Disable click in motion mode
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
                                        console.log("inside if after ", flagForPiece);
                                    } else {
                                        console.log("inside else", flagForPiece);
                                        r2 = result;
                                        if (isPromotionMove(r1, r2)) {
                                            setPendingPromotion({ from: r1, to: r2 });
                                            return;
                                        }
                                        console.log("r:", r1 + r2);
                                        if (currentPuzzle) {
                                            const answer = r1 + r2;
                                            if (mode === 'engine-easy') {
                                                const chess = new Chess(fen);
                                                try {
                                                    const move = chess.move({ from: r1, to: r2 });
                                                    announceMove(new Chess(fen), move);
                                                    setCurrentFen(chess.fen());
                                                    setFeedback('correct');
                                                    setTimeout(() => {
                                                        const engine = new Chess(chess.fen());
                                                        const engineMove = getEasyEngineMove(engine);
                                                        if (engineMove) {
                                                            engine.move(engineMove);
                                                            setCurrentFen(engine.fen());
                                                        }
                                                        setFeedback('idle');
                                                    }, 450);
                                                } catch (e) {
                                                    setFeedback('incorrect');
                                                }
                                            } else if (mode === 'one') {
                                                const bestMove = currentPuzzle.best.toLowerCase();
                                                console.log("BM:", bestMove);
                                                if (answer === bestMove) {
                                                    setFeedback('correct');
                                                    new Audio(audioUrl).play();
                                                    setIsAnswerVisible(false);
                                                    setSolveTime(elapsedTime);
                                                    setShowCongrats(true);
                                                    console.log(fen);
                                                    const chess = new Chess(fen);
                                                    chess.move(currentPuzzle.best);
                                                    setCurrentFen(chess.fen());
                                                    setTimeout(() => setShowCongrats(false), 2000);
                                                } else {
                                                    setFeedback('incorrect');
                                                }
                                            } else if (mode === 'two') {
                                                console.log("Two Move mode")
                                                console.log(fen);
                                                const chess = new Chess(fen);
                                                console.log("CMI", moves[currentMoveIndex].toLowerCase());
                                                try {
                                                    const move = chess.move({ from: r1, to: r2 });
                                                    if (move && r1+r2 === moves[currentMoveIndex].toLowerCase()) {
                                                    // if (true) {
                                                        console.log("Index:", currentMoveIndex)
                                                        console.log("correct move::::)")
                                                        setFeedback('correct');
                                                        console.log(fen);
                                                        setCurrentFen(chess.fen());
                                                        const newIndex = currentMoveIndex + 1;
                                                        console.log("correct move::::2)")
                                                        setCurrentMoveIndex(newIndex);
                                                        if (newIndex === 1) {
                                                            // Apply black's move immediately
                                                            console.log("correct move::::3)");
                                                            const chess2 = new Chess(chess.fen());
                                                            console.log("IMplemente0")
                                                            console.log("MOve", moves[1]);
                                                            console.log("MOves", moves);

                                                            try {
                                                                const moveStr = moves[1];
                                                                let blackMove;

                                                                if (/^[a-h][1-8][a-h][1-8]/.test(moveStr)) {
                                                                    // Coordinate format like e7c6
                                                                    blackMove = chess2.move({ from: moveStr.slice(0, 2), to: moveStr.slice(2, 4) });
                                                                } else {
                                                                    // SAN format like Nf6
                                                                    blackMove = chess2.move(moveStr);
                                                                }

                                                                if (!blackMove) console.warn("Invalid move:", moveStr);
                                                                if (!blackMove) {
                                                                    console.warn('Invalid move:', moves[1]);
                                                                }
                                                            } catch (err) {
                                                                console.error('Chess move failed:', err);
                                                            }

                                                            console.log("IMplemente0.1")
                                                            console.log(chess2.fen())
                                                            setCurrentFen(chess2.fen());
                                                            console.log("IMplemente0.2")
                                                            setCurrentMoveIndex(2);
                                                            console.log("IMplemente")
                                                        } else if (newIndex === moves.length) {
                                                            // Checkmate
                                                            new Audio(audioUrl).play();
                                                            setIsAnswerVisible(false);
                                                            setSolveTime(elapsedTime);
                                                            setShowCongrats(true);
                                                            setTimeout(() => setShowCongrats(false), 2000);
                                                        }
                                                    } else {
                                                        setFeedback('incorrect');
                                                    }
                                                } catch (e) {
                                                    setFeedback('incorrect');
                                                }
                                            }
                                        }
                                        flagForPiece = false;
                                        setSelectedSquare(null);
                                    }
                                }


                                const isSelected = selectedSquare && selectedSquare.row === rowIndex && selectedSquare.col === colIndex;
                                const isMotionCursor = motionMode && motionCursor.row === rowIndex && motionCursor.col === colIndex;
                                return (
                                    <div
                                        key={`${rowIndex}-${colIndex}`}
                                        style={{ cursor: motionMode ? "default" : "pointer" }}
                                        onClick={() => !motionMode && handleClickOnBlankPiece(rowIndex, colIndex)}
                                        className={`flex-1 aspect-square flex items-center justify-center ${squareColor} transition-all duration-300 ease-out ${isSelected ? 'ring-4 ring-yellow-400 scale-[.96] z-10' : ''} ${isMotionCursor ? 'ring-4 ring-blue-400' : ''}`}
                                        role="gridcell"
                                    >
                                        <span style={{ cursor: motionMode ? "default" : "pointer", animation: animatedSquare?.row === rowIndex && animatedSquare?.col === colIndex ? 'pieceSlide 420ms cubic-bezier(.22, 1, .36, 1)' : undefined }} className={`text-4xl sm:text-5xl md:text-6xl ${pieceColor} drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-out hover:scale-110`}>
                                            {piece}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                    {pendingPromotion && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/65 backdrop-blur-sm" style={{ animation: 'promotionPop 220ms ease-out' }}>
                            <div className="mx-4 rounded-2xl border border-white/15 bg-slate-900/95 p-4 text-center shadow-2xl">
                                <p className="mb-3 text-sm font-semibold text-white">Choose your promotion</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['q', 'r', 'b', 'n'] as PromotionPiece[]).map(piece => (
                                        <button
                                            key={piece}
                                            type="button"
                                            onClick={() => choosePromotion(piece)}
                                            className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-700 text-4xl text-white shadow-md transition-all duration-200 hover:-translate-y-1 hover:bg-emerald-600 hover:shadow-emerald-500/30 active:scale-90"
                                            aria-label={`Promote to ${piece === 'q' ? 'queen' : piece === 'r' ? 'rook' : piece === 'b' ? 'bishop' : 'knight'}`}
                                        >
                                            {piece === 'q' ? '♕' : piece === 'r' ? '♖' : piece === 'b' ? '♗' : '♘'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
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
                {motionMode && gyroscopeData.isListening && (
                    <div className="text-xs text-blue-400 mt-1">
                        Motion Mode: Tilt to move cursor, shake to select
                    </div>
                )}
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
    const [mode, setMode] = useState<GameMode>('one');
    const [currentMoveIndex, setCurrentMoveIndex] = useState<number>(0);
    const [moves, setMoves] = useState<string[]>([]);
    const [motionMode, setMotionMode] = useState<boolean>(false);

    const gyroscope = useGyroscope();

    useEffect(() => {
        if (mode === 'engine-easy') {
            setPuzzles([]);
            setCurrentPuzzle(ENGINE_EASY_PUZZLE);
            setCurrentFen(ENGINE_EASY_PUZZLE.fen);
            setMoves([]);
            setCurrentMoveIndex(0);
            setFeedback('idle');
            return;
        }

        const csvFile = mode === 'one' ? 'test.csv' : 'test2.csv';
        fetch(csvFile)
            .then(res => res.text())
            .then(csv => {
                const parsed = parseCsv(csv);
                setPuzzles(parsed);
                const puzzle = getRandomPuzzle(parsed);
                setCurrentPuzzle(puzzle);
                setCurrentFen(puzzle.fen);
                setMoves(puzzle.best.split(' ').map(m => m.replace(/[+#]$/, '')));
                setCurrentMoveIndex(0);
            });
    }, [mode]);

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
        setCurrentMoveIndex(0);
        if (mode === 'engine-easy') {
            setCurrentPuzzle(ENGINE_EASY_PUZZLE);
            setCurrentFen(ENGINE_EASY_PUZZLE.fen);
            setMoves([]);
            return;
        }
        if (puzzles.length > 0) {
            const puzzle = getRandomPuzzle(puzzles);
            setCurrentPuzzle(puzzle);
            setCurrentFen(puzzle.fen);
            setMoves(puzzle.best.split(' ').map(m => m.replace(/[+#]$/, '')));
        }
    }, [mode, puzzles]);

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

    const toggleMotionMode = useCallback(async () => {
        if (!motionMode) {
            const granted = await gyroscope.requestAccess();
            if (granted) {
                setMotionMode(true);
            } else {
                alert('Gyroscope access denied or not supported.');
            }
        } else {
            gyroscope.stopListening();
            setMotionMode(false);
        }
    }, [motionMode, gyroscope]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 font-sans">
            <header className="text-center mb-6">
                <h1 className="text-4xl font-bold text-emerald-400">Chess Checkmate Puzzles</h1>
                <p className="text-slate-400 mt-2">
                    {mode === 'engine-easy' ? 'Play the easy engine · 800 Elo' : `Find the mate in ${mode === 'one' ? 'one' : 'two'}!`}
                </p>
                <div className="flex gap-2 mt-2">
                    <button
                        onClick={() => setMode(mode === 'one' ? 'two' : mode === 'two' ? 'engine-easy' : 'one')}
                        className="px-4 py-2 bg-slate-700 text-slate-300 font-bold rounded-lg hover:bg-slate-600"
                    >
                        Switch to {mode === 'one' ? 'Mate in Two' : mode === 'two' ? 'Easy Engine' : 'Mate in One'}
                    </button>
                    <button
                        onClick={toggleMotionMode}
                        className={`px-4 py-2 font-bold rounded-lg ${motionMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                        {motionMode ? 'Disable Motion' : 'Enable Motion'}
                    </button>
                </div>
                {gyroscope.error && <p className="text-red-400 mt-2">{gyroscope.error}</p>}
            </header>

            <main className="w-full max-w-xl bg-slate-800/50 rounded-2xl shadow-2xl p-4 md:p-6 flex flex-col items-center ring-1 ring-slate-700">
                {!currentPuzzle ? (
                    <div className="text-slate-400">Loading puzzle...</div>
                ) : (
                    <>
                        <Chessboard fen={currentFen}
                            currentPuzzle={currentPuzzle}
                            mode={mode}
                            currentMoveIndex={currentMoveIndex}
                            moves={moves}
                            setFeedback={setFeedback}
                            setIsAnswerVisible={setIsAnswerVisible}
                            setSolveTime={setSolveTime}
                            elapsedTime={elapsedTime}
                            showCongrats={showCongrats}
                            setShowCongrats={setShowCongrats}
                            setCurrentFen={setCurrentFen}
                            setCurrentMoveIndex={setCurrentMoveIndex}
                            motionMode={motionMode}
                            gyroscopeData={gyroscope}
                            requestGyroAccess={gyroscope.requestAccess}
                            stopGyroListening={gyroscope.stopListening}
                        />

                        {mode === 'two' && (
                           <div>
                            <button
                                onClick={loadNextPuzzle}
                                className="w-full mt-2 px-6 py-3 bg-slate-700 text-slate-300 font-bold rounded-lg hover:bg-slate-600"
                            >
                                New Puzzle
                            </button>
                            <button
                                onClick={handleShowAnswer}
                                className="w-full mt-2 px-6 py-3 bg-slate-700 text-slate-300 font-bold rounded-lg hover:bg-slate-600"
                            >
                                Show Answer
                            </button>
                            {isAnswerVisible && (
                                <p className="mt-4 text-lg text-amber-400 font-bold">
                                    Correct moves: <span className="font-mono">{currentPuzzle.best}</span>
                                </p>
                            )}
                            </div>

                        )}

                        {mode === 'one' && !motionMode && (
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
                        )}

                        {mode === 'engine-easy' && (
                            <div className="w-full max-w-sm mt-6 text-center text-slate-300">
                                <p className="text-sm">You play White. Click a piece, then its destination.</p>
                                <button
                                    onClick={loadNextPuzzle}
                                    className="w-full mt-4 px-6 py-3 bg-slate-700 text-slate-300 font-bold rounded-lg hover:bg-slate-600"
                                >
                                    Reset Game
                                </button>
                            </div>
                        )}
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
