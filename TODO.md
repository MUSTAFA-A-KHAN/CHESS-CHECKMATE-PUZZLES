# TODO: Implement Telegram Bot Backend for Chess Puzzle Screenshots

## Steps to Complete
- [x] Initialize Go module (go mod init chess-checkmate-puzzles-backend)
- [x] Install dependencies: go get github.com/go-telegram-bot-api/telegram-bot-api/v5, go get github.com/chromedp/chromedp
- [x] Implement Telegram bot in backend/main.go:
  - Set up bot with token from environment variable TELEGRAM_BOT_TOKEN
  - Handle /screenshot command
  - Use chromedp to navigate to http://localhost:3000, capture screenshot
  - Send the screenshot image to the Telegram chat
- [ ] Run the backend (go run backend/main.go)
- [ ] Test the bot by sending /screenshot in Telegram (ensure frontend is running on localhost:3000)
