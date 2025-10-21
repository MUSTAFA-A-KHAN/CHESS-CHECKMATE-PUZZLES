# TODO: Implement Chess Puzzle Guessing Game

## Step 1: Modify ProcessRandomCSVFile to return bestMove ✅
- Update the function to return the bestMove string along with generating the image.

## Step 2: Add game state management ✅
- Add global maps to track current bestMove per chat and user scores per chat per user.

## Step 3: Update /screenshot command to start a new puzzle ✅
- When /screenshot is received, generate puzzle, send image, store bestMove for the chat, and prompt user to guess.

## Step 4: Handle user guesses in message updates ✅
- For non-command messages, check if there's an active puzzle for the chat.
- If message matches bestMove, award point, send positive reaction, clear puzzle.
- If not, send negative reaction.

## Step 5: Add score tracking and display ✅
- Implement logic to increment scores on correct guesses.
- Add a /score command to display current scores for the chat.

## Step 6: Test the implementation
- Run the bot and test the game flow: start puzzle, guess correctly/incorrectly, check scores.
